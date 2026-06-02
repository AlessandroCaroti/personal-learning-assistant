import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PausedSession, QuestionStats, QuizDomanda } from '../types'

const getQuestionStats = vi.fn()
const saveQuestionStat = vi.fn()
const saveQuizSession = vi.fn()
const savePausedSession = vi.fn()
const deletePausedSession = vi.fn()

vi.mock('../services/storageService', () => ({
  getQuestionStats,
  saveQuestionStat,
  saveQuizSession,
  savePausedSession,
  deletePausedSession,
}))

vi.mock('uuid', () => ({
  v4: () => 'session-1',
}))

const { useQuiz } = await import('./useQuiz')

const domande: QuizDomanda[] = [
  {
    id: 'q1',
    macroargomenti: ['Algebra'],
    tipo: 'multipla',
    testo: 'Quanto fa 2 + 2?',
    opzioni: ['3', '4'],
    risposta_corretta: '4',
    spiegazione: 'Somma.',
  },
  {
    id: 'q2',
    macroargomenti: ['Geometria'],
    tipo: 'vero_falso',
    testo: 'Un triangolo ha tre lati.',
    risposta_corretta: 'Vero',
    spiegazione: 'Definizione.',
  },
  {
    id: 'q3',
    macroargomenti: ['Algebra', 'Analisi'],
    tipo: 'multipla',
    testo: 'Quanto fa 3 + 3?',
    opzioni: ['5', '6'],
    risposta_corretta: '6',
    spiegazione: 'Somma.',
  },
]

function makePaused(overrides: Partial<PausedSession> = {}): PausedSession {
  return {
    id: 'exam-1__quiz',
    examId: 'exam-1',
    mode: 'quiz',
    savedAt: '2026-06-01T09:00:00.000Z',
    elapsedSeconds: 12,
    timeLimitSeconds: 600,
    macroargomenti: ['Algebra'],
    questionIds: ['q3', 'missing', 'q1'],
    currentQuestionIndex: 5,
    confirmedAnswers: { q3: '6', missing: 'x' },
    ...overrides,
  }
}

describe('useQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getQuestionStats.mockResolvedValue([])
    saveQuestionStat.mockResolvedValue(undefined)
    saveQuizSession.mockResolvedValue(undefined)
    savePausedSession.mockResolvedValue(undefined)
    deletePausedSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('starts a filtered session with OR macro filtering and count limit', () => {
    const { result } = renderHook(() => useQuiz('exam-1'))

    act(() => {
      result.current.startSession(domande, ['Analisi', 'Geometria'], 2, 300)
    })

    expect(result.current.timeLimitSeconds).toBe(300)
    expect(result.current.macroargomenti).toEqual(['Analisi', 'Geometria'])
    expect(result.current.sessionState?.questions).toHaveLength(2)
    expect(result.current.sessionState?.questions.map((question) => question.id).sort()).toEqual([
      'q2',
      'q3',
    ])
    expect(result.current.sessionState?.currentIndex).toBe(0)
    expect(result.current.sessionState?.confirmedAnswers).toEqual({})
    expect(result.current.sessionState?.selectedAnswer).toBeNull()
  })

  it('confirms the selected answer and updates question stats asynchronously', async () => {
    const existing: QuestionStats = {
      id: 'exam-1__q1',
      examId: 'exam-1',
      questionId: 'q1',
      timesShown: 2,
      timesCorrect: 1,
    }
    getQuestionStats.mockResolvedValue([existing])
    const { result } = renderHook(() => useQuiz('exam-1'))

    act(() => {
      result.current.startSession([domande[0]], [], 1, null)
      result.current.selectAnswer('4')
      result.current.confirmAnswer('q1', 7)
    })

    expect(result.current.sessionState?.confirmedAnswers).toEqual({ q1: '4' })
    expect(result.current.sessionState?.selectedAnswer).toBeNull()
    await waitFor(() => {
      expect(saveQuestionStat).toHaveBeenCalledWith({
        ...existing,
        timesShown: 3,
        timesCorrect: 2,
      })
    })
  })

  it('serializes repeated stat updates and catches update failures', async () => {
    const statsById = new Map<string, QuestionStats>()
    getQuestionStats.mockImplementation(async () => [...statsById.values()])
    saveQuestionStat.mockImplementation(async (stat: QuestionStats) => {
      statsById.set(stat.questionId, stat)
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() => useQuiz('exam-1'))

    act(() => {
      result.current.startSession([domande[0]], [], 1, null)
      result.current.selectAnswer('4')
      result.current.confirmAnswer('q1', 1)
      result.current.selectAnswer('4')
      result.current.confirmAnswer('q1', 2)
    })

    await waitFor(() => {
      expect(statsById.get('q1')).toEqual({
        id: 'exam-1__q1',
        examId: 'exam-1',
        questionId: 'q1',
        timesShown: 2,
        timesCorrect: 2,
      })
    })

    saveQuestionStat.mockRejectedValueOnce(new Error('storage unavailable'))

    act(() => {
      result.current.selectAnswer('3')
      result.current.confirmAnswer('q1', 3)
    })

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to update question stats',
        expect.any(Error),
      )
    })
    consoleError.mockRestore()
  })

  it('uses same-tick start metadata when finishing before React state catches up', async () => {
    const { result } = renderHook(() => useQuiz('exam-1'))
    let normalSaved = null
    let reviewSaved = null

    await act(async () => {
      result.current.startSession([domande[0], domande[2]], ['Algebra'], 2, 450)
      normalSaved = await result.current.finishSession(12, false, domande)
    })

    await act(async () => {
      result.current.startReviewSession(['q2'], [], domande)
      reviewSaved = await result.current.finishSession(18, false, domande)
    })

    expect(normalSaved).toMatchObject({
      total: 2,
      timeLimitSeconds: 450,
      macroargomenti: ['Algebra'],
      isReview: false,
    })
    expect(reviewSaved).toMatchObject({
      total: 1,
      timeLimitSeconds: null,
      macroargomenti: [],
      isReview: true,
    })
  })

  it('finishes with score, errors, unanswered, deletes pause, and preserves review flag', async () => {
    const { result } = renderHook(() => useQuiz('exam-1'))

    act(() => {
      result.current.startReviewSession(['q2'], ['q3'], domande)
      result.current.selectAnswer('Falso')
      result.current.confirmAnswer('q2', 5)
    })

    let saved = null
    await act(async () => {
      saved = await result.current.finishSession(44, true, domande)
    })

    expect(saved).toEqual({
      id: 'session-1',
      examId: 'exam-1',
      date: expect.any(String),
      score: 0,
      total: 2,
      totalTime: 44,
      timeLimitSeconds: null,
      completedByTimeout: true,
      macroargomenti: [],
      errors: ['q2'],
      unanswered: ['q3'],
      isReview: true,
    })
    expect(saveQuizSession).toHaveBeenCalledWith(saved)
    expect(deletePausedSession).toHaveBeenCalledWith('exam-1__quiz')
    expect(result.current.sessionState).toBeNull()
  })

  it('pauses by saving the current ordered question ids and answers', async () => {
    const { result } = renderHook(() => useQuiz('exam-1'))

    act(() => {
      result.current.resumeFromPaused(makePaused(), domande)
    })

    await act(async () => {
      await result.current.pauseSession(123)
    })

    expect(savePausedSession).toHaveBeenCalledWith({
      id: 'exam-1__quiz',
      examId: 'exam-1',
      mode: 'quiz',
      savedAt: expect.any(String),
      elapsedSeconds: 123,
      timeLimitSeconds: 600,
      macroargomenti: ['Algebra'],
      questionIds: ['q3', 'q1'],
      currentQuestionIndex: 1,
      confirmedAnswers: { q3: '6' },
    })
  })

  it('resumes only valid quiz pauses and safely ignores missing question ids', () => {
    const { result } = renderHook(() => useQuiz('exam-1'))

    act(() => {
      result.current.resumeFromPaused(makePaused({ mode: 'flashcard' }), domande)
    })

    expect(result.current.sessionState).toBeNull()

    act(() => {
      result.current.resumeFromPaused(makePaused(), domande)
    })

    expect(result.current.timeLimitSeconds).toBe(600)
    expect(result.current.macroargomenti).toEqual(['Algebra'])
    expect(result.current.sessionState?.questions.map((question) => question.id)).toEqual([
      'q3',
      'q1',
    ])
    expect(result.current.sessionState?.currentIndex).toBe(1)
    expect(result.current.sessionState?.confirmedAnswers).toEqual({ q3: '6' })
  })

  it('does not create an active review session when there are no review questions', () => {
    const { result } = renderHook(() => useQuiz('exam-1'))

    act(() => {
      result.current.startSession([domande[0]], ['Algebra'], 1, 300)
    })

    expect(() => {
      act(() => {
        result.current.startReviewSession(['missing'], [], domande)
      })
    }).toThrow('Nessuna domanda disponibile per il ripasso')
    expect(result.current.sessionState?.questions.map((question) => question.id)).toEqual(['q1'])
    expect(result.current.timeLimitSeconds).toBe(300)
    expect(result.current.macroargomenti).toEqual(['Algebra'])
  })
})
