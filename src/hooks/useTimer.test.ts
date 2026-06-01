import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTimer } from './useTimer'

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('count-up elapsed starts at 0 and remaining is null', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: null }))

    expect(result.current.elapsed).toBe(0)
    expect(result.current.remaining).toBeNull()
    expect(result.current.isExpired).toBe(false)
  })

  it('elapsed increments each second', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: null }))

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.elapsed).toBe(3)
  })

  it('count-down remaining starts at limitSeconds', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: 10 }))

    expect(result.current.elapsed).toBe(0)
    expect(result.current.remaining).toBe(10)
    expect(result.current.isExpired).toBe(false)
  })

  it('calls onExpire at zero', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() =>
      useTimer({ limitSeconds: 3, onExpire }),
    )

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.elapsed).toBe(3)
    expect(result.current.remaining).toBe(0)
    expect(result.current.isExpired).toBe(true)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('pause stops timer', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: null }))

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      result.current.pause()
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.elapsed).toBe(1)
  })

  it('resume continues after pause', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: null }))

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      result.current.pause()
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    act(() => {
      result.current.resume()
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.elapsed).toBe(3)
  })

  it('starts from initialElapsed', () => {
    const { result } = renderHook(() =>
      useTimer({ limitSeconds: 10, initialElapsed: 4 }),
    )

    expect(result.current.elapsed).toBe(4)
    expect(result.current.remaining).toBe(6)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.elapsed).toBe(5)
    expect(result.current.remaining).toBe(5)
  })

  it('calls onExpire exactly once and does not resume after expiry', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() =>
      useTimer({ limitSeconds: 2, onExpire }),
    )

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    act(() => {
      result.current.resume()
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.elapsed).toBe(2)
    expect(result.current.remaining).toBe(0)
    expect(result.current.isExpired).toBe(true)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('uses the latest onExpire callback', () => {
    const firstOnExpire = vi.fn()
    const secondOnExpire = vi.fn()
    const { rerender } = renderHook(
      ({ onExpire }) => useTimer({ limitSeconds: 2, onExpire }),
      { initialProps: { onExpire: firstOnExpire } },
    )

    rerender({ onExpire: secondOnExpire })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(firstOnExpire).not.toHaveBeenCalled()
    expect(secondOnExpire).toHaveBeenCalledTimes(1)
  })
})
