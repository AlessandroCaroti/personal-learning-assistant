import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressBar } from './ProgressBar'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

describe('ProgressBar', () => {
  afterEach(() => {
    cleanup()
  })

  it('exposes the expected percentage', () => {
    render(<ProgressBar current={2} total={4} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('clamps unexpected percentages to the 0 to 100 range', () => {
    const { rerender } = render(<ProgressBar current={6} total={4} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')

    rerender(<ProgressBar current={-1} total={4} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
