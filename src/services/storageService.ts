import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { v4 as uuidv4 } from 'uuid'
import type {
  Esame,
  FileRecord,
  FlashcardStats,
  PausedSession,
  QuestionStats,
  QuizSession,
} from '../types'
import { encodeFileRecord } from './sync/serialization'
import {
  SYNC_SCHEMA_VERSION,
  type LocalSyncRecordMetadata,
  type RemoteSyncState,
  type SyncDirtyStore,
  type SyncMetadata,
  type SyncTombstone,
} from './sync/types'

const DB_NAME = 'study-app-db'
const DB_VERSION = 3
const SYNC_METADATA_ID = 'sync'

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
  syncMetadata: {
    key: string
    value: SyncMetadata
  }
  syncRecordMetadata: {
    key: string
    value: LocalSyncRecordMetadata
    indexes: { 'by-store': SyncDirtyStore }
  }
  syncTombstones: {
    key: string
    value: SyncTombstone
  }
}

type ExamScopedStoreName =
  | 'quizSessions'
  | 'questionStats'
  | 'flashcardStats'
  | 'pausedSessions'
type SyncMetadataTransaction = {
  objectStore(name: 'syncMetadata'): {
    get(key: typeof SYNC_METADATA_ID): Promise<SyncMetadata | undefined>
    put(value: SyncMetadata): Promise<unknown>
  }
}
type SyncDirtyTransaction = SyncMetadataTransaction & {
  objectStore(name: 'syncRecordMetadata'): {
    put(value: LocalSyncRecordMetadata): Promise<unknown>
  }
}

let dbPromise: Promise<IDBPDatabase<StudyAppDB>> | null = null

export async function resetForTesting(): Promise<void> {
  const existingDbPromise = dbPromise
  dbPromise = null

  if (!existingDbPromise) {
    return
  }

  const db = await existingDbPromise
  db.close()
}

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

      if (oldVersion < 3) {
        db.createObjectStore('syncMetadata', { keyPath: 'id' })

        const syncRecordMetadata = db.createObjectStore('syncRecordMetadata', { keyPath: 'id' })
        syncRecordMetadata.createIndex('by-store', 'store')

        db.createObjectStore('syncTombstones', { keyPath: 'id' })
      }
    },
  })

  return dbPromise
}

function newSyncMetadata(): SyncMetadata {
  return {
    id: SYNC_METADATA_ID,
    deviceId: uuidv4(),
    lastSyncedAt: null,
    lastRemoteRevision: null,
    pendingLocalChanges: false,
    syncSchemaVersion: SYNC_SCHEMA_VERSION,
    account: null,
  }
}

function syncRecordMetadataId(store: SyncDirtyStore, recordId: string): string {
  return `${store}__${recordId}`
}

async function getOrCreateSyncMetadataInTransaction(
  tx: SyncMetadataTransaction,
): Promise<SyncMetadata> {
  const metadataStore = tx.objectStore('syncMetadata')
  const existing = await metadataStore.get(SYNC_METADATA_ID)

  if (existing) {
    return existing
  }

  const metadata = newSyncMetadata()
  await metadataStore.put(metadata)
  return metadata
}

async function markRecordDirtyInTransaction(
  tx: SyncDirtyTransaction,
  store: SyncDirtyStore,
  recordId: string,
  nowIso = new Date().toISOString(),
): Promise<SyncMetadata> {
  const metadata = await getOrCreateSyncMetadataInTransaction(tx)
  const dirtyMetadata: SyncMetadata = {
    ...metadata,
    pendingLocalChanges: true,
    syncSchemaVersion: SYNC_SCHEMA_VERSION,
  }

  await Promise.all([
    tx.objectStore('syncMetadata').put(dirtyMetadata),
    tx.objectStore('syncRecordMetadata').put({
      id: syncRecordMetadataId(store, recordId),
      store,
      recordId,
      updatedAt: nowIso,
      updatedByDeviceId: metadata.deviceId,
    }),
  ])

  return dirtyMetadata
}

async function markRecordDirty(store: SyncDirtyStore, recordId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['syncMetadata', 'syncRecordMetadata'], 'readwrite')
  await markRecordDirtyInTransaction(tx, store, recordId)
  await tx.done
}

export async function getSyncMetadata(): Promise<SyncMetadata> {
  const db = await getDB()
  const tx = db.transaction('syncMetadata', 'readwrite')
  const metadata = await getOrCreateSyncMetadataInTransaction(tx)
  await tx.done
  return metadata
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
  await markRecordDirty('esami', esame.id)
}

export async function replaceQuizFileForExam(examId: string, file: FileRecord): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['esami', 'quizSessions', 'questionStats', 'pausedSessions', 'syncMetadata', 'syncRecordMetadata'],
    'readwrite',
  )

  const examStore = tx.objectStore('esami')
  const quizSessions = tx.objectStore('quizSessions')
  const questionStats = tx.objectStore('questionStats')
  const pausedSessions = tx.objectStore('pausedSessions')
  const existingExam = await examStore.get(examId)

  if (!existingExam) {
    throw new Error(`Exam ${examId} not found`)
  }

  const [quizRecords, questionRecords] = await Promise.all([
    quizSessions.index('by-examId').getAll(examId),
    questionStats.index('by-examId').getAll(examId),
  ])

  await examStore.put({
    ...existingExam,
    files: {
      ...existingExam.files,
      quiz: file,
    },
  })
  await markRecordDirtyInTransaction(tx, 'esami', examId)
  await Promise.all([
    ...quizRecords.map((record) => quizSessions.delete(record.id)),
    ...questionRecords.map((record) => questionStats.delete(record.id)),
    pausedSessions.delete(`${examId}__quiz`),
  ])
  await tx.done
}

export async function replaceFlashcardFileForExam(
  examId: string,
  file: FileRecord,
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['esami', 'flashcardStats', 'pausedSessions', 'syncMetadata', 'syncRecordMetadata'],
    'readwrite',
  )

  const examStore = tx.objectStore('esami')
  const flashcardStats = tx.objectStore('flashcardStats')
  const pausedSessions = tx.objectStore('pausedSessions')
  const existingExam = await examStore.get(examId)

  if (!existingExam) {
    throw new Error(`Exam ${examId} not found`)
  }

  const statsRecords = await flashcardStats.index('by-examId').getAll(examId)

  await examStore.put({
    ...existingExam,
    files: {
      ...existingExam.files,
      flashcard: file,
    },
  })
  await markRecordDirtyInTransaction(tx, 'esami', examId)
  await Promise.all([
    ...statsRecords.map((record) => flashcardStats.delete(record.id)),
    pausedSessions.delete(`${examId}__flashcard`),
  ])
  await tx.done
}

export async function deleteEsame(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    [
      'esami',
      'quizSessions',
      'questionStats',
      'flashcardStats',
      'pausedSessions',
      'syncMetadata',
      'syncRecordMetadata',
      'syncTombstones',
    ],
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
  const metadata = await markRecordDirtyInTransaction(tx, 'esami', id)
  await tx.objectStore('syncTombstones').put({
    id,
    kind: 'exam',
    deletedAt: new Date().toISOString(),
    deletedByDeviceId: metadata.deviceId,
  })
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
  await markRecordDirty('quizSessions', session.id)
}

export async function deleteQuizSessionsForExam(examId: string): Promise<void> {
  await deleteExamScopedRecords('quizSessions', examId)
}

export async function getQuestionStats(examId: string): Promise<QuestionStats[]> {
  return (await getDB()).getAllFromIndex('questionStats', 'by-examId', examId)
}

export async function saveQuestionStat(stat: QuestionStats): Promise<void> {
  await (await getDB()).put('questionStats', stat)
  await markRecordDirty('questionStats', stat.id)
}

export async function deleteQuestionStatsForExam(examId: string): Promise<void> {
  await deleteExamScopedRecords('questionStats', examId)
}

export async function getFlashcardStats(examId: string): Promise<FlashcardStats[]> {
  return (await getDB()).getAllFromIndex('flashcardStats', 'by-examId', examId)
}

export async function saveFlashcardStat(stat: FlashcardStats): Promise<void> {
  await (await getDB()).put('flashcardStats', stat)
  await markRecordDirty('flashcardStats', stat.id)
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

export async function exportLocalSyncState(): Promise<{
  state: RemoteSyncState
  revision: string | null
}> {
  const db = await getDB()
  const metadata = await getSyncMetadata()
  const [esami, quizSessions, questionStats, flashcardStats, recordMetadata, tombstones] =
    await Promise.all([
      db.getAll('esami'),
      db.getAll('quizSessions'),
      db.getAll('questionStats'),
      db.getAll('flashcardStats'),
      db.getAll('syncRecordMetadata'),
      db.getAll('syncTombstones'),
    ])
  const metadataByRecord = new Map(recordMetadata.map((entry) => [entry.id, entry]))
  const getRecordMetadata = (store: SyncDirtyStore, recordId: string) =>
    metadataByRecord.get(syncRecordMetadataId(store, recordId))

  return {
    state: {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      writerDeviceId: metadata.deviceId,
      data: {
        esami: esami.map((esame) => {
          const syncMetadata = getRecordMetadata('esami', esame.id)

          return {
            ...esame,
            files: Object.fromEntries(
              Object.entries(esame.files).map(([slot, file]) => [slot, encodeFileRecord(file)]),
            ),
            updatedAt: syncMetadata?.updatedAt ?? esame.createdAt,
            updatedByDeviceId: syncMetadata?.updatedByDeviceId ?? metadata.deviceId,
          }
        }),
        quizSessions: quizSessions.map((session) => ({
          ...session,
          updatedByDeviceId:
            getRecordMetadata('quizSessions', session.id)?.updatedByDeviceId ?? metadata.deviceId,
        })),
        questionStats: questionStats.map(({ timesShown, timesCorrect, ...stat }) => ({
          ...stat,
          deviceCounters: {
            [metadata.deviceId]: {
              timesShown,
              timesCorrect,
            },
          },
        })),
        flashcardStats: flashcardStats.map((stat) => ({
          ...stat,
          updatedByDeviceId:
            getRecordMetadata('flashcardStats', stat.id)?.updatedByDeviceId ?? metadata.deviceId,
        })),
      },
      tombstones,
    },
    revision: metadata.lastRemoteRevision,
  }
}
