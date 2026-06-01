import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  Esame,
  FlashcardStats,
  PausedSession,
  QuestionStats,
  QuizSession,
} from '../types'

const DB_NAME = 'study-app-db'
const DB_VERSION = 2

interface StudyAppDB extends DBSchema {
  esami: {
    key: string
    value: Esame
  }
  quizSessions: {
    key: string
    value: QuizSession
    indexes: { 'by-examId': string }
  }
  questionStats: {
    key: string
    value: QuestionStats
    indexes: { 'by-examId': string }
  }
  flashcardStats: {
    key: string
    value: FlashcardStats
    indexes: { 'by-examId': string }
  }
  pausedSessions: {
    key: string
    value: PausedSession
    indexes: { 'by-examId': string }
  }
}

type ExamScopedStoreName =
  | 'quizSessions'
  | 'questionStats'
  | 'flashcardStats'
  | 'pausedSessions'

let dbPromise: Promise<IDBPDatabase<StudyAppDB>> | null = null

function getDB(): Promise<IDBPDatabase<StudyAppDB>> {
  dbPromise ??= openDB<StudyAppDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('esami', { keyPath: 'id' })

        const quizSessions = db.createObjectStore('quizSessions', { keyPath: 'id' })
        quizSessions.createIndex('by-examId', 'examId')

        const questionStats = db.createObjectStore('questionStats', { keyPath: 'id' })
        questionStats.createIndex('by-examId', 'examId')

        const flashcardStats = db.createObjectStore('flashcardStats', { keyPath: 'id' })
        flashcardStats.createIndex('by-examId', 'examId')
      }

      if (oldVersion < 2) {
        const pausedSessions = db.createObjectStore('pausedSessions', { keyPath: 'id' })
        pausedSessions.createIndex('by-examId', 'examId')
      }
    },
  })

  return dbPromise
}

async function deleteExamScopedRecordsFromStore(
  db: IDBPDatabase<StudyAppDB>,
  storeName: ExamScopedStoreName,
  examId: string,
): Promise<void> {
  const tx = db.transaction(storeName, 'readwrite')
  const records = await tx.store.index('by-examId').getAll(examId)
  await Promise.all(records.map((record) => tx.store.delete(record.id)))
  await tx.done
}

async function deleteExamScopedRecords(
  storeName: ExamScopedStoreName,
  examId: string,
): Promise<void> {
  const db = await getDB()
  await deleteExamScopedRecordsFromStore(db, storeName, examId)
}

export async function getAllEsami(): Promise<Esame[]> {
  return (await getDB()).getAll('esami')
}

export async function getEsame(id: string): Promise<Esame | undefined> {
  return (await getDB()).get('esami', id)
}

export async function saveEsame(esame: Esame): Promise<void> {
  await (await getDB()).put('esami', esame)
}

export async function deleteEsame(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['esami', 'quizSessions', 'questionStats', 'flashcardStats', 'pausedSessions'],
    'readwrite',
  )

  const quizSessions = tx.objectStore('quizSessions')
  const questionStats = tx.objectStore('questionStats')
  const flashcardStats = tx.objectStore('flashcardStats')
  const pausedSessions = tx.objectStore('pausedSessions')

  const [
    quizRecords,
    questionRecords,
    flashcardRecords,
    pausedRecords,
  ] = await Promise.all([
    quizSessions.index('by-examId').getAll(id),
    questionStats.index('by-examId').getAll(id),
    flashcardStats.index('by-examId').getAll(id),
    pausedSessions.index('by-examId').getAll(id),
  ])

  await tx.objectStore('esami').delete(id)
  await Promise.all([
    ...quizRecords.map((record) => quizSessions.delete(record.id)),
    ...questionRecords.map((record) => questionStats.delete(record.id)),
    ...flashcardRecords.map((record) => flashcardStats.delete(record.id)),
    ...pausedRecords.map((record) => pausedSessions.delete(record.id)),
  ])
  await tx.done
}

export async function getQuizSessions(examId: string): Promise<QuizSession[]> {
  return (await getDB()).getAllFromIndex('quizSessions', 'by-examId', examId)
}

export async function saveQuizSession(session: QuizSession): Promise<void> {
  await (await getDB()).put('quizSessions', session)
}

export async function deleteQuizSessionsForExam(examId: string): Promise<void> {
  await deleteExamScopedRecords('quizSessions', examId)
}

export async function getQuestionStats(examId: string): Promise<QuestionStats[]> {
  return (await getDB()).getAllFromIndex('questionStats', 'by-examId', examId)
}

export async function saveQuestionStat(stat: QuestionStats): Promise<void> {
  await (await getDB()).put('questionStats', stat)
}

export async function deleteQuestionStatsForExam(examId: string): Promise<void> {
  await deleteExamScopedRecords('questionStats', examId)
}

export async function getFlashcardStats(examId: string): Promise<FlashcardStats[]> {
  return (await getDB()).getAllFromIndex('flashcardStats', 'by-examId', examId)
}

export async function saveFlashcardStat(stat: FlashcardStats): Promise<void> {
  await (await getDB()).put('flashcardStats', stat)
}

export async function deleteFlashcardStatsForExam(examId: string): Promise<void> {
  await deleteExamScopedRecords('flashcardStats', examId)
}

export async function getPausedSession(id: string): Promise<PausedSession | undefined> {
  return (await getDB()).get('pausedSessions', id)
}

export async function savePausedSession(ps: PausedSession): Promise<void> {
  await (await getDB()).put('pausedSessions', ps)
}

export async function deletePausedSession(id: string): Promise<void> {
  await (await getDB()).delete('pausedSessions', id)
}

export async function getPausedSessionsForExam(examId: string): Promise<PausedSession[]> {
  return (await getDB()).getAllFromIndex('pausedSessions', 'by-examId', examId)
}

export async function __resetStorageServiceForTests(): Promise<void> {
  if (!dbPromise) return

  const db = await dbPromise
  db.close()
  dbPromise = null
}
