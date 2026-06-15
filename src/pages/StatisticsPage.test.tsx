import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MemoryRouter,
  Outlet,
  Route,
  RouterProvider,
  Routes,
  createMemoryRouter,
  useNavigate,
} from 'react-router-dom'
import type { Esame } from '../types'

const getEsame = vi.fn()
const getQuizSessions = vi.fn()
const getQuestionStats = vi.fn()
const getFlashcardStats = vi.fn()
const saveEsame = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
  getQuizSessions,
  getQuestionStats,
  getFlashcardStats,
  saveEsame,
}))

const { StatisticsPage } = await import('./StatisticsPage')

function makeExam(): Esame {
  return {
    id: 'exam-1',
    name: 'Analisi 1',
    createdAt: '2026-06-01T08:00:00.000Z',
    files: {},
  }
}

function renderStatisticsPage(path = '/esame/exam-1/statistiche') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
        <Route path="/esame/:examId/statistiche" element={<StatisticsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function DeferredRouteLayout() {
  const navigate = useNavigate()

  return (
    <>
      <button type="button" onClick={() => navigate('/esame/exam-2/statistiche')}>
        Vai a exam-2
      </button>
      <Outlet />
    </>
  )
}

describe('StatisticsPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeExam())
    getQuizSessions.mockResolvedValue([])
    getQuestionStats.mockResolvedValue([])
    getFlashcardStats.mockResolvedValue([])
    saveEsame.mockResolvedValue(undefined)
  })

  it('renders the statistics shell for the current exam', async () => {
    renderStatisticsPage()

    expect(await screen.findByRole('heading', { name: 'Statistiche' })).not.toBeNull()
    expect(screen.getByText('Analisi 1')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Date esame' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Quiz' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Flashcard' })).not.toBeNull()
  })

  it('redirects to all exams when the exam is missing', async () => {
    getEsame.mockResolvedValue(undefined)

    renderStatisticsPage()

    expect(await screen.findByRole('heading', { name: 'Tutti gli esami' })).not.toBeNull()
  })

  it('navigates back to the exam dashboard', async () => {
    renderStatisticsPage()

    fireEvent.click(await screen.findByRole('button', { name: "Torna alla dashboard dell'esame" }))

    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('shows an error state and retries loading statistics', async () => {
    getQuizSessions.mockRejectedValueOnce(new Error('DB failed')).mockResolvedValueOnce([])

    renderStatisticsPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('DB failed')

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))

    await waitFor(() => {
      expect(getQuizSessions).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByRole('heading', { name: 'Statistiche' })).not.toBeNull()
    expect(screen.getByText('Analisi 1')).not.toBeNull()
  })

  it('clears stale exam content while loading a different exam route', async () => {
    let resolveSecondExam: ((value: Esame) => void) | undefined
    getEsame
      .mockResolvedValueOnce(makeExam())
      .mockImplementationOnce(
        () =>
          new Promise<Esame>((resolve) => {
            resolveSecondExam = resolve
          }),
      )

    const router = createMemoryRouter(
      [
        {
          path: '/esame/:examId',
          element: <DeferredRouteLayout />,
          children: [{ path: 'statistiche', element: <StatisticsPage /> }],
        },
      ],
      { initialEntries: ['/esame/exam-1/statistiche'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Analisi 1')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Vai a exam-2' }))

    expect(await screen.findByText('Caricamento...')).not.toBeNull()
    expect(screen.queryByText('Analisi 1')).toBeNull()

    resolveSecondExam?.({
      ...makeExam(),
      id: 'exam-2',
      name: 'Geometria',
    })

    expect(await screen.findByText('Geometria')).not.toBeNull()
  })

  it('ignores a late response from an older exam load after switching routes', async () => {
    let resolveFirstExam: ((value: Esame) => void) | undefined
    let resolveSecondExam: ((value: Esame) => void) | undefined

    getEsame
      .mockImplementationOnce(
        () =>
          new Promise<Esame>((resolve) => {
            resolveFirstExam = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Esame>((resolve) => {
            resolveSecondExam = resolve
          }),
      )

    const router = createMemoryRouter(
      [
        {
          path: '/esame/:examId',
          element: <DeferredRouteLayout />,
          children: [{ path: 'statistiche', element: <StatisticsPage /> }],
        },
      ],
      { initialEntries: ['/esame/exam-1/statistiche'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Caricamento...')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Vai a exam-2' }))

    resolveSecondExam?.({
      ...makeExam(),
      id: 'exam-2',
      name: 'Geometria',
    })

    expect(await screen.findByText('Geometria')).not.toBeNull()

    resolveFirstExam?.(makeExam())

    await waitFor(() => {
      expect(screen.getByText('Geometria')).not.toBeNull()
    })
    expect(screen.queryByText('Analisi 1')).toBeNull()
  })
})
