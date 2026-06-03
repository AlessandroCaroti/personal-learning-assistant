import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeEsame, makePausedFlash, makePausedQuiz, makeQuizSession } from '../__tests__/factories'
import { resetDb } from '../__tests__/resetDb'
import type { FileRecord, FlashcardStats, QuestionStats } from '../types'
import {
  deleteEsame,
  deleteFlashcardStatsForExam,
  deletePausedSession,
  deleteQuestionStatsForExam,
  deleteQuizSessionsForExam,
  getAllEsami,
  getEsame,
  getFlashcardStats,
  getPausedSession,
  getPausedSessionsForExam,
  getQuestionStats,
  getQuizSessions,
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

describe('storageService', () => {
  beforeEach(async () => {
    await resetDb()
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
})
