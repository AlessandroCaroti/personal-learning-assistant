import { beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import type {
  Esame,
  FlashcardStats,
  PausedSession,
  QuestionStats,
  QuizSession,
} from '../types'

let testDbSuffix = 0

async function freshStorage() {
  vi.resetModules()
  vi.doMock('idb', async (importOriginal) => {
    const actual = await importOriginal<typeof import('idb')>()
    const openDB: typeof actual.openDB = ((name, version, callbacks) => {
      return actual.openDB(`${String(name)}-${testDbSuffix}`, version, callbacks)
    }) as typeof actual.openDB

    return {
      ...actual,
      openDB,
    }
  })

  return import('./storageService')
}

const exam: Esame = {
  id: 'exam-1',
  name: 'Diritto privato',
  createdAt: '2026-06-01T10:00:00.000Z',
  files: {},
}

const otherExam: Esame = {
  id: 'exam-2',
  name: 'Economia',
  createdAt: '2026-06-01T11:00:00.000Z',
  files: {},
}

function quizSession(id: string, examId: string): QuizSession {
  return {
    id,
    examId,
    date: '2026-06-01T12:00:00.000Z',
    score: 7,
    total: 10,
    totalTime: 120,
    timeLimitSeconds: null,
    completedByTimeout: false,
    macroargomenti: ['intro'],
    errors: [],
    unanswered: [],
    isReview: false,
  }
}

function questionStat(id: string, examId: string): QuestionStats {
  return {
    id,
    examId,
    questionId: id.split('__')[1] ?? id,
    timesShown: 2,
    timesCorrect: 1,
  }
}

function flashcardStat(id: string, examId: string): FlashcardStats {
  return {
    id,
    examId,
    cardId: id.split('__')[1] ?? id,
    lastEval: 'Sì',
    lastSeen: '2026-06-01T12:30:00.000Z',
  }
}

function pausedSession(id: string, examId: string): PausedSession {
  return {
    id,
    examId,
    mode: 'quiz',
    savedAt: '2026-06-01T12:45:00.000Z',
    elapsedSeconds: 45,
    timeLimitSeconds: null,
    macroargomenti: ['intro'],
  }
}

describe('storageService', () => {
  beforeEach(() => {
    testDbSuffix += 1
  })

  it('stores and reads exams plus exam-scoped records through indexes', async () => {
    const storage = await freshStorage()

    await storage.saveEsame(exam)
    await storage.saveEsame(otherExam)
    await storage.saveQuizSession(quizSession('qs-1', exam.id))
    await storage.saveQuizSession(quizSession('qs-2', otherExam.id))
    await storage.saveQuestionStat(questionStat(`${exam.id}__q1`, exam.id))
    await storage.saveFlashcardStat(flashcardStat(`${exam.id}__c1`, exam.id))
    await storage.savePausedSession(pausedSession(`${exam.id}__quiz`, exam.id))

    await expect(storage.getEsame(exam.id)).resolves.toEqual(exam)
    await expect(storage.getAllEsami()).resolves.toEqual([exam, otherExam])
    await expect(storage.getQuizSessions(exam.id)).resolves.toEqual([
      quizSession('qs-1', exam.id),
    ])
    await expect(storage.getQuestionStats(exam.id)).resolves.toEqual([
      questionStat(`${exam.id}__q1`, exam.id),
    ])
    await expect(storage.getFlashcardStats(exam.id)).resolves.toEqual([
      flashcardStat(`${exam.id}__c1`, exam.id),
    ])
    await expect(storage.getPausedSession(`${exam.id}__quiz`)).resolves.toEqual(
      pausedSession(`${exam.id}__quiz`, exam.id),
    )
    await expect(storage.getPausedSessionsForExam(exam.id)).resolves.toEqual([
      pausedSession(`${exam.id}__quiz`, exam.id),
    ])
  })

  it('deletes an exam and cascades only records for that exam', async () => {
    const storage = await freshStorage()

    await storage.saveEsame(exam)
    await storage.saveEsame(otherExam)
    await storage.saveQuizSession(quizSession('qs-1', exam.id))
    await storage.saveQuizSession(quizSession('qs-2', otherExam.id))
    await storage.saveQuestionStat(questionStat(`${exam.id}__q1`, exam.id))
    await storage.saveQuestionStat(questionStat(`${otherExam.id}__q1`, otherExam.id))
    await storage.saveFlashcardStat(flashcardStat(`${exam.id}__c1`, exam.id))
    await storage.saveFlashcardStat(flashcardStat(`${otherExam.id}__c1`, otherExam.id))
    await storage.savePausedSession(pausedSession(`${exam.id}__quiz`, exam.id))
    await storage.savePausedSession(pausedSession(`${otherExam.id}__quiz`, otherExam.id))

    await storage.deleteEsame(exam.id)

    await expect(storage.getEsame(exam.id)).resolves.toBeUndefined()
    await expect(storage.getEsame(otherExam.id)).resolves.toEqual(otherExam)
    await expect(storage.getQuizSessions(exam.id)).resolves.toEqual([])
    await expect(storage.getQuestionStats(exam.id)).resolves.toEqual([])
    await expect(storage.getFlashcardStats(exam.id)).resolves.toEqual([])
    await expect(storage.getPausedSessionsForExam(exam.id)).resolves.toEqual([])
    await expect(storage.getQuizSessions(otherExam.id)).resolves.toEqual([
      quizSession('qs-2', otherExam.id),
    ])
    await expect(storage.getQuestionStats(otherExam.id)).resolves.toEqual([
      questionStat(`${otherExam.id}__q1`, otherExam.id),
    ])
    await expect(storage.getFlashcardStats(otherExam.id)).resolves.toEqual([
      flashcardStat(`${otherExam.id}__c1`, otherExam.id),
    ])
    await expect(storage.getPausedSessionsForExam(otherExam.id)).resolves.toEqual([
      pausedSession(`${otherExam.id}__quiz`, otherExam.id),
    ])
  })
})
