import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UseTimerOptions {
  limitSeconds: number | null
  initialElapsed?: number
  onExpire?: () => void
}

interface UseTimerResult {
  elapsed: number
  remaining: number | null
  isExpired: boolean
  pause: () => void
  resume: () => void
}

export function useTimer({
  limitSeconds,
  initialElapsed = 0,
  onExpire,
}: UseTimerOptions): UseTimerResult {
  const [elapsed, setElapsed] = useState(initialElapsed)
  const [isPaused, setIsPaused] = useState(false)
  const onExpireRef = useRef(onExpire)
  const hasExpiredRef = useRef(false)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  const isExpired = limitSeconds !== null && elapsed >= limitSeconds
  const remaining = useMemo(() => {
    if (limitSeconds === null) return null

    return Math.max(0, limitSeconds - elapsed)
  }, [elapsed, limitSeconds])

  useEffect(() => {
    if (!isExpired) {
      hasExpiredRef.current = false
      return
    }

    if (hasExpiredRef.current) return

    hasExpiredRef.current = true
    onExpireRef.current?.()
  }, [isExpired])

  useEffect(() => {
    if (isPaused || isExpired) return undefined

    const intervalId = window.setInterval(() => {
      setElapsed((currentElapsed) => {
        const nextElapsed = currentElapsed + 1

        if (limitSeconds === null) return nextElapsed

        return Math.min(nextElapsed, limitSeconds)
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isPaused, isExpired, limitSeconds])

  const pause = useCallback(() => {
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    if (!isExpired) {
      setIsPaused(false)
    }
  }, [isExpired])

  return {
    elapsed,
    remaining,
    isExpired,
    pause,
    resume,
  }
}
