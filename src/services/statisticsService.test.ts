import { describe, expect, it } from 'vitest'
import {
  makeFlashCard,
  makeFlashcardFile,
  makeQuizDomanda,
  makeQuizFile,
  makeQuizSession,
} from '../__tests__/factories'
import type { FlashcardStats, QuestionStats } from '../types'
import {
  buildFlashcardSummary,
  buildQuizSummary,
  decodeFlashcardSource,
  decodeQuizSource,
  weakFlashcards,
  weakMacroargomenti,
  weakQuizQuestions,
} from './statisticsService'

function encodeJson(value: unknown): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function questionStat(overrides: Partial<QuestionStats> = {}): QuestionStats {
  return {
    id: 'exam-1__q1',
    examId: 'exam-1',
    questionId: 'q1',
    timesShown: 4,
    timesCorrect: 2,
    ...overrides,
  }
}

function flashcardStat(overrides: Partial<FlashcardStats> = {}): FlashcardStats {
  return {
    id: 'exam-1__f1',
    examId: 'exam-1',
    cardId: 'f1',
    lastEval: 'Sì',
    lastSeen: '2026-06-14T10:00:00.000Z',
    ...overrides,
  }
}

describe('statisticsService', () => {
  it('builds quiz summary from sessions', () => {
    expect(
      buildQuizSummary([
        makeQuizSession({
          id: 's1',
          score: 6,
          total: 10,
          totalTime: 120,
          completedByTimeout: false,
          isReview: false,
          date: '2026-06-10T10:00:00.000Z',
        }),
        makeQuizSession({
          id: 's2',
          score: 8,
          total: 10,
          totalTime: 60,
          completedByTimeout: true,
          isReview: true,
          date: '2026-06-11T10:00:00.000Z',
        }),
      ]),
    ).toEqual({
      totalSessions: 2,
      averageScorePercent: 70,
      bestScorePercent: 80,
      latestScorePercent: 80,
      averageTimeSeconds: 90,
      timeoutCount: 1,
      reviewCount: 1,
    })
  })

  it('returns empty quiz summary for no sessions', () => {
    expect(buildQuizSummary([])).toEqual({
      totalSessions: 0,
      averageScorePercent: null,
      bestScorePercent: null,
      latestScorePercent: null,
      averageTimeSeconds: null,
      timeoutCount: 0,
      reviewCount: 0,
    })
  })

  it('resolves weak quiz questions and macroargomenti from stats and source questions', () => {
    const questions = [
      makeQuizDomanda({ id: 'q1', testo: 'Hard question', macroargomenti: ['Algebra'] }),
      makeQuizDomanda({ id: 'q2', testo: 'Medium question', macroargomenti: ['Analisi'] }),
    ]
    const stats = [
      questionStat({ questionId: 'q1', timesShown: 5, timesCorrect: 1 }),
      questionStat({ questionId: 'q2', timesShown: 4, timesCorrect: 2 }),
    ]

    expect(weakQuizQuestions(stats, questions)).toEqual([
      {
        questionId: 'q1',
        text: 'Hard question',
        macroargomenti: ['Algebra'],
        timesShown: 5,
        timesCorrect: 1,
        accuracyPercent: 20,
      },
      {
        questionId: 'q2',
        text: 'Medium question',
        macroargomenti: ['Analisi'],
        timesShown: 4,
        timesCorrect: 2,
        accuracyPercent: 50,
      },
    ])

    expect(weakMacroargomenti(stats, questions)).toEqual([
      {
        name: 'Algebra',
        timesShown: 5,
        timesCorrect: 1,
        accuracyPercent: 20,
      },
      {
        name: 'Analisi',
        timesShown: 4,
        timesCorrect: 2,
        accuracyPercent: 50,
      },
    ])
  })

  it('keeps weak quiz question ordering deterministic when accuracy and exposure tie', () => {
    const questions = [
      makeQuizDomanda({ id: 'q1', testo: 'Question 1' }),
      makeQuizDomanda({ id: 'q2', testo: 'Question 2' }),
      makeQuizDomanda({ id: 'q3', testo: 'Question 3' }),
    ]
    const stats = [
      questionStat({ questionId: 'q3', timesShown: 4, timesCorrect: 2 }),
      questionStat({ questionId: 'q1', timesShown: 4, timesCorrect: 2 }),
      questionStat({ questionId: 'q2', timesShown: 4, timesCorrect: 2 }),
    ]

    expect(weakQuizQuestions(stats, questions).map((question) => question.questionId)).toEqual([
      'q1',
      'q2',
      'q3',
    ])
  })

  it('dedupes repeated macroargomenti within a single question and keeps macro ordering deterministic on ties', () => {
    const questions = [
      makeQuizDomanda({
        id: 'q1',
        macroargomenti: ['Beta', 'Beta', 'Alpha'],
      }),
      makeQuizDomanda({
        id: 'q2',
        macroargomenti: ['Gamma'],
      }),
    ]
    const stats = [
      questionStat({ questionId: 'q1', timesShown: 4, timesCorrect: 2 }),
      questionStat({ questionId: 'q2', timesShown: 4, timesCorrect: 2 }),
    ]

    expect(weakMacroargomenti(stats, questions)).toEqual([
      {
        name: 'Alpha',
        timesShown: 4,
        timesCorrect: 2,
        accuracyPercent: 50,
      },
      {
        name: 'Beta',
        timesShown: 4,
        timesCorrect: 2,
        accuracyPercent: 50,
      },
      {
        name: 'Gamma',
        timesShown: 4,
        timesCorrect: 2,
        accuracyPercent: 50,
      },
    ])
  })

  it('builds flashcard summary and weak flashcards', () => {
    const cards = [
      makeFlashCard({ id: 'f1', fronte: 'Front 1', macroargomenti: ['A'] }),
      makeFlashCard({ id: 'f2', fronte: 'Front 2', macroargomenti: ['B'] }),
      makeFlashCard({ id: 'f3', fronte: 'Front 3', macroargomenti: ['C'] }),
    ]
    const stats = [
      flashcardStat({ cardId: 'f1', lastEval: 'Sì', lastSeen: '2026-06-14T10:00:00.000Z' }),
      flashcardStat({ cardId: 'f2', lastEval: 'No', lastSeen: '2026-06-13T10:00:00.000Z' }),
      flashcardStat({ cardId: 'f3', lastEval: 'In parte', lastSeen: '2026-06-12T10:00:00.000Z' }),
      flashcardStat({
        cardId: 'missing',
        lastEval: 'Non risposta',
        lastSeen: '2026-06-11T10:00:00.000Z',
      }),
    ]

    expect(buildFlashcardSummary(stats)).toEqual({
      totalSeen: 4,
      si: 1,
      inParte: 1,
      no: 1,
      nonRisposta: 1,
    })

    expect(weakFlashcards(stats, cards)).toEqual([
      {
        cardId: 'f2',
        front: 'Front 2',
        macroargomenti: ['B'],
        lastEval: 'No',
        lastSeen: '2026-06-13T10:00:00.000Z',
      },
      {
        cardId: 'f3',
        front: 'Front 3',
        macroargomenti: ['C'],
        lastEval: 'In parte',
        lastSeen: '2026-06-12T10:00:00.000Z',
      },
    ])
  })

  it('keeps weak flashcard ordering deterministic when urgency and lastSeen tie', () => {
    const cards = [
      makeFlashCard({ id: 'f1', fronte: 'Front 1' }),
      makeFlashCard({ id: 'f2', fronte: 'Front 2' }),
      makeFlashCard({ id: 'f3', fronte: 'Front 3' }),
    ]
    const stats = [
      flashcardStat({ cardId: 'f3', lastEval: 'No', lastSeen: '2026-06-13T10:00:00.000Z' }),
      flashcardStat({ cardId: 'f1', lastEval: 'No', lastSeen: '2026-06-13T10:00:00.000Z' }),
      flashcardStat({ cardId: 'f2', lastEval: 'In parte', lastSeen: '2026-06-13T10:00:00.000Z' }),
    ]

    expect(weakFlashcards(stats, cards).map((card) => card.cardId)).toEqual(['f1', 'f3', 'f2'])
  })

  it('decodes valid sources and returns errors for invalid sources', () => {
    expect(decodeQuizSource(undefined)).toEqual({ status: 'missing' })
    expect(decodeQuizSource(encodeJson(makeQuizFile()))).toMatchObject({
      status: 'ready',
      questions: expect.any(Array),
    })
    expect(decodeQuizSource(encodeJson({ esame: 'Broken' }))).toEqual({
      status: 'error',
      message: 'Dettagli quiz non disponibili: file quiz non valido.',
    })
    expect(decodeFlashcardSource(undefined)).toEqual({ status: 'missing' })
    expect(decodeFlashcardSource(encodeJson(makeFlashcardFile()))).toMatchObject({
      status: 'ready',
      cards: expect.any(Array),
    })
    expect(decodeFlashcardSource(encodeJson({ esame: 'Broken' }))).toEqual({
      status: 'error',
      message: 'Dettagli flashcard non disponibili: file flashcard non valido.',
    })
  })
})
