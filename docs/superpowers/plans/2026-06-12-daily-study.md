# Daily Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a quiz-only daily study area with a cumulative review queue, basic study statistics, dashboard summary, and reusable review-session launch flow.

**Architecture:** Add a pure `studyService` module that derives queue items and statistics from existing quiz sessions, question stats, and the current quiz file. Add a `/esame/:examId/studio` page and a compact dashboard summary that consume this service. Generalize quiz review navigation to a single `reviewQuestionIds` contract without changing IndexedDB schema or sync storage.

**Tech Stack:** React 18.3.1, TypeScript 5.6 strict mode, Vite 6, Vitest 4.1.8, React Testing Library, IndexedDB through the existing `storageService`.

---

## Scope Check

The approved spec is focused enough for one implementation plan. It touches one feature area: quiz-based daily study. It deliberately excludes flashcards, notes, bookmarks, difficulty filtering, global search, backup import/export, JSON schema changes, and new IndexedDB stores.

## File Structure

- Create `src/services/studyService.ts`: pure domain logic for review queue construction, filtering, sorting, and derived statistics.
- Create `src/services/studyService.test.ts`: unit tests for queue rules, filters, and stats.
- Modify `src/hooks/useQuiz.ts`: simplify `startReviewSession` to accept one ordered question id list.
- Modify `src/pages/QuizSessionPage.tsx`: read unified `reviewQuestionIds` state while temporarily tolerating the previous `reviewErrors`/`reviewUnanswered` state during migration.
- Modify `src/pages/QuizSessionPage.test.tsx`: update and add review-state tests.
- Modify `src/pages/QuizResultPage.tsx`: navigate with `reviewQuestionIds`.
- Modify `src/pages/QuizResultPage.test.tsx`: update expected navigation state.
- Create `src/pages/StudyPage.tsx`: load exam quiz, sessions, and question stats; render stats, trend, filters, queue, detail, and review actions.
- Create `src/pages/StudyPage.test.tsx`: UI coverage for loading, error/empty states, filters, and review navigation.
- Modify `src/pages/DashboardPage.tsx`: load sessions/stats when a quiz exists and render the compact daily-study summary.
- Modify `src/pages/DashboardPage.test.tsx`: dashboard summary empty and populated states.
- Modify `src/App.tsx`: add `/esame/:examId/studio` route.
- Modify `src/App.test.tsx` if route expectations are explicitly enumerated there.

Do not modify `src/services/storageService.ts` or IndexedDB version for this feature.

---

### Task 1: Add Pure Daily Study Domain Service

**Files:**
- Create: `src/services/studyService.ts`
- Create: `src/services/studyService.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/services/studyService.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { QuestionStats, QuizSession } from '../types'
import { makeQuizDomanda, makeQuizFile } from '../__tests__/factories'
import {
  buildReviewQueue,
  buildStudyStats,
  filterReviewQueue,
  sortReviewQueue,
  type ReviewQueueFilters,
} from './studyService'

const quiz = makeQuizFile([
  makeQuizDomanda({
    id: 'q1',
    macroargomenti: ['Algebra'],
    testo: 'Question 1',
    risposta_corretta: 'Correct 1',
    opzioni: ['Correct 1', 'Wrong 1'],
    spiegazione: 'Explanation 1',
  }),
  makeQuizDomanda({
    id: 'q2',
    macroargomenti: ['Geometry'],
    testo: 'Question 2',
    risposta_corretta: 'Correct 2',
    opzioni: ['Correct 2', 'Wrong 2'],
    spiegazione: 'Explanation 2',
  }),
  makeQuizDomanda({
    id: 'q3',
    macroargomenti: ['Algebra', 'Geometry'],
    testo: 'Question 3',
    risposta_corretta: 'Correct 3',
    opzioni: ['Correct 3', 'Wrong 3'],
    spiegazione: 'Explanation 3',
  }),
])

function session(overrides: Partial<QuizSession>): QuizSession {
  return {
    id: 'session-1',
    examId: 'exam-1',
    date: '2026-06-01T09:00:00.000Z',
    score: 0,
    total: 2,
    totalTime: 60,
    timeLimitSeconds: null,
    completedByTimeout: false,
    macroargomenti: [],
    errors: [],
    unanswered: [],
    isReview: false,
    ...overrides,
  }
}

function stat(questionId: string, timesShown: number, timesCorrect: number): QuestionStats {
  return {
    id: `exam-1__${questionId}`,
    examId: 'exam-1',
    questionId,
    timesShown,
    timesCorrect,
  }
}

describe('studyService', () => {
  it('builds a cumulative review queue from errors and unanswered ids', () => {
    const queue = buildReviewQueue({
      quiz,
      sessions: [
        session({
          id: 'old',
          date: '2026-06-01T09:00:00.000Z',
          errors: ['q1'],
          unanswered: ['missing'],
        }),
        session({
          id: 'new',
          date: '2026-06-02T09:00:00.000Z',
          errors: [],
          unanswered: ['q2'],
        }),
      ],
      stats: [stat('q1', 4, 2), stat('q2', 3, 1)],
    })

    expect(queue.map((item) => item.questionId)).toEqual(['q2', 'q1'])
    expect(queue[0]).toMatchObject({
      questionId: 'q2',
      questionText: 'Question 2',
      lastResult: 'unanswered',
      lastMissedAt: '2026-06-02T09:00:00.000Z',
      accuracy: 1 / 3,
    })
    expect(queue.some((item) => item.questionId === 'missing')).toBe(false)
  })

  it('sorts by latest miss, then lower accuracy, then id', () => {
    const queue = buildReviewQueue({
      quiz,
      sessions: [
        session({ id: 'same-date', date: '2026-06-02T09:00:00.000Z', errors: ['q1', 'q2', 'q3'] }),
      ],
      stats: [stat('q1', 10, 9), stat('q2', 10, 1), stat('q3', 10, 1)],
    })

    expect(queue.map((item) => item.questionId)).toEqual(['q2', 'q3', 'q1'])
  })

  it('filters queue items by macroargomento, result type, and recent sessions', () => {
    const sessions = [
      session({ id: 's1', date: '2026-06-03T09:00:00.000Z', errors: ['q1'], unanswered: [] }),
      session({ id: 's2', date: '2026-06-02T09:00:00.000Z', errors: [], unanswered: ['q2'] }),
      session({ id: 's3', date: '2026-06-01T09:00:00.000Z', errors: ['q3'], unanswered: [] }),
    ]
    const queue = buildReviewQueue({ quiz, sessions, stats: [] })
    const filters: ReviewQueueFilters = {
      macroargomento: 'Algebra',
      resultType: 'error',
      recentScope: 1,
    }

    expect(filterReviewQueue(queue, filters).map((item) => item.questionId)).toEqual(['q1'])
    expect(filterReviewQueue(queue, { resultType: 'unanswered', recentScope: 'all' }).map((item) => item.questionId)).toEqual(['q2'])
  })

  it('calculates accuracy, progress, average time, completed sessions, and trend', () => {
    const stats = [stat('q1', 4, 2), stat('q2', 0, 0), stat('q3', 2, 2)]
    const sessions = [
      session({ id: 'old', date: '2026-06-01T09:00:00.000Z', score: 1, total: 2, totalTime: 100 }),
      session({ id: 'new', date: '2026-06-02T09:00:00.000Z', score: 2, total: 2, totalTime: 40, isReview: true }),
    ]

    const summary = buildStudyStats({ quiz, sessions, stats })

    expect(summary.accuracy).toBe(4 / 6)
    expect(summary.seenQuestions).toBe(2)
    expect(summary.totalQuestions).toBe(3)
    expect(summary.progress).toBe(2 / 3)
    expect(summary.averageSecondsPerQuestion).toBe(35)
    expect(summary.completedSessions).toBe(2)
    expect(summary.trend.map((item) => item.sessionId)).toEqual(['new', 'old'])
    expect(summary.trend[0]).toMatchObject({
      scorePercent: 100,
      averageSecondsPerQuestion: 20,
      isReview: true,
    })
  })

  it('represents unavailable statistics as null when no questions were shown', () => {
    const summary = buildStudyStats({ quiz, sessions: [], stats: [] })

    expect(summary.accuracy).toBeNull()
    expect(summary.averageSecondsPerQuestion).toBeNull()
    expect(summary.progress).toBe(0)
    expect(summary.completedSessions).toBe(0)
    expect(summary.trend).toEqual([])
  })

  it('sortReviewQueue returns a new sorted array without mutating the input', () => {
    const queue = buildReviewQueue({
      quiz,
      sessions: [
        session({ id: 's1', date: '2026-06-01T09:00:00.000Z', errors: ['q1'] }),
        session({ id: 's2', date: '2026-06-02T09:00:00.000Z', errors: ['q2'] }),
      ],
      stats: [],
    })
    const reversed = [...queue].reverse()

    expect(sortReviewQueue(reversed).map((item) => item.questionId)).toEqual(['q2', 'q1'])
    expect(reversed.map((item) => item.questionId)).toEqual(['q1', 'q2'])
  })
})
```

- [ ] **Step 2: Run the service tests and verify failure**

Run:

```bash
npm run test -- src/services/studyService.test.ts --run
```

Expected: FAIL because `src/services/studyService.ts` does not exist.

- [ ] **Step 3: Implement the service**

Create `src/services/studyService.ts`:

```ts
import type { QuestionStats, QuizDomanda, QuizFile, QuizSession } from '../types'

export type ReviewResultType = 'error' | 'unanswered'
export type ReviewResultFilter = 'all' | ReviewResultType
export type RecentScope = 1 | 3 | 7 | 'all'

export interface ReviewQueueItem {
  questionId: string
  questionText: string
  macroargomenti: string[]
  lastResult: ReviewResultType
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
  scorePercent: number
  averageSecondsPerQuestion: number | null
  isReview: boolean
}

export interface StudyStatsSummary {
  accuracy: number | null
  seenQuestions: number
  totalQuestions: number
  progress: number
  averageSecondsPerQuestion: number | null
  completedSessions: number
  trend: StudyTrendItem[]
}

interface BuildReviewQueueInput {
  quiz: QuizFile
  sessions: QuizSession[]
  stats: QuestionStats[]
}

interface BuildStudyStatsInput {
  quiz: QuizFile
  sessions: QuizSession[]
  stats: QuestionStats[]
}

function questionMap(questions: QuizDomanda[]): Map<string, QuizDomanda> {
  return new Map(questions.map((question) => [question.id, question]))
}

function statsMap(stats: QuestionStats[]): Map<string, QuestionStats> {
  return new Map(stats.map((stat) => [stat.questionId, stat]))
}

function sortedSessionsDesc(sessions: QuizSession[]): QuizSession[] {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date))
}

function scorePercent(score: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((score / total) * 100)
}

function accuracyFromStat(stat: QuestionStats | undefined): number | null {
  if (!stat || stat.timesShown <= 0) return null
  return stat.timesCorrect / stat.timesShown
}

export function sortReviewQueue(queue: ReviewQueueItem[]): ReviewQueueItem[] {
  return [...queue].sort((a, b) => {
    const dateComparison = b.lastMissedAt.localeCompare(a.lastMissedAt)
    if (dateComparison !== 0) return dateComparison

    const aAccuracy = a.accuracy ?? Number.POSITIVE_INFINITY
    const bAccuracy = b.accuracy ?? Number.POSITIVE_INFINITY
    if (aAccuracy !== bAccuracy) return aAccuracy - bAccuracy

    return a.questionId.localeCompare(b.questionId)
  })
}

export function buildReviewQueue({
  quiz,
  sessions,
  stats,
}: BuildReviewQueueInput): ReviewQueueItem[] {
  const questionsById = questionMap(quiz.domande)
  const statsByQuestionId = statsMap(stats)
  const latestByQuestionId = new Map<string, ReviewQueueItem>()

  sortedSessionsDesc(sessions).forEach((session, sessionIndex) => {
    const events: Array<{ questionId: string; result: ReviewResultType }> = [
      ...session.errors.map((questionId) => ({ questionId, result: 'error' as const })),
      ...session.unanswered.map((questionId) => ({ questionId, result: 'unanswered' as const })),
    ]

    for (const event of events) {
      if (latestByQuestionId.has(event.questionId)) continue

      const question = questionsById.get(event.questionId)
      if (!question) continue

      const stat = statsByQuestionId.get(event.questionId)
      latestByQuestionId.set(event.questionId, {
        questionId: event.questionId,
        questionText: question.testo,
        macroargomenti: [...question.macroargomenti],
        lastResult: event.result,
        lastMissedAt: session.date,
        latestSessionIndex: sessionIndex,
        accuracy: accuracyFromStat(stat),
        timesShown: stat?.timesShown ?? 0,
        timesCorrect: stat?.timesCorrect ?? 0,
        correctAnswer: question.risposta_corretta,
        explanation: question.spiegazione,
      })
    }
  })

  return sortReviewQueue([...latestByQuestionId.values()])
}

export function filterReviewQueue(
  queue: ReviewQueueItem[],
  filters: ReviewQueueFilters,
): ReviewQueueItem[] {
  const resultType = filters.resultType ?? 'all'
  const recentScope = filters.recentScope ?? 'all'

  return queue.filter((item) => {
    if (filters.macroargomento && !item.macroargomenti.includes(filters.macroargomento)) {
      return false
    }

    if (resultType !== 'all' && item.lastResult !== resultType) {
      return false
    }

    if (recentScope !== 'all' && item.latestSessionIndex >= recentScope) {
      return false
    }

    return true
  })
}

export function buildStudyStats({
  quiz,
  sessions,
  stats,
}: BuildStudyStatsInput): StudyStatsSummary {
  const totals = stats.reduce(
    (acc, stat) => ({
      timesShown: acc.timesShown + stat.timesShown,
      timesCorrect: acc.timesCorrect + stat.timesCorrect,
    }),
    { timesShown: 0, timesCorrect: 0 },
  )
  const seenQuestionIds = new Set(
    stats.filter((stat) => stat.timesShown > 0).map((stat) => stat.questionId),
  )
  const sessionQuestionTotal = sessions.reduce((sum, session) => sum + Math.max(0, session.total), 0)
  const sessionTimeTotal = sessions.reduce((sum, session) => sum + Math.max(0, session.totalTime), 0)

  return {
    accuracy: totals.timesShown > 0 ? totals.timesCorrect / totals.timesShown : null,
    seenQuestions: seenQuestionIds.size,
    totalQuestions: quiz.domande.length,
    progress: quiz.domande.length > 0 ? seenQuestionIds.size / quiz.domande.length : 0,
    averageSecondsPerQuestion:
      sessionQuestionTotal > 0 ? sessionTimeTotal / sessionQuestionTotal : null,
    completedSessions: sessions.length,
    trend: sortedSessionsDesc(sessions)
      .slice(0, 10)
      .map((session) => ({
        sessionId: session.id,
        date: session.date,
        score: session.score,
        total: session.total,
        scorePercent: scorePercent(session.score, session.total),
        averageSecondsPerQuestion:
          session.total > 0 ? session.totalTime / session.total : null,
        isReview: session.isReview,
      })),
  }
}
```

- [ ] **Step 4: Run the service tests and verify pass**

Run:

```bash
npm run test -- src/services/studyService.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/studyService.ts src/services/studyService.test.ts
git commit -m "feat: add daily study service"
```

---

### Task 2: Generalize Quiz Review Session State

**Files:**
- Modify: `src/hooks/useQuiz.ts`
- Modify: `src/hooks/useQuiz.test.ts`
- Modify: `src/pages/QuizSessionPage.tsx`
- Modify: `src/pages/QuizSessionPage.test.tsx`
- Modify: `src/pages/QuizResultPage.tsx`
- Modify: `src/pages/QuizResultPage.test.tsx`

- [ ] **Step 1: Write/update failing tests for unified review ids**

In `src/pages/QuizSessionPage.test.tsx`, replace the existing review-state test input:

```ts
entryState: {
  isReview: true,
  reviewErrors: ['q1'],
  reviewUnanswered: ['q2'],
},
```

with:

```ts
entryState: {
  isReview: true,
  reviewQuestionIds: ['q1', 'q2'],
},
```

Add this test near the review tests:

```ts
it('ignores invalid reviewQuestionIds and starts with the valid ordered ids', async () => {
  renderPage({
    entryState: {
      isReview: true,
      reviewQuestionIds: ['missing', 'q2', 'q1'],
    },
  })

  expect(await screen.findByText('Domanda 1 di 2')).not.toBeNull()
  expect(screen.getByText('Un triangolo ha tre lati.')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Consegna quiz/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Consegna' }))

  await waitFor(() => {
    expect(saveQuizSession).toHaveBeenCalled()
  })
  const savedSession = saveQuizSession.mock.calls[0][0] as QuizSession
  expect(savedSession.isReview).toBe(true)
  expect(savedSession.total).toBe(2)
  expect(savedSession.unanswered).toEqual(['q2', 'q1'])
})
```

In `src/pages/QuizResultPage.test.tsx`, update the navigation assertion:

```ts
expect(
  await screen.findByText('{"reviewQuestionIds":["q1","q2"],"isReview":true}'),
).not.toBeNull()
```

- [ ] **Step 2: Run the affected tests and verify failure**

Run:

```bash
npm run test -- src/pages/QuizSessionPage.test.tsx src/pages/QuizResultPage.test.tsx --run
```

Expected: FAIL because the app still reads/writes `reviewErrors` and `reviewUnanswered`.

- [ ] **Step 3: Update `useQuiz.startReviewSession`**

In `src/hooks/useQuiz.ts`, replace the `startReviewSession` callback with:

```ts
const startReviewSession = useCallback(
  (questionIds: string[], allDomande: QuizDomanda[]) => {
    const requestedIds = [...new Set(questionIds)]
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
```

Ensure the returned object still exposes `startReviewSession`.

- [ ] **Step 4: Update `QuizSessionPage` review loading**

In `src/pages/QuizSessionPage.tsx`, update the `LoadedSession` review shape:

```ts
| {
    mode: 'review'
    quizData: QuizFile
    questionIds: string[]
  }
```

Replace `readReviewConfig` with this compatible reader:

```ts
function readReviewConfig(state: unknown): { questionIds: string[] } | null {
  if (!state || typeof state !== 'object') return null

  const record = state as Record<string, unknown>
  if (record.isReview !== true) return null

  const explicitIds = Array.isArray(record.reviewQuestionIds)
    ? record.reviewQuestionIds.filter((item): item is string => typeof item === 'string')
    : []

  const legacyErrors = Array.isArray(record.reviewErrors)
    ? record.reviewErrors.filter((item): item is string => typeof item === 'string')
    : []
  const legacyUnanswered = Array.isArray(record.reviewUnanswered)
    ? record.reviewUnanswered.filter((item): item is string => typeof item === 'string')
    : []

  const questionIds = explicitIds.length > 0 ? explicitIds : [...legacyErrors, ...legacyUnanswered]
  const uniqueQuestionIds = [...new Set(questionIds)]

  if (uniqueQuestionIds.length === 0) return null

  return { questionIds: uniqueQuestionIds }
}
```

Update the `setLoadedSession` call:

```ts
setLoadedSession({
  mode: 'review',
  quizData,
  questionIds: reviewConfig.questionIds,
})
```

Update initialization:

```ts
} else if (loadedSession.mode === 'review') {
  quiz.startReviewSession(loadedSession.questionIds, loadedSession.quizData.domande)
} else {
```

- [ ] **Step 5: Update `QuizResultPage` navigation**

In `src/pages/QuizResultPage.tsx`, change the `onReview` navigation state to:

```ts
onReview={() => {
  navigate(`/esame/${examId}/quiz/sessione`, {
    state: {
      reviewQuestionIds: [...currentSession.errors, ...currentSession.unanswered],
      isReview: true,
    },
  })
}}
```

- [ ] **Step 6: Run affected tests and verify pass**

Run:

```bash
npm run test -- src/pages/QuizSessionPage.test.tsx src/pages/QuizResultPage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useQuiz.ts src/pages/QuizSessionPage.tsx src/pages/QuizSessionPage.test.tsx src/pages/QuizResultPage.tsx src/pages/QuizResultPage.test.tsx
git commit -m "feat: unify quiz review ids"
```

---

### Task 3: Add Study Page Loading, Stats, Trend, And Route

**Files:**
- Create: `src/pages/StudyPage.tsx`
- Create: `src/pages/StudyPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing page tests for route, loading, stats, and empty states**

Create `src/pages/StudyPage.test.tsx`:

```ts
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { Esame, QuestionStats, QuizSession } from '../types'

const getEsame = vi.fn()
const getQuizSessions = vi.fn()
const getQuestionStats = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
  getQuizSessions,
  getQuestionStats,
}))

const { StudyPage } = await import('./StudyPage')

const quizFile = {
  esame: 'Analisi',
  domande: [
    {
      id: 'q1',
      macroargomenti: ['Algebra'],
      tipo: 'multipla',
      testo: 'Quanto fa 2 + 2?',
      opzioni: ['3', '4'],
      risposta_corretta: '4',
      spiegazione: 'Due piu due fa quattro.',
    },
    {
      id: 'q2',
      macroargomenti: ['Geometria'],
      tipo: 'vero_falso',
      testo: 'Un triangolo ha tre lati.',
      risposta_corretta: 'Vero',
      spiegazione: 'Per definizione ha tre lati.',
    },
  ],
}

function encodeJson(value: unknown): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function makeExam(files: Esame['files'] = {}): Esame {
  return {
    id: 'exam-1',
    name: 'Analisi 1',
    createdAt: '2026-06-01T08:00:00.000Z',
    files,
  }
}

function makeSession(overrides: Partial<QuizSession> = {}): QuizSession {
  return {
    id: 'session-1',
    examId: 'exam-1',
    date: '2026-06-01T09:00:00.000Z',
    score: 1,
    total: 2,
    totalTime: 80,
    timeLimitSeconds: null,
    completedByTimeout: false,
    macroargomenti: [],
    errors: ['q1'],
    unanswered: [],
    isReview: false,
    ...overrides,
  }
}

function makeStat(questionId: string, timesShown: number, timesCorrect: number): QuestionStats {
  return {
    id: `exam-1__${questionId}`,
    examId: 'exam-1',
    questionId,
    timesShown,
    timesCorrect,
  }
}

function LocationStateView() {
  const location = useLocation()
  return <pre>{JSON.stringify(location.state)}</pre>
}

function renderStudy(path = '/esame/exam-1/studio') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
        <Route path="/esame/:examId/studio" element={<StudyPage />} />
        <Route path="/esame/:examId/quiz/sessione" element={<LocationStateView />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StudyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(
      makeExam({
        quiz: {
          name: 'quiz.json',
          type: 'application/json',
          data: encodeJson(quizFile),
        },
      }),
    )
    getQuizSessions.mockResolvedValue([
      makeSession({
        id: 'new',
        date: '2026-06-02T09:00:00.000Z',
        score: 1,
        total: 2,
        totalTime: 80,
        errors: ['q1'],
      }),
    ])
    getQuestionStats.mockResolvedValue([makeStat('q1', 4, 2), makeStat('q2', 1, 1)])
  })

  afterEach(() => {
    cleanup()
  })

  it('redirects home when the exam is missing', async () => {
    getEsame.mockResolvedValue(undefined)

    renderStudy()

    expect(await screen.findByRole('heading', { name: 'Tutti gli esami' })).not.toBeNull()
  })

  it('shows an import prompt when the exam has no quiz file', async () => {
    getEsame.mockResolvedValue(makeExam())

    renderStudy()

    expect(await screen.findByText(/Importa un quiz/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: /Dashboard/i })).not.toBeNull()
  })

  it('renders study stats and recent trend', async () => {
    renderStudy()

    expect(await screen.findByRole('heading', { name: 'Studio quotidiano' })).not.toBeNull()
    expect(screen.getByText('60%')).not.toBeNull()
    expect(screen.getByText('2/2')).not.toBeNull()
    expect(screen.getByText('0:16')).not.toBeNull()
    expect(screen.getByText(/Sessioni completate/i)).not.toBeNull()
    expect(screen.getByText(/02\/06\/2026/)).not.toBeNull()
  })

  it('shows review queue items and navigates to review all', async () => {
    renderStudy()

    expect(await screen.findByText('Quanto fa 2 + 2?')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ripassa tutte' }))

    expect(await screen.findByText('{"reviewQuestionIds":["q1"],"isReview":true}')).not.toBeNull()
  })

  it('shows empty queue state when there are no missed questions', async () => {
    getQuizSessions.mockResolvedValue([makeSession({ errors: [], unanswered: [], score: 2 })])

    renderStudy()

    expect(await screen.findByText(/Nessuna domanda da ripassare/i)).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Ripassa tutte' })).toBeNull()
  })

  it('shows a validation alert when the quiz file is invalid', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        quiz: {
          name: 'broken.json',
          type: 'application/json',
          data: encodeJson({ esame: 'Analisi' }),
        },
      }),
    )

    renderStudy()

    expect((await screen.findByRole('alert')).textContent).toMatch(/File quiz non valido/i)
  })
})
```

- [ ] **Step 2: Run the StudyPage test and verify failure**

Run:

```bash
npm run test -- src/pages/StudyPage.test.tsx --run
```

Expected: FAIL because `StudyPage.tsx` does not exist.

- [ ] **Step 3: Implement the first StudyPage version**

Create `src/pages/StudyPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { validateQuizFile } from '../services/quizService'
import {
  buildReviewQueue,
  buildStudyStats,
  type ReviewQueueItem,
  type StudyStatsSummary,
} from '../services/studyService'
import * as storage from '../services/storageService'
import type { QuestionStats, QuizFile, QuizSession } from '../types'
import { formatTime } from '../utils/formatTime'

type LoadState =
  | { status: 'loading' }
  | { status: 'missingQuiz' }
  | {
      status: 'ready'
      quiz: QuizFile
      sessions: QuizSession[]
      stats: QuestionStats[]
      reviewQueue: ReviewQueueItem[]
      summary: StudyStatsSummary
    }
  | { status: 'error'; message: string }

function parseJsonFile(data: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(data))
}

function formatPercent(value: number | null): string {
  if (value === null) return '-'
  return `${Math.round(value * 100)}%`
}

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function StudyPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!examId) {
        navigate('/', { replace: true })
        return
      }

      try {
        const esame = await storage.getEsame(examId)
        if (!esame) {
          navigate('/', { replace: true })
          return
        }

        if (!esame.files.quiz) {
          if (!cancelled) setLoadState({ status: 'missingQuiz' })
          return
        }

        let quiz: QuizFile
        try {
          quiz = validateQuizFile(parseJsonFile(esame.files.quiz.data))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Quiz non valido'
          if (!cancelled) setLoadState({ status: 'error', message: `File quiz non valido: ${message}` })
          return
        }

        const [sessions, stats] = await Promise.all([
          storage.getQuizSessions(examId),
          storage.getQuestionStats(examId),
        ])
        const reviewQueue = buildReviewQueue({ quiz, sessions, stats })
        const summary = buildStudyStats({ quiz, sessions, stats })

        if (!cancelled) {
          setLoadState({ status: 'ready', quiz, sessions, stats, reviewQueue, summary })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossibile caricare lo studio.'
        if (!cancelled) setLoadState({ status: 'error', message })
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [examId, navigate])

  const goDashboard = () => navigate(examId ? `/esame/${examId}` : '/')

  if (loadState.status === 'loading') {
    return <div style={{ color: 'var(--text-muted)' }}>Caricamento...</div>
  }

  if (loadState.status === 'missingQuiz') {
    return (
      <div style={pageStyle}>
        <button type="button" onClick={goDashboard} style={backButtonStyle}>
          Dashboard
        </button>
        <section style={sectionStyle}>
          <h1 style={headingStyle}>Studio quotidiano</h1>
          <p style={mutedTextStyle}>Importa un quiz per vedere statistiche e domande da ripassare.</p>
        </section>
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <div style={pageStyle}>
        <button type="button" onClick={goDashboard} style={backButtonStyle}>
          Dashboard
        </button>
        <div role="alert" style={alertStyle}>{loadState.message}</div>
      </div>
    )
  }

  return <StudyContent examId={examId} loadState={loadState} onBack={goDashboard} />
}

function StudyContent({
  examId,
  loadState,
  onBack,
}: {
  examId: string | undefined
  loadState: Extract<LoadState, { status: 'ready' }>
  onBack: () => void
}) {
  const navigate = useNavigate()
  const { summary, reviewQueue } = loadState
  const questionIds = useMemo(() => reviewQueue.map((item) => item.questionId), [reviewQueue])

  const startReview = (ids: string[]) => {
    if (!examId || ids.length === 0) return
    navigate(`/esame/${examId}/quiz/sessione`, {
      state: { reviewQuestionIds: ids, isReview: true },
    })
  }

  return (
    <div style={pageStyle}>
      <button type="button" onClick={onBack} style={backButtonStyle}>
        Dashboard
      </button>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.35rem' }}>Studio quotidiano</h1>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Riepilogo</h2>
        <div style={metricsGridStyle}>
          <Metric label="Accuratezza" value={formatPercent(summary.accuracy)} />
          <Metric label="Progresso" value={`${summary.seenQuestions}/${summary.totalQuestions}`} />
          <Metric label="Tempo medio" value={summary.averageSecondsPerQuestion === null ? '-' : formatTime(Math.round(summary.averageSecondsPerQuestion))} />
          <Metric label="Sessioni completate" value={String(summary.completedSessions)} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Trend ultime sessioni</h2>
        {summary.trend.length === 0 ? (
          <p style={mutedTextStyle}>Nessuna sessione completata.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {summary.trend.map((item) => (
              <div key={item.sessionId} style={trendRowStyle}>
                <span>{formatDateTime(item.date)}{item.isReview ? ' · ripasso' : ''}</span>
                <strong>{item.scorePercent}% · {item.averageSecondsPerQuestion === null ? '-' : formatTime(Math.round(item.averageSecondsPerQuestion))}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <h2 style={headingStyle}>Da ripassare</h2>
          {questionIds.length > 0 && (
            <button type="button" onClick={() => startReview(questionIds)} style={primaryButtonStyle}>
              Ripassa tutte
            </button>
          )}
        </div>
        {reviewQueue.length === 0 ? (
          <p style={mutedTextStyle}>Nessuna domanda da ripassare.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {reviewQueue.map((item) => (
              <ReviewQueueRow key={item.questionId} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <span style={mutedTextStyle}>{label}</span>
      <strong style={{ fontSize: '1.1rem' }}>{value}</strong>
    </div>
  )
}

function ReviewQueueRow({ item }: { item: ReviewQueueItem }) {
  return (
    <article style={queueRowStyle}>
      <div>
        <strong>{item.questionText}</strong>
        <p style={mutedTextStyle}>{item.macroargomenti.join(', ')}</p>
      </div>
      <span style={badgeStyle}>{item.lastResult === 'error' ? 'Sbagliata' : 'Saltata'}</span>
    </article>
  )
}

const pageStyle = {
  maxWidth: '760px',
  margin: '0 auto',
  padding: '0 1rem',
} satisfies React.CSSProperties

const backButtonStyle = {
  marginBottom: '1rem',
  color: 'var(--text-muted)',
  minHeight: '40px',
} satisfies React.CSSProperties

const sectionStyle = {
  marginBottom: '1rem',
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
} satisfies React.CSSProperties

const headingStyle = {
  marginBottom: '0.75rem',
  fontSize: '1rem',
  fontWeight: 700,
} satisfies React.CSSProperties

const mutedTextStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
} satisfies React.CSSProperties

const alertStyle = {
  padding: '0.85rem',
  border: '1px solid var(--danger)',
  borderRadius: '8px',
  background: 'rgba(224, 85, 85, 0.12)',
  color: 'var(--text)',
} satisfies React.CSSProperties

const metricsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: '0.75rem',
} satisfies React.CSSProperties

const metricStyle = {
  display: 'grid',
  gap: '0.2rem',
  padding: '0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
} satisfies React.CSSProperties

const trendRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.7rem 0.8rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
} satisfies React.CSSProperties

const queueRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.85rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
} satisfies React.CSSProperties

const badgeStyle = {
  alignSelf: 'start',
  padding: '0.15rem 0.45rem',
  borderRadius: '6px',
  background: 'var(--warning)',
  color: '#fff',
  fontSize: '0.78rem',
  fontWeight: 700,
} satisfies React.CSSProperties

const primaryButtonStyle = {
  minHeight: '44px',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 700,
} satisfies React.CSSProperties
```

- [ ] **Step 4: Add the route**

In `src/App.tsx`, import the page:

```ts
import { StudyPage } from './pages/StudyPage'
```

Add the route after the dashboard route:

```tsx
<Route path="/esame/:examId/studio" element={<StudyPage />} />
```

- [ ] **Step 5: Run page tests and verify pass**

Run:

```bash
npm run test -- src/pages/StudyPage.test.tsx src/App.test.tsx --run
```

Expected: PASS. If `App.test.tsx` does not assert the route list, it should still pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/pages/StudyPage.tsx src/pages/StudyPage.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add daily study page"
```

---

### Task 4: Add Study Page Filters, Detail, And Review Filtered Action

**Files:**
- Modify: `src/pages/StudyPage.tsx`
- Modify: `src/pages/StudyPage.test.tsx`

- [ ] **Step 1: Add failing tests for filters, detail, and review filtered**

Append to `src/pages/StudyPage.test.tsx`:

```ts
it('filters the queue by macroargomento and starts a filtered review', async () => {
  getQuizSessions.mockResolvedValue([
    makeSession({ id: 'new', date: '2026-06-02T09:00:00.000Z', errors: ['q1'], unanswered: ['q2'] }),
  ])

  renderStudy()

  expect(await screen.findByText('Quanto fa 2 + 2?')).not.toBeNull()
  expect(screen.getByText('Un triangolo ha tre lati.')).not.toBeNull()

  fireEvent.change(screen.getByLabelText('Macroargomento'), { target: { value: 'Geometria' } })

  expect(screen.queryByText('Quanto fa 2 + 2?')).toBeNull()
  expect(screen.getByText('Un triangolo ha tre lati.')).not.toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Ripassa filtrate' }))

  expect(await screen.findByText('{"reviewQuestionIds":["q2"],"isReview":true}')).not.toBeNull()
})

it('filters by result type and shows an empty filtered state', async () => {
  renderStudy()

  expect(await screen.findByText('Quanto fa 2 + 2?')).not.toBeNull()
  fireEvent.change(screen.getByLabelText('Esito'), { target: { value: 'unanswered' } })

  expect(screen.getByText(/Nessuna domanda corrisponde ai filtri/i)).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Ripassa filtrate' })).toBeNull()
})

it('shows question answer and explanation in a detail section', async () => {
  renderStudy()

  fireEvent.click(await screen.findByRole('button', { name: /Dettagli: Quanto fa 2 \+ 2\?/i }))

  expect(screen.getByText(/Risposta corretta/i)).not.toBeNull()
  expect(screen.getByText('4')).not.toBeNull()
  expect(screen.getByText('Due piu due fa quattro.')).not.toBeNull()
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm run test -- src/pages/StudyPage.test.tsx --run
```

Expected: FAIL because controls and detail behavior are not implemented yet.

- [ ] **Step 3: Add filter state and derived queue**

In `StudyContent`, add state:

```tsx
const [macroargomento, setMacroargomento] = useState('')
const [resultType, setResultType] = useState<ReviewResultFilter>('all')
const [recentScope, setRecentScope] = useState<RecentScope>('all')
const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null)
```

Update imports:

```ts
import {
  buildReviewQueue,
  buildStudyStats,
  filterReviewQueue,
  type RecentScope,
  type ReviewQueueItem,
  type ReviewResultFilter,
  type StudyStatsSummary,
} from '../services/studyService'
```

Add derived values:

```tsx
const macroOptions = useMemo(
  () => [...new Set(loadState.quiz.domande.flatMap((question) => question.macroargomenti))].sort(),
  [loadState.quiz.domande],
)
const filteredQueue = useMemo(
  () =>
    filterReviewQueue(reviewQueue, {
      macroargomento: macroargomento || undefined,
      resultType,
      recentScope,
    }),
  [macroargomento, recentScope, resultType, reviewQueue],
)
const allQuestionIds = useMemo(() => reviewQueue.map((item) => item.questionId), [reviewQueue])
const filteredQuestionIds = useMemo(
  () => filteredQueue.map((item) => item.questionId),
  [filteredQueue],
)
```

- [ ] **Step 4: Render filter controls**

Add this block above the queue rows:

```tsx
{reviewQueue.length > 0 && (
  <div style={filterGridStyle}>
    <label style={labelStyle}>
      Macroargomento
      <select
        aria-label="Macroargomento"
        value={macroargomento}
        onChange={(event) => setMacroargomento(event.target.value)}
        style={selectStyle}
      >
        <option value="">Tutti</option>
        {macroOptions.map((macro) => (
          <option key={macro} value={macro}>{macro}</option>
        ))}
      </select>
    </label>
    <label style={labelStyle}>
      Esito
      <select
        aria-label="Esito"
        value={resultType}
        onChange={(event) => setResultType(event.target.value as ReviewResultFilter)}
        style={selectStyle}
      >
        <option value="all">Tutti</option>
        <option value="error">Sbagliate</option>
        <option value="unanswered">Saltate</option>
      </select>
    </label>
    <label style={labelStyle}>
      Periodo
      <select
        aria-label="Periodo"
        value={String(recentScope)}
        onChange={(event) => {
          const value = event.target.value
          setRecentScope(value === 'all' ? 'all' : (Number(value) as 1 | 3 | 7))
        }}
        style={selectStyle}
      >
        <option value="all">Tutto lo storico</option>
        <option value="1">Ultima sessione</option>
        <option value="3">Ultime 3 sessioni</option>
        <option value="7">Ultime 7 sessioni</option>
      </select>
    </label>
  </div>
)}
```

Add styles:

```tsx
const filterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '0.75rem',
  marginBottom: '1rem',
} satisfies React.CSSProperties

const labelStyle = {
  display: 'grid',
  gap: '0.35rem',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
} satisfies React.CSSProperties

const selectStyle = {
  minHeight: '44px',
  padding: '0.55rem 0.65rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
} satisfies React.CSSProperties
```

- [ ] **Step 5: Switch queue rendering to filtered queue and add detail**

Use `allQuestionIds` for "Ripassa tutte" and add "Ripassa filtrate":

```tsx
{allQuestionIds.length > 0 && (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
    <button type="button" onClick={() => startReview(allQuestionIds)} style={primaryButtonStyle}>
      Ripassa tutte
    </button>
    {filteredQuestionIds.length > 0 && filteredQuestionIds.length !== allQuestionIds.length && (
      <button type="button" onClick={() => startReview(filteredQuestionIds)} style={secondaryButtonStyle}>
        Ripassa filtrate
      </button>
    )}
  </div>
)}
```

Replace queue map with:

```tsx
{reviewQueue.length === 0 ? (
  <p style={mutedTextStyle}>Nessuna domanda da ripassare.</p>
) : filteredQueue.length === 0 ? (
  <p style={mutedTextStyle}>Nessuna domanda corrisponde ai filtri selezionati.</p>
) : (
  <div style={{ display: 'grid', gap: '0.75rem' }}>
    {filteredQueue.map((item) => (
      <ReviewQueueRow
        key={item.questionId}
        item={item}
        expanded={expandedQuestionId === item.questionId}
        onToggle={() =>
          setExpandedQuestionId((current) =>
            current === item.questionId ? null : item.questionId,
          )
        }
      />
    ))}
  </div>
)}
```

Replace `ReviewQueueRow` with:

```tsx
function ReviewQueueRow({
  item,
  expanded,
  onToggle,
}: {
  item: ReviewQueueItem
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <article style={queueRowStyle}>
      <div style={{ minWidth: 0 }}>
        <strong>{item.questionText}</strong>
        <p style={mutedTextStyle}>{item.macroargomenti.join(', ')}</p>
        {expanded && (
          <div style={detailStyle}>
            <strong>Risposta corretta</strong>
            <p>{item.correctAnswer}</p>
            <strong>Spiegazione</strong>
            <p>{item.explanation}</p>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'end' }}>
        <span style={badgeStyle}>{item.lastResult === 'error' ? 'Sbagliata' : 'Saltata'}</span>
        <button type="button" onClick={onToggle} style={secondaryButtonStyle}>
          {expanded ? 'Chiudi' : `Dettagli: ${item.questionText}`}
        </button>
      </div>
    </article>
  )
}
```

Add styles:

```tsx
const secondaryButtonStyle = {
  minHeight: '44px',
  padding: '0.55rem 0.8rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
} satisfies React.CSSProperties

const detailStyle = {
  display: 'grid',
  gap: '0.35rem',
  marginTop: '0.75rem',
  padding: '0.75rem',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
} satisfies React.CSSProperties
```

- [ ] **Step 6: Run StudyPage tests and verify pass**

Run:

```bash
npm run test -- src/pages/StudyPage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/StudyPage.tsx src/pages/StudyPage.test.tsx
git commit -m "feat: add daily study filters"
```

---

### Task 5: Add Dashboard Daily Study Summary

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Add failing dashboard tests**

In `src/pages/DashboardPage.test.tsx`, add storage mocks:

```ts
const getQuizSessions = vi.fn()
const getQuestionStats = vi.fn()
```

Include them in the storage mock:

```ts
getQuizSessions,
getQuestionStats,
```

In `beforeEach`, add:

```ts
getQuizSessions.mockResolvedValue([])
getQuestionStats.mockResolvedValue([])
```

Add tests:

```ts
it('shows a daily study summary when a quiz is available', async () => {
  getEsame.mockResolvedValue(
    makeExam({
      quiz: { name: 'quiz.json', type: 'application/json', data: encodeJson(validQuiz) },
    }),
  )
  getQuizSessions.mockResolvedValue([
    {
      id: 's1',
      examId: 'exam-1',
      date: '2026-06-01T09:00:00.000Z',
      score: 0,
      total: 1,
      totalTime: 30,
      timeLimitSeconds: null,
      completedByTimeout: false,
      macroargomenti: ['Limiti'],
      errors: ['q1'],
      unanswered: [],
      isReview: false,
    },
  ])
  getQuestionStats.mockResolvedValue([
    {
      id: 'exam-1__q1',
      examId: 'exam-1',
      questionId: 'q1',
      timesShown: 1,
      timesCorrect: 0,
    },
  ])

  renderDashboard()

  expect(await screen.findByRole('heading', { name: 'Studio quotidiano' })).not.toBeNull()
  expect(screen.getByText(/1 da ripassare/i)).not.toBeNull()
  expect(screen.getByText('0%')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Apri studio' }))
  expect(await screen.findByText('null')).not.toBeNull()
})

it('does not show the daily study summary before quiz import', async () => {
  renderDashboard()

  await screen.findByText('File non importato')
  expect(screen.queryByRole('heading', { name: 'Studio quotidiano' })).toBeNull()
  expect(getQuizSessions).not.toHaveBeenCalled()
  expect(getQuestionStats).not.toHaveBeenCalled()
})
```

Update `renderDashboard` routes to include:

```tsx
<Route path="/esame/:examId/studio" element={<LocationStateView />} />
```

- [ ] **Step 2: Run dashboard tests and verify failure**

Run:

```bash
npm run test -- src/pages/DashboardPage.test.tsx --run
```

Expected: FAIL because `DashboardPage` does not load or render daily study data.

- [ ] **Step 3: Add dashboard state and loading**

In `DashboardPage.tsx`, import:

```ts
import { buildReviewQueue, buildStudyStats, type ReviewQueueItem, type StudyStatsSummary } from '../services/studyService'
import type { Esame, PausedSession, QuizFile } from '../types'
```

Add local type:

```ts
interface DailyStudySummaryState {
  queue: ReviewQueueItem[]
  stats: StudyStatsSummary
}
```

Add state:

```ts
const [dailyStudy, setDailyStudy] = useState<DailyStudySummaryState | null>(null)
const [dailyStudyError, setDailyStudyError] = useState<string | null>(null)
```

Inside `loadDashboard`, after paused-session loading and before state updates, calculate when a quiz exists:

```ts
let nextDailyStudy: DailyStudySummaryState | null = null
let nextDailyStudyError: string | null = null

if (currentExam.files.quiz) {
  try {
    const quizData = validateQuizFile(parseJsonFile(currentExam.files.quiz.data)) as QuizFile
    const [sessions, stats] = await Promise.all([
      storageService.getQuizSessions(examId),
      storageService.getQuestionStats(examId),
    ])
    nextDailyStudy = {
      queue: buildReviewQueue({ quiz: quizData, sessions, stats }),
      stats: buildStudyStats({ quiz: quizData, sessions, stats }),
    }
  } catch (error) {
    nextDailyStudyError = error instanceof Error ? error.message : 'Impossibile caricare lo studio.'
  }
}
```

Set state:

```ts
setDailyStudy(nextDailyStudy)
setDailyStudyError(nextDailyStudyError)
```

- [ ] **Step 4: Render the dashboard summary**

Add helper functions near existing helpers:

```ts
function formatPercent(value: number | null): string {
  if (value === null) return '-'
  return `${Math.round(value * 100)}%`
}

function formatShortTime(seconds: number | null): string {
  if (seconds === null) return '-'
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}
```

Add this block after paused banners and before file cards:

```tsx
{hasQuiz && dailyStudy && (
  <section style={dailyStudyCardStyle} aria-labelledby="daily-study-title">
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
      <div>
        <h2 id="daily-study-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
          Studio quotidiano
        </h2>
        <p style={mutedTextStyle}>{dailyStudy.queue.length} da ripassare</p>
      </div>
      <button type="button" onClick={() => navigate(`/esame/${esame.id}/studio`)} style={secondaryButtonStyle}>
        Apri studio
      </button>
    </div>
    <div style={dailyStudyMetricsStyle}>
      <span>Accuratezza: <strong>{formatPercent(dailyStudy.stats.accuracy)}</strong></span>
      <span>Progresso: <strong>{dailyStudy.stats.seenQuestions}/{dailyStudy.stats.totalQuestions}</strong></span>
      <span>Tempo medio: <strong>{formatShortTime(dailyStudy.stats.averageSecondsPerQuestion)}</strong></span>
    </div>
    {dailyStudy.queue.length > 0 && (
      <button
        type="button"
        onClick={() =>
          navigate(`/esame/${esame.id}/quiz/sessione`, {
            state: {
              reviewQuestionIds: dailyStudy.queue.map((item) => item.questionId),
              isReview: true,
            },
          })
        }
        style={primaryButtonStyle}
      >
        Ripassa ora
      </button>
    )}
  </section>
)}
{hasQuiz && dailyStudyError && (
  <div role="alert" style={replacementErrorStyle}>
    Studio non disponibile: {dailyStudyError}
  </div>
)}
```

Add styles:

```ts
const dailyStudyCardStyle = {
  padding: '1rem',
  marginBottom: '1rem',
  border: '1px solid var(--accent)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
} satisfies React.CSSProperties

const dailyStudyMetricsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  margin: '0.85rem 0',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
} satisfies React.CSSProperties
```

- [ ] **Step 5: Run dashboard tests and verify pass**

Run:

```bash
npm run test -- src/pages/DashboardPage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx
git commit -m "feat: show daily study on dashboard"
```

---

### Task 6: Final Integration Verification

**Files:**
- Review: all files touched in Tasks 1-5

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript and production build**

Run:

```bash
npm run build
```

Expected: PASS. Vite should produce `dist/`.

- [ ] **Step 3: Inspect git diff for accidental storage/schema changes**

Run:

```bash
git diff -- src/services/storageService.ts src/services/sync src/types/index.ts
```

Expected: no diff, unless `src/types/index.ts` was intentionally touched for exported UI-only types. There must be no IndexedDB version bump and no new object store.

- [ ] **Step 4: Inspect feature diff**

Run:

```bash
git diff --stat HEAD~5..HEAD
```

Expected: changes are limited to the new study service/page, route, dashboard summary, and quiz review state updates.

- [ ] **Step 5: Manual behavior check in the browser**

Run:

```bash
npm run dev
```

Expected: Vite starts on `localhost:5173`.

Manual checks:

1. Open an exam with a quiz and previous quiz sessions.
2. Confirm the dashboard shows "Studio quotidiano".
3. Click "Apri studio".
4. Confirm stats, trend, and queue render.
5. Change macroargomento and esito filters.
6. Click a queue item detail button and verify answer/explanation show.
7. Click "Ripassa filtrate" or "Ripassa tutte" and confirm a review quiz starts.
8. Finish the review quiz and confirm the result is marked as review.

- [ ] **Step 6: Final commit if Task 6 required fixes**

If verification required any fixes, commit them:

```bash
git add src docs
git commit -m "fix: finalize daily study integration"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: queue construction, priority, filters, stats, dashboard summary, study route, review session reuse, error states, and tests all map to tasks above.
- Storage boundary: no task modifies IndexedDB schema, sync schema, or `storageService`.
- Placeholder scan: no unfinished marker words or unspecified test-writing steps remain. Each code-changing task includes concrete code or exact replacement snippets.
- Type consistency: `reviewQuestionIds`, `ReviewQueueItem`, `ReviewQueueFilters`, `RecentScope`, `ReviewResultFilter`, and `StudyStatsSummary` are introduced before later tasks consume them.
