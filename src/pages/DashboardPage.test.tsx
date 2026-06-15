import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import smokeFlashcardText from '../../assets/exams/patologia/patologia_flashcard.json?raw'
import smokeQuizText from '../../assets/exams/patologia/patologia_quiz.json?raw'
import smokeSummaryText from '../../assets/exams/patologia/patologia-summary.html?raw'
import type { Esame, PausedSession } from '../types'

const getEsame = vi.fn()
const saveEsame = vi.fn()
const getPausedSession = vi.fn()
const getQuizSessions = vi.fn()
const getQuestionStats = vi.fn()
const getFlashcardStats = vi.fn()
const replaceQuizFileForExam = vi.fn()
const replaceFlashcardFileForExam = vi.fn()
const getExamBackupSourceBundle = vi.fn()
const buildExamBackupArchive = vi.fn()
const downloadExamBackupArchive = vi.fn()
const suggestedBackupFileName = vi.fn()
const pickFile = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
  saveEsame,
  getPausedSession,
  getQuizSessions,
  getQuestionStats,
  getFlashcardStats,
  replaceQuizFileForExam,
  replaceFlashcardFileForExam,
  getExamBackupSourceBundle,
}))

vi.mock('../services/fileService', () => ({
  fileService: {
    pickFile,
  },
}))

vi.mock('../services/examBackupService', () => ({
  buildExamBackupArchive,
  downloadExamBackupArchive,
  suggestedBackupFileName,
}))

const { DashboardPage } = await import('./DashboardPage')
const { StatisticsPage } = await import('./StatisticsPage')

function encodeText(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value)
  return Uint8Array.from(bytes).buffer
}

const smokeQuizData = encodeText(smokeQuizText)
const smokeFlashcardData = encodeText(smokeFlashcardText)
const smokeSummaryData = encodeText(smokeSummaryText)

const validQuiz = {
  esame: 'Analisi',
  domande: [
    {
      id: 'q1',
      macroargomenti: ['Limiti'],
      tipo: 'multipla',
      testo: 'Quanto fa 2 + 2?',
      opzioni: ['3', '4'],
      risposta_corretta: '4',
      spiegazione: 'Somma.',
    },
  ],
}

const validFlashcards = {
  esame: 'Analisi',
  carte: [
    {
      id: 'c1',
      macroargomenti: ['Limiti'],
      fronte: 'Definizione',
      retro: 'Risposta',
    },
  ],
}

function encodeJson(value: unknown): ArrayBuffer {
  return encodeText(JSON.stringify(value))
}

function LocationStateView() {
  const location = useLocation()
  return <pre>{JSON.stringify(location.state)}</pre>
}

function renderDashboard(path = '/esame/exam-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId" element={<DashboardPage />} />
        <Route path="/esame/:examId/archivio" element={<h1>Archivio esame</h1>} />
        <Route path="/esame/:examId/statistiche" element={<StatisticsPage />} />
        <Route path="/esame/:examId/quiz/config" element={<LocationStateView />} />
        <Route path="/esame/:examId/quiz/sessione" element={<LocationStateView />} />
        <Route path="/esame/:examId/flashcard/sessione" element={<LocationStateView />} />
      </Routes>
    </MemoryRouter>,
  )
}

function makeExam(files: Esame['files'] = {}): Esame {
  return {
    id: 'exam-1',
    name: 'Analisi 1',
    createdAt: '2026-06-01T08:00:00.000Z',
    files,
  }
}

function makePaused(mode: 'quiz' | 'flashcard'): PausedSession {
  return {
    id: `exam-1__${mode}`,
    examId: 'exam-1',
    mode,
    savedAt: '2026-06-01T09:00:00.000Z',
    elapsedSeconds: 42,
    timeLimitSeconds: null,
    macroargomenti: [],
  }
}

describe('DashboardPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeExam())
    getPausedSession.mockResolvedValue(undefined)
    getQuizSessions.mockResolvedValue([])
    getQuestionStats.mockResolvedValue([])
    getFlashcardStats.mockResolvedValue([])
    saveEsame.mockResolvedValue(undefined)
    replaceQuizFileForExam.mockResolvedValue(undefined)
    replaceFlashcardFileForExam.mockResolvedValue(undefined)
    getExamBackupSourceBundle.mockResolvedValue({
      exam: makeExam(),
      quizSessions: [],
      questionStats: [],
      flashcardStats: [],
      pausedSessions: [],
    })
    buildExamBackupArchive.mockResolvedValue(encodeText('backup-archive'))
    suggestedBackupFileName.mockReturnValue('analisi-1-2026-06-13.pla-exam-backup')
    downloadExamBackupArchive.mockReturnValue(undefined)
  })

  it('redirects to all exams when the exam is missing', async () => {
    getEsame.mockResolvedValue(undefined)

    renderDashboard()

    expect(await screen.findByRole('heading', { name: 'Tutti gli esami' })).not.toBeNull()
  })

  it('does not save an invalid quiz import', async () => {
    pickFile.mockResolvedValue({
      name: 'quiz.json',
      type: 'application/json',
      data: encodeJson({ esame: 'Analisi' }),
    })

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Importa quiz.json' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/domande/i)
    expect(saveEsame).not.toHaveBeenCalled()
  })

  it('saves a valid quiz import and shows the file name', async () => {
    const current = makeExam()
    getEsame.mockResolvedValue(current)
    saveEsame.mockImplementation(async (updated: Esame) => {
      getEsame.mockResolvedValue(updated)
    })
    const pickedData = encodeJson(validQuiz)
    pickFile.mockResolvedValue({
      name: 'quiz.json',
      type: 'application/json',
      data: pickedData,
    })

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Importa quiz.json' }))

    await waitFor(() => {
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        files: {
          quiz: {
            name: 'quiz.json',
            type: 'application/json',
            data: pickedData,
          },
        },
      })
    })
    expect(await screen.findByText('quiz.json')).not.toBeNull()
  })

  it('shows an empty archive section on the dashboard', async () => {
    renderDashboard()

    expect(await screen.findByRole('heading', { name: 'Archivio' })).not.toBeNull()
    expect(screen.getByText('Nessun file')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Aggiungi file' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Apri archivio' })).not.toBeNull()
  })

  it('adds an archive attachment from the dashboard', async () => {
    const current = makeExam()
    getEsame.mockResolvedValue(current)
    saveEsame.mockImplementation(async (updated: Esame) => {
      getEsame.mockResolvedValue(updated)
    })
    const pickedData = encodeText('archive')
    pickFile.mockResolvedValue({
      name: 'archive.custom',
      type: 'application/octet-stream',
      data: pickedData,
    })

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Aggiungi file' }))

    expect(pickFile).toHaveBeenCalledWith([])
    await waitFor(() => {
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        attachments: [
          expect.objectContaining({
            id: expect.any(String),
            name: 'archive.custom',
            type: 'application/octet-stream',
            data: pickedData,
            createdAt: expect.any(String),
          }),
        ],
      })
    })
    expect(await screen.findByText('archive.custom')).not.toBeNull()
  })

  it('shows recent archive attachments and navigates to the full archive', async () => {
    getEsame.mockResolvedValue({
      ...makeExam(),
      attachments: [
        {
          id: 'old',
          name: 'old.pdf',
          type: 'application/pdf',
          data: encodeText('old'),
          createdAt: '2026-06-01T08:00:00.000Z',
        },
        {
          id: 'new',
          name: 'new.pdf',
          type: 'application/pdf',
          data: encodeText('new'),
          createdAt: '2026-06-02T08:00:00.000Z',
        },
      ],
    })

    renderDashboard()

    expect(await screen.findByText('2 file')).not.toBeNull()
    expect(screen.getByText('new.pdf')).not.toBeNull()
    expect(screen.getByText('old.pdf')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Apri archivio' }))

    expect(await screen.findByRole('heading', { name: 'Archivio esame' })).not.toBeNull()
  })

  it('exports a full exam backup from the dashboard', async () => {
    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Esporta backup' }))

    await waitFor(() => {
      expect(getExamBackupSourceBundle).toHaveBeenCalledWith('exam-1')
    })
    expect(buildExamBackupArchive).toHaveBeenCalledWith({
      exam: makeExam(),
      quizSessions: [],
      questionStats: [],
      flashcardStats: [],
      pausedSessions: [],
    })
    expect(suggestedBackupFileName).toHaveBeenCalledWith('Analisi 1')
    expect(downloadExamBackupArchive).toHaveBeenCalledWith(
      encodeText('backup-archive'),
      'analisi-1-2026-06-13.pla-exam-backup',
    )
  })

  it('navigates to the statistics page from the dashboard header', async () => {
    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Statistiche' }))

    expect(await screen.findByRole('heading', { name: 'Statistiche' })).not.toBeNull()
    expect(screen.getByText('Analisi 1')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Date esame' })).not.toBeNull()
  })

  it('shows an export error when backup generation fails', async () => {
    buildExamBackupArchive.mockRejectedValue(new Error('ZIP failed'))

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Esporta backup' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ZIP failed')
    expect(downloadExamBackupArchive).not.toHaveBeenCalled()
  })

  it('validates quiz replacement before calling the transactional replacement helper', async () => {
    const current = makeExam({
      quiz: { name: 'old-quiz.json', type: 'application/json', data: encodeJson(validQuiz) },
    })
    const calls: string[] = []
    getEsame.mockResolvedValue(current)
    const pickedData = encodeJson(validQuiz)
    pickFile.mockImplementation(async () => {
      calls.push('pick')
      return {
        name: 'new-quiz.json',
        type: 'application/json',
        data: pickedData,
      }
    })
    replaceQuizFileForExam.mockImplementation(async () => {
      calls.push('replace')
    })

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Sostituisci quiz.json' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sostituisci quiz' }))

    await waitFor(() => {
      expect(replaceQuizFileForExam).toHaveBeenCalledWith('exam-1', {
        name: 'new-quiz.json',
        type: 'application/json',
        data: pickedData,
      })
    })
    expect(calls).toEqual(['pick', 'replace'])
    expect(saveEsame).not.toHaveBeenCalled()
    expect(replaceFlashcardFileForExam).not.toHaveBeenCalled()
  })

  it('validates flashcard replacement before calling the transactional replacement helper', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        flashcard: {
          name: 'old-flashcard.json',
          type: 'application/json',
          data: encodeJson(validFlashcards),
        },
      }),
    )
    const pickedData = encodeJson(validFlashcards)
    pickFile.mockResolvedValue({
      name: 'new-flashcard.json',
      type: 'application/json',
      data: pickedData,
    })

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Sostituisci flashcard.json' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sostituisci flashcard' }))

    await waitFor(() => {
      expect(replaceFlashcardFileForExam).toHaveBeenCalledWith('exam-1', {
        name: 'new-flashcard.json',
        type: 'application/json',
        data: pickedData,
      })
    })
    expect(saveEsame).not.toHaveBeenCalled()
    expect(replaceQuizFileForExam).not.toHaveBeenCalled()
  })

  it('leaves existing quiz data untouched when replacement is invalid', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        quiz: { name: 'old-quiz.json', type: 'application/json', data: encodeJson(validQuiz) },
      }),
    )
    pickFile.mockResolvedValue({
      name: 'broken.json',
      type: 'application/json',
      data: encodeJson({ esame: 'Analisi' }),
    })

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Sostituisci quiz.json' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sostituisci quiz' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/domande/i)
    expect(replaceQuizFileForExam).not.toHaveBeenCalled()
    expect(replaceFlashcardFileForExam).not.toHaveBeenCalled()
    expect(saveEsame).not.toHaveBeenCalled()
    expect(screen.getByText('old-quiz.json')).not.toBeNull()
  })

  it('shows paused banners and navigates to resume sessions', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        quiz: { name: 'quiz.json', type: 'application/json', data: encodeJson(validQuiz) },
        flashcard: {
          name: 'flashcard.json',
          type: 'application/json',
          data: encodeJson(validFlashcards),
        },
      }),
    )
    getPausedSession.mockImplementation(async (id: string) => {
      if (id === 'exam-1__quiz') return makePaused('quiz')
      if (id === 'exam-1__flashcard') return makePaused('flashcard')
      return undefined
    })

    renderDashboard()

    expect(await screen.findByText(/quiz in pausa/i)).not.toBeNull()
    expect(screen.getByText(/flashcard in pausa/i)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Riprendi quiz' }))
    expect(await screen.findByText('{"resume":true}')).not.toBeNull()
  })

  it('smoke-tests importing the real patologia quiz, flashcard, and summary fixtures', async () => {
    const current = makeExam()
    getEsame.mockResolvedValue(current)
    saveEsame.mockImplementation(async (updated: Esame) => {
      getEsame.mockResolvedValue(updated)
    })
    pickFile
      .mockResolvedValueOnce({
        name: 'patologia-summary.html',
        type: 'text/html',
        data: smokeSummaryData,
      })
      .mockResolvedValueOnce({
        name: 'patologia_quiz.json',
        type: 'application/json',
        data: smokeQuizData,
      })
      .mockResolvedValueOnce({
        name: 'patologia_flashcard.json',
        type: 'application/json',
        data: smokeFlashcardData,
      })

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Importa riassunto' }))
    await waitFor(() => {
      expect(saveEsame).toHaveBeenNthCalledWith(1, {
        ...current,
        files: {
          riassunto: {
            name: 'patologia-summary.html',
            type: 'text/html',
            data: smokeSummaryData,
          },
        },
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Importa quiz.json' }))
    await waitFor(() => {
      expect(saveEsame).toHaveBeenNthCalledWith(2, {
        ...current,
        files: {
          riassunto: {
            name: 'patologia-summary.html',
            type: 'text/html',
            data: smokeSummaryData,
          },
          quiz: {
            name: 'patologia_quiz.json',
            type: 'application/json',
            data: smokeQuizData,
          },
        },
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Importa flashcard.json' }))
    await waitFor(() => {
      expect(saveEsame).toHaveBeenNthCalledWith(3, {
        ...current,
        files: {
          riassunto: {
            name: 'patologia-summary.html',
            type: 'text/html',
            data: smokeSummaryData,
          },
          quiz: {
            name: 'patologia_quiz.json',
            type: 'application/json',
            data: smokeQuizData,
          },
          flashcard: {
            name: 'patologia_flashcard.json',
            type: 'application/json',
            data: smokeFlashcardData,
          },
        },
      })
    })

    expect(await screen.findByText('patologia-summary.html')).not.toBeNull()
    expect(screen.getByText('patologia_quiz.json')).not.toBeNull()
    expect(screen.getByText('patologia_flashcard.json')).not.toBeNull()
  })
})
