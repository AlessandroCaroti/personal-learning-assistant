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

  it('copies the quiz and flashcard prompt and shows copied state', async () => {
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
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('flashcard.json'))
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

    const prompt = screen.getByLabelText('Prompt: Genera quiz e flashcard') as HTMLTextAreaElement

    expect(prompt.value).toContain('quiz.json')
    expect(prompt.value).toContain('flashcard.json')

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
