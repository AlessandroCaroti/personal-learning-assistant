import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Timer } from './Timer'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

describe('Timer', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows remaining time and warns under one minute', () => {
    render(<Timer elapsed={30} remaining={59} />)

    const timer = screen.getByText('0:59')

    expect(timer.style.color).toBe('var(--danger)')
    expect(timer.style.fontWeight).toBe('700')
  })

  it('falls back to elapsed time when remaining is null', () => {
    render(<Timer elapsed={90} remaining={null} />)

    expect(screen.getByLabelText('Tempo trascorso')).toHaveTextContent('1:30')
  })
})
