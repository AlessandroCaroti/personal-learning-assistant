import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { isSessionRoute } from './App'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

describe('App routing shell', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    window.history.pushState({}, '', '/')
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders the responsive navigation shell and home route', () => {
    render(<App />)

    expect(screen.getByText('Study App')).not.toBeNull()
    expect(screen.getAllByRole('link', { name: 'Esami' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Guida' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Cambia tema' })).toHaveLength(2)
    expect(screen.getByRole('main').className).toContain('main-content')
    expect(screen.getByRole('heading', { name: 'Esami' })).not.toBeNull()
  })
})

describe('isSessionRoute', () => {
  it('matches active quiz and flashcard session routes only', () => {
    expect(isSessionRoute('/esame/abc/quiz/sessione')).toBe(true)
    expect(isSessionRoute('/esame/abc/flashcard/sessione')).toBe(true)
    expect(isSessionRoute('/esame/abc/quiz/config')).toBe(false)
    expect(isSessionRoute('/esame/abc/flashcard/config')).toBe(false)
    expect(isSessionRoute('/guida')).toBe(false)
  })
})
