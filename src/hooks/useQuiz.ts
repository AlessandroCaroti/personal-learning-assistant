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
  const [isReviewSession, setIsReviewSession] = useState(false)
  const sessionStateRef = useRef<QuizSessionState | null>(null)
  const selectedAnswerRef = useRef<string | null>(null)

  const clearSelectedAnswer = useCallback(() => {
    selectedAnswerRef.current = null
  }, [])

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
      setTimeLimitSeconds(limitSec)
      setMacroargomenti([...selectedMacro])
      setIsReviewSession(false)
      const nextSessionState = {
        questions,
        currentIndex: 0,
        confirmedAnswers: {},
        selectedAnswer: null,
      }
      sessionStateRef.current = nextSessionState
      setSessionState(nextSessionState)
    },
    [clearSelectedAnswer],
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
      setTimeLimitSeconds(ps.timeLimitSeconds)
      setMacroargomenti([...(ps.macroargomenti ?? [])])
      setIsReviewSession(false)
      const nextSessionState = {
        questions,
        currentIndex: clampIndex(ps.currentQuestionIndex ?? 0, questions.length),
        confirmedAnswers: filterConfirmedAnswers(ps.confirmedAnswers, validQuestionIds),
        selectedAnswer: null,
      }
      sessionStateRef.current = nextSessionState
      setSessionState(nextSessionState)
    },
    [clearSelectedAnswer],
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

      void (async () => {
        const stats = await storage.getQuestionStats(examId)
        const existing = stats.find((item) => item.questionId === questionId)
        await storage.saveQuestionStat({
          id: existing?.id ?? `${examId}__${questionId}`,
          examId,
          questionId,
          timesShown: (existing?.timesShown ?? 0) + 1,
          timesCorrect:
            (existing?.timesCorrect ?? 0) +
            (capturedAnswer === question.risposta_corretta ? 1 : 0),
        })
      })()
    },
    [clearSelectedAnswer, examId],
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

      await storage.savePausedSession({
        id: `${examId}__quiz`,
        examId,
        mode: 'quiz',
        savedAt: new Date().toISOString(),
        elapsedSeconds,
        timeLimitSeconds,
        macroargomenti,
        questionIds: current.questions.map((question) => question.id),
        currentQuestionIndex: current.currentIndex,
        confirmedAnswers: current.confirmedAnswers,
      })
    },
    [examId, macroargomenti, timeLimitSeconds],
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
        timeLimitSeconds,
        completedByTimeout,
        macroargomenti,
        errors,
        unanswered,
        isReview: isReviewSession,
      }

      await storage.saveQuizSession(savedSession)
      await storage.deletePausedSession(`${examId}__quiz`)
      clearSelectedAnswer()
      sessionStateRef.current = null
      setSessionState(null)

      return savedSession
    },
    [
      clearSelectedAnswer,
      examId,
      isReviewSession,
      macroargomenti,
      timeLimitSeconds,
    ],
  )

  const startReviewSession = useCallback(
    (errors: string[], unanswered: string[], allDomande: QuizDomanda[]) => {
      const requestedIds = [...new Set([...errors, ...unanswered])]
      const sourceById = new Map(allDomande.map((domanda) => [domanda.id, domanda]))
      const questions = requestedIds
        .map((questionId) => sourceById.get(questionId))
        .filter((domanda): domanda is QuizDomanda => Boolean(domanda))
        .map(prepareQuestion)

      clearSelectedAnswer()
      setTimeLimitSeconds(null)
      setMacroargomenti([])
      setIsReviewSession(true)
      const nextSessionState = {
        questions,
        currentIndex: 0,
        confirmedAnswers: {},
        selectedAnswer: null,
      }
      sessionStateRef.current = nextSessionState
      setSessionState(nextSessionState)
    },
    [clearSelectedAnswer],
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
