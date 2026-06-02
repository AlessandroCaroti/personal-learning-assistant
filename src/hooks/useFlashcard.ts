import { useCallback, useRef, useState } from 'react'
import * as storage from '../services/storageService'
import type { CardEval, FlashCard, PausedSession } from '../types'
import { shuffle } from '../utils/shuffle'

export type FlashcardPhase = 'front' | 'back'

export interface FlashcardSessionState {
  cards: FlashCard[]
  currentIndex: number
  phase: FlashcardPhase
  cardEvals: Record<string, CardEval>
  reviewQueue: string[]
  isInReview: boolean
}

interface FlashcardSessionMetadata {
  timeLimitSeconds: number | null
  macroargomenti: string[]
}

function filterCards(cards: FlashCard[], selectedMacro: string[]): FlashCard[] {
  if (selectedMacro.length === 0) return cards
  const selected = new Set(selectedMacro)
  return cards.filter((card) => card.macroargomenti.some((macro) => selected.has(macro)))
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(0, index), length - 1)
}

function filterCardEvals(
  cardEvals: Record<string, CardEval> | undefined,
  validCardIds: Set<string>,
): Record<string, CardEval> {
  if (!cardEvals) return {}

  return Object.fromEntries(
    Object.entries(cardEvals).filter(([cardId]) => validCardIds.has(cardId)),
  )
}

function filterReviewQueue(
  reviewQueue: string[] | undefined,
  validCardIds: Set<string>,
): string[] {
  if (!reviewQueue) return []
  return reviewQueue.filter((cardId) => validCardIds.has(cardId))
}

export function useFlashcard(examId: string) {
  const [sessionState, setSessionState] = useState<FlashcardSessionState | null>(null)
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null)
  const [macroargomenti, setMacroargomenti] = useState<string[]>([])
  const sessionStateRef = useRef<FlashcardSessionState | null>(null)
  const originalSessionCardsRef = useRef<FlashCard[]>([])
  const sessionMetadataRef = useRef<FlashcardSessionMetadata>({
    timeLimitSeconds: null,
    macroargomenti: [],
  })

  const setActiveSession = useCallback(
    (nextSessionState: FlashcardSessionState | null, metadata: FlashcardSessionMetadata) => {
      sessionStateRef.current = nextSessionState
      sessionMetadataRef.current = {
        ...metadata,
        macroargomenti: [...metadata.macroargomenti],
      }
      setSessionState(nextSessionState)
      setTimeLimitSeconds(metadata.timeLimitSeconds)
      setMacroargomenti([...metadata.macroargomenti])
    },
    [],
  )

  const updateSessionState = useCallback((updater: (current: FlashcardSessionState) => FlashcardSessionState) => {
    const current = sessionStateRef.current
    if (!current) return

    const nextSessionState = updater(current)
    sessionStateRef.current = nextSessionState
    setSessionState(nextSessionState)
  }, [])

  const moveAfterEvaluation = useCallback(
    (current: FlashcardSessionState, cardEvals: Record<string, CardEval>): FlashcardSessionState => {
      const nextIndex = current.currentIndex + 1

      if (nextIndex < current.cards.length) {
        return {
          ...current,
          currentIndex: nextIndex,
          phase: 'front',
          cardEvals,
        }
      }

      const reviewIds = current.cards
        .filter((card) => {
          const cardEval = cardEvals[card.id]
          return cardEval === 'No' || cardEval === 'In parte'
        })
        .map((card) => card.id)

      if (reviewIds.length === 0) {
        return {
          ...current,
          currentIndex: current.cards.length,
          phase: 'front',
          cardEvals,
          reviewQueue: [],
        }
      }

      const reviewQueue = shuffle(reviewIds)
      const sourceById = new Map(current.cards.map((card) => [card.id, card]))
      const reviewCards = reviewQueue
        .map((cardId) => sourceById.get(cardId))
        .filter((card): card is FlashCard => Boolean(card))

      return {
        cards: reviewCards,
        currentIndex: 0,
        phase: 'front',
        cardEvals,
        reviewQueue,
        isInReview: true,
      }
    },
    [],
  )

  const startSession = useCallback(
    (
      allCards: FlashCard[],
      selectedMacro: string[],
      n: number,
      limitSec: number | null,
    ) => {
      const filtered = filterCards(allCards, selectedMacro)
      const count = Math.min(Math.max(0, n), filtered.length)
      const cards = shuffle(filtered).slice(0, count)
      originalSessionCardsRef.current = cards

      setActiveSession(
        {
          cards,
          currentIndex: 0,
          phase: 'front',
          cardEvals: {},
          reviewQueue: [],
          isInReview: false,
        },
        {
          timeLimitSeconds: limitSec,
          macroargomenti: selectedMacro,
        },
      )
    },
    [setActiveSession],
  )

  const resumeFromPaused = useCallback(
    (ps: PausedSession, allCards: FlashCard[]) => {
      if (ps.mode !== 'flashcard' || !ps.cardIds?.length) return

      const sourceById = new Map(allCards.map((card) => [card.id, card]))
      const cards = ps.cardIds
        .map((cardId) => sourceById.get(cardId))
        .filter((card): card is FlashCard => Boolean(card))

      if (cards.length === 0) return

      const validCardIds = new Set(cards.map((card) => card.id))
      const reviewQueue = filterReviewQueue(ps.reviewQueue, validCardIds)
      const isInReview = reviewQueue.length > 0
      const activeCards = isInReview
        ? reviewQueue
            .map((cardId) => sourceById.get(cardId))
            .filter((card): card is FlashCard => Boolean(card))
        : cards
      originalSessionCardsRef.current = cards
      setActiveSession(
        {
          cards: activeCards,
          currentIndex: clampIndex(ps.currentCardIndex ?? 0, activeCards.length),
          phase: 'front',
          cardEvals: filterCardEvals(ps.cardEvals, validCardIds),
          reviewQueue,
          isInReview,
        },
        {
          timeLimitSeconds: ps.timeLimitSeconds,
          macroargomenti: ps.macroargomenti ?? [],
        },
      )
    },
    [setActiveSession],
  )

  const showBack = useCallback(() => {
    updateSessionState((current) => ({
      ...current,
      phase: 'back',
    }))
  }, [updateSessionState])

  const dontKnow = useCallback(() => {
    updateSessionState((current) => {
      const currentCard = current.cards[current.currentIndex]
      if (!currentCard) return current

      return {
        ...current,
        phase: 'back',
        cardEvals: {
          ...current.cardEvals,
          [currentCard.id]: 'No',
        },
      }
    })
  }, [updateSessionState])

  const evaluate = useCallback(
    (cardId: string, cardEval: CardEval) => {
      updateSessionState((current) => {
        if (current.cards[current.currentIndex]?.id !== cardId) return current

        return moveAfterEvaluation(current, {
          ...current.cardEvals,
          [cardId]: cardEval,
        })
      })
    },
    [moveAfterEvaluation, updateSessionState],
  )

  const pauseSession = useCallback(
    async (elapsedSeconds: number) => {
      const current = sessionStateRef.current
      if (!current) return
      const metadata = sessionMetadataRef.current
      const persistedCards =
        originalSessionCardsRef.current.length > 0
          ? originalSessionCardsRef.current
          : current.cards

      await storage.savePausedSession({
        id: `${examId}__flashcard`,
        examId,
        mode: 'flashcard',
        savedAt: new Date().toISOString(),
        elapsedSeconds,
        timeLimitSeconds: metadata.timeLimitSeconds,
        macroargomenti: metadata.macroargomenti,
        cardIds: persistedCards.map((card) => card.id),
        currentCardIndex: current.currentIndex,
        cardEvals: current.cardEvals,
        reviewQueue: current.reviewQueue,
      })
    },
    [examId],
  )

  const finishSession = useCallback(
    async (elapsedSeconds: number, timedOut: boolean) => {
      void elapsedSeconds
      void timedOut
      const current = sessionStateRef.current
      if (!current) return
      const lastSeen = new Date().toISOString()
      const cardsToPersist =
        originalSessionCardsRef.current.length > 0
          ? originalSessionCardsRef.current
          : current.cards

      await Promise.all(
        cardsToPersist.map((card) =>
          storage.saveFlashcardStat({
            id: `${examId}__${card.id}`,
            examId,
            cardId: card.id,
            lastEval: current.cardEvals[card.id] ?? 'Non risposta',
            lastSeen,
          }),
        ),
      )
      await storage.deletePausedSession(`${examId}__flashcard`)
      setActiveSession(null, {
        timeLimitSeconds: null,
        macroargomenti: [],
      })
      originalSessionCardsRef.current = []
    },
    [examId, setActiveSession],
  )

  return {
    sessionState,
    timeLimitSeconds,
    macroargomenti,
    isDone: sessionState ? sessionState.currentIndex >= sessionState.cards.length : false,
    startSession,
    resumeFromPaused,
    showBack,
    dontKnow,
    evaluate,
    pauseSession,
    finishSession,
  }
}
