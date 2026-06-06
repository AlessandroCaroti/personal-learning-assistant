import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeEsame, makePausedFlash, makePausedQuiz, makeQuizSession } from '../__tests__/factories'
import { resetDb } from '../__tests__/resetDb'
import type { FileRecord, FlashcardStats, QuestionStats } from '../types'
import { SYNC_SCHEMA_VERSION } from './sync/types'
import {
  deleteEsame,
  deleteFlashcardStatsForExam,
  deletePausedSession,
  deleteQuestionStatsForExam,
  deleteQuizSessionsForExam,
  exportLocalSyncState,
  getAllEsami,
  getEsame,
  getFlashcardStats,
  getPausedSession,
  getPausedSessionsForExam,
  getQuestionStats,
  getQuizSessions,
  getSyncMetadata,
  replaceFlashcardFileForExam,
  replaceQuizFileForExam,
  saveEsame,
  saveFlashcardStat,
  savePausedSession,
  saveQuestionStat,
  saveQuizSession,
} from './storageService'

const exam = makeEsame({
  id: 'exam-1',
  name: 'Diritto privato',
  createdAt: '2026-06-01T10:00:00.000Z',
})

const otherExam = makeEsame({
  id: 'exam-2',
  name: 'Economia',
  createdAt: '2026-06-01T11:00:00.000Z',
})

function questionStat(overrides: Partial<QuestionStats> = {}): QuestionStats {
  return {
    id: 'exam-1__q1',
    examId: 'exam-1',
    questionId: 'q1',
    timesShown: 2,
    timesCorrect: 1,
    ...overrides,
  }
}

function flashcardStat(overrides: Partial<FlashcardStats> = {}): FlashcardStats {
  return {
    id: 'exam-1__f1',
    examId: 'exam-1',
    cardId: 'f1',
    lastEval: 'Sì',
    lastSeen: '2026-06-01T12:30:00.000Z',
    ...overrides,
  }
}

function fileRecord(name: string): FileRecord {
  const bytes = new TextEncoder().encode(name)

  return {
    name,
    type: 'application/json',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}

function byId<T extends { id: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => a.id.localeCompare(b.id))
}

async function withRawDb<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  callback: (db: IDBDatabase, tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('study-app-db')

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open raw test DB'))
  })

  try {
    const tx = db.transaction(storeNames, mode)
    const result = await callback(db, tx)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Raw test transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('Raw test transaction aborted'))
    })
    return result
  } finally {
    db.close()
  }
}

function rawRequestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Raw test request failed'))
  })
}

describe('storageService', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('returns empty exam results for an empty database and undefined for unknown ids', async () => {
    await expect(getAllEsami()).resolves.toEqual([])
    await expect(getEsame('unknown-exam')).resolves.toBeUndefined()
  })

  it('creates, reads, updates, lists, and deletes exams', async () => {
    const updatedExam = {
      ...exam,
      name: 'Diritto privato aggiornato',
      files: {
        quiz: fileRecord('quiz.json'),
      },
    }

    await saveEsame(exam)
    await saveEsame(otherExam)
    await saveEsame(updatedExam)

    await expect(getEsame(exam.id)).resolves.toEqual(updatedExam)
    await expect(getAllEsami()).resolves.toEqual([updatedExam, otherExam])

    await deleteEsame(exam.id)

    await expect(getEsame(exam.id)).resolves.toBeUndefined()
    await expect(getAllEsami()).resolves.toEqual([otherExam])
  })

  it('deletes an exam and cascades only records for that exam', async () => {
    const examQuiz = makeQuizSession({ id: 'quiz-1', examId: exam.id })
    const otherQuiz = makeQuizSession({ id: 'quiz-2', examId: otherExam.id })
    const examQuestion = questionStat({ id: 'exam-1__q1', examId: exam.id })
    const otherQuestion = questionStat({ id: 'exam-2__q1', examId: otherExam.id })
    const examFlashcard = flashcardStat({ id: 'exam-1__f1', examId: exam.id })
    const otherFlashcard = flashcardStat({ id: 'exam-2__f1', examId: otherExam.id })
    const examPausedQuiz = makePausedQuiz({ id: 'exam-1__quiz', examId: exam.id })
    const examPausedFlash = makePausedFlash({ id: 'exam-1__flashcard', examId: exam.id })
    const otherPausedQuiz = makePausedQuiz({ id: 'exam-2__quiz', examId: otherExam.id })

    await saveEsame(exam)
    await saveEsame(otherExam)
    await saveQuizSession(examQuiz)
    await saveQuizSession(otherQuiz)
    await saveQuestionStat(examQuestion)
    await saveQuestionStat(otherQuestion)
    await saveFlashcardStat(examFlashcard)
    await saveFlashcardStat(otherFlashcard)
    await savePausedSession(examPausedQuiz)
    await savePausedSession(examPausedFlash)
    await savePausedSession(otherPausedQuiz)

    await deleteEsame(exam.id)

    await expect(getEsame(exam.id)).resolves.toBeUndefined()
    await expect(getEsame(otherExam.id)).resolves.toEqual(otherExam)
    await expect(getQuizSessions(exam.id)).resolves.toEqual([])
    await expect(getQuestionStats(exam.id)).resolves.toEqual([])
    await expect(getFlashcardStats(exam.id)).resolves.toEqual([])
    await expect(getPausedSessionsForExam(exam.id)).resolves.toEqual([])
    await expect(getQuizSessions(otherExam.id)).resolves.toEqual([otherQuiz])
    await expect(getQuestionStats(otherExam.id)).resolves.toEqual([otherQuestion])
    await expect(getFlashcardStats(otherExam.id)).resolves.toEqual([otherFlashcard])
    await expect(getPausedSessionsForExam(otherExam.id)).resolves.toEqual([otherPausedQuiz])
  })

  it('creates, updates, filters, and deletes quiz sessions by exam', async () => {
    const original = makeQuizSession({ id: 'quiz-1', examId: exam.id, score: 6 })
    const updated = makeQuizSession({ id: 'quiz-1', examId: exam.id, score: 9 })
    const other = makeQuizSession({ id: 'quiz-2', examId: otherExam.id, score: 7 })

    await saveQuizSession(original)
    await saveQuizSession(other)
    await saveQuizSession(updated)

    await expect(getQuizSessions(exam.id)).resolves.toEqual([updated])
    await expect(getQuizSessions(otherExam.id)).resolves.toEqual([other])

    await deleteQuizSessionsForExam(exam.id)

    await expect(getQuizSessions(exam.id)).resolves.toEqual([])
    await expect(getQuizSessions(otherExam.id)).resolves.toEqual([other])
  })

  it('creates, updates, filters, and deletes question stats by exam', async () => {
    const original = questionStat({ id: 'exam-1__q1', examId: exam.id, timesShown: 1 })
    const updated = questionStat({ id: 'exam-1__q1', examId: exam.id, timesShown: 3 })
    const other = questionStat({ id: 'exam-2__q1', examId: otherExam.id })

    await saveQuestionStat(original)
    await saveQuestionStat(other)
    await saveQuestionStat(updated)

    await expect(getQuestionStats(exam.id)).resolves.toEqual([updated])
    await expect(getQuestionStats(otherExam.id)).resolves.toEqual([other])

    await deleteQuestionStatsForExam(exam.id)

    await expect(getQuestionStats(exam.id)).resolves.toEqual([])
    await expect(getQuestionStats(otherExam.id)).resolves.toEqual([other])
  })

  it('creates, updates, filters, and deletes flashcard stats by exam', async () => {
    const original = flashcardStat({ id: 'exam-1__f1', examId: exam.id, lastEval: 'No' })
    const updated = flashcardStat({ id: 'exam-1__f1', examId: exam.id, lastEval: 'In parte' })
    const other = flashcardStat({ id: 'exam-2__f1', examId: otherExam.id })

    await saveFlashcardStat(original)
    await saveFlashcardStat(other)
    await saveFlashcardStat(updated)

    await expect(getFlashcardStats(exam.id)).resolves.toEqual([updated])
    await expect(getFlashcardStats(otherExam.id)).resolves.toEqual([other])

    await deleteFlashcardStatsForExam(exam.id)

    await expect(getFlashcardStats(exam.id)).resolves.toEqual([])
    await expect(getFlashcardStats(otherExam.id)).resolves.toEqual([other])
  })

  it('gets, saves, updates, deletes, and filters paused quiz and flashcard sessions', async () => {
    await expect(getPausedSession('unknown-session')).resolves.toBeUndefined()

    const quiz = makePausedQuiz({
      id: 'exam-1__quiz',
      examId: exam.id,
      elapsedSeconds: 30,
    })
    const updatedQuiz = makePausedQuiz({
      id: 'exam-1__quiz',
      examId: exam.id,
      elapsedSeconds: 75,
      currentQuestionIndex: 2,
    })
    const flashcard = makePausedFlash({
      id: 'exam-1__flashcard',
      examId: exam.id,
      currentCardIndex: 1,
    })
    const otherQuiz = makePausedQuiz({
      id: 'exam-2__quiz',
      examId: otherExam.id,
    })

    await savePausedSession(quiz)
    await savePausedSession(flashcard)
    await savePausedSession(otherQuiz)
    await savePausedSession(updatedQuiz)

    await expect(getPausedSession('exam-1__quiz')).resolves.toEqual(updatedQuiz)
    await expect(getPausedSession('exam-1__flashcard')).resolves.toEqual(flashcard)
    expect(byId(await getPausedSessionsForExam(exam.id))).toEqual(byId([updatedQuiz, flashcard]))
    await expect(getPausedSessionsForExam(otherExam.id)).resolves.toEqual([otherQuiz])

    await deletePausedSession('exam-1__quiz')

    await expect(getPausedSession('exam-1__quiz')).resolves.toBeUndefined()
    await expect(getPausedSessionsForExam(exam.id)).resolves.toEqual([flashcard])
    await expect(getPausedSessionsForExam(otherExam.id)).resolves.toEqual([otherQuiz])
  })

  it('replaces a quiz file and deletes only quiz-scoped progress', async () => {
    const existingExam = {
      ...exam,
      files: {
        quiz: fileRecord('old-quiz.json'),
        flashcard: fileRecord('flashcard.json'),
      },
    }
    const replacement = fileRecord('new-quiz.json')
    const quiz = makeQuizSession({ id: 'quiz-1', examId: exam.id })
    const otherQuiz = makeQuizSession({ id: 'quiz-2', examId: otherExam.id })
    const question = questionStat({ id: 'exam-1__q1', examId: exam.id })
    const otherQuestion = questionStat({ id: 'exam-2__q1', examId: otherExam.id })
    const flashcard = flashcardStat({ id: 'exam-1__f1', examId: exam.id })
    const pausedQuiz = makePausedQuiz({ id: 'exam-1__quiz', examId: exam.id })
    const pausedFlash = makePausedFlash({ id: 'exam-1__flashcard', examId: exam.id })

    await saveEsame(existingExam)
    await saveQuizSession(quiz)
    await saveQuizSession(otherQuiz)
    await saveQuestionStat(question)
    await saveQuestionStat(otherQuestion)
    await saveFlashcardStat(flashcard)
    await savePausedSession(pausedQuiz)
    await savePausedSession(pausedFlash)

    await replaceQuizFileForExam(exam.id, replacement)

    await expect(getEsame(exam.id)).resolves.toEqual({
      ...existingExam,
      files: {
        ...existingExam.files,
        quiz: replacement,
      },
    })
    await expect(getQuizSessions(exam.id)).resolves.toEqual([])
    await expect(getQuestionStats(exam.id)).resolves.toEqual([])
    await expect(getPausedSession('exam-1__quiz')).resolves.toBeUndefined()
    await expect(getFlashcardStats(exam.id)).resolves.toEqual([flashcard])
    await expect(getPausedSession('exam-1__flashcard')).resolves.toEqual(pausedFlash)
    await expect(getQuizSessions(otherExam.id)).resolves.toEqual([otherQuiz])
    await expect(getQuestionStats(otherExam.id)).resolves.toEqual([otherQuestion])
  })

  it('replaces a flashcard file and deletes only flashcard-scoped progress', async () => {
    const existingExam = {
      ...exam,
      files: {
        quiz: fileRecord('quiz.json'),
        flashcard: fileRecord('old-flashcard.json'),
      },
    }
    const replacement = fileRecord('new-flashcard.json')
    const quiz = makeQuizSession({ id: 'quiz-1', examId: exam.id })
    const question = questionStat({ id: 'exam-1__q1', examId: exam.id })
    const flashcard = flashcardStat({ id: 'exam-1__f1', examId: exam.id })
    const otherFlashcard = flashcardStat({ id: 'exam-2__f1', examId: otherExam.id })
    const pausedQuiz = makePausedQuiz({ id: 'exam-1__quiz', examId: exam.id })
    const pausedFlash = makePausedFlash({ id: 'exam-1__flashcard', examId: exam.id })

    await saveEsame(existingExam)
    await saveQuizSession(quiz)
    await saveQuestionStat(question)
    await saveFlashcardStat(flashcard)
    await saveFlashcardStat(otherFlashcard)
    await savePausedSession(pausedQuiz)
    await savePausedSession(pausedFlash)

    await replaceFlashcardFileForExam(exam.id, replacement)

    await expect(getEsame(exam.id)).resolves.toEqual({
      ...existingExam,
      files: {
        ...existingExam.files,
        flashcard: replacement,
      },
    })
    await expect(getFlashcardStats(exam.id)).resolves.toEqual([])
    await expect(getPausedSession('exam-1__flashcard')).resolves.toBeUndefined()
    await expect(getQuizSessions(exam.id)).resolves.toEqual([quiz])
    await expect(getQuestionStats(exam.id)).resolves.toEqual([question])
    await expect(getPausedSession('exam-1__quiz')).resolves.toEqual(pausedQuiz)
    await expect(getFlashcardStats(otherExam.id)).resolves.toEqual([otherFlashcard])
  })

  it('rejects replacement when the exam is missing', async () => {
    await expect(replaceQuizFileForExam('missing', fileRecord('quiz.json'))).rejects.toThrow(
      'Exam missing not found',
    )
    await expect(replaceFlashcardFileForExam('missing', fileRecord('flashcard.json'))).rejects.toThrow(
      'Exam missing not found',
    )
  })

  it('creates stable sync metadata with a device id', async () => {
    const metadata = await getSyncMetadata()
    const reread = await getSyncMetadata()

    expect(metadata).toEqual({
      id: 'sync',
      deviceId: expect.any(String),
      lastSyncedAt: null,
      lastRemoteRevision: null,
      pendingLocalChanges: false,
      syncSchemaVersion: SYNC_SCHEMA_VERSION,
      account: null,
    })
    expect(metadata.deviceId).not.toHaveLength(0)
    expect(reread.deviceId).toBe(metadata.deviceId)
  })

  it('marks syncable writes as pending local changes', async () => {
    await expect(getSyncMetadata()).resolves.toMatchObject({
      pendingLocalChanges: false,
    })

    await saveEsame(exam)

    await expect(getSyncMetadata()).resolves.toMatchObject({
      pendingLocalChanges: true,
    })
  })

  it('marks quiz session writes as dirty sync records', async () => {
    const session = makeQuizSession({ id: 'quiz-dirty', examId: exam.id })

    await saveQuizSession(session)

    const { state } = await exportLocalSyncState()
    const metadata = await getSyncMetadata()
    expect(metadata.pendingLocalChanges).toBe(true)
    expect(state.data.quizSessions).toEqual([
      {
        ...session,
        updatedByDeviceId: metadata.deviceId,
      },
    ])
  })

  it('marks question stat writes as dirty sync records and preserves local device counters', async () => {
    const original = questionStat({ timesShown: 5, timesCorrect: 3 })
    const updated = questionStat({ timesShown: 7, timesCorrect: 4 })

    await saveQuestionStat(original)
    await saveQuestionStat(updated)

    const { state } = await exportLocalSyncState()
    const metadata = await getSyncMetadata()
    expect(metadata.pendingLocalChanges).toBe(true)
    expect(state.data.questionStats).toEqual([
      {
        id: updated.id,
        examId: updated.examId,
        questionId: updated.questionId,
        deviceCounters: {
          [metadata.deviceId]: {
            timesShown: 7,
            timesCorrect: 4,
          },
        },
      },
    ])
  })

  it('exports preserved per-device question counters instead of relabeling aggregate stats', async () => {
    const aggregate = questionStat({ timesShown: 12, timesCorrect: 8 })

    await saveQuestionStat(aggregate)
    const metadata = await getSyncMetadata()
    await withRawDb(
      ['questionStats', 'syncQuestionCounters'],
      'readwrite',
      async (_db, tx) => {
        tx.objectStore('questionStats').put({
          ...aggregate,
          timesShown: 20,
          timesCorrect: 13,
        })
        tx.objectStore('syncQuestionCounters').put({
          id: `${aggregate.id}__remote-device`,
          questionStatId: aggregate.id,
          deviceId: 'remote-device',
          timesShown: 8,
          timesCorrect: 5,
        })
      },
    )

    const { state } = await exportLocalSyncState()

    expect(state.data.questionStats).toEqual([
      {
        id: aggregate.id,
        examId: aggregate.examId,
        questionId: aggregate.questionId,
        deviceCounters: {
          [metadata.deviceId]: {
            timesShown: 12,
            timesCorrect: 8,
          },
          'remote-device': {
            timesShown: 8,
            timesCorrect: 5,
          },
        },
      },
    ])
  })

  it('marks flashcard stat writes as dirty sync records', async () => {
    const stat = flashcardStat({ id: 'exam-1__f-dirty' })

    await saveFlashcardStat(stat)

    const { state } = await exportLocalSyncState()
    const metadata = await getSyncMetadata()
    expect(metadata.pendingLocalChanges).toBe(true)
    expect(state.data.flashcardStats).toEqual([
      {
        ...stat,
        updatedByDeviceId: metadata.deviceId,
      },
    ])
  })

  it('marks replacement writes as dirty exam sync records', async () => {
    await saveEsame(exam)
    const beforeReplacement = await exportLocalSyncState()
    await new Promise((resolve) => setTimeout(resolve, 1))

    await replaceQuizFileForExam(exam.id, fileRecord('replacement-quiz.json'))

    const { state } = await exportLocalSyncState()
    const metadata = await getSyncMetadata()
    expect(metadata.pendingLocalChanges).toBe(true)
    expect(state.data.esami).toEqual([
      expect.objectContaining({
        id: exam.id,
        updatedByDeviceId: metadata.deviceId,
      }),
    ])
    expect(state.data.esami[0].updatedAt).not.toBe(beforeReplacement.state.data.esami[0].updatedAt)
  })

  it('exports delete tombstones without stale live exam metadata', async () => {
    await saveEsame(exam)

    await deleteEsame(exam.id)

    const { state } = await exportLocalSyncState()
    const metadata = await getSyncMetadata()
    const staleLiveMetadata = await withRawDb(
      ['syncRecordMetadata'],
      'readonly',
      async (_db, tx) =>
        rawRequestResult(tx.objectStore('syncRecordMetadata').get(`esami__${exam.id}`)),
    )
    expect(state.data.esami).toEqual([])
    expect(staleLiveMetadata).toBeUndefined()
    expect(state.tombstones).toEqual([
      {
        id: exam.id,
        kind: 'exam',
        deletedAt: expect.any(String),
        deletedByDeviceId: metadata.deviceId,
      },
    ])
  })

  it('exports syncable data and excludes paused sessions', async () => {
    const examWithFiles = {
      ...exam,
      files: {
        quiz: fileRecord('quiz.json'),
      },
    }
    const quizSession = makeQuizSession({ id: 'quiz-1', examId: exam.id })
    const question = questionStat({ id: 'exam-1__q1', examId: exam.id })
    const flashcard = flashcardStat({ id: 'exam-1__f1', examId: exam.id })
    const pausedOnlyMarker = 'PAUSED_ONLY_MARKER_SHOULD_NOT_EXPORT'
    const pausedQuiz = makePausedQuiz({
      id: 'exam-1__quiz',
      examId: exam.id,
      macroargomenti: [pausedOnlyMarker],
      questionIds: [pausedOnlyMarker],
    })

    await saveEsame(examWithFiles)
    await saveQuizSession(quizSession)
    await saveQuestionStat(question)
    await saveFlashcardStat(flashcard)
    await savePausedSession(pausedQuiz)

    const { state, revision } = await exportLocalSyncState()
    const metadata = await getSyncMetadata()

    expect(revision).toBeNull()
    expect(state.syncVersion).toBe(SYNC_SCHEMA_VERSION)
    expect(state.writerDeviceId).toBe(metadata.deviceId)
    expect(state.data.esami).toEqual([
      {
        ...examWithFiles,
        files: {
          quiz: {
            name: 'quiz.json',
            type: 'application/json',
            dataBase64: 'cXVpei5qc29u',
          },
        },
        updatedAt: expect.any(String),
        updatedByDeviceId: metadata.deviceId,
      },
    ])
    expect(state.data.quizSessions).toEqual([
      {
        ...quizSession,
        updatedByDeviceId: metadata.deviceId,
      },
    ])
    expect(state.data.questionStats).toEqual([
      {
        id: question.id,
        examId: question.examId,
        questionId: question.questionId,
        deviceCounters: {
          [metadata.deviceId]: {
            timesShown: question.timesShown,
            timesCorrect: question.timesCorrect,
          },
        },
      },
    ])
    expect(state.data.flashcardStats).toEqual([
      {
        ...flashcard,
        updatedByDeviceId: metadata.deviceId,
      },
    ])
    expect(state.tombstones).toEqual([])
    expect(JSON.stringify(state)).not.toContain(pausedOnlyMarker)
  })
})
