import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { Esame, PausedSession } from '../types'

const getEsame = vi.fn()
const getPausedSession = vi.fn()
const deletePausedSession = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
  getPausedSession,
  deletePausedSession,
}))

const { QuizConfigPage } = await import('./QuizConfigPage')

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
      spiegazione: 'Somma.',
    },
    {
      id: 'q2',
      macroargomenti: ['Geometria'],
      tipo: 'vero_falso',
      testo: 'Un triangolo ha tre lati.',
      risposta_corretta: 'Vero',
      spiegazione: 'Definizione.',
    },
    {
      id: 'q3',
      macroargomenti: ['Algebra', 'Analisi'],
      tipo: 'multipla',
      testo: 'Quanto fa 3 + 3?',
      opzioni: ['5', '6'],
      risposta_corretta: '6',
      spiegazione: 'Somma.',
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

function makePaused(): PausedSession {
  return {
    id: 'exam-1__quiz',
    examId: 'exam-1',
    mode: 'quiz',
    savedAt: '2026-06-01T09:00:00.000Z',
    elapsedSeconds: 42,
    timeLimitSeconds: null,
    macroargomenti: [],
    questionIds: ['q1'],
    currentQuestionIndex: 0,
    confirmedAnswers: {},
  }
}

function LocationStateView() {
  const location = useLocation()
  return <pre>{JSON.stringify(location.state)}</pre>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/esame/exam-1/quiz/config']}>
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
        <Route path="/esame/:examId/quiz/config" element={<QuizConfigPage />} />
        <Route path="/esame/:examId/quiz/sessione" element={<LocationStateView />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QuizConfigPage', () => {
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
    getPausedSession.mockResolvedValue(undefined)
    deletePausedSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('redirects to the dashboard when the quiz file is missing', async () => {
    getEsame.mockResolvedValue(makeExam())

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('shows a clear error for an invalid quiz file', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        quiz: {
          name: 'broken.json',
          type: 'application/json',
          data: encodeJson({ esame: 'Analisi' }),
        },
      }),
    )

    renderPage()

    expect((await screen.findByRole('alert')).textContent).toMatch(/domande/i)
  })

  it('renders sorted macros, count presets, and time presets', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Configura quiz' })).not.toBeNull()
    const macroButtons = screen
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((text) => ['Tutti', 'Algebra', 'Analisi', 'Geometria'].includes(text ?? ''))
    expect(macroButtons).toEqual(['Tutti', 'Algebra', 'Analisi', 'Geometria'])
    expect(screen.getByRole('button', { name: '10' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '30' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '50' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Disabilitato' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '5m' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '30m' })).not.toBeNull()
  })

  it('warns when the raw requested count exceeds the filtered available questions', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Geometria' }))

    expect(await screen.findByText(/sono disponibili solo 1 domande/i)).not.toBeNull()
  })

  it('disables start when no questions are available after filtering', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        quiz: {
          name: 'empty.json',
          type: 'application/json',
          data: encodeJson({ esame: 'Analisi', domande: [] }),
        },
      }),
    )

    renderPage()

    const start = await screen.findByRole('button', {
      name: 'Nessuna domanda disponibile con i filtri selezionati',
    })
    expect(start).toHaveProperty('disabled', true)
  })

  it('starts with selected macros, clamped count, and limit seconds in navigation state', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Algebra' }))
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    fireEvent.click(screen.getByRole('button', { name: '5m' }))
    fireEvent.click(screen.getByRole('button', { name: 'Inizia quiz' }))

    expect(await screen.findByText('{"selectedMacro":["Algebra"],"count":2,"limitSeconds":300}')).not.toBeNull()
  })

  it('resumes or abandons a paused quiz before starting a new one', async () => {
    getPausedSession.mockResolvedValue(makePaused())

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Inizia quiz' }))
    expect(screen.getByRole('dialog')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Riprendi' }))
    expect(await screen.findByText('{"resume":true}')).not.toBeNull()

    cleanup()
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Inizia quiz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abbandona e ricomincia' }))

    await waitFor(() => {
      expect(deletePausedSession).toHaveBeenCalledWith('exam-1__quiz')
    })
    expect(await screen.findByText('{"selectedMacro":[],"count":3,"limitSeconds":null}')).not.toBeNull()
  })
})
