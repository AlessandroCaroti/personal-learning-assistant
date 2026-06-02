import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Esame, PausedSession } from '../types'

const getEsame = vi.fn()
const getPausedSession = vi.fn()
const savePausedSession = vi.fn()
const saveFlashcardStat = vi.fn()
const deletePausedSession = vi.fn()
const capacitorState = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  backButtonListener: undefined as (() => void) | undefined,
  removeBackButtonListener: vi.fn(),
}))

vi.mock('../services/storageService', () => ({
  getEsame,
  getPausedSession,
  savePausedSession,
  saveFlashcardStat,
  deletePausedSession,
}))

vi.mock('../utils/shuffle', () => ({
  shuffle: <T,>(items: T[]) => [...items],
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: capacitorState.isNativePlatform,
  },
}))

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (event: string, callback: () => void) => {
      if (event === 'backButton') {
        capacitorState.backButtonListener = callback
      }

      return {
        remove: capacitorState.removeBackButtonListener,
      }
    }),
  },
}))

function encodedFile(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer as ArrayBuffer
}

const flashcardFile = {
  esame: 'Diritto',
  carte: [
    { id: 'c1', macroargomenti: ['Alfa'], fronte: 'Fronte 1', retro: 'Retro 1' },
    { id: 'c2', macroargomenti: ['Beta'], fronte: 'Fronte 2', retro: 'Retro 2' },
  ],
}

function makeExam(): Esame {
  return {
    id: 'exam-1',
    name: 'Diritto',
    createdAt: '2026-06-01T09:00:00.000Z',
    files: {
      flashcard: {
        name: 'flashcard.json',
        type: 'application/json',
        data: encodedFile(flashcardFile),
      },
    },
  }
}

function renderPage(state: unknown = { selectedMacro: [], count: 2, limitSeconds: null }) {
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/esame/exam-1/flashcard/sessione',
          state,
        },
      ]}
    >
      <Routes>
        <Route path="/esame/:examId/flashcard/sessione" element={<FlashcardSessionPage />} />
        <Route path="/esame/:examId/flashcard/config" element={<h1>Config flashcard</h1>} />
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

const { FlashcardSessionPage } = await import('./FlashcardSessionPage')

describe('FlashcardSessionPage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeExam())
    getPausedSession.mockResolvedValue(undefined)
    savePausedSession.mockResolvedValue(undefined)
    saveFlashcardStat.mockResolvedValue(undefined)
    deletePausedSession.mockResolvedValue(undefined)
    capacitorState.isNativePlatform.mockReturnValue(false)
    capacitorState.backButtonListener = undefined
    capacitorState.removeBackButtonListener.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('starts from navigation state and moves through front, back, and evaluations', async () => {
    renderPage({ selectedMacro: [], count: 2, limitSeconds: null })

    expect(await screen.findByText('Carta 1 di 2')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Fronte 1' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Mostra risposta' }))

    expect(screen.getByText('Retro 1')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'In parte' }))

    expect(screen.getByText('Carta 2 di 2')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Fronte 2' })).not.toBeNull()
  })

  it('pre-marks Non so as No and only offers Prossima on the back side', async () => {
    renderPage({ selectedMacro: [], count: 2, limitSeconds: null })

    fireEvent.click(await screen.findByRole('button', { name: 'Non so' }))

    expect(screen.getByText('Retro 1')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'In parte' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sì' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Prossima' }))

    expect(screen.getByRole('heading', { name: 'Fronte 2' })).not.toBeNull()
  })

  it('saves a paused flashcard session and returns to dashboard', async () => {
    renderPage({ selectedMacro: ['Alfa'], count: 1, limitSeconds: 300 })

    fireEvent.click(await screen.findByRole('button', { name: 'Pausa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Metti in pausa' }))

    await waitFor(() => {
      expect(savePausedSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'exam-1__flashcard',
          examId: 'exam-1',
          mode: 'flashcard',
          elapsedSeconds: 0,
          timeLimitSeconds: 300,
          macroargomenti: ['Alfa'],
          cardIds: ['c1'],
          currentCardIndex: 0,
        }),
      )
    })
    expect(screen.getByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('resumes a paused flashcard session when resume state is present', async () => {
    const paused: PausedSession = {
      id: 'exam-1__flashcard',
      examId: 'exam-1',
      mode: 'flashcard',
      savedAt: '2026-06-01T09:00:00.000Z',
      elapsedSeconds: 12,
      timeLimitSeconds: 300,
      macroargomenti: ['Beta'],
      cardIds: ['c1', 'c2'],
      currentCardIndex: 1,
      cardEvals: { c1: 'Sì' },
      reviewQueue: [],
    }
    getPausedSession.mockResolvedValueOnce(paused)

    renderPage({ resume: true })

    expect(await screen.findByText('Carta 2 di 2')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Fronte 2' })).not.toBeNull()
  })

  it('redirects to dashboard when the flashcard file is missing', async () => {
    getEsame.mockResolvedValueOnce({
      id: 'exam-1',
      name: 'Diritto',
      createdAt: '2026-06-01T09:00:00.000Z',
      files: {},
    } satisfies Esame)

    renderPage({ selectedMacro: [], count: 2, limitSeconds: null })

    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('redirects to config when resume is requested but the paused session is missing', async () => {
    renderPage({ resume: true })

    expect(await screen.findByRole('heading', { name: 'Config flashcard' })).not.toBeNull()
  })

  it('redirects to config when start state produces no cards', async () => {
    renderPage({ selectedMacro: ['Missing'], count: 2, limitSeconds: null })

    expect(await screen.findByRole('heading', { name: 'Config flashcard' })).not.toBeNull()
  })

  it('redirects to config when paused card ids no longer exist', async () => {
    getPausedSession.mockResolvedValueOnce({
      id: 'exam-1__flashcard',
      examId: 'exam-1',
      mode: 'flashcard',
      savedAt: '2026-06-01T09:00:00.000Z',
      elapsedSeconds: 12,
      timeLimitSeconds: null,
      macroargomenti: [],
      cardIds: ['missing'],
      currentCardIndex: 0,
      cardEvals: {},
      reviewQueue: [],
    } satisfies PausedSession)

    renderPage({ resume: true })

    expect(await screen.findByRole('heading', { name: 'Config flashcard' })).not.toBeNull()
  })

  it('opens the pause dialog from native back button', async () => {
    capacitorState.isNativePlatform.mockReturnValue(true)
    renderPage({ selectedMacro: [], count: 2, limitSeconds: null })

    expect(await screen.findByText('Carta 1 di 2')).not.toBeNull()
    await waitFor(() => {
      expect(capacitorState.backButtonListener).toBeDefined()
    })

    act(() => {
      capacitorState.backButtonListener?.()
    })

    expect(screen.getByRole('dialog', { name: 'Metti in pausa?' })).not.toBeNull()
  })

  it('finishes on the last evaluation, saves stats, and shows completion', async () => {
    renderPage({ selectedMacro: ['Alfa'], count: 1, limitSeconds: null })

    fireEvent.click(await screen.findByRole('button', { name: 'Mostra risposta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sì' }))

    expect(await screen.findByRole('heading', { name: 'Sessione completata' })).not.toBeNull()
    expect(saveFlashcardStat).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c1', lastEval: 'Sì' }),
    )
    expect(deletePausedSession).toHaveBeenCalledWith('exam-1__flashcard')
  })

  it('finishes on timeout and reports unreached cards as Non risposta', async () => {
    vi.useFakeTimers()
    renderPage({ selectedMacro: [], count: 2, limitSeconds: 1 })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByRole('heading', { name: 'Fronte 1' })).not.toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByRole('heading', { name: 'Tempo scaduto' })).not.toBeNull()
    expect(screen.getByText('2 carte non raggiunte segnate come Non risposta.')).not.toBeNull()
    expect(saveFlashcardStat).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c1', lastEval: 'Non risposta' }),
    )
    expect(saveFlashcardStat).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c2', lastEval: 'Non risposta' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Torna alla dashboard' }))
    expect(screen.getByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })
})
