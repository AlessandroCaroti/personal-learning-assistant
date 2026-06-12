import type { QuestionStats, QuizFile, QuizSession } from '../types'

export type ReviewResultType = 'error' | 'unanswered'
export type ReviewResultFilter = 'all' | ReviewResultType
export type RecentScope = 1 | 3 | 7 | 'all'

export interface ReviewQueueItem {
  questionId: string
  questionText: string
  macroargomenti: string[]
  resultType: ReviewResultType
  lastMissedAt: string
  latestSessionIndex: number
  accuracy: number | null
  timesShown: number
  timesCorrect: number
  correctAnswer: string
  explanation: string
}

export interface ReviewQueueFilters {
  macroargomento?: string
  resultType?: ReviewResultFilter
  recentScope?: RecentScope
}

export interface StudyTrendItem {
  sessionId: string
  date: string
  score: number
  total: number
  accuracyPercent: number
  secondsPerQuestion: number | null
}

export interface StudyStatsSummary {
  overallAccuracy: number | null
  seenQuestionCount: number
  totalQuestionCount: number
  progress: number
  averageSecondsPerQuestion: number | null
  completedSessionCount: number
  trend: StudyTrendItem[]
}

interface StudyServiceInput {
  quiz: QuizFile
  sessions: QuizSession[]
  stats: QuestionStats[]
}

const sortSessionsByLatestDate = (sessions: QuizSession[]): QuizSession[] =>
  [...sessions].sort((a, b) => b.date.localeCompare(a.date))

const buildStatsByQuestionId = (stats: QuestionStats[]): Map<string, QuestionStats> =>
  new Map(stats.map((stat) => [stat.questionId, stat]))

const getAccuracy = (stat: QuestionStats | undefined): number | null => {
  if (!stat || stat.timesShown <= 0) {
    return null
  }

  return stat.timesCorrect / stat.timesShown
}

const compareAccuracy = (left: number | null, right: number | null): number => {
  if (left === right) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }

  return left - right
}

export const buildReviewQueue = ({ quiz, sessions, stats }: StudyServiceInput): ReviewQueueItem[] => {
  const questionsById = new Map(quiz.domande.map((question) => [question.id, question]))
  const statsByQuestionId = buildStatsByQuestionId(stats)
  const latestSessions = sortSessionsByLatestDate(sessions)
  const queueByQuestionId = new Map<string, ReviewQueueItem>()

  latestSessions.forEach((session, latestSessionIndex) => {
    const missedEntries: Array<[string, ReviewResultType]> = [
      ...session.errors.map((questionId): [string, ReviewResultType] => [questionId, 'error']),
      ...session.unanswered.map((questionId): [string, ReviewResultType] => [
        questionId,
        'unanswered',
      ]),
    ]

    missedEntries.forEach(([questionId, resultType]) => {
      if (queueByQuestionId.has(questionId)) {
        return
      }

      const question = questionsById.get(questionId)
      if (!question) {
        return
      }

      const stat = statsByQuestionId.get(questionId)
      queueByQuestionId.set(questionId, {
        questionId,
        questionText: question.testo,
        macroargomenti: [...question.macroargomenti],
        resultType,
        lastMissedAt: session.date,
        latestSessionIndex,
        accuracy: getAccuracy(stat),
        timesShown: stat?.timesShown ?? 0,
        timesCorrect: stat?.timesCorrect ?? 0,
        correctAnswer: question.risposta_corretta,
        explanation: question.spiegazione,
      })
    })
  })

  return Array.from(queueByQuestionId.values())
}

export const sortReviewQueue = (queue: ReviewQueueItem[]): ReviewQueueItem[] =>
  [...queue].sort((a, b) => {
    const dateComparison = b.lastMissedAt.localeCompare(a.lastMissedAt)
    if (dateComparison !== 0) {
      return dateComparison
    }

    const accuracyComparison = compareAccuracy(a.accuracy, b.accuracy)
    if (accuracyComparison !== 0) {
      return accuracyComparison
    }

    return a.questionId.localeCompare(b.questionId)
  })

export const filterReviewQueue = (
  queue: ReviewQueueItem[],
  filters: ReviewQueueFilters = {},
): ReviewQueueItem[] => {
  const resultType = filters.resultType ?? 'all'
  const recentScope = filters.recentScope ?? 'all'

  return queue.filter((item) => {
    if (filters.macroargomento && !item.macroargomenti.includes(filters.macroargomento)) {
      return false
    }

    if (resultType !== 'all' && item.resultType !== resultType) {
      return false
    }

    if (recentScope !== 'all' && item.latestSessionIndex >= recentScope) {
      return false
    }

    return true
  })
}

export const buildStudyStats = ({ quiz, sessions, stats }: StudyServiceInput): StudyStatsSummary => {
  const questionIds = new Set(quiz.domande.map((question) => question.id))
  const relevantStats = stats.filter((stat) => questionIds.has(stat.questionId))
  const totalShown = relevantStats.reduce((sum, stat) => sum + stat.timesShown, 0)
  const totalCorrect = relevantStats.reduce((sum, stat) => sum + stat.timesCorrect, 0)
  const seenQuestionCount = relevantStats.filter((stat) => stat.timesShown > 0).length
  const totalQuestionCount = quiz.domande.length
  const totalSessionQuestions = sessions.reduce((sum, session) => sum + session.total, 0)
  const totalSessionSeconds = sessions.reduce((sum, session) => sum + session.totalTime, 0)

  return {
    overallAccuracy: totalShown > 0 ? totalCorrect / totalShown : null,
    seenQuestionCount,
    totalQuestionCount,
    progress: totalQuestionCount > 0 ? seenQuestionCount / totalQuestionCount : 0,
    averageSecondsPerQuestion:
      totalSessionQuestions > 0 ? totalSessionSeconds / totalSessionQuestions : null,
    completedSessionCount: sessions.length,
    trend: sortSessionsByLatestDate(sessions)
      .slice(0, 10)
      .map((session) => ({
        sessionId: session.id,
        date: session.date,
        score: session.score,
        total: session.total,
        accuracyPercent: session.total > 0 ? Math.round((session.score / session.total) * 100) : 0,
        secondsPerQuestion: session.total > 0 ? session.totalTime / session.total : null,
      })),
  }
}
