import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlashCard, PausedSession } from '../types'

const saveFlashcardStat = vi.fn()
const savePausedSession = vi.fn()
const deletePausedSession = vi.fn()

vi.mock('../services/storageService', () => ({
  saveFlashcardStat,
  savePausedSession,
  deletePausedSession,
}))

vi.mock('../utils/shuffle', () => ({
  shuffle: <T,>(arr: T[]) => [...arr],
}))

const { useFlashcard } = await import('./useFlashcard')

const cards: FlashCard[] = [
  {
    id: 'c1',
    macroargomenti: ['Algebra'],
    fronte: 'Front 1',
    retro: 'Back 1',
  },
  {
    id: 'c2',
    macroargomenti: ['Geometria'],
    fronte: 'Front 2',
    retro: 'Back 2',
  },
  {
    id: 'c3',
    macroargomenti: ['Algebra', 'Analisi'],
    fronte: 'Front 3',
    retro: 'Back 3',
  },
]

function makePaused(overrides: Partial<PausedSession> = {}): PausedSession {
  return {
    id: 'exam-1__flashcard',
    examId: 'exam-1',
    mode: 'flashcard',
    savedAt: '2026-06-01T09:00:00.000Z',
    elapsedSeconds: 12,
    timeLimitSeconds: 900,
    macroargomenti: ['Algebra'],
    cardIds: ['c3', 'missing', 'c1'],
    currentCardIndex: 1,
    cardEvals: { c3: 'In parte', missing: 'No' },
    reviewQueue: ['c3'],
    ...overrides,
  }
}

describe('useFlashcard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveFlashcardStat.mockResolvedValue(undefined)
    savePausedSession.mockResolvedValue(undefined)
    deletePausedSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('starts a filtered session with OR macro filtering, count limit, and timer metadata', () => {
    const { result } = renderHook(() => useFlashcard('exam-1'))

    act(() => {
      result.current.startSession(cards, ['Analisi', 'Geometria'], 2, 300)
    })

    expect(result.current.timeLimitSeconds).toBe(300)
    expect(result.current.macroargomenti).toEqual(['Analisi', 'Geometria'])
    expect(result.current.isDone).toBe(false)
    expect(result.current.sessionState).toEqual({
      cards: [cards[1], cards[2]],
      currentIndex: 0,
      phase: 'front',
      cardEvals: {},
      reviewQueue: [],
      isInReview: false,
    })
  })

  it('moves uncertain cards through repeated review until all are known', () => {
    const { result } = renderHook(() => useFlashcard('exam-1'))

    act(() => {
      result.current.startSession([cards[0], cards[1]], [], 2, null)
      result.current.dontKnow()
    })

    expect(result.current.sessionState?.phase).toBe('back')
    expect(result.current.sessionState?.cardEvals).toEqual({ c1: 'No' })

    act(() => {
      result.current.evaluate('c1', 'No')
      result.current.evaluate('c2', 'In parte')
    })

    expect(result.current.sessionState).toMatchObject({
      cards: [cards[0], cards[1]],
      currentIndex: 0,
      phase: 'front',
      reviewQueue: ['c1', 'c2'],
      isInReview: true,
    })

    act(() => {
      result.current.evaluate('c1', 'Sì')
      result.current.evaluate('c2', 'In parte')
    })

    expect(result.current.sessionState).toMatchObject({
      cards: [cards[1]],
      currentIndex: 0,
      phase: 'front',
      reviewQueue: ['c2'],
      isInReview: true,
    })

    act(() => {
      result.current.evaluate('c2', 'Sì')
    })

    expect(result.current.isDone).toBe(true)
    expect(result.current.sessionState?.currentIndex).toBe(1)
    expect(result.current.sessionState?.cards).toHaveLength(1)
  })

  it('ignores evaluations for cards that are not current', () => {
    const { result } = renderHook(() => useFlashcard('exam-1'))

    act(() => {
      result.current.startSession([cards[0], cards[1]], [], 2, null)
      result.current.evaluate('c2', 'Sì')
    })

    expect(result.current.sessionState).toMatchObject({
      currentIndex: 0,
      cardEvals: {},
      phase: 'front',
    })
  })

  it('pauses by saving current card order, evals, review queue, and metadata', async () => {
    const { result } = renderHook(() => useFlashcard('exam-1'))

    act(() => {
      result.current.startSession([cards[0], cards[2]], ['Algebra'], 2, 450)
      result.current.evaluate('c1', 'No')
    })

    await act(async () => {
      await result.current.pauseSession(123)
    })

    expect(savePausedSession).toHaveBeenCalledWith({
      id: 'exam-1__flashcard',
      examId: 'exam-1',
      mode: 'flashcard',
      savedAt: expect.any(String),
      elapsedSeconds: 123,
      timeLimitSeconds: 450,
      macroargomenti: ['Algebra'],
      cardIds: ['c1', 'c3'],
      currentCardIndex: 1,
      cardEvals: { c1: 'No' },
      reviewQueue: [],
    })
  })

  it('pauses review mode with the full original card order', async () => {
    const { result } = renderHook(() => useFlashcard('exam-1'))

    act(() => {
      result.current.startSession([cards[0], cards[1]], [], 2, null)
      result.current.evaluate('c1', 'Sì')
      result.current.evaluate('c2', 'No')
    })

    expect(result.current.sessionState).toMatchObject({
      cards: [cards[1]],
      reviewQueue: ['c2'],
      isInReview: true,
    })

    await act(async () => {
      await result.current.pauseSession(45)
    })

    expect(savePausedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cardIds: ['c1', 'c2'],
        currentCardIndex: 0,
        cardEvals: { c1: 'Sì', c2: 'No' },
        reviewQueue: ['c2'],
      }),
    )
  })

  it('finishes by saving active-session stats with Non risposta for unvisited cards', async () => {
    const { result } = renderHook(() => useFlashcard('exam-1'))

    act(() => {
      result.current.startSession([cards[0], cards[1], cards[2]], [], 3, 60)
      result.current.evaluate('c1', 'Sì')
    })

    await act(async () => {
      await result.current.finishSession(60, true)
    })

    expect(saveFlashcardStat).toHaveBeenCalledTimes(3)
    expect(saveFlashcardStat).toHaveBeenCalledWith({
      id: 'exam-1__c1',
      examId: 'exam-1',
      cardId: 'c1',
      lastEval: 'Sì',
      lastSeen: expect.any(String),
    })
    expect(saveFlashcardStat).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c2', lastEval: 'Non risposta' }),
    )
    expect(saveFlashcardStat).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c3', lastEval: 'Non risposta' }),
    )
    expect(deletePausedSession).toHaveBeenCalledWith('exam-1__flashcard')
    expect(result.current.sessionState).toBeNull()
    expect(result.current.timeLimitSeconds).toBeNull()
    expect(result.current.macroargomenti).toEqual([])
  })

  it('finishes review mode by saving stats for the full original session', async () => {
    const { result } = renderHook(() => useFlashcard('exam-1'))

    act(() => {
      result.current.startSession([cards[0], cards[1], cards[2]], [], 3, null)
      result.current.evaluate('c1', 'Sì')
      result.current.evaluate('c2', 'No')
      result.current.evaluate('c3', 'In parte')
      result.current.evaluate('c2', 'Sì')
      result.current.evaluate('c3', 'Sì')
    })

    expect(result.current.isDone).toBe(true)

    await act(async () => {
      await result.current.finishSession(90, false)
    })

    expect(saveFlashcardStat).toHaveBeenCalledTimes(3)
    expect(saveFlashcardStat).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c1', lastEval: 'Sì' }),
    )
    expect(saveFlashcardStat).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c2', lastEval: 'Sì' }),
    )
    expect(saveFlashcardStat).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c3', lastEval: 'Sì' }),
    )
  })

  it('resumes valid flashcard pauses and ignores missing card ids and evals', () => {
    const { result } = renderHook(() => useFlashcard('exam-1'))

    act(() => {
      result.current.resumeFromPaused(makePaused({ mode: 'quiz' }), cards)
    })

    expect(result.current.sessionState).toBeNull()

    act(() => {
      result.current.resumeFromPaused(makePaused({ reviewQueue: [] }), cards)
    })

    expect(result.current.timeLimitSeconds).toBe(900)
    expect(result.current.macroargomenti).toEqual(['Algebra'])
    expect(result.current.isDone).toBe(false)
    expect(result.current.sessionState).toEqual({
      cards: [cards[2], cards[0]],
      currentIndex: 1,
      phase: 'front',
      cardEvals: { c3: 'In parte' },
      reviewQueue: [],
      isInReview: false,
    })
  })

  it('resumes paused review mode from the saved review queue position', () => {
    const { result } = renderHook(() => useFlashcard('exam-1'))

    act(() => {
      result.current.resumeFromPaused(
        makePaused({
          cardIds: ['c1', 'c2', 'c3'],
          currentCardIndex: 1,
          cardEvals: { c1: 'Sì', c2: 'No', c3: 'In parte' },
          reviewQueue: ['c2', 'c3'],
        }),
        cards,
      )
    })

    expect(result.current.sessionState).toEqual({
      cards: [cards[1], cards[2]],
      currentIndex: 1,
      phase: 'front',
      cardEvals: { c1: 'Sì', c2: 'No', c3: 'In parte' },
      reviewQueue: ['c2', 'c3'],
      isInReview: true,
    })
  })
})
