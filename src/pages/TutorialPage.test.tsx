import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
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

  it('shows a fallback message when clipboard copy fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Copia prompt' })[0])

    expect(await screen.findByText(/Copia non riuscita/)).not.toBeNull()
  })
})
