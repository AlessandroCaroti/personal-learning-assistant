import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useAppStore', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.resetModules()
  })

  it('defaults to dark theme and applies it to the document', async () => {
    const { useAppStore } = await import('./appStore')

    expect(useAppStore.getState().theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('toggles and persists the theme', async () => {
    const { useAppStore } = await import('./appStore')

    useAppStore.getState().toggleTheme()

    expect(useAppStore.getState().theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('stores the current exam id', async () => {
    const { useAppStore } = await import('./appStore')

    useAppStore.getState().setCurrentExamId('exam-1')

    expect(useAppStore.getState().currentExamId).toBe('exam-1')
  })
})
