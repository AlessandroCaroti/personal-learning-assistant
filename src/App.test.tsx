import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import App, { isSessionRoute, shouldUseHashRouter } from './App'

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

  it('renders the responsive navigation shell and home route after onboarding', () => {
    localStorage.setItem('tutorialSeen', 'true')

    render(<App />)

    expect(screen.getByText('Study App')).not.toBeNull()
    expect(screen.getAllByRole('link', { name: 'Esami' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Guida' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Cambia tema' })).toHaveLength(2)
    expect(screen.getByRole('main').className).toContain('main-content')
    expect(screen.getByRole('heading', { name: 'I tuoi esami' })).not.toBeNull()
  })

  it('redirects the root route to onboarding when tutorialSeen is missing', async () => {
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Salta' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Guida' })).not.toBeNull()
  })

  it('keeps the root route on HomePage when tutorialSeen is set', () => {
    localStorage.setItem('tutorialSeen', 'true')

    render(<App />)

    expect(screen.getByRole('heading', { name: 'I tuoi esami' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Salta' })).toBeNull()
  })

  it('renders the home route when opened from a packaged index.html path', () => {
    localStorage.setItem('tutorialSeen', 'true')
    window.history.pushState({}, '', '/C:/Users/carot/Software/personal-learning-assistant/dist/index.html')

    render(<App />)

    expect(screen.getByRole('heading', { name: 'I tuoi esami' })).not.toBeNull()
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

describe('shouldUseHashRouter', () => {
  it('uses hash routing for packaged file URLs and index.html paths', () => {
    expect(shouldUseHashRouter({ protocol: 'file:', pathname: '/dist/index.html' })).toBe(true)
    expect(
      shouldUseHashRouter({
        protocol: 'http:',
        pathname: '/C:/Users/carot/Software/personal-learning-assistant/dist/index.html',
      }),
    ).toBe(true)
    expect(shouldUseHashRouter({ protocol: 'http:', pathname: '/' })).toBe(false)
  })
})
