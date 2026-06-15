import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makeEsame,
  makeExamAttachment,
  makeExamDate,
  makePausedFlash,
  makePausedQuiz,
  makeQuizSession,
} from '../__tests__/factories'
import { resetDb } from '../__tests__/resetDb'
import type {
  Esame,
  ExamAttachment,
  FileRecord,
  FlashcardStats,
  PausedSession,
  QuestionStats,
  QuizSession,
} from '../types'
import { SYNC_SCHEMA_VERSION, type RemoteSyncState } from './sync/types'
import {
  deleteEsame,
  deleteFlashcardStatsForExam,
  deletePausedSession,
  deleteQuestionStatsForExam,
  deleteQuizSessionsForExam,
  exportLocalSyncState,
  getAllEsami,
  getExamBackupSourceBundle,
  getEsame,
  getFlashcardStats,
  importMergedSyncState,
  getPausedSession,
  getPausedSessionsForExam,
  getQuestionStats,
  getQuizSessions,
  getSyncMetadata,
  replaceFlashcardFileForExam,
  replaceQuizFileForExam,
  saveEsame,
  saveImportedExamBackupBundle,
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

function attachmentRecord(overrides: Partial<ExamAttachment> = {}): ExamAttachment {
  const bytes = new TextEncoder().encode(overrides.name ?? 'archive.pdf')

  return {
    id: 'attachment-1',
    name: 'archive.pdf',
    type: 'application/pdf',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    createdAt: '2026-06-13T09:00:00.000Z',
    ...overrides,
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

async function markSyncMetadataCleanForTest(): Promise<void> {
  const metadata = await getSyncMetadata()

  await withRawDb(['syncMetadata'], 'readwrite', async (_db, tx) => {
    tx.objectStore('syncMetadata').put({
      ...metadata,
      pendingLocalChanges: false,
    })
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

  it('persists exam attachments without changing study file slots', async () => {
    const attachment = attachmentRecord()
    const examWithAttachment: Esame = {
      ...exam,
      files: {
        quiz: fileRecord('quiz.json'),
      },
      attachments: [attachment],
    }

    await saveEsame(examWithAttachment)

    await expect(getEsame(exam.id)).resolves.toEqual(examWithAttachment)
  })

  it('normalizes legacy exams without attachments on read', async () => {
    await getAllEsami()

    await withRawDb(['esami'], 'readwrite', async (_db, tx) => {
      tx.objectStore('esami').put({
        id: 'legacy-exam',
        name: 'Legacy exam',
        createdAt: '2026-06-01T10:00:00.000Z',
        files: {},
      })
    })

    const expectedLegacyExam: Esame = {
      id: 'legacy-exam',
      name: 'Legacy exam',
      createdAt: '2026-06-01T10:00:00.000Z',
      files: {},
      attachments: [],
      examDates: [],
    }

    await expect(getEsame('legacy-exam')).resolves.toEqual(expectedLegacyExam)
    await expect(getAllEsami()).resolves.toEqual([expectedLegacyExam])

    const [storedExam] = await withRawDb(['esami'], 'readonly', async (_db, tx) =>
      rawRequestResult(tx.objectStore('esami').getAll()),
    )

    expect(storedExam).toEqual(expectedLegacyExam)
    await expect(getSyncMetadata()).resolves.toMatchObject({
      pendingLocalChanges: true,
    })
  })

  it('normalizes legacy exams without exam dates on read', async () => {
    await getAllEsami()

    await withRawDb(['esami'], 'readwrite', async (_db, tx) => {
      tx.objectStore('esami').put({
        id: 'legacy-dates-exam',
        name: 'Legacy dates exam',
        createdAt: '2026-06-01T10:00:00.000Z',
        files: {},
        attachments: [],
      })
    })

    const expectedLegacyExam: Esame = {
      id: 'legacy-dates-exam',
      name: 'Legacy dates exam',
      createdAt: '2026-06-01T10:00:00.000Z',
      files: {},
      attachments: [],
      examDates: [],
    }

    await expect(getEsame('legacy-dates-exam')).resolves.toEqual(expectedLegacyExam)
    await expect(getAllEsami()).resolves.toEqual([expectedLegacyExam])

    const [storedExam] = await withRawDb(['esami'], 'readonly', async (_db, tx) =>
      rawRequestResult(tx.objectStore('esami').getAll()),
    )

    expect(storedExam).toEqual(expectedLegacyExam)
    await expect(getSyncMetadata()).resolves.toMatchObject({
      pendingLocalChanges: true,
    })
  })

  it('prunes expired exam dates on single exam reads and marks the exam dirty', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-12T00:00:00'))

    try {
      await saveEsame({
        ...exam,
        examDates: [
          makeExamDate({ id: 'expired', date: '2026-07-10' }),
          makeExamDate({ id: 'active', date: '2026-07-11' }),
        ],
      })
      await markSyncMetadataCleanForTest()

      await expect(getEsame(exam.id)).resolves.toEqual({
        ...exam,
        attachments: [],
        examDates: [makeExamDate({ id: 'active', date: '2026-07-11' })],
      })

      const metadata = await getSyncMetadata()
      const { state } = await exportLocalSyncState()

      expect(metadata.pendingLocalChanges).toBe(true)
      expect(state.data.esami[0].examDates).toEqual([
        makeExamDate({ id: 'active', date: '2026-07-11' }),
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('prunes expired exam dates on exam list reads and marks the exam dirty', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-12T00:00:00'))

    try {
      await saveEsame({
        ...exam,
        examDates: [
          makeExamDate({ id: 'expired', date: '2026-07-10' }),
          makeExamDate({ id: 'active', date: '2026-07-11' }),
        ],
      })
      await markSyncMetadataCleanForTest()

      await expect(getAllEsami()).resolves.toEqual([
        {
          ...exam,
          attachments: [],
          examDates: [makeExamDate({ id: 'active', date: '2026-07-11' })],
        },
      ])

      const metadata = await getSyncMetadata()
      const { state } = await exportLocalSyncState()

      expect(metadata.pendingLocalChanges).toBe(true)
      expect(state.data.esami[0].examDates).toEqual([
        makeExamDate({ id: 'active', date: '2026-07-11' }),
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not prune dates before the grace period expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-11T23:59:59'))

    try {
      await saveEsame({
        ...exam,
        examDates: [makeExamDate({ id: 'still-active', date: '2026-07-10' })],
      })
      await markSyncMetadataCleanForTest()

      await expect(getEsame(exam.id)).resolves.toEqual({
        ...exam,
        attachments: [],
        examDates: [makeExamDate({ id: 'still-active', date: '2026-07-10' })],
      })
      await expect(getSyncMetadata()).resolves.toMatchObject({
        pendingLocalChanges: false,
      })
    } finally {
      vi.useRealTimers()
    }
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

  it('reads a full backup source bundle for one exam only', async () => {
    const examWithFiles = {
      ...exam,
      files: {
        quiz: fileRecord('quiz.json'),
      },
      attachments: [makeExamAttachment({ id: 'attachment-1' })],
    }
    const quiz = makeQuizSession({ id: 'quiz-1', examId: exam.id })
    const otherQuiz = makeQuizSession({ id: 'quiz-2', examId: otherExam.id })
    const question = questionStat({ id: 'exam-1__q1', examId: exam.id })
    const otherQuestion = questionStat({ id: 'exam-2__q1', examId: otherExam.id })
    const flashcard = flashcardStat({ id: 'exam-1__f1', examId: exam.id })
    const otherFlashcard = flashcardStat({ id: 'exam-2__f1', examId: otherExam.id })
    const pausedQuiz = makePausedQuiz({ id: 'exam-1__quiz', examId: exam.id })
    const otherPausedQuiz = makePausedQuiz({ id: 'exam-2__quiz', examId: otherExam.id })

    await saveEsame(examWithFiles)
    await saveEsame(otherExam)
    await saveQuizSession(quiz)
    await saveQuizSession(otherQuiz)
    await saveQuestionStat(question)
    await saveQuestionStat(otherQuestion)
    await saveFlashcardStat(flashcard)
    await saveFlashcardStat(otherFlashcard)
    await savePausedSession(pausedQuiz)
    await savePausedSession(otherPausedQuiz)

    await expect(getExamBackupSourceBundle(exam.id)).resolves.toEqual({
      exam: examWithFiles,
      quizSessions: [quiz],
      questionStats: [question],
      flashcardStats: [flashcard],
      pausedSessions: [pausedQuiz],
    })
  })

  it('rejects backup source reads for missing exams', async () => {
    await expect(getExamBackupSourceBundle('missing-exam')).rejects.toThrow(
      'Exam missing-exam not found',
    )
  })

  it('atomically imports a restored backup bundle as local state', async () => {
    const importedExam = {
      ...exam,
      id: 'imported-exam',
      name: 'Diritto privato',
      attachments: [makeExamAttachment({ id: 'attachment-imported' })],
    }
    const importedQuiz: QuizSession = makeQuizSession({
      id: 'quiz-imported',
      examId: 'imported-exam',
    })
    const importedQuestion: QuestionStats = questionStat({
      id: 'imported-exam__q1',
      examId: 'imported-exam',
    })
    const importedFlashcard: FlashcardStats = flashcardStat({
      id: 'imported-exam__f1',
      examId: 'imported-exam',
    })
    const importedPausedQuiz: PausedSession = makePausedQuiz({
      id: 'imported-exam__quiz',
      examId: 'imported-exam',
    })

    await saveImportedExamBackupBundle({
      exam: importedExam,
      quizSessions: [importedQuiz],
      questionStats: [importedQuestion],
      flashcardStats: [importedFlashcard],
      pausedSessions: [importedPausedQuiz],
    })

    await expect(getEsame('imported-exam')).resolves.toEqual(importedExam)
    await expect(getQuizSessions('imported-exam')).resolves.toEqual([importedQuiz])
    await expect(getQuestionStats('imported-exam')).resolves.toEqual([importedQuestion])
    await expect(getFlashcardStats('imported-exam')).resolves.toEqual([importedFlashcard])
    await expect(getPausedSession('imported-exam__quiz')).resolves.toEqual(importedPausedQuiz)
    await expect(getSyncMetadata()).resolves.toMatchObject({
      pendingLocalChanges: true,
    })
  })

  it('rolls back imported backup writes when any record cannot be cloned', async () => {
    const badBundle = {
      exam: {
        ...exam,
        id: 'bad-import',
      },
      quizSessions: [makeQuizSession({ id: 'bad-quiz', examId: 'bad-import' })],
      questionStats: [
        {
          ...questionStat({ id: 'bad-import__q1', examId: 'bad-import' }),
          timesShown: (() => 1) as unknown as number,
        },
      ],
      flashcardStats: [],
      pausedSessions: [],
    }

    await expect(saveImportedExamBackupBundle(badBundle)).rejects.toThrow()

    await expect(getEsame('bad-import')).resolves.toBeUndefined()
    await expect(getQuizSessions('bad-import')).resolves.toEqual([])
    await expect(getQuestionStats('bad-import')).resolves.toEqual([])
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

  it('marks quiz session delete helpers dirty and clears stale sync metadata', async () => {
    const session = makeQuizSession({ id: 'quiz-delete', examId: exam.id })

    await saveQuizSession(session)
    await markSyncMetadataCleanForTest()

    await deleteQuizSessionsForExam(exam.id)

    const { state } = await exportLocalSyncState()
    const metadata = await getSyncMetadata()
    const staleRecordMetadata = await withRawDb(
      ['syncRecordMetadata'],
      'readonly',
      async (_db, tx) =>
        rawRequestResult(tx.objectStore('syncRecordMetadata').get(`quizSessions__${session.id}`)),
    )
    expect(metadata.pendingLocalChanges).toBe(true)
    expect(state.data.quizSessions).toEqual([])
    expect(staleRecordMetadata).toBeUndefined()
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

  it('marks question stat delete helpers dirty and clears stale counters', async () => {
    const stat = questionStat({ timesShown: 9, timesCorrect: 7 })

    await saveQuestionStat(stat)
    await markSyncMetadataCleanForTest()

    await deleteQuestionStatsForExam(exam.id)

    const metadataAfterDelete = await getSyncMetadata()
    const rawAfterDelete = await withRawDb(
      ['syncRecordMetadata', 'syncQuestionCounters'],
      'readonly',
      async (_db, tx) => {
        const staleRecordMetadata = await rawRequestResult(
          tx.objectStore('syncRecordMetadata').get(`questionStats__${stat.id}`),
        )
        const staleCounters = await rawRequestResult(tx.objectStore('syncQuestionCounters').getAll())

        return { staleRecordMetadata, staleCounters }
      },
    )
    expect(metadataAfterDelete.pendingLocalChanges).toBe(true)
    expect(rawAfterDelete.staleRecordMetadata).toBeUndefined()
    expect(rawAfterDelete.staleCounters).toEqual([])

    await saveQuestionStat(questionStat({ timesShown: 1, timesCorrect: 1 }))

    const { state } = await exportLocalSyncState()
    const metadataAfterResave = await getSyncMetadata()
    expect(state.data.questionStats).toEqual([
      {
        id: stat.id,
        examId: stat.examId,
        questionId: stat.questionId,
        deviceCounters: {
          [metadataAfterResave.deviceId]: {
            timesShown: 1,
            timesCorrect: 1,
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

  it('marks flashcard stat delete helpers dirty and clears stale sync metadata', async () => {
    const stat = flashcardStat({ id: 'exam-1__f-delete' })

    await saveFlashcardStat(stat)
    await markSyncMetadataCleanForTest()

    await deleteFlashcardStatsForExam(exam.id)

    const { state } = await exportLocalSyncState()
    const metadata = await getSyncMetadata()
    const staleRecordMetadata = await withRawDb(
      ['syncRecordMetadata'],
      'readonly',
      async (_db, tx) =>
        rawRequestResult(tx.objectStore('syncRecordMetadata').get(`flashcardStats__${stat.id}`)),
    )
    expect(metadata.pendingLocalChanges).toBe(true)
    expect(state.data.flashcardStats).toEqual([])
    expect(staleRecordMetadata).toBeUndefined()
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

  it('notifies automatic sync listeners for flashcard replacement and exam deletion', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent')

    await saveEsame({
      ...exam,
      files: {
        flashcard: fileRecord('old-flashcard.json'),
      },
    })
    dispatchEvent.mockClear()

    await replaceFlashcardFileForExam(exam.id, fileRecord('new-flashcard.json'))

    expect(dispatchEvent).toHaveBeenCalledWith(new Event('study-app-sync-dirty'))
    dispatchEvent.mockClear()

    await deleteEsame(exam.id)

    expect(dispatchEvent).toHaveBeenCalledWith(new Event('study-app-sync-dirty'))
  })

  it('clears question sync counters when replacing a quiz file', async () => {
    await saveEsame({
      ...exam,
      files: {
        quiz: fileRecord('old-quiz.json'),
      },
    })
    await saveQuestionStat(questionStat({ timesShown: 4, timesCorrect: 2 }))

    await replaceQuizFileForExam(exam.id, fileRecord('new-quiz.json'))

    const { state } = await exportLocalSyncState()
    const rawCounters = await withRawDb(
      ['syncQuestionCounters'],
      'readonly',
      async (_db, tx) =>
        rawRequestResult(tx.objectStore('syncQuestionCounters').getAll()),
    )
    expect(state.data.questionStats).toEqual([])
    expect(rawCounters).toEqual([])
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

  it('clears question sync counters when deleting an exam', async () => {
    await saveEsame(exam)
    await saveQuestionStat(questionStat({ timesShown: 6, timesCorrect: 5 }))

    await deleteEsame(exam.id)

    const { state } = await exportLocalSyncState()
    const rawCounters = await withRawDb(
      ['syncQuestionCounters'],
      'readonly',
      async (_db, tx) =>
        rawRequestResult(tx.objectStore('syncQuestionCounters').getAll()),
    )
    expect(state.data.questionStats).toEqual([])
    expect(rawCounters).toEqual([])
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
        examDates: [],
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

  it('exports exam attachments as encoded sync data', async () => {
    await saveEsame({
      ...exam,
      attachments: [attachmentRecord()],
    })

    const { state } = await exportLocalSyncState()

    expect(state.data.esami).toEqual([
      expect.objectContaining({
        id: exam.id,
        attachments: [
          {
            id: 'attachment-1',
            name: 'archive.pdf',
            type: 'application/pdf',
            dataBase64: 'YXJjaGl2ZS5wZGY=',
            createdAt: '2026-06-13T09:00:00.000Z',
          },
        ],
      }),
    ])
  })

  it('imports merged sync state and aggregates question stat device counters', async () => {
    const metadataBeforeImport = await getSyncMetadata()
    const syncedAt = '2026-06-06T10:00:00.000Z'
    const remoteState: RemoteSyncState = {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: syncedAt,
      writerDeviceId: 'remote-device',
      data: {
        esami: [
          {
            id: 'exam-imported',
            name: 'Imported exam',
            createdAt: '2026-06-05T09:00:00.000Z',
            files: {
              quiz: {
                name: 'quiz.json',
                type: 'application/json',
                dataBase64: 'aW1wb3J0ZWQtcXVpeg==',
              },
            },
            attachments: [],
            examDates: [],
            updatedAt: '2026-06-05T10:00:00.000Z',
            updatedByDeviceId: 'remote-device',
          },
        ],
        quizSessions: [],
        questionStats: [
          {
            id: 'exam-imported__q1',
            examId: 'exam-imported',
            questionId: 'q1',
            deviceCounters: {
              [metadataBeforeImport.deviceId]: {
                timesShown: 2,
                timesCorrect: 1,
              },
              'remote-device': {
                timesShown: 3,
                timesCorrect: 2,
              },
            },
          },
        ],
        flashcardStats: [],
      },
      tombstones: [
        {
          id: 'deleted-exam',
          kind: 'exam',
          deletedAt: '2026-06-05T11:00:00.000Z',
          deletedByDeviceId: 'remote-device',
        },
      ],
    }

    await importMergedSyncState(remoteState, 'remote-revision-7', syncedAt)

    const importedExam = await getEsame('exam-imported')
    const [importedQuestionStat] = await getQuestionStats('exam-imported')
    const metadataAfterImport = await getSyncMetadata()
    const exportedAfterImport = await exportLocalSyncState()

    expect(importedExam).toEqual({
      id: 'exam-imported',
      name: 'Imported exam',
      createdAt: '2026-06-05T09:00:00.000Z',
      files: {
        quiz: expect.objectContaining({
          name: 'quiz.json',
          type: 'application/json',
        }),
      },
      attachments: [],
      examDates: [],
    })
    expect(new TextDecoder().decode(importedExam?.files.quiz?.data)).toBe('imported-quiz')
    expect(importedQuestionStat).toEqual({
      id: 'exam-imported__q1',
      examId: 'exam-imported',
      questionId: 'q1',
      timesShown: 5,
      timesCorrect: 3,
    })
    expect(metadataAfterImport).toEqual({
      ...metadataBeforeImport,
      lastRemoteRevision: 'remote-revision-7',
      lastSyncedAt: syncedAt,
      pendingLocalChanges: false,
    })
    expect(exportedAfterImport.state.data.questionStats).toEqual([
      {
        id: 'exam-imported__q1',
        examId: 'exam-imported',
        questionId: 'q1',
        deviceCounters: {
          [metadataBeforeImport.deviceId]: {
            timesShown: 2,
            timesCorrect: 1,
          },
          'remote-device': {
            timesShown: 3,
            timesCorrect: 2,
          },
        },
      },
    ])
    expect(exportedAfterImport.state.tombstones).toEqual(remoteState.tombstones)
  })

  it('normalizes imported exam dates from sync payloads without marking sync metadata dirty', async () => {
    const metadataBeforeImport = await getSyncMetadata()
    const syncedAt = '2026-06-06T10:00:00.000Z'
    const remoteState = {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: syncedAt,
      writerDeviceId: 'remote-device',
      data: {
        esami: [
          {
            id: 'exam-imported-dates',
            name: 'Imported exam with dates',
            createdAt: '2026-06-05T09:00:00.000Z',
            files: {},
            attachments: [],
            examDates: [
              makeExamDate({
                id: 'later-date',
                date: '2026-07-20',
                createdAt: '2026-06-14T12:00:00.000Z',
                label: '  Orale  ',
                notes: '  Aula 5  ',
              }),
              {
                id: 'invalid-date',
                date: '2026-02-31',
                createdAt: '2026-06-14T09:00:00.000Z',
              },
              {
                id: 'missing-created-at',
                date: '2026-07-10',
              },
              makeExamDate({
                id: 'earlier-date',
                date: '2026-07-15',
                createdAt: '2026-06-14T10:00:00.000Z',
                label: '   ',
              }),
              makeExamDate({
                id: 'same-day-earlier-created',
                date: '2026-07-20',
                createdAt: '2026-06-14T08:00:00.000Z',
              }),
            ],
            updatedAt: '2026-06-05T10:00:00.000Z',
            updatedByDeviceId: 'remote-device',
          },
        ],
        quizSessions: [],
        questionStats: [],
        flashcardStats: [],
      },
      tombstones: [],
    } as unknown as RemoteSyncState

    await importMergedSyncState(remoteState, 'remote-revision-dates', syncedAt)

    await expect(getEsame('exam-imported-dates')).resolves.toEqual({
      id: 'exam-imported-dates',
      name: 'Imported exam with dates',
      createdAt: '2026-06-05T09:00:00.000Z',
      files: {},
      attachments: [],
      examDates: [
        makeExamDate({
          id: 'earlier-date',
          date: '2026-07-15',
          createdAt: '2026-06-14T10:00:00.000Z',
        }),
        makeExamDate({
          id: 'same-day-earlier-created',
          date: '2026-07-20',
          createdAt: '2026-06-14T08:00:00.000Z',
        }),
        makeExamDate({
          id: 'later-date',
          date: '2026-07-20',
          createdAt: '2026-06-14T12:00:00.000Z',
          label: 'Orale',
          notes: 'Aula 5',
        }),
      ],
    })
    await expect(getSyncMetadata()).resolves.toEqual({
      ...metadataBeforeImport,
      lastRemoteRevision: 'remote-revision-dates',
      lastSyncedAt: syncedAt,
      pendingLocalChanges: false,
    })
  })

  it('preserves exam dates through sync export and import', async () => {
    const datedExam = {
      ...exam,
      examDates: [
        makeExamDate({
          id: 'written',
          date: '2026-07-15',
          label: 'Scritto',
          notes: 'Aula 3',
        }),
      ],
    }

    await saveEsame(datedExam)

    const { state } = await exportLocalSyncState()
    const syncedAt = '2026-06-14T12:00:00.000Z'

    expect(state.data.esami[0].examDates).toEqual(datedExam.examDates)

    await importMergedSyncState(
      {
        ...state,
        data: {
          ...state.data,
          esami: [
            {
              ...state.data.esami[0],
              id: 'exam-imported-dates',
              name: 'Imported with dates',
              updatedAt: syncedAt,
            },
          ],
        },
      },
      'remote-revision-dates',
      syncedAt,
    )

    await expect(getEsame('exam-imported-dates')).resolves.toMatchObject({
      id: 'exam-imported-dates',
      name: 'Imported with dates',
      examDates: datedExam.examDates,
    })
  })

  it('preserves paused sessions while importing merged sync state', async () => {
    const pausedQuiz = makePausedQuiz({ id: 'local-exam__quiz', examId: 'local-exam' })
    const remoteState: RemoteSyncState = {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: '2026-06-06T10:00:00.000Z',
      writerDeviceId: 'remote-device',
      data: {
        esami: [],
        quizSessions: [],
        questionStats: [],
        flashcardStats: [],
      },
      tombstones: [],
    }

    await savePausedSession(pausedQuiz)
    await importMergedSyncState(remoteState, 'remote-revision-empty', '2026-06-06T10:01:00.000Z')

    await expect(getPausedSession(pausedQuiz.id)).resolves.toEqual(pausedQuiz)
  })

  it('imports merged sync state with exam attachments', async () => {
    const remoteState: RemoteSyncState = {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: '2026-06-13T09:15:00.000Z',
      writerDeviceId: 'remote-device',
      data: {
        esami: [
          {
            id: 'exam-imported',
            name: 'Imported exam',
            createdAt: '2026-06-13T09:00:00.000Z',
            files: {},
            attachments: [
              {
                id: 'attachment-1',
                name: 'archive.pdf',
                type: 'application/pdf',
                dataBase64: 'bm90ZXM=',
                createdAt: '2026-06-13T09:00:00.000Z',
              },
            ],
            updatedAt: '2026-06-13T09:10:00.000Z',
            updatedByDeviceId: 'remote-device',
          },
        ],
        quizSessions: [],
        questionStats: [],
        flashcardStats: [],
      },
      tombstones: [],
    }

    await importMergedSyncState(remoteState, 'remote-revision-attachments', '2026-06-13T09:16:00.000Z')

    const importedExam = await getEsame('exam-imported')
    expect(importedExam?.attachments).toHaveLength(1)
    expect(importedExam?.attachments?.[0]).toMatchObject({
      id: 'attachment-1',
      name: 'archive.pdf',
      type: 'application/pdf',
      createdAt: '2026-06-13T09:00:00.000Z',
    })
    expect(new TextDecoder().decode(importedExam?.attachments?.[0].data)).toBe('notes')
  })

  it('leaves existing syncable stores intact when import normalization fails', async () => {
    const existingExam = {
      ...exam,
      files: {
        quiz: fileRecord('existing-quiz.json'),
      },
    }
    const existingSession = makeQuizSession({ id: 'existing-session', examId: exam.id })
    const existingQuestion = questionStat({ id: 'exam-1__existing-question' })
    const existingFlashcard = flashcardStat({ id: 'exam-1__existing-flashcard' })
    const malformedState: RemoteSyncState = {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: '2026-06-06T10:00:00.000Z',
      writerDeviceId: 'remote-device',
      data: {
        esami: [
          {
            id: 'exam-imported',
            name: 'Imported exam',
            createdAt: '2026-06-05T09:00:00.000Z',
            files: {
              quiz: {
                name: 'bad-quiz.json',
                type: 'application/json',
                dataBase64: '%%%not-valid-base64%%%',
              },
            },
            attachments: [],
            updatedAt: '2026-06-05T10:00:00.000Z',
            updatedByDeviceId: 'remote-device',
          },
        ],
        quizSessions: [],
        questionStats: [],
        flashcardStats: [],
      },
      tombstones: [],
    }

    await saveEsame(existingExam)
    await saveQuizSession(existingSession)
    await saveQuestionStat(existingQuestion)
    await saveFlashcardStat(existingFlashcard)

    await expect(
      importMergedSyncState(malformedState, 'bad-revision', '2026-06-06T10:01:00.000Z'),
    ).rejects.toThrow()

    await expect(getEsame(existingExam.id)).resolves.toEqual(existingExam)
    await expect(getQuizSessions(existingExam.id)).resolves.toEqual([existingSession])
    await expect(getQuestionStats(existingExam.id)).resolves.toEqual([existingQuestion])
    await expect(getFlashcardStats(existingExam.id)).resolves.toEqual([existingFlashcard])
    await expect(getEsame('exam-imported')).resolves.toBeUndefined()
  })

  it('strips unknown remote fields from imported app records', async () => {
    const remoteState = {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: '2026-06-06T10:00:00.000Z',
      writerDeviceId: 'remote-device',
      data: {
        esami: [
          {
            id: 'exam-imported',
            name: 'Imported exam',
            createdAt: '2026-06-05T09:00:00.000Z',
            files: {},
            attachments: [],
            updatedAt: '2026-06-05T10:00:00.000Z',
            updatedByDeviceId: 'remote-device',
            remoteOnlyExamField: 'must-not-persist',
          },
        ],
        quizSessions: [
          {
            id: 'quiz-imported',
            examId: 'exam-imported',
            date: '2026-06-05T12:00:00.000Z',
            score: 4,
            total: 5,
            totalTime: 120,
            timeLimitSeconds: null,
            completedByTimeout: false,
            macroargomenti: ['contracts'],
            errors: ['q2'],
            unanswered: [],
            isReview: false,
            updatedByDeviceId: 'remote-device',
            remoteOnlyQuizField: 'must-not-persist',
          },
        ],
        questionStats: [],
        flashcardStats: [
          {
            id: 'exam-imported__f1',
            examId: 'exam-imported',
            cardId: 'f1',
            lastEval: 'Sì',
            lastSeen: '2026-06-05T13:00:00.000Z',
            updatedByDeviceId: 'remote-device',
            remoteOnlyFlashcardField: 'must-not-persist',
          },
        ],
      },
      tombstones: [],
    } as unknown as RemoteSyncState

    await importMergedSyncState(remoteState, 'remote-revision-fields', '2026-06-06T10:01:00.000Z')

    await expect(getEsame('exam-imported')).resolves.toEqual({
      id: 'exam-imported',
      name: 'Imported exam',
      createdAt: '2026-06-05T09:00:00.000Z',
      files: {},
      attachments: [],
      examDates: [],
    })
    await expect(getQuizSessions('exam-imported')).resolves.toEqual([
      {
        id: 'quiz-imported',
        examId: 'exam-imported',
        date: '2026-06-05T12:00:00.000Z',
        score: 4,
        total: 5,
        totalTime: 120,
        timeLimitSeconds: null,
        completedByTimeout: false,
        macroargomenti: ['contracts'],
        errors: ['q2'],
        unanswered: [],
        isReview: false,
      },
    ])
    await expect(getFlashcardStats('exam-imported')).resolves.toEqual([
      {
        id: 'exam-imported__f1',
        examId: 'exam-imported',
        cardId: 'f1',
        lastEval: 'Sì',
        lastSeen: '2026-06-05T13:00:00.000Z',
      },
    ])
  })
})
