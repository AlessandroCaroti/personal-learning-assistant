import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DotNav, type DotState } from '../components/DotNav'
import { ProgressBar } from '../components/ProgressBar'
import { Timer } from '../components/Timer'
import { useQuiz } from '../hooks/useQuiz'
import { useTimer } from '../hooks/useTimer'
import { validateQuizFile } from '../services/quizService'
import type { PausedSession, QuizFile } from '../types'
import * as storage from '../services/storageService'

interface StartConfig {
  selectedMacro: string[]
  count: number
  limitSeconds: number | null
}

type LoadedSession =
  | {
    mode: 'start'
    quizData: QuizFile
    config: StartConfig
  }
  | {
    mode: 'resume'
    quizData: QuizFile
    pausedSession: PausedSession
  }

function parseJsonFile(data: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(data))
}

function readStartConfig(state: unknown): StartConfig {
  if (!state || typeof state !== 'object') {
    return { selectedMacro: [], count: 30, limitSeconds: null }
  }

  const record = state as Record<string, unknown>
  const selectedMacro = Array.isArray(record.selectedMacro)
    ? record.selectedMacro.filter((item): item is string => typeof item === 'string')
    : []
  const count = typeof record.count === 'number' && Number.isFinite(record.count)
    ? record.count
    : 30
  const limitSeconds =
    typeof record.limitSeconds === 'number' && Number.isFinite(record.limitSeconds)
      ? record.limitSeconds
      : null

  return { selectedMacro, count, limitSeconds }
}

export function QuizSessionPage() {
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
        if (!esame?.files.quiz) {
          navigate(`/esame/${examId}`)
          return
        }

        const quizData = validateQuizFile(parseJsonFile(esame.files.quiz.data))

        if ((location.state as { resume?: boolean } | null)?.resume === true) {
          const pausedSession = await storage.getPausedSession(`${examId}__quiz`)
          if (!pausedSession || pausedSession.mode !== 'quiz') {
            navigate(`/esame/${examId}/quiz/config`)
            return
          }

          if (!cancelled) {
            setLoadedSession({ mode: 'resume', quizData, pausedSession })
          }
          return
        }

        if (!cancelled) {
          setLoadedSession({
            mode: 'start',
            quizData,
            config: readStartConfig(location.state),
          })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Quiz non valido')
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

  return <ActiveQuizSession examId={examId} loadedSession={loadedSession} />
}

function ActiveQuizSession({
  examId,
  loadedSession,
}: {
  examId: string
  loadedSession: LoadedSession
}) {
  const navigate = useNavigate()
  const quiz = useQuiz(examId)
  const [initialized, setInitialized] = useState(false)
  const [pauseDialog, setPauseDialog] = useState(false)
  const [deliverDialog, setDeliverDialog] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const finishingRef = useRef(false)
  const pendingTimeoutElapsedRef = useRef<number | null>(null)
  const timerRef = useRef<{
    elapsed: number
    isExpired: boolean
    pause: () => void
    resume: () => void
  } | null>(null)
  const sessionStateRef = useRef(quiz.sessionState)

  const initialElapsed =
    loadedSession.mode === 'resume' ? loadedSession.pausedSession.elapsedSeconds : 0
  const initialLimitSeconds =
    loadedSession.mode === 'resume'
      ? loadedSession.pausedSession.timeLimitSeconds
      : loadedSession.config.limitSeconds

  useEffect(() => {
    if (initialized) return

    if (loadedSession.mode === 'resume') {
      quiz.resumeFromPaused(loadedSession.pausedSession, loadedSession.quizData.domande)
    } else {
      quiz.startSession(
        loadedSession.quizData.domande,
        loadedSession.config.selectedMacro,
        loadedSession.config.count,
        loadedSession.config.limitSeconds,
      )
    }

    setInitialized(true)
  }, [initialized, loadedSession, quiz])

  useEffect(() => {
    sessionStateRef.current = quiz.sessionState
  }, [quiz.sessionState])

  const finishAndNavigate = useCallback(
    async (completedByTimeout: boolean, elapsedOverride?: number) => {
      if (finishingRef.current) return
      if (!sessionStateRef.current) {
        if (completedByTimeout) {
          pendingTimeoutElapsedRef.current = elapsedOverride ?? timerRef.current?.elapsed ?? 0
        }
        return
      }

      const elapsed = elapsedOverride ?? timerRef.current?.elapsed ?? 0
      finishingRef.current = true
      setIsFinishing(true)
      setFinishError(null)
      setPauseDialog(false)
      setDeliverDialog(false)
      timerRef.current?.pause()

      try {
        const session = await quiz.finishSession(
          elapsed,
          completedByTimeout,
          loadedSession.quizData.domande,
        )

        if (session) {
          navigate(`/esame/${examId}/quiz/risultato`, { state: { session } })
          return
        }

        finishingRef.current = false
        setIsFinishing(false)
        timerRef.current?.resume()
      } catch (err) {
        console.error('Failed to finish quiz session', err)
        setFinishError('Impossibile salvare il risultato del quiz. Riprova.')
        finishingRef.current = false
        setIsFinishing(false)
        if (!timerRef.current?.isExpired) {
          timerRef.current?.resume()
        }
      }
    },
    [examId, loadedSession.quizData.domande, navigate, quiz],
  )

  const timer = useTimer({
    limitSeconds: quiz.timeLimitSeconds ?? initialLimitSeconds,
    initialElapsed,
    onExpire: (elapsed) => {
      void finishAndNavigate(true, elapsed)
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
    void finishAndNavigate(true, elapsed)
  }, [finishAndNavigate, initialized, quiz.sessionState])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    let cleanup: (() => void) | undefined
    let cancelled = false

    async function registerBackButton() {
      try {
        const { App } = await import('@capacitor/app')
        const listener = await App.addListener('backButton', () => {
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
    await quiz.pauseSession(timer.elapsed)
    if (finishingRef.current) return

    navigate(`/esame/${examId}`)
  }

  const handleDeliver = () => {
    void finishAndNavigate(timer.isExpired, timer.elapsed)
  }

  const state = quiz.sessionState
  const questions = state?.questions ?? []
  const currentQuestion = state ? state.questions[state.currentIndex] : undefined
  const confirmedAnswer = currentQuestion ? state?.confirmedAnswers[currentQuestion.id] : undefined
  const isConfirmed = confirmedAnswer !== undefined
  const selectedAnswer = state?.selectedAnswer ?? null
  const unconfirmedCount = useMemo(
    () => questions.filter((question) => state?.confirmedAnswers[question.id] === undefined).length,
    [questions, state?.confirmedAnswers],
  )
  const dotStates = useMemo<DotState[]>(
    () =>
      questions.map((question, index) => {
        const answer = state?.confirmedAnswers[question.id]
        if (answer === undefined) {
          return index === state?.currentIndex && selectedAnswer ? 'selected' : 'unanswered'
        }

        return answer === question.risposta_corretta ? 'correct' : 'wrong'
      }),
    [questions, selectedAnswer, state?.confirmedAnswers, state?.currentIndex],
  )

  if (!initialized || !state || !currentQuestion) {
    return <div style={{ color: 'var(--text-muted)' }}>Caricamento...</div>
  }

  const displayOptions =
    currentQuestion.tipo === 'multipla'
      ? currentQuestion.opzioniShuffled ?? currentQuestion.opzioni ?? []
      : ['Vero', 'Falso']

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
              setPauseDialog(true)
            }
          }}
          disabled={isFinishing || timer.isExpired}
          style={{
            padding: '0.45rem 0.75rem',
            borderRadius: '8px',
            background: 'var(--bg-elevated)',
            color: 'var(--text)',
          }}
        >
          Pausa
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Domanda {state.currentIndex + 1} di {questions.length}
        </span>
        <Timer elapsed={timer.elapsed} remaining={timer.remaining} />
      </div>

      <ProgressBar current={state.currentIndex + 1} total={questions.length} />
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
      <div style={{ margin: '0.75rem 0' }}>
        <DotNav
          total={questions.length}
          current={state.currentIndex}
          states={dotStates}
          onSelect={quiz.goTo}
        />
      </div>

      <section
        style={{
          padding: '1.25rem',
          marginBottom: '1rem',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: 'var(--bg-surface)',
        }}
      >
        <h1 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>{currentQuestion.testo}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {displayOptions.map((option, index) => (
            <OptionButton
              key={option}
              option={option}
              prefix={currentQuestion.tipo === 'multipla' ? `${String.fromCharCode(65 + index)}) ` : ''}
              isConfirmed={isConfirmed}
              isCorrect={option === currentQuestion.risposta_corretta}
              isSelected={selectedAnswer === option || confirmedAnswer === option}
              onSelect={() => quiz.selectAnswer(option)}
            />
          ))}
        </div>

        {isConfirmed && currentQuestion.spiegazione && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.85rem',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
            }}
          >
            {currentQuestion.spiegazione}
          </div>
        )}
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(76px, auto) 1fr minmax(76px, auto)',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <button
          type="button"
          onClick={() => quiz.goTo(state.currentIndex - 1)}
          disabled={state.currentIndex === 0}
          style={secondaryButtonStyle}
        >
          Prev
        </button>

        {!isConfirmed ? (
          <button
            type="button"
            onClick={() => quiz.confirmAnswer(currentQuestion.id, timer.elapsed)}
            disabled={!selectedAnswer}
            style={{
              minHeight: '48px',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            Conferma
          </button>
        ) : (
          <button
            type="button"
            onClick={() => quiz.goTo(state.currentIndex + 1)}
            disabled={state.currentIndex === questions.length - 1}
            style={secondaryButtonStyle}
          >
            Prossima
          </button>
        )}

        <button
          type="button"
          onClick={() => quiz.goTo(state.currentIndex + 1)}
          disabled={state.currentIndex === questions.length - 1}
          style={secondaryButtonStyle}
        >
          Next
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!isFinishing) {
            setDeliverDialog(true)
          }
        }}
        disabled={isFinishing}
        style={{
          width: '100%',
          minHeight: '48px',
          padding: '0.75rem 1rem',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: 'var(--bg-elevated)',
          color: 'var(--text)',
          fontWeight: 700,
        }}
      >
        Consegna quiz
        {unconfirmedCount > 0 && (
          <span
            aria-label={`${unconfirmedCount} domande non confermate`}
            style={{
              marginLeft: '0.5rem',
              padding: '0.1rem 0.45rem',
              borderRadius: '999px',
              background: 'var(--danger)',
              color: '#fff',
              fontSize: '0.8rem',
            }}
          >
            {unconfirmedCount}
          </span>
        )}
      </button>

      <ConfirmDialog
        open={pauseDialog}
        title="Metti in pausa?"
        message="Vuoi mettere in pausa la sessione e tornare alla dashboard?"
        confirmLabel="Metti in pausa"
        cancelLabel="Continua"
        onConfirm={() => {
          void handlePause()
        }}
        onCancel={() => setPauseDialog(false)}
        busy={isFinishing}
      />

      <ConfirmDialog
        open={deliverDialog}
        title="Consegna quiz"
        message={
          unconfirmedCount > 0
            ? `Hai ancora ${unconfirmedCount} domande non confermate. Vuoi consegnare comunque?`
            : 'Confermi la consegna del quiz?'
        }
        confirmLabel="Consegna"
        onConfirm={() => {
          setDeliverDialog(false)
          handleDeliver()
        }}
        onCancel={() => setDeliverDialog(false)}
        busy={isFinishing}
      />
    </div>
  )
}

function OptionButton({
  option,
  prefix,
  isConfirmed,
  isCorrect,
  isSelected,
  onSelect,
}: {
  option: string
  prefix: string
  isConfirmed: boolean
  isCorrect: boolean
  isSelected: boolean
  onSelect: () => void
}) {
  let background = 'var(--bg-elevated)'
  let border = 'var(--border)'

  if (isConfirmed) {
    if (isCorrect) {
      background = 'rgba(76, 175, 130, 0.15)'
      border = 'var(--success)'
    } else if (isSelected) {
      background = 'rgba(224, 85, 85, 0.15)'
      border = 'var(--danger)'
    }
  } else if (isSelected) {
    background = 'rgba(108, 99, 255, 0.15)'
    border = 'var(--accent)'
  }

  return (
    <button
      type="button"
      disabled={isConfirmed}
      onClick={onSelect}
      style={{
        minHeight: '48px',
        padding: '0.75rem 1rem',
        border: `1px solid ${border}`,
        borderRadius: '8px',
        background,
        color: 'var(--text)',
        textAlign: 'left',
      }}
    >
      <span aria-hidden="true">{prefix}</span>
      {option}
    </button>
  )
}

const secondaryButtonStyle = {
  minHeight: '48px',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
} satisfies React.CSSProperties
