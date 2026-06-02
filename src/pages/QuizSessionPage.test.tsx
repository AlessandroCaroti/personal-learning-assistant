import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { Esame, PausedSession, QuizSession } from '../types'

const getEsame = vi.fn()
const getPausedSession = vi.fn()
const savePausedSession = vi.fn()
const saveQuizSession = vi.fn()
const deletePausedSession = vi.fn()
const getQuestionStats = vi.fn()
const saveQuestionStat = vi.fn()

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

vi.mock('../utils/shuffle', () => ({
  shuffle: <T,>(items: T[]) => [...items],
}))

vi.mock('../services/storageService', () => ({
  getEsame,
  getPausedSession,
  savePausedSession,
  saveQuizSession,
  deletePausedSession,
  getQuestionStats,
  saveQuestionStat,
}))

const { QuizSessionPage } = await import('./QuizSessionPage')

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
    {
      id: 'q3',
      macroargomenti: ['Algebra'],
      tipo: 'multipla',
      testo: 'Quanto fa 3 + 3?',
      opzioni: ['5', '6'],
      risposta_corretta: '6',
      spiegazione: 'Tre piu tre fa sei.',
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

function makePaused(overrides: Partial<PausedSession> = {}): PausedSession {
  return {
    id: 'exam-1__quiz',
    examId: 'exam-1',
    mode: 'quiz',
    savedAt: '2026-06-01T09:00:00.000Z',
    elapsedSeconds: 42,
    timeLimitSeconds: null,
    macroargomenti: ['Algebra'],
    questionIds: ['q1', 'q3'],
    currentQuestionIndex: 1,
    confirmedAnswers: { q1: '4' },
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
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
          pathname: '/esame/exam-1/quiz/sessione',
          state: entryState,
        },
      ]}
    >
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
        <Route path="/esame/:examId/quiz/config" element={<h1>Configura quiz</h1>} />
        <Route path="/esame/:examId/quiz/sessione" element={<QuizSessionPage />} />
        <Route path="/esame/:examId/quiz/risultato" element={<LocationStateView />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function selectAndConfirm(answer: string) {
  fireEvent.click(await screen.findByRole('button', { name: answer }))
  fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
}

describe('QuizSessionPage', () => {
  beforeEach(() => {
    vi.useRealTimers()
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
    savePausedSession.mockResolvedValue(undefined)
    saveQuizSession.mockResolvedValue(undefined)
    deletePausedSession.mockResolvedValue(undefined)
    getQuestionStats.mockResolvedValue([])
    saveQuestionStat.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('starts from config state and filters the requested questions', async () => {
    renderPage({ entryState: { selectedMacro: ['Algebra'], count: 1, limitSeconds: 300 } })

    expect(await screen.findByText('Domanda 1 di 1')).not.toBeNull()
    expect(screen.getByText('Quanto fa 2 + 2?')).not.toBeNull()
    expect(screen.getByLabelText('Tempo rimanente').textContent).toBe('5:00')
  })

  it('resumes from paused state with initial elapsed time', async () => {
    getPausedSession.mockResolvedValue(makePaused())

    renderPage({ entryState: { resume: true } })

    expect(await screen.findByText('Domanda 2 di 2')).not.toBeNull()
    expect(screen.getByText('Quanto fa 3 + 3?')).not.toBeNull()
    expect(screen.getByLabelText('Tempo trascorso').textContent).toBe('0:42')
  })

  it('redirects to config when resume is requested but the paused session is missing', async () => {
    renderPage({ entryState: { resume: true } })

    expect(await screen.findByRole('heading', { name: 'Configura quiz' })).not.toBeNull()
  })

  it('shows explanation and answer styling after confirming a selection', async () => {
    renderPage({ entryState: { count: 1 } })

    await selectAndConfirm('4')

    expect(await screen.findByText('Due piu due fa quattro.')).not.toBeNull()
    expect(screen.getByRole('button', { name: '4' })).toHaveProperty('disabled', true)
  })

  it('delivers explicitly and navigates to the result with the finished session', async () => {
    renderPage({ entryState: { count: 1 } })

    await selectAndConfirm('4')
    fireEvent.click(screen.getByRole('button', { name: /Consegna quiz/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Consegna' }))

    await waitFor(() => {
      expect(saveQuizSession).toHaveBeenCalled()
    })
    const savedSession = saveQuizSession.mock.calls[0][0] as QuizSession
    expect(savedSession.completedByTimeout).toBe(false)
    expect(savedSession.score).toBe(1)
    expect(await screen.findByText(/"completedByTimeout":false/)).not.toBeNull()
  })

  it('auto-delivers on timeout once with completedByTimeout', async () => {
    vi.useFakeTimers()
    renderPage({ entryState: { count: 1, limitSeconds: 1 } })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('Domanda 1 di 1')).not.toBeNull()
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveQuizSession).toHaveBeenCalledTimes(1)
    const savedSession = saveQuizSession.mock.calls[0][0] as QuizSession
    expect(savedSession.completedByTimeout).toBe(true)
    expect(savedSession.totalTime).toBe(1)
    expect(savedSession.unanswered).toEqual(['q1'])
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText(/"completedByTimeout":true/)).not.toBeNull()
  })

  it('auto-delivers an expired resumed session after initialization', async () => {
    getPausedSession.mockResolvedValue(
      makePaused({
        elapsedSeconds: 60,
        timeLimitSeconds: 60,
      }),
    )

    renderPage({ entryState: { resume: true } })

    await waitFor(() => {
      expect(saveQuizSession).toHaveBeenCalledTimes(1)
    })
    const savedSession = saveQuizSession.mock.calls[0][0] as QuizSession
    expect(savedSession.completedByTimeout).toBe(true)
    expect(savedSession.totalTime).toBe(60)
    expect(await screen.findByText(/"completedByTimeout":true/)).not.toBeNull()
  })

  it('pauses, saves elapsed state, and returns to the dashboard', async () => {
    renderPage({ entryState: { count: 2 } })

    await screen.findByText('Domanda 1 di 2')
    fireEvent.click(screen.getByRole('button', { name: 'Pausa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Metti in pausa' }))

    await waitFor(() => {
      expect(savePausedSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'exam-1__quiz',
          examId: 'exam-1',
          mode: 'quiz',
          elapsedSeconds: 0,
          questionIds: ['q1', 'q2'],
          currentQuestionIndex: 0,
        }),
      )
    })
    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('lets timeout completion win when pause dialog was open before expiration', async () => {
    vi.useFakeTimers()
    const saveCompletion = deferred<void>()
    saveQuizSession.mockReturnValueOnce(saveCompletion.promise)
    renderPage({ entryState: { count: 1, limitSeconds: 1 } })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('Domanda 1 di 1')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Pausa' }))

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(saveQuizSession).toHaveBeenCalledTimes(1)

    const pauseConfirm = screen.queryByRole('button', { name: 'Metti in pausa' })
    if (pauseConfirm) {
      fireEvent.click(pauseConfirm)
    }

    await act(async () => {
      saveCompletion.resolve(undefined)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(savePausedSession).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Dashboard esame' })).toBeNull()
    expect(screen.getByText(/"completedByTimeout":true/)).not.toBeNull()
  })

  it('shows a finish error after persistence fails and allows delivery retry', async () => {
    saveQuizSession
      .mockRejectedValueOnce(new Error('IndexedDB unavailable'))
      .mockResolvedValueOnce(undefined)
    renderPage({ entryState: { count: 1 } })

    await screen.findByText('Domanda 1 di 1')
    fireEvent.click(screen.getByRole('button', { name: /Consegna quiz/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Consegna' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Impossibile salvare il risultato del quiz. Riprova.',
    )

    fireEvent.click(screen.getByRole('button', { name: /Consegna quiz/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Consegna' }))

    await waitFor(() => {
      expect(saveQuizSession).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText(/"completedByTimeout":false/)).not.toBeNull()
  })

  it('supports free navigation through the dot nav', async () => {
    renderPage({ entryState: { count: 2 } })

    expect(await screen.findByText('Quanto fa 2 + 2?')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Domanda 2, non risposta/i }))

    expect(await screen.findByText('Un triangolo ha tre lati.')).not.toBeNull()
  })
})
