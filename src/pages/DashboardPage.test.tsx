import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { Esame, PausedSession } from '../types'

const getEsame = vi.fn()
const saveEsame = vi.fn()
const getPausedSession = vi.fn()
const replaceQuizFileForExam = vi.fn()
const replaceFlashcardFileForExam = vi.fn()
const pickFile = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
  saveEsame,
  getPausedSession,
  replaceQuizFileForExam,
  replaceFlashcardFileForExam,
}))

vi.mock('../services/fileService', () => ({
  fileService: {
    pickFile,
  },
}))

const { DashboardPage } = await import('./DashboardPage')

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
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
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
    saveEsame.mockResolvedValue(undefined)
    replaceQuizFileForExam.mockResolvedValue(undefined)
    replaceFlashcardFileForExam.mockResolvedValue(undefined)
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
})
