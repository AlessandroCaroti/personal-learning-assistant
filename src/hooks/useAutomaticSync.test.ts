import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutomaticSync } from './useAutomaticSync'

describe('useAutomaticSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs sync on startup and on online events', async () => {
    const syncNow = vi.fn().mockResolvedValue(undefined)

    renderHook(() => useAutomaticSync(syncNow))
    await vi.runAllTimersAsync()

    expect(syncNow).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('online'))
    await vi.runAllTimersAsync()

    expect(syncNow).toHaveBeenCalledTimes(2)
  })

  it('debounces requested sync', async () => {
    const syncNow = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutomaticSync(syncNow))

    result.current.requestSync()
    result.current.requestSync()
    vi.advanceTimersByTime(799)
    expect(syncNow).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(syncNow).toHaveBeenCalledTimes(2)
  })

  it('debounces syncable write notifications', async () => {
    const syncNow = vi.fn().mockResolvedValue(undefined)

    renderHook(() => useAutomaticSync(syncNow))

    window.dispatchEvent(new Event('study-app-sync-dirty'))
    window.dispatchEvent(new Event('study-app-sync-dirty'))
    vi.advanceTimersByTime(799)
    expect(syncNow).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(syncNow).toHaveBeenCalledTimes(2)
  })
})
