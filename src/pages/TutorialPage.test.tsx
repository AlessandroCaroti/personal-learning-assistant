import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TutorialPage } from './TutorialPage'

describe('TutorialPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    localStorage.clear()
  })

  it('renders onboarding skip only in onboarding mode', () => {
    const { rerender } = render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: 'Salta' })).toBeNull()

    rerender(
      <MemoryRouter>
        <TutorialPage isOnboarding />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Salta' })).not.toBeNull()
  })

  it('copies the quiz prompt and shows copied state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Copia prompt' })[0])

    expect(await screen.findByRole('button', { name: 'Copiato!' })).not.toBeNull()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('quiz.json'))
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('flashcard.json'))
  })

  it('copies the flashcard prompt separately', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Copia prompt' })[1])

    expect(await screen.findByRole('button', { name: 'Copiato!' })).not.toBeNull()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('flashcard.json'))
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('quiz.json'))
  })

  it('shows visible prompt text and a manual-copy fallback when clipboard copy fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>,
    )

    const quizPrompt = screen.getByLabelText('Prompt: Genera quiz') as HTMLTextAreaElement
    const flashcardPrompt = screen.getByLabelText('Prompt: Genera flashcard') as HTMLTextAreaElement

    expect(quizPrompt.value).toContain('quiz.json')
    expect(quizPrompt.value).not.toContain('flashcard.json')
    expect(flashcardPrompt.value).toContain('flashcard.json')
    expect(flashcardPrompt.value).not.toContain('quiz.json')

    fireEvent.click(screen.getAllByRole('button', { name: 'Copia prompt' })[0])

    expect(await screen.findByText(/riquadro del prompt/)).not.toBeNull()
  })

  it('marks onboarding as seen and navigates home when skipped', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<TutorialPage isOnboarding />} />
          <Route path="/" element={<h1>Esami</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Salta' }))

    expect(localStorage.getItem('tutorialSeen')).toBe('true')
    expect(await screen.findByRole('heading', { name: 'Esami' })).not.toBeNull()
  })
})
