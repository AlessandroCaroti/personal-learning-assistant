import { useCallback, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  buildSessionQuestions,
  filterDomande,
  type SessionQuestion,
} from '../services/quizService'
import * as storage from '../services/storageService'
import type { PausedSession, QuizDomanda, QuizSession } from '../types'
import { shuffle } from '../utils/shuffle'

export interface QuizSessionState {
  questions: SessionQuestion[]
  currentIndex: number
  confirmedAnswers: Record<string, string>
  selectedAnswer: string | null
}

interface QuizSessionMetadata {
  timeLimitSeconds: number | null
  macroargomenti: string[]
  isReviewSession: boolean
}

function prepareQuestion(domanda: QuizDomanda): SessionQuestion {
  if (domanda.tipo !== 'multipla' || !domanda.opzioni) return { ...domanda }

  return {
    ...domanda,
    opzioni: [...domanda.opzioni],
    opzioniShuffled: shuffle(domanda.opzioni),
  }
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(0, index), length - 1)
}

function filterConfirmedAnswers(
  answers: Record<string, string> | undefined,
  validQuestionIds: Set<string>,
): Record<string, string> {
  if (!answers) return {}

  return Object.fromEntries(
    Object.entries(answers).filter(([questionId]) => validQuestionIds.has(questionId)),
  )
}

export function useQuiz(examId: string) {
  const [sessionState, setSessionState] = useState<QuizSessionState | null>(null)
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null)
  const [macroargomenti, setMacroargomenti] = useState<string[]>([])
  const [, setIsReviewSession] = useState(false)
  const sessionStateRef = useRef<QuizSessionState | null>(null)
  const sessionMetadataRef = useRef<QuizSessionMetadata>({
    timeLimitSeconds: null,
    macroargomenti: [],
    isReviewSession: false,
  })
  const selectedAnswerRef = useRef<string | null>(null)
  const statsUpdateQueueRef = useRef<Promise<void>>(Promise.resolve())

  const clearSelectedAnswer = useCallback(() => {
    selectedAnswerRef.current = null
  }, [])

  const setActiveSession = useCallback(
    (nextSessionState: QuizSessionState | null, metadata: QuizSessionMetadata) => {
      sessionMetadataRef.current = {
        ...metadata,
        macroargomenti: [...metadata.macroargomenti],
      }
      sessionStateRef.current = nextSessionState
      setTimeLimitSeconds(metadata.timeLimitSeconds)
      setMacroargomenti([...metadata.macroargomenti])
      setIsReviewSession(metadata.isReviewSession)
      setSessionState(nextSessionState)
    },
    [],
  )

  const enqueueStatsUpdate = useCallback(
    (questionId: string, isCorrect: boolean) => {
      const update = async () => {
        const stats = await storage.getQuestionStats(examId)
        const existing = stats.find((item) => item.questionId === questionId)
        await storage.saveQuestionStat({
          id: existing?.id ?? `${examId}__${questionId}`,
          examId,
          questionId,
          timesShown: (existing?.timesShown ?? 0) + 1,
          timesCorrect: (existing?.timesCorrect ?? 0) + (isCorrect ? 1 : 0),
        })
      }

      statsUpdateQueueRef.current = statsUpdateQueueRef.current
        .catch(() => undefined)
        .then(update)
        .catch((error) => {
          console.error('Failed to update question stats', error)
        })
    },
    [examId],
  )

  const startSession = useCallback(
    (
      allDomande: QuizDomanda[],
      selectedMacro: string[],
      n: number,
      limitSec: number | null,
    ) => {
      const filtered = filterDomande(allDomande, selectedMacro)
      const questions = buildSessionQuestions(filtered, Math.min(Math.max(0, n), filtered.length))

      clearSelectedAnswer()
      const nextSessionState = {
        questions,
        currentIndex: 0,
        confirmedAnswers: {},
        selectedAnswer: null,
      }
      setActiveSession(nextSessionState, {
        timeLimitSeconds: limitSec,
        macroargomenti: selectedMacro,
        isReviewSession: false,
      })
    },
    [clearSelectedAnswer, setActiveSession],
  )

  const resumeFromPaused = useCallback(
    (ps: PausedSession, allDomande: QuizDomanda[]) => {
      if (ps.mode !== 'quiz' || !ps.questionIds?.length) return

      const sourceById = new Map(allDomande.map((domanda) => [domanda.id, domanda]))
      const questions = ps.questionIds
        .map((questionId) => sourceById.get(questionId))
        .filter((domanda): domanda is QuizDomanda => Boolean(domanda))
        .map(prepareQuestion)

      if (questions.length === 0) return

      const validQuestionIds = new Set(questions.map((question) => question.id))

      clearSelectedAnswer()
      const nextSessionState = {
        questions,
        currentIndex: clampIndex(ps.currentQuestionIndex ?? 0, questions.length),
        confirmedAnswers: filterConfirmedAnswers(ps.confirmedAnswers, validQuestionIds),
        selectedAnswer: null,
      }
      setActiveSession(nextSessionState, {
        timeLimitSeconds: ps.timeLimitSeconds,
        macroargomenti: ps.macroargomenti ?? [],
        isReviewSession: ps.isReview === true,
      })
    },
    [clearSelectedAnswer, setActiveSession],
  )

  const selectAnswer = useCallback((answer: string) => {
    selectedAnswerRef.current = answer
    const current = sessionStateRef.current
    const nextSessionState = current ? { ...current, selectedAnswer: answer } : current
    sessionStateRef.current = nextSessionState
    setSessionState(nextSessionState)
  }, [])

  const confirmAnswer = useCallback(
    (questionId: string, elapsedSeconds: number) => {
      void elapsedSeconds
      const capturedAnswer = selectedAnswerRef.current
      if (capturedAnswer === null) return

      const current = sessionStateRef.current
      const question = current?.questions.find((item) => item.id === questionId)
      if (!question) return

      clearSelectedAnswer()
      const nextSessionState = current
        ? {
          ...current,
          confirmedAnswers: {
            ...current.confirmedAnswers,
            [questionId]: capturedAnswer,
          },
          selectedAnswer: null,
        }
        : current
      sessionStateRef.current = nextSessionState
      setSessionState(nextSessionState)

      enqueueStatsUpdate(questionId, capturedAnswer === question.risposta_corretta)
    },
    [clearSelectedAnswer, enqueueStatsUpdate],
  )

  const goTo = useCallback(
    (index: number) => {
      clearSelectedAnswer()
      const current = sessionStateRef.current
      const nextSessionState = current
        ? {
          ...current,
          currentIndex: clampIndex(index, current.questions.length),
          selectedAnswer: null,
        }
        : current
      sessionStateRef.current = nextSessionState
      setSessionState(nextSessionState)
    },
    [clearSelectedAnswer],
  )

  const pauseSession = useCallback(
    async (elapsedSeconds: number) => {
      const current = sessionStateRef.current
      if (!current) return
      const metadata = sessionMetadataRef.current

      await storage.savePausedSession({
        id: `${examId}__quiz`,
        examId,
        mode: 'quiz',
        savedAt: new Date().toISOString(),
        elapsedSeconds,
        timeLimitSeconds: metadata.timeLimitSeconds,
        macroargomenti: metadata.macroargomenti,
        questionIds: current.questions.map((question) => question.id),
        currentQuestionIndex: current.currentIndex,
        confirmedAnswers: current.confirmedAnswers,
        isReview: metadata.isReviewSession,
      })
    },
    [examId],
  )

  const finishSession = useCallback(
    async (
      elapsedSeconds: number,
      completedByTimeout: boolean,
      allDomande: QuizDomanda[],
    ): Promise<QuizSession | null> => {
      void allDomande
      const current = sessionStateRef.current
      if (!current) return null
      const metadata = sessionMetadataRef.current

      const errors: string[] = []
      const unanswered: string[] = []
      let score = 0

      for (const question of current.questions) {
        const answer = current.confirmedAnswers[question.id]
        if (answer === undefined) {
          unanswered.push(question.id)
        } else if (answer === question.risposta_corretta) {
          score += 1
        } else {
          errors.push(question.id)
        }
      }

      const savedSession: QuizSession = {
        id: uuidv4(),
        examId,
        date: new Date().toISOString(),
        score,
        total: current.questions.length,
        totalTime: elapsedSeconds,
        timeLimitSeconds: metadata.timeLimitSeconds,
        completedByTimeout,
        macroargomenti: metadata.macroargomenti,
        errors,
        unanswered,
        isReview: metadata.isReviewSession,
      }

      await storage.saveQuizSession(savedSession)
      await storage.deletePausedSession(`${examId}__quiz`)
      clearSelectedAnswer()
      setActiveSession(null, {
        timeLimitSeconds: null,
        macroargomenti: [],
        isReviewSession: false,
      })

      return savedSession
    },
    [clearSelectedAnswer, examId, setActiveSession],
  )

  const startReviewSession = useCallback(
    (errors: string[], unanswered: string[], allDomande: QuizDomanda[]) => {
      const requestedIds = [...new Set([...errors, ...unanswered])]
      const sourceById = new Map(allDomande.map((domanda) => [domanda.id, domanda]))
      const questions = requestedIds
        .map((questionId) => sourceById.get(questionId))
        .filter((domanda): domanda is QuizDomanda => Boolean(domanda))
        .map(prepareQuestion)

      if (questions.length === 0) {
        throw new Error('Nessuna domanda disponibile per il ripasso')
      }

      clearSelectedAnswer()
      const nextSessionState = {
        questions,
        currentIndex: 0,
        confirmedAnswers: {},
        selectedAnswer: null,
      }
      setActiveSession(nextSessionState, {
        timeLimitSeconds: null,
        macroargomenti: [],
        isReviewSession: true,
      })
    },
    [clearSelectedAnswer, setActiveSession],
  )

  return {
    sessionState,
    timeLimitSeconds,
    macroargomenti,
    startSession,
    resumeFromPaused,
    selectAnswer,
    confirmAnswer,
    goTo,
    pauseSession,
    finishSession,
    startReviewSession,
  }
}
