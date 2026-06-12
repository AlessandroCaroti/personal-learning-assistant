import { describe, expect, it } from 'vitest'
import { makeQuizDomanda, makeQuizFile } from '../__tests__/factories'
import type { QuestionStats, QuizSession } from '../types'
import {
  buildReviewQueue,
  buildStudyStats,
  filterReviewQueue,
  sortReviewQueue,
  type ReviewQueueItem,
} from './studyService'

const quiz = makeQuizFile([
  makeQuizDomanda({
    id: 'q1',
    testo: 'Domanda uno',
    macroargomenti: ['Algebra'],
    risposta_corretta: 'Risposta 1',
    spiegazione: 'Spiegazione 1',
  }),
  makeQuizDomanda({
    id: 'q2',
    testo: 'Domanda due',
    macroargomenti: ['Geometria'],
    risposta_corretta: 'Risposta 2',
    spiegazione: 'Spiegazione 2',
  }),
  makeQuizDomanda({
    id: 'q3',
    testo: 'Domanda tre',
    macroargomenti: ['Algebra', 'Analisi'],
    risposta_corretta: 'Risposta 3',
    spiegazione: 'Spiegazione 3',
  }),
])

const makeSession = (overrides: Partial<QuizSession>): QuizSession => ({
  id: 'session-1',
  examId: 'exam-1',
  date: '2026-01-01T00:00:00.000Z',
  score: 0,
  total: 3,
  totalTime: 90,
  timeLimitSeconds: null,
  completedByTimeout: false,
  macroargomenti: [],
  errors: [],
  unanswered: [],
  isReview: false,
  ...overrides,
})

const makeStat = (overrides: Partial<QuestionStats>): QuestionStats => ({
  id: `exam-1__${overrides.questionId ?? 'q1'}`,
  examId: 'exam-1',
  questionId: 'q1',
  timesShown: 0,
  timesCorrect: 0,
  ...overrides,
})

describe('studyService', () => {
  it('builds a cumulative review queue from latest missed events and ignores missing question IDs', () => {
    const sessions = [
      makeSession({
        id: 'older',
        date: '2026-01-01T10:00:00.000Z',
        errors: ['q1', 'missing-id'],
        unanswered: ['q2'],
      }),
      makeSession({
        id: 'latest',
        date: '2026-01-03T10:00:00.000Z',
        errors: ['q3'],
        unanswered: ['q1'],
      }),
    ]
    const stats = [
      makeStat({ questionId: 'q1', timesShown: 4, timesCorrect: 3 }),
      makeStat({ questionId: 'q2', timesShown: 2, timesCorrect: 0 }),
    ]

    const queue = buildReviewQueue({ quiz, sessions, stats })

    expect(queue).toHaveLength(3)
    expect(queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionId: 'q1',
          questionText: 'Domanda uno',
          macroargomenti: ['Algebra'],
          resultType: 'unanswered',
          lastMissedAt: '2026-01-03T10:00:00.000Z',
          latestSessionIndex: 0,
          accuracy: 0.75,
          timesShown: 4,
          timesCorrect: 3,
          correctAnswer: 'Risposta 1',
          explanation: 'Spiegazione 1',
        }),
        expect.objectContaining({
          questionId: 'q2',
          resultType: 'unanswered',
          lastMissedAt: '2026-01-01T10:00:00.000Z',
          latestSessionIndex: 1,
          accuracy: 0,
          timesShown: 2,
          timesCorrect: 0,
        }),
        expect.objectContaining({
          questionId: 'q3',
          resultType: 'error',
          lastMissedAt: '2026-01-03T10:00:00.000Z',
          latestSessionIndex: 0,
          accuracy: null,
          timesShown: 0,
          timesCorrect: 0,
        }),
      ]),
    )
    expect(queue.find((item) => item.questionId === 'missing-id')).toBeUndefined()

    const q1 = queue.find((item) => item.questionId === 'q1')
    expect(q1?.macroargomenti).not.toBe(quiz.domande[0].macroargomenti)
  })

  it('sorts by latest miss, lower accuracy, then question ID without mutating input', () => {
    const items: ReviewQueueItem[] = [
      {
        questionId: 'q3',
        questionText: 'Domanda tre',
        macroargomenti: [],
        resultType: 'error',
        lastMissedAt: '2026-01-03T10:00:00.000Z',
        latestSessionIndex: 0,
        accuracy: 0.8,
        timesShown: 5,
        timesCorrect: 4,
        correctAnswer: 'Risposta 3',
        explanation: 'Spiegazione 3',
      },
      {
        questionId: 'q2',
        questionText: 'Domanda due',
        macroargomenti: [],
        resultType: 'error',
        lastMissedAt: '2026-01-03T10:00:00.000Z',
        latestSessionIndex: 0,
        accuracy: 0.2,
        timesShown: 5,
        timesCorrect: 1,
        correctAnswer: 'Risposta 2',
        explanation: 'Spiegazione 2',
      },
      {
        questionId: 'q1',
        questionText: 'Domanda uno',
        macroargomenti: [],
        resultType: 'unanswered',
        lastMissedAt: '2026-01-01T10:00:00.000Z',
        latestSessionIndex: 1,
        accuracy: null,
        timesShown: 0,
        timesCorrect: 0,
        correctAnswer: 'Risposta 1',
        explanation: 'Spiegazione 1',
      },
      {
        questionId: 'q4',
        questionText: 'Domanda quattro',
        macroargomenti: [],
        resultType: 'error',
        lastMissedAt: '2026-01-03T10:00:00.000Z',
        latestSessionIndex: 0,
        accuracy: 0.2,
        timesShown: 5,
        timesCorrect: 1,
        correctAnswer: 'Risposta 4',
        explanation: 'Spiegazione 4',
      },
    ]
    const originalOrder = items.map((item) => item.questionId)

    const sorted = sortReviewQueue(items)

    expect(sorted.map((item) => item.questionId)).toEqual(['q2', 'q4', 'q3', 'q1'])
    expect(items.map((item) => item.questionId)).toEqual(originalOrder)
    expect(sorted).not.toBe(items)
  })

  it('filters review queue by macroargomento, result type, and recent sessions', () => {
    const queue = buildReviewQueue({
      quiz,
      sessions: [
        makeSession({
          id: 'latest',
          date: '2026-01-04T10:00:00.000Z',
          errors: ['q1'],
        }),
        makeSession({
          id: 'middle',
          date: '2026-01-03T10:00:00.000Z',
          unanswered: ['q2'],
        }),
        makeSession({
          id: 'older',
          date: '2026-01-02T10:00:00.000Z',
          errors: ['q3'],
        }),
      ],
      stats: [],
    })

    expect(
      filterReviewQueue(queue, {
        macroargomento: 'Algebra',
        resultType: 'all',
        recentScope: 'all',
      }).map((item) => item.questionId),
    ).toEqual(['q1', 'q3'])
    expect(
      filterReviewQueue(queue, {
        resultType: 'unanswered',
        recentScope: 'all',
      }).map((item) => item.questionId),
    ).toEqual(['q2'])
    expect(
      filterReviewQueue(queue, {
        resultType: 'all',
        recentScope: 1,
      }).map((item) => item.questionId),
    ).toEqual(['q1'])
    expect(
      filterReviewQueue(queue, {
        resultType: 'all',
        recentScope: 3,
      }).map((item) => item.questionId),
    ).toEqual(['q1', 'q2', 'q3'])
  })

  it('builds study stats from question stats and the latest ten sessions', () => {
    const sessions = Array.from({ length: 12 }, (_, index) =>
      makeSession({
        id: `session-${index + 1}`,
        date: `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
        score: index % 3,
        total: 3,
        totalTime: 90 + index * 3,
      }),
    )
    const stats = [
      makeStat({ questionId: 'q1', timesShown: 4, timesCorrect: 3 }),
      makeStat({ questionId: 'q2', timesShown: 2, timesCorrect: 1 }),
      makeStat({ questionId: 'q3', timesShown: 0, timesCorrect: 0 }),
    ]

    const summary = buildStudyStats({ quiz, sessions, stats })

    expect(summary).toEqual({
      overallAccuracy: 4 / 6,
      seenQuestionCount: 2,
      totalQuestionCount: 3,
      progress: 2 / 3,
      averageSecondsPerQuestion: 106.5 / 3,
      completedSessionCount: 12,
      trend: expect.any(Array),
    })
    expect(summary.trend).toHaveLength(10)
    expect(summary.trend.map((item) => item.sessionId)).toEqual([
      'session-12',
      'session-11',
      'session-10',
      'session-9',
      'session-8',
      'session-7',
      'session-6',
      'session-5',
      'session-4',
      'session-3',
    ])
    expect(summary.trend[0]).toEqual({
      sessionId: 'session-12',
      date: '2026-01-12T10:00:00.000Z',
      score: 2,
      total: 3,
      accuracyPercent: 67,
      secondsPerQuestion: 41,
    })
  })

  it('returns null unavailable stats when no questions were shown', () => {
    const summary = buildStudyStats({
      quiz,
      sessions: [makeSession({ id: 'empty', total: 0, totalTime: 0, score: 0 })],
      stats: [makeStat({ questionId: 'q1', timesShown: 0, timesCorrect: 0 })],
    })

    expect(summary.overallAccuracy).toBeNull()
    expect(summary.averageSecondsPerQuestion).toBeNull()
    expect(summary.seenQuestionCount).toBe(0)
    expect(summary.progress).toBe(0)
    expect(summary.completedSessionCount).toBe(1)
    expect(summary.trend[0]).toEqual({
      sessionId: 'empty',
      date: '2026-01-01T00:00:00.000Z',
      score: 0,
      total: 0,
      accuracyPercent: 0,
      secondsPerQuestion: null,
    })
  })
})
