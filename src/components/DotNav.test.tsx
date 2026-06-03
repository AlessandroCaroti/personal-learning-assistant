import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DotNav } from './DotNav'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

describe('DotNav', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders selectable question dots', () => {
    const onSelect = vi.fn()

    render(
      <DotNav
        total={3}
        current={1}
        states={['unanswered', 'correct', 'wrong']}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Domanda 3, risposta errata' }))

    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('exposes status, current state, and a larger hit target', () => {
    render(
      <DotNav
        total={4}
        current={1}
        states={['unanswered', 'selected', 'correct', 'wrong']}
        onSelect={vi.fn()}
      />,
    )

    const unanswered = screen.getByRole('button', {
      name: 'Domanda 1, non risposta',
    })
    const selectedCurrent = screen.getByRole('button', {
      name: 'Domanda 2, corrente, risposta selezionata',
    })

    expect(selectedCurrent).toHaveAttribute('aria-current', 'step')
    expect(unanswered.style.width).toBe('44px')
    expect(unanswered.style.height).toBe('44px')
    expect(screen.getByRole('button', { name: 'Domanda 3, risposta corretta' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Domanda 4, risposta errata' })).not.toBeNull()
  })

  it('gives each answer status a visible non-color cue', () => {
    render(
      <DotNav
        total={4}
        current={0}
        states={['unanswered', 'selected', 'correct', 'wrong']}
        onSelect={vi.fn()}
      />,
    )

    expect(
      screen
        .getByRole('button', { name: 'Domanda 1, corrente, non risposta' })
        .querySelector('[data-status-cue="unanswered"]'),
    ).not.toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Domanda 2, risposta selezionata' })
        .querySelector('[data-status-cue="selected"]'),
    ).not.toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Domanda 3, risposta corretta' })
        .querySelector('[data-status-cue="correct"]')?.textContent,
    ).toBe('✓')
    expect(
      screen
        .getByRole('button', { name: 'Domanda 4, risposta errata' })
        .querySelector('[data-status-cue="wrong"]')?.textContent,
    ).toBe('×')
  })
})
