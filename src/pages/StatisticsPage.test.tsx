import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
        <Route path="/esame/:examId/statistiche" element={<StatisticsPage />} />
      </Routes>
    </MemoryRouter>,
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
})
