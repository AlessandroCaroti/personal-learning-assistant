import { useCallback, useEffect, useRef } from 'react'

const SYNC_DIRTY_EVENT = 'study-app-sync-dirty'

export function useAutomaticSync(syncNow: () => Promise<void>, debounceMs = 800) {
  const syncNowRef = useRef(syncNow)
  const timeoutRef = useRef<number | null>(null)

  syncNowRef.current = syncNow

  const requestSync = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      void syncNowRef.current()
    }, debounceMs)
  }, [debounceMs])

  useEffect(() => {
    void syncNowRef.current()

    function handleOnline() {
      requestSync()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener(SYNC_DIRTY_EVENT, requestSync)
    document.addEventListener('visibilitychange', requestSync)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener(SYNC_DIRTY_EVENT, requestSync)
      document.removeEventListener('visibilitychange', requestSync)

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [requestSync])

  return { requestSync }
}
