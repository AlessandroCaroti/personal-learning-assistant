import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import {
  makeEsame,
  makeExamDate,
  makeFlashCard,
  makeFlashcardFile,
  makeQuizDomanda,
  makeQuizFile,
  makeQuizSession,
} from '../__tests__/factories'
import type { Esame, FlashcardStats, QuestionStats } from '../types'

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

function encodeJson(value: unknown): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function questionStat(overrides: Partial<QuestionStats> = {}): QuestionStats {
  return {
    id: 'exam-1__q1',
    examId: 'exam-1',
    questionId: 'q1',
    timesShown: 4,
    timesCorrect: 2,
    ...overrides,
  }
}

function flashcardStat(overrides: Partial<FlashcardStats> = {}): FlashcardStats {
  return {
    id: 'exam-1__f1',
    examId: 'exam-1',
    cardId: 'f1',
    lastEval: 'Sì',
    lastSeen: '2026-06-14T10:00:00.000Z',
    ...overrides,
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

function localDateString(offsetDays: number): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

describe('StatisticsPage', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeEsame({ name: 'Analisi 1' }))
    getQuizSessions.mockResolvedValue([])
    getQuestionStats.mockResolvedValue([])
    getFlashcardStats.mockResolvedValue([])
    saveEsame.mockResolvedValue(undefined)
  })

  it('renders exam dates, quiz summary, weak questions, and weak macroargomenti', async () => {
    getEsame.mockResolvedValue(
      makeEsame({
        name: 'Analisi 1',
        examDates: [
          makeExamDate({ id: 'date-1', date: localDateString(0), label: 'Scritto' }),
          makeExamDate({
            id: 'date-2',
            date: localDateString(1),
            label: 'Orale',
            notes: 'Aula 3',
          }),
        ],
        files: {
          quiz: {
            name: 'quiz.json',
            type: 'application/json',
            data: encodeJson(
              makeQuizFile([
                makeQuizDomanda({
                  id: 'q1',
                  testo: 'Domanda difficile',
                  macroargomenti: ['Algebra'],
                }),
                makeQuizDomanda({
                  id: 'q2',
                  testo: 'Domanda facile',
                  macroargomenti: ['Analisi'],
                }),
              ]),
            ),
          },
        },
      }),
    )
    getQuizSessions.mockResolvedValue([
      makeQuizSession({
        id: 's1',
        score: 6,
        total: 10,
        totalTime: 120,
        completedByTimeout: false,
        isReview: false,
        date: '2026-06-13T10:00:00.000Z',
      }),
      makeQuizSession({
        id: 's2',
        score: 8,
        total: 10,
        totalTime: 60,
        completedByTimeout: true,
        isReview: true,
        date: '2026-06-14T10:00:00.000Z',
      }),
    ])
    getQuestionStats.mockResolvedValue([
      questionStat({ questionId: 'q1', timesShown: 5, timesCorrect: 1 }),
      questionStat({ questionId: 'q2', timesShown: 4, timesCorrect: 2 }),
    ])

    renderStatisticsPage()

    expect(await screen.findByRole('heading', { name: 'Statistiche' })).not.toBeNull()
    expect(screen.getByText('Analisi 1')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Date esame' })).not.toBeNull()
    expect(screen.getByText('Scritto')).not.toBeNull()
    expect(screen.getByText('oggi')).not.toBeNull()
    expect(screen.getByText(localDateString(0))).not.toBeNull()
    expect(screen.getByText('Orale')).not.toBeNull()
    expect(screen.getByText('1 giorno')).not.toBeNull()
    expect(screen.getByText(localDateString(1))).not.toBeNull()
    expect(screen.getByText('Aula 3')).not.toBeNull()

    expect(screen.getByRole('heading', { name: 'Quiz' })).not.toBeNull()
    expect(screen.getByText('Sessioni completate')).not.toBeNull()
    expect(screen.getByText('Sessioni completate').closest('div')).toHaveTextContent('2')
    expect(screen.getByText('70%')).not.toBeNull()
    expect(screen.getByText('Migliore').closest('div')).toHaveTextContent('80%')
    expect(screen.getByText('Ultimo risultato').closest('div')).toHaveTextContent('80%')
    expect(screen.getByText('1m 30s')).not.toBeNull()
    expect(screen.getByText('Domanda difficile')).not.toBeNull()
    expect(screen.getByText('Domanda difficile').closest('li')).toHaveTextContent(
      '20% corrette su 5 tentativi',
    )
    expect(screen.getByText('Domanda difficile').closest('li')).toHaveTextContent('Algebra')
    expect(screen.getByText('Domanda facile').closest('li')).toHaveTextContent(
      '50% corrette su 4 tentativi',
    )
    expect(screen.getByRole('heading', { name: 'Macroargomenti deboli' })).not.toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Macroargomenti deboli' }).closest('section'),
    ).toHaveTextContent('Algebra')
    expect(
      screen.getByRole('heading', { name: 'Macroargomenti deboli' }).closest('section'),
    ).toHaveTextContent('20% corrette su 5 tentativi')

    expect(screen.getByRole('heading', { name: 'Flashcard' })).not.toBeNull()
    expect(screen.getByText('Nessun file flashcard importato.')).not.toBeNull()
  })

  it('renders flashcard summary and weak flashcards', async () => {
    const cards = [
      makeFlashCard({ id: 'f1', fronte: 'Concetto fragile', macroargomenti: ['Patologia'] }),
      makeFlashCard({ id: 'f2', fronte: 'Concetto stabile', macroargomenti: ['Patologia'] }),
    ]
    getEsame.mockResolvedValue(
      makeEsame({
        files: {
          flashcard: {
            name: 'flashcard.json',
            type: 'application/json',
            data: encodeJson(makeFlashcardFile(cards)),
          },
        },
      }),
    )
    getFlashcardStats.mockResolvedValue([
      flashcardStat({ cardId: 'f1', lastEval: 'No', lastSeen: '2026-06-14T09:00:00.000Z' }),
      flashcardStat({
        id: 'exam-1__f2',
        cardId: 'f2',
        lastEval: 'Sì',
        lastSeen: '2026-06-14T11:00:00.000Z',
      }),
    ])

    renderStatisticsPage()

    expect(await screen.findByText('Flashcard')).not.toBeNull()
    expect(screen.getByText('Flashcard con progressi')).not.toBeNull()
    expect(screen.getByText('Flashcard con progressi').closest('div')).toHaveTextContent('2')
    expect(screen.getByText('Sì').closest('div')).toHaveTextContent('1')
    expect(screen.getByText('Concetto fragile')).not.toBeNull()
    expect(screen.getByText('Patologia')).not.toBeNull()
    expect(screen.getByText('Concetto fragile').closest('li')).toHaveTextContent('No')
    expect(screen.getByText(new Date('2026-06-14T09:00:00.000Z').toLocaleDateString())).not.toBeNull()
  })

  it('shows concrete source errors when imported JSON is invalid', async () => {
    getEsame.mockResolvedValue(
      makeEsame({
        files: {
          quiz: {
            name: 'quiz.json',
            type: 'application/json',
            data: encodeJson({ esame: 'Broken' }),
          },
          flashcard: {
            name: 'flashcard.json',
            type: 'application/json',
            data: encodeJson({ esame: 'Broken' }),
          },
        },
      }),
    )

    renderStatisticsPage()

    expect(
      await screen.findByText('Dettagli quiz non disponibili: file quiz non valido.'),
    ).not.toBeNull()
    expect(
      screen.getByText('Dettagli flashcard non disponibili: file flashcard non valido.'),
    ).not.toBeNull()
  })

  it('redirects to all exams when the exam is missing', async () => {
    getEsame.mockResolvedValue(undefined)

    renderStatisticsPage()

    expect(await screen.findByRole('heading', { name: 'Tutti gli esami' })).not.toBeNull()
  })

  it('navigates back to the exam dashboard', async () => {
    const user = userEvent.setup()

    renderStatisticsPage()

    await user.click(await screen.findByRole('button', { name: "Torna alla dashboard dell'esame" }))

    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('shows an error state and retries loading statistics', async () => {
    const user = userEvent.setup()

    getQuizSessions.mockRejectedValueOnce(new Error('DB failed')).mockResolvedValueOnce([])

    renderStatisticsPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('DB failed')

    await user.click(screen.getByRole('button', { name: 'Riprova' }))

    await waitFor(() => {
      expect(getQuizSessions).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByRole('heading', { name: 'Statistiche' })).not.toBeNull()
    expect(screen.getByText('Analisi 1')).not.toBeNull()
  })

  it('adds an exam date with optional label and notes', async () => {
    const user = userEvent.setup()
    const current = makeEsame({ examDates: [] })
    getEsame.mockResolvedValue(current)

    renderStatisticsPage()

    await user.type(await screen.findByLabelText('Data'), '2026-07-15')
    await user.type(screen.getByLabelText('Etichetta'), 'Scritto')
    await user.type(screen.getByLabelText('Note'), 'Aula 3')
    await user.click(screen.getByRole('button', { name: 'Aggiungi data' }))

    await waitFor(() => {
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        examDates: [
          {
            id: expect.any(String),
            date: '2026-07-15',
            label: 'Scritto',
            notes: 'Aula 3',
            createdAt: expect.any(String),
          },
        ],
      })
    })
  })

  it('edits and deletes an exam date', async () => {
    const user = userEvent.setup()
    const originalDate = makeExamDate({ id: 'date-1', date: '2026-07-15', label: 'Scritto' })
    const current = makeEsame({ examDates: [originalDate] })
    getEsame.mockResolvedValue(current)

    renderStatisticsPage()

    await user.click(await screen.findByRole('button', { name: 'Modifica Scritto' }))
    await user.clear(screen.getByLabelText('Etichetta'))
    await user.type(screen.getByLabelText('Etichetta'), 'Orale')
    await user.click(screen.getByRole('button', { name: 'Salva data' }))

    await waitFor(() => {
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        examDates: [{ ...originalDate, label: 'Orale' }],
      })
    })

    saveEsame.mockClear()

    await user.click(screen.getByRole('button', { name: 'Elimina Orale' }))
    await user.click(screen.getByRole('button', { name: 'Conferma eliminazione' }))

    await waitFor(() => {
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        examDates: [],
      })
    })
  })

  it('clears optional label and notes when editing an exam date', async () => {
    const user = userEvent.setup()
    const originalDate = makeExamDate({
      id: 'date-1',
      date: '2026-07-15',
      label: 'Scritto',
      notes: 'Aula 3',
    })
    const current = makeEsame({ examDates: [originalDate] })
    getEsame.mockResolvedValue(current)

    renderStatisticsPage()

    await user.click(await screen.findByRole('button', { name: 'Modifica Scritto' }))
    await user.clear(screen.getByLabelText('Etichetta'))
    await user.clear(screen.getByLabelText('Note'))
    await user.click(screen.getByRole('button', { name: 'Salva data' }))

    await waitFor(() => {
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        examDates: [
          {
            id: 'date-1',
            date: '2026-07-15',
            createdAt: originalDate.createdAt,
          },
        ],
      })
    })
  })

  it('shows an error and does not apply local success state when saving a date fails', async () => {
    const user = userEvent.setup()
    const current = makeEsame({ examDates: [] })
    getEsame.mockResolvedValue(current)
    saveEsame.mockRejectedValueOnce(new Error('Salvataggio non riuscito'))

    renderStatisticsPage()

    await user.type(await screen.findByLabelText('Data'), '2026-07-15')
    await user.type(screen.getByLabelText('Etichetta'), 'Scritto')
    await user.click(screen.getByRole('button', { name: 'Aggiungi data' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Salvataggio non riuscito')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-07-15')
    expect(screen.getByLabelText('Etichetta')).toHaveValue('Scritto')
    expect(screen.getByText('Nessuna data esame configurata.')).not.toBeNull()
    expect(screen.queryByText('Scritto')).toBeNull()
  })

  it('shows validation feedback for invalid date input', async () => {
    const user = userEvent.setup()

    renderStatisticsPage()

    await user.click(await screen.findByRole('button', { name: 'Aggiungi data' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Inserisci una data valida.')
    expect(saveEsame).not.toHaveBeenCalled()
  })

  it('clears stale exam content while loading a different exam route', async () => {
    const user = userEvent.setup()
    let resolveSecondExam: ((value: Esame) => void) | undefined
    getEsame
      .mockResolvedValueOnce(makeEsame({ name: 'Analisi 1' }))
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

    await user.click(screen.getByRole('button', { name: 'Vai a exam-2' }))

    expect(await screen.findByText('Caricamento...')).not.toBeNull()
    expect(screen.queryByText('Analisi 1')).toBeNull()

    resolveSecondExam?.({
      ...makeEsame(),
      id: 'exam-2',
      name: 'Geometria',
    })

    await waitFor(() => {
      expect(screen.getByText('Geometria')).not.toBeNull()
    })
  })

  it('ignores a late response from an older exam load after switching routes', async () => {
    const user = userEvent.setup()
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

    await user.click(screen.getByRole('button', { name: 'Vai a exam-2' }))

    resolveSecondExam?.({
      ...makeEsame({ name: 'Geometria' }),
      id: 'exam-2',
      name: 'Geometria',
    })

    await waitFor(() => {
      expect(screen.getByText('Geometria')).not.toBeNull()
    })

    resolveFirstExam?.(makeEsame())

    await waitFor(() => {
      expect(screen.getByText('Geometria')).not.toBeNull()
    })
    expect(screen.queryByText('Analisi 1')).toBeNull()
  })
})
