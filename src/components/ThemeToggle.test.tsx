import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.resetModules()
  })

  afterEach(() => {
    cleanup()
  })

  it('toggles the store theme and applies it to the document', async () => {
    const { ThemeToggle } = await import('./ThemeToggle')
    const { useAppStore } = await import('../store/appStore')

    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Cambia tema' }))

    expect(useAppStore.getState().theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
