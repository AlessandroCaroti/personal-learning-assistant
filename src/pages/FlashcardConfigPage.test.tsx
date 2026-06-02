import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Esame, PausedSession } from '../types'

const getEsame = vi.fn()
const getPausedSession = vi.fn()
const deletePausedSession = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
  getPausedSession,
  deletePausedSession,
}))

function encodedFile(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer as ArrayBuffer
}

function makeExam(flashcardData?: unknown): Esame {
  return {
    id: 'exam-1',
    name: 'Diritto',
    createdAt: '2026-06-01T09:00:00.000Z',
    files: flashcardData
      ? {
          flashcard: {
            name: 'flashcard.json',
            type: 'application/json',
            data: encodedFile(flashcardData),
          },
        }
      : {},
  }
}

function LocationProbe() {
  const location = useLocation()

  return (
    <pre data-testid="location-state">
      {JSON.stringify({ pathname: location.pathname, state: location.state })}
    </pre>
  )
}

function renderPage(initialEntry = '/esame/exam-1/flashcard/config') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/esame/:examId/flashcard/config" element={<FlashcardConfigPage />} />
        <Route
          path="/esame/:examId/flashcard/sessione"
          element={
            <>
              <h1>Sessione flashcard</h1>
              <LocationProbe />
            </>
          }
        />
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
        <Route path="/" element={<h1>Home</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

const { FlashcardConfigPage } = await import('./FlashcardConfigPage')

const flashcardFile = {
  esame: 'Diritto',
  carte: [
    { id: 'c1', macroargomenti: ['Zeta'], fronte: 'Fronte 1', retro: 'Retro 1' },
    { id: 'c2', macroargomenti: ['Alfa'], fronte: 'Fronte 2', retro: 'Retro 2' },
    { id: 'c3', macroargomenti: ['Beta', 'Alfa'], fronte: 'Fronte 3', retro: 'Retro 3' },
  ],
}

describe('FlashcardConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeExam(flashcardFile))
    getPausedSession.mockResolvedValue(undefined)
    deletePausedSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('loads flashcards, lists sorted macroargomenti, filters with OR, and starts with selected options', async () => {
    renderPage()

    const macroSection = await screen.findByRole('heading', { name: 'Macroargomenti' })
    const macroButtons = within(macroSection.closest('section') as HTMLElement).getAllByRole('button')
    expect(macroButtons.map((button) => button.textContent)).toEqual([
      'Tutti',
      'Alfa',
      'Beta',
      'Zeta',
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    expect(screen.getByText('1 carta disponibile')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    fireEvent.click(screen.getByRole('button', { name: '5m' }))
    fireEvent.click(screen.getByRole('button', { name: 'Inizia flashcard' }))

    expect(await screen.findByRole('heading', { name: 'Sessione flashcard' })).not.toBeNull()
    expect(screen.getByTestId('location-state').textContent).toContain(
      JSON.stringify({
        pathname: '/esame/exam-1/flashcard/sessione',
        state: { selectedMacro: ['Beta'], count: 1, limitSeconds: 300 },
      }),
    )
  })

  it('starts with custom count and custom time clamped to available cards and minutes', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Configura flashcard' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Personalizzato' })[0])
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Carte' }), {
      target: { value: '999' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Personalizzato' })[1])
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minuti' }), {
      target: { value: '999' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Inizia flashcard' }))

    expect(screen.getByTestId('location-state').textContent).toContain(
      JSON.stringify({
        pathname: '/esame/exam-1/flashcard/sessione',
        state: { selectedMacro: [], count: 3, limitSeconds: 10800 },
      }),
    )
  })

  it('disables start when no cards are available after loading', async () => {
    getEsame.mockResolvedValueOnce(makeExam({ esame: 'Diritto', carte: [] }))

    renderPage()

    expect(
      await screen.findByRole('button', {
        name: 'Nessuna carta disponibile con i filtri selezionati',
      }),
    ).toHaveProperty('disabled', true)
  })

  it('shows invalid flashcard files inline', async () => {
    getEsame.mockResolvedValueOnce(makeExam({ esame: 'Diritto', carte: [{ id: 'bad' }] }))

    renderPage()

    expect((await screen.findByRole('alert')).textContent).toContain('fronte')
    expect(screen.queryByRole('heading', { name: 'Dashboard esame' })).toBeNull()
  })

  it('redirects to the exam dashboard when the exam has no flashcard file', async () => {
    getEsame.mockResolvedValueOnce(makeExam())

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('asks whether to resume or restart when a paused flashcard session exists', async () => {
    const paused: PausedSession = {
      id: 'exam-1__flashcard',
      examId: 'exam-1',
      mode: 'flashcard',
      savedAt: '2026-06-01T09:00:00.000Z',
      elapsedSeconds: 12,
      timeLimitSeconds: null,
      macroargomenti: [],
      cardIds: ['c1'],
      currentCardIndex: 0,
      cardEvals: {},
      reviewQueue: [],
    }
    getPausedSession.mockResolvedValueOnce(paused)

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Inizia flashcard' }))

    expect(screen.getByRole('dialog', { name: 'Sessione in pausa' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Riprendi' }))

    expect(screen.getByTestId('location-state').textContent).toContain(
      JSON.stringify({
        pathname: '/esame/exam-1/flashcard/sessione',
        state: { resume: true },
      }),
    )
  })

  it('deletes the paused flashcard session before restarting from the conflict dialog', async () => {
    getPausedSession.mockResolvedValueOnce({
      id: 'exam-1__flashcard',
      examId: 'exam-1',
      mode: 'flashcard',
      savedAt: '2026-06-01T09:00:00.000Z',
      elapsedSeconds: 12,
      timeLimitSeconds: null,
      macroargomenti: [],
      cardIds: ['c1'],
      currentCardIndex: 0,
      cardEvals: {},
      reviewQueue: [],
    })

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Inizia flashcard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abbandona e ricomincia' }))

    await waitFor(() => {
      expect(deletePausedSession).toHaveBeenCalledWith('exam-1__flashcard')
    })
    expect(screen.getByTestId('location-state').textContent).toContain(
      '"pathname":"/esame/exam-1/flashcard/sessione"',
    )
  })
})
