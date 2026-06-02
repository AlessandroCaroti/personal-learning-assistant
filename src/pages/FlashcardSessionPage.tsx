import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ProgressBar } from '../components/ProgressBar'
import { Timer } from '../components/Timer'
import { useFlashcard } from '../hooks/useFlashcard'
import { useTimer } from '../hooks/useTimer'
import { validateFlashcardFile } from '../services/quizService'
import * as storage from '../services/storageService'
import type { FlashcardFile, PausedSession } from '../types'

interface StartConfig {
  selectedMacro: string[]
  count: number
  limitSeconds: number | null
}

type LoadedSession =
  | {
    mode: 'start'
    flashcardData: FlashcardFile
    config: StartConfig
  }
  | {
    mode: 'resume'
    flashcardData: FlashcardFile
    pausedSession: PausedSession
  }

interface CompletionState {
  timedOut: boolean
  unansweredCount: number
}

function parseJsonFile(data: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(data))
}

function readStartConfig(state: unknown): StartConfig | null {
  if (!state || typeof state !== 'object') return null

  const record = state as Record<string, unknown>
  const selectedMacro = Array.isArray(record.selectedMacro)
    ? record.selectedMacro.filter((item): item is string => typeof item === 'string')
    : []
  const count = typeof record.count === 'number' && Number.isFinite(record.count) && record.count > 0
    ? record.count
    : null
  const limitSeconds =
    typeof record.limitSeconds === 'number' && Number.isFinite(record.limitSeconds)
      ? record.limitSeconds
      : null

  if (count === null) return null

  return { selectedMacro, count, limitSeconds }
}

export function FlashcardSessionPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [loadedSession, setLoadedSession] = useState<LoadedSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!examId) {
        navigate('/')
        return
      }

      try {
        const esame = await storage.getEsame(examId)
        if (!esame?.files.flashcard) {
          navigate(`/esame/${examId}`)
          return
        }

        const flashcardData = validateFlashcardFile(parseJsonFile(esame.files.flashcard.data))

        if ((location.state as { resume?: boolean } | null)?.resume === true) {
          const pausedSession = await storage.getPausedSession(`${examId}__flashcard`)
          if (!pausedSession || pausedSession.mode !== 'flashcard') {
            navigate(`/esame/${examId}/flashcard/config`)
            return
          }

          if (!cancelled) {
            setLoadedSession({ mode: 'resume', flashcardData, pausedSession })
          }
          return
        }

        const config = readStartConfig(location.state)
        if (!config) {
          navigate(`/esame/${examId}/flashcard/config`)
          return
        }

        if (!cancelled) {
          setLoadedSession({ mode: 'start', flashcardData, config })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Flashcard non valide')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [examId, location.state, navigate])

  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: '1rem',
          border: '1px solid var(--danger)',
          borderRadius: '8px',
          background: 'rgba(224, 85, 85, 0.12)',
        }}
      >
        {error}
      </div>
    )
  }

  if (!examId || !loadedSession) {
    return <div style={{ color: 'var(--text-muted)' }}>Caricamento...</div>
  }

  return <ActiveFlashcardSession examId={examId} loadedSession={loadedSession} />
}

function ActiveFlashcardSession({
  examId,
  loadedSession,
}: {
  examId: string
  loadedSession: LoadedSession
}) {
  const navigate = useNavigate()
  const flashcard = useFlashcard(examId)
  const [initialized, setInitialized] = useState(false)
  const [pauseDialog, setPauseDialog] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [completion, setCompletion] = useState<CompletionState | null>(null)
  const [preMarkedNoCardId, setPreMarkedNoCardId] = useState<string | null>(null)
  const finishingRef = useRef(false)
  const pendingTimeoutElapsedRef = useRef<number | null>(null)
  const sessionStateRef = useRef(flashcard.sessionState)
  const timerRef = useRef<{
    elapsed: number
    isExpired: boolean
    pause: () => void
    resume: () => void
  } | null>(null)

  const initialElapsed =
    loadedSession.mode === 'resume' ? loadedSession.pausedSession.elapsedSeconds : 0
  const initialLimitSeconds =
    loadedSession.mode === 'resume'
      ? loadedSession.pausedSession.timeLimitSeconds
      : loadedSession.config.limitSeconds

  useEffect(() => {
    if (initialized) return

    if (loadedSession.mode === 'resume') {
      const availablePausedCards = loadedSession.pausedSession.cardIds
        ?.map((cardId) =>
          loadedSession.flashcardData.carte.find((card) => card.id === cardId),
        )
        .filter(Boolean)

      if (!availablePausedCards?.length) {
        navigate(`/esame/${examId}/flashcard/config`)
        return
      }

      flashcard.resumeFromPaused(loadedSession.pausedSession, loadedSession.flashcardData.carte)
    } else {
      const selected = new Set(loadedSession.config.selectedMacro)
      const availableCards = loadedSession.flashcardData.carte.filter(
        (card) =>
          selected.size === 0 || card.macroargomenti.some((macro) => selected.has(macro)),
      )

      if (availableCards.length === 0 || loadedSession.config.count <= 0) {
        navigate(`/esame/${examId}/flashcard/config`)
        return
      }

      flashcard.startSession(
        loadedSession.flashcardData.carte,
        loadedSession.config.selectedMacro,
        loadedSession.config.count,
        loadedSession.config.limitSeconds,
      )
    }

    setInitialized(true)
  }, [examId, flashcard, initialized, loadedSession, navigate])

  useEffect(() => {
    sessionStateRef.current = flashcard.sessionState
  }, [flashcard.sessionState])

  const finishCurrentSession = useCallback(
    async (timedOut: boolean, elapsedOverride?: number) => {
      if (finishingRef.current || completion) return

      const current = sessionStateRef.current
      if (!current) {
        if (timedOut) {
          pendingTimeoutElapsedRef.current = elapsedOverride ?? timerRef.current?.elapsed ?? 0
        }
        return
      }

      const unansweredCount = current.cards.filter((card) => !current.cardEvals[card.id]).length
      const elapsed = elapsedOverride ?? timerRef.current?.elapsed ?? 0
      finishingRef.current = true
      setIsFinishing(true)
      setFinishError(null)
      setPauseDialog(false)
      timerRef.current?.pause()

      try {
        await flashcard.finishSession(elapsed, timedOut)
        setCompletion({ timedOut, unansweredCount })
      } catch (err) {
        console.error('Failed to finish flashcard session', err)
        setFinishError('Impossibile salvare le statistiche flashcard. Riprova.')
        finishingRef.current = false
        setIsFinishing(false)
        if (!timerRef.current?.isExpired) {
          timerRef.current?.resume()
        }
      }
    },
    [completion, flashcard],
  )

  const timer = useTimer({
    limitSeconds: flashcard.timeLimitSeconds ?? initialLimitSeconds,
    initialElapsed,
    onExpire: (elapsed) => {
      void finishCurrentSession(true, elapsed)
    },
  })

  useEffect(() => {
    timerRef.current = {
      elapsed: timer.elapsed,
      isExpired: timer.isExpired,
      pause: timer.pause,
      resume: timer.resume,
    }
  }, [timer.elapsed, timer.isExpired, timer.pause, timer.resume])

  useEffect(() => {
    if (!initialized || !sessionStateRef.current || pendingTimeoutElapsedRef.current === null) {
      return
    }

    const elapsed = pendingTimeoutElapsedRef.current
    pendingTimeoutElapsedRef.current = null
    void finishCurrentSession(true, elapsed)
  }, [finishCurrentSession, initialized, flashcard.sessionState])

  useEffect(() => {
    if (!initialized || !flashcard.isDone || completion || finishingRef.current) return

    void finishCurrentSession(false)
  }, [completion, finishCurrentSession, flashcard.isDone, initialized])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    let cleanup: (() => void) | undefined
    let cancelled = false

    async function registerBackButton() {
      try {
        const { App } = await import('@capacitor/app')
        const listener = await App.addListener('backButton', () => {
          if (finishingRef.current || timerRef.current?.isExpired) {
            setPauseDialog(false)
            return
          }

          timerRef.current?.pause()
          setPauseDialog(true)
        })

        if (cancelled) {
          void listener.remove()
          return
        }

        cleanup = () => {
          void listener.remove()
        }
      } catch {
        cleanup = undefined
      }
    }

    void registerBackButton()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  const handlePause = async () => {
    if (finishingRef.current || timer.isExpired) {
      setPauseDialog(false)
      return
    }

    timer.pause()
    await flashcard.pauseSession(timer.elapsed)
    if (finishingRef.current) return

    navigate(`/esame/${examId}`)
  }

  if (completion) {
    return (
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '0 1rem' }}>
        <h1 style={{ marginBottom: '1rem', fontSize: '1.35rem' }}>
          {completion.timedOut ? 'Tempo scaduto' : 'Sessione completata'}
        </h1>
        {completion.timedOut && (
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
            {completion.unansweredCount} carte non raggiunte segnate come Non risposta.
          </p>
        )}
        <button
          type="button"
          onClick={() => navigate(`/esame/${examId}`)}
          style={primaryButtonStyle}
        >
          Torna alla dashboard
        </button>
      </div>
    )
  }

  const state = flashcard.sessionState
  const cards = state?.cards ?? []
  const currentCard = state ? state.cards[state.currentIndex] : undefined

  if (!initialized || !state || !currentCard) {
    return <div style={{ color: 'var(--text-muted)' }}>Caricamento...</div>
  }

  const currentEval = state.cardEvals[currentCard.id]
  const preMarkedNo =
    state.phase === 'back' && currentEval === 'No' && preMarkedNoCardId === currentCard.id

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 1rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '0.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (!isFinishing && !timer.isExpired) {
              timer.pause()
              setPauseDialog(true)
            }
          }}
          disabled={isFinishing || timer.isExpired}
          style={secondaryButtonStyle}
        >
          Pausa
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Carta {state.currentIndex + 1} di {cards.length}
        </span>
        <Timer elapsed={timer.elapsed} remaining={timer.remaining} />
      </div>

      <ProgressBar current={state.currentIndex + 1} total={cards.length} />
      {finishError && (
        <div
          role="alert"
          style={{
            margin: '0.75rem 0',
            padding: '0.85rem',
            border: '1px solid var(--danger)',
            borderRadius: '8px',
            background: 'rgba(224, 85, 85, 0.12)',
            color: 'var(--text)',
          }}
        >
          {finishError}
        </div>
      )}

      <section
        style={{
          padding: '1.25rem',
          margin: '0.75rem 0 1rem',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: 'var(--bg-surface)',
          minHeight: '180px',
        }}
      >
        <p
          style={{
            marginBottom: '0.75rem',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {state.phase === 'front' ? 'Fronte' : 'Retro'}
        </p>
        <h1 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
          {state.phase === 'front' ? currentCard.fronte : currentCard.fronte}
        </h1>
        {state.phase === 'back' && (
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>{currentCard.retro}</p>
        )}
      </section>

      {state.phase === 'front' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              setPreMarkedNoCardId(null)
              flashcard.showBack()
            }}
            style={primaryButtonStyle}
          >
            Mostra risposta
          </button>
          <button
            type="button"
            onClick={() => {
              setPreMarkedNoCardId(currentCard.id)
              flashcard.dontKnow()
            }}
            style={secondaryButtonStyle}
          >
            Non so
          </button>
        </div>
      ) : preMarkedNo ? (
        <button
          type="button"
          onClick={() => {
            setPreMarkedNoCardId(null)
            flashcard.evaluate(currentCard.id, 'No')
          }}
          style={primaryButtonStyle}
        >
          Prossima
        </button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              setPreMarkedNoCardId(null)
              flashcard.evaluate(currentCard.id, 'No')
            }}
            style={secondaryButtonStyle}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => {
              setPreMarkedNoCardId(null)
              flashcard.evaluate(currentCard.id, 'In parte')
            }}
            style={secondaryButtonStyle}
          >
            In parte
          </button>
          <button
            type="button"
            onClick={() => {
              setPreMarkedNoCardId(null)
              flashcard.evaluate(currentCard.id, 'Sì')
            }}
            style={primaryButtonStyle}
          >
            Sì
          </button>
        </div>
      )}

      <ConfirmDialog
        open={pauseDialog}
        title="Metti in pausa?"
        message="Vuoi mettere in pausa la sessione e tornare alla dashboard?"
        confirmLabel="Metti in pausa"
        cancelLabel="Continua"
        onConfirm={() => {
          void handlePause()
        }}
        onCancel={() => {
          setPauseDialog(false)
          if (!timer.isExpired) {
            timer.resume()
          }
        }}
        busy={isFinishing}
      />
    </div>
  )
}

const primaryButtonStyle = {
  width: '100%',
  minHeight: '48px',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 700,
} satisfies CSSProperties

const secondaryButtonStyle = {
  minHeight: '48px',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
} satisfies CSSProperties
