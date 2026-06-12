import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { Esame, QuizSession } from '../types'

const getEsame = vi.fn()
const getQuizSessions = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
  getQuizSessions,
}))

const { QuizResultPage } = await import('./QuizResultPage')

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
    total: 3,
    totalTime: 125,
    timeLimitSeconds: 300,
    completedByTimeout: true,
    macroargomenti: ['Algebra'],
    errors: ['q1'],
    unanswered: ['q2'],
    isReview: false,
    ...overrides,
  }
}

function LocationStateView() {
  const location = useLocation()
  return <pre>{JSON.stringify(location.state)}</pre>
}

function renderPage({
  entryState,
}: {
  entryState?: Record<string, unknown>
} = {}) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/esame/exam-1/quiz/risultato',
          state: entryState,
        },
      ]}
    >
      <Routes>
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
        <Route path="/esame/:examId/quiz/risultato" element={<QuizResultPage />} />
        <Route path="/esame/:examId/quiz/sessione" element={<LocationStateView />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QuizResultPage', () => {
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
      makeSession({ id: 'older', date: '2026-06-01T08:00:00.000Z', score: 2, total: 4 }),
      makeSession({
        id: 'review',
        date: '2026-06-01T10:00:00.000Z',
        score: 1,
        total: 2,
        isReview: true,
        completedByTimeout: false,
        errors: [],
        unanswered: [],
      }),
    ])
  })

  afterEach(() => {
    cleanup()
  })

  it('renders score, formatted time, markers, and sorted history with review sessions distinct', async () => {
    renderPage({ entryState: { session: makeSession() } })

    expect(await screen.findByText('33%')).not.toBeNull()
    expect(screen.getByText('1 / 3 corrette')).not.toBeNull()
    expect(screen.getByText('Tempo: 2:05')).not.toBeNull()
    expect(screen.getByText('Tempo scaduto')).not.toBeNull()
    expect(screen.getByText(/ripasso$/)).not.toBeNull()
    expect(screen.getByText('1/2 (50%)')).not.toBeNull()
    expect(screen.getByText('2/4 (50%)')).not.toBeNull()
  })

  it('falls back to the latest saved session when route state is missing', async () => {
    renderPage()

    expect(await screen.findByText('50%')).not.toBeNull()
    expect(screen.getByText('1 / 2 corrette')).not.toBeNull()
    expect(screen.getByText('Ripasso')).not.toBeNull()
  })

  it('lists wrong and unanswered questions with labels and validated question text', async () => {
    renderPage({ entryState: { session: makeSession() } })

    expect(await screen.findByText('Sbagliata')).not.toBeNull()
    expect(screen.getByText('Quanto fa 2 + 2?')).not.toBeNull()
    expect(screen.getByText('Non risposta')).not.toBeNull()
    expect(screen.getByText('Un triangolo ha tre lati.')).not.toBeNull()
  })

  it('shows a quiz-file fallback and question ids when analysis text is unavailable', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        quiz: {
          name: 'broken.json',
          type: 'application/json',
          data: encodeJson({ esame: 'Analisi' }),
        },
      }),
    )

    renderPage({ entryState: { session: makeSession({ errors: ['missing-q'], unanswered: [] }) } })

    expect((await screen.findByRole('alert')).textContent).toMatch(/File quiz non valido/i)
    expect(screen.getByText('missing-q')).not.toBeNull()
  })

  it('hides review when the session is clean or already a review', async () => {
    renderPage({
      entryState: {
        session: makeSession({ errors: [], unanswered: [], score: 3, total: 3 }),
      },
    })

    expect(await screen.findByText('Nessun errore o domanda non risposta.')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Ripassa errori' })).toBeNull()

    cleanup()
    renderPage({ entryState: { session: makeSession({ isReview: true }) } })

    expect(await screen.findByText('Ripasso')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Ripassa errori' })).toBeNull()
  })

  it('navigates to a compatible review session state from Ripassa errori', async () => {
    renderPage({ entryState: { session: makeSession() } })

    fireEvent.click(await screen.findByRole('button', { name: 'Ripassa errori' }))

    expect(
      await screen.findByText('{"reviewQuestionIds":["q1","q2"],"isReview":true}'),
    ).not.toBeNull()
  })

  it('handles zero-total sessions without dividing by zero', async () => {
    renderPage({ entryState: { session: makeSession({ score: 0, total: 0 }) } })

    expect(await screen.findByText('0%')).not.toBeNull()
    expect(screen.getByText('0 / 0 corrette')).not.toBeNull()
  })
})
