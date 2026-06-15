import type {
  FlashCard,
  FlashcardStats,
  QuestionStats,
  QuizDomanda,
  QuizSession,
} from '../types'
import { validateFlashcardFile, validateQuizFile } from './quizService'

export interface QuizSummary {
  totalSessions: number
  averageScorePercent: number | null
  bestScorePercent: number | null
  latestScorePercent: number | null
  averageTimeSeconds: number | null
  timeoutCount: number
  reviewCount: number
}

export interface WeakQuizQuestion {
  questionId: string
  text: string
  macroargomenti: string[]
  timesShown: number
  timesCorrect: number
  accuracyPercent: number
}

export interface WeakMacroargomento {
  name: string
  timesShown: number
  timesCorrect: number
  accuracyPercent: number
}

export interface FlashcardSummary {
  totalSeen: number
  si: number
  inParte: number
  no: number
  nonRisposta: number
}

export interface WeakFlashcard {
  cardId: string
  front: string
  macroargomenti: string[]
  lastEval: 'No' | 'In parte'
  lastSeen: string
}

export type QuizSourceResult =
  | { status: 'missing' }
  | { status: 'ready'; questions: QuizDomanda[] }
  | { status: 'error'; message: string }

export type FlashcardSourceResult =
  | { status: 'missing' }
  | { status: 'ready'; cards: FlashCard[] }
  | { status: 'error'; message: string }

function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return Math.round((part / total) * 100)
}

function decodeJson(data: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(data))
}

export function decodeQuizSource(data: ArrayBuffer | undefined): QuizSourceResult {
  if (!data) {
    return { status: 'missing' }
  }

  try {
    return { status: 'ready', questions: validateQuizFile(decodeJson(data)).domande }
  } catch {
    return {
      status: 'error',
      message: 'Dettagli quiz non disponibili: file quiz non valido.',
    }
  }
}

export function decodeFlashcardSource(data: ArrayBuffer | undefined): FlashcardSourceResult {
  if (!data) {
    return { status: 'missing' }
  }

  try {
    return { status: 'ready', cards: validateFlashcardFile(decodeJson(data)).carte }
  } catch {
    return {
      status: 'error',
      message: 'Dettagli flashcard non disponibili: file flashcard non valido.',
    }
  }
}

export function buildQuizSummary(sessions: QuizSession[]): QuizSummary {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      averageScorePercent: null,
      bestScorePercent: null,
      latestScorePercent: null,
      averageTimeSeconds: null,
      timeoutCount: 0,
      reviewCount: 0,
    }
  }

  const scores = sessions.map((session) => percent(session.score, session.total))
  const latestSession = [...sessions].sort((left, right) => right.date.localeCompare(left.date))[0]

  return {
    totalSessions: sessions.length,
    averageScorePercent: Math.round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length,
    ),
    bestScorePercent: Math.max(...scores),
    latestScorePercent: percent(latestSession.score, latestSession.total),
    averageTimeSeconds: Math.round(
      sessions.reduce((sum, session) => sum + session.totalTime, 0) / sessions.length,
    ),
    timeoutCount: sessions.filter((session) => session.completedByTimeout).length,
    reviewCount: sessions.filter((session) => session.isReview).length,
  }
}

export function weakQuizQuestions(
  stats: QuestionStats[],
  questions: QuizDomanda[],
): WeakQuizQuestion[] {
  const sourceOrder = new Map(questions.map((question, index) => [question.id, index]))
  const questionsById = new Map(questions.map((question) => [question.id, question]))

  return stats
    .filter((stat) => stat.timesShown > 0 && questionsById.has(stat.questionId))
    .map((stat) => {
      const question = questionsById.get(stat.questionId)!

      return {
        questionId: stat.questionId,
        text: question.testo,
        macroargomenti: question.macroargomenti,
        timesShown: stat.timesShown,
        timesCorrect: stat.timesCorrect,
        accuracyPercent: percent(stat.timesCorrect, stat.timesShown),
      }
    })
    .sort((left, right) => {
      const accuracyComparison = left.accuracyPercent - right.accuracyPercent
      if (accuracyComparison !== 0) {
        return accuracyComparison
      }

      const exposureComparison = right.timesShown - left.timesShown
      if (exposureComparison !== 0) {
        return exposureComparison
      }

      return (sourceOrder.get(left.questionId) ?? 0) - (sourceOrder.get(right.questionId) ?? 0)
    })
}

export function weakMacroargomenti(
  stats: QuestionStats[],
  questions: QuizDomanda[],
): WeakMacroargomento[] {
  const questionsById = new Map(questions.map((question) => [question.id, question]))
  const totals = new Map<string, { timesShown: number; timesCorrect: number }>()

  for (const stat of stats) {
    if (stat.timesShown <= 0) {
      continue
    }

    const question = questionsById.get(stat.questionId)
    if (!question) {
      continue
    }

    for (const macroargomento of question.macroargomenti) {
      const existing = totals.get(macroargomento) ?? { timesShown: 0, timesCorrect: 0 }
      totals.set(macroargomento, {
        timesShown: existing.timesShown + stat.timesShown,
        timesCorrect: existing.timesCorrect + stat.timesCorrect,
      })
    }
  }

  return [...totals.entries()]
    .map(([name, total]) => ({
      name,
      timesShown: total.timesShown,
      timesCorrect: total.timesCorrect,
      accuracyPercent: percent(total.timesCorrect, total.timesShown),
    }))
    .sort((left, right) => {
      const accuracyComparison = left.accuracyPercent - right.accuracyPercent
      if (accuracyComparison !== 0) {
        return accuracyComparison
      }

      const exposureComparison = right.timesShown - left.timesShown
      if (exposureComparison !== 0) {
        return exposureComparison
      }

      return left.name.localeCompare(right.name)
    })
}

export function buildFlashcardSummary(stats: FlashcardStats[]): FlashcardSummary {
  return {
    totalSeen: stats.length,
    si: stats.filter((stat) => stat.lastEval === 'Sì').length,
    inParte: stats.filter((stat) => stat.lastEval === 'In parte').length,
    no: stats.filter((stat) => stat.lastEval === 'No').length,
    nonRisposta: stats.filter((stat) => stat.lastEval === 'Non risposta').length,
  }
}

export function weakFlashcards(stats: FlashcardStats[], cards: FlashCard[]): WeakFlashcard[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]))
  const urgency = { No: 0, 'In parte': 1 } as const

  return stats
    .filter(
      (stat): stat is FlashcardStats & { lastEval: 'No' | 'In parte' } =>
        (stat.lastEval === 'No' || stat.lastEval === 'In parte') && cardsById.has(stat.cardId),
    )
    .map((stat) => {
      const card = cardsById.get(stat.cardId)!

      return {
        cardId: stat.cardId,
        front: card.fronte,
        macroargomenti: card.macroargomenti,
        lastEval: stat.lastEval,
        lastSeen: stat.lastSeen,
      }
    })
    .sort((left, right) => {
      const urgencyComparison = urgency[left.lastEval] - urgency[right.lastEval]
      if (urgencyComparison !== 0) {
        return urgencyComparison
      }

      return left.lastSeen.localeCompare(right.lastSeen)
    })
}
