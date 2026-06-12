import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { validateQuizFile } from '../services/quizService'
import * as storage from '../services/storageService'
import type { QuizDomanda, QuizFile, QuizSession } from '../types'
import { formatTime } from '../utils/formatTime'

interface ResultState {
  session?: QuizSession
}

type LoadState =
  | { status: 'loading' }
  | {
    status: 'ready'
    currentSession: QuizSession | null
    allSessions: QuizSession[]
    quizData: QuizFile | null
    quizError: string | null
  }
  | { status: 'error'; message: string }

function parseJsonFile(data: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(data))
}

function sortSessionsByDateDesc(sessions: QuizSession[]): QuizSession[] {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date))
}

function scorePercent(session: QuizSession): number {
  if (session.total <= 0) return 0
  return Math.round((session.score / session.total) * 100)
}

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function getQuestionById(quizData: QuizFile | null): Map<string, QuizDomanda> {
  return new Map((quizData?.domande ?? []).map((question) => [question.id, question]))
}

export function QuizResultPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const routeSession = (location.state as ResultState | null)?.session
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!examId) {
        setLoadState({ status: 'error', message: 'Esame non trovato.' })
        return
      }

      try {
        const sessions = sortSessionsByDateDesc(await storage.getQuizSessions(examId))
        const currentSession =
          routeSession && routeSession.examId === examId
            ? routeSession
            : sessions[0] ?? null

        const esame = await storage.getEsame(examId)
        let quizData: QuizFile | null = null
        let quizError: string | null = null

        if (!esame?.files.quiz) {
          quizError = 'File quiz non disponibile: mostro gli id delle domande.'
        } else {
          try {
            quizData = validateQuizFile(parseJsonFile(esame.files.quiz.data))
          } catch (err) {
            quizError =
              err instanceof Error
                ? `File quiz non valido: ${err.message}`
                : 'File quiz non valido: mostro gli id delle domande.'
          }
        }

        if (!cancelled) {
          setLoadState({
            status: 'ready',
            currentSession,
            allSessions: sessions,
            quizData,
            quizError,
          })
        }
      } catch (err) {
        if (!cancelled) {
          setLoadState({
            status: 'error',
            message:
              err instanceof Error
                ? `Impossibile caricare il risultato: ${err.message}`
                : 'Impossibile caricare il risultato.',
          })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [examId, routeSession])

  const goDashboard = () => {
    navigate(examId ? `/esame/${examId}` : '/')
  }

  if (loadState.status === 'loading') {
    return <div style={{ color: 'var(--text-muted)' }}>Caricamento...</div>
  }

  if (loadState.status === 'error') {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 1rem' }}>
        <button type="button" onClick={goDashboard} style={backButtonStyle}>
          Dashboard
        </button>
        <div role="alert" style={alertStyle}>
          {loadState.message}
        </div>
      </div>
    )
  }

  const { currentSession, allSessions, quizData, quizError } = loadState

  if (!currentSession) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 1rem' }}>
        <button type="button" onClick={goDashboard} style={backButtonStyle}>
          Dashboard
        </button>
        <section style={sectionStyle}>
          <h1 style={headingStyle}>Nessun risultato disponibile</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Non ho trovato una sessione quiz salvata per questo esame.
          </p>
        </section>
      </div>
    )
  }

  return (
    <ResultContent
      examId={examId}
      currentSession={currentSession}
      allSessions={allSessions}
      quizData={quizData}
      quizError={quizError}
      onBack={goDashboard}
      onReview={() => {
        navigate(`/esame/${examId}/quiz/sessione`, {
          state: {
            reviewQuestionIds: [...currentSession.errors, ...currentSession.unanswered],
            isReview: true,
          },
        })
      }}
    />
  )
}

function ResultContent({
  examId,
  currentSession,
  allSessions,
  quizData,
  quizError,
  onBack,
  onReview,
}: {
  examId: string | undefined
  currentSession: QuizSession
  allSessions: QuizSession[]
  quizData: QuizFile | null
  quizError: string | null
  onBack: () => void
  onReview: () => void
}) {
  const pct = scorePercent(currentSession)
  const questionById = useMemo(() => getQuestionById(quizData), [quizData])
  const errorItems = [
    ...currentSession.errors.map((id) => ({ id, type: 'error' as const })),
    ...currentSession.unanswered.map((id) => ({ id, type: 'unanswered' as const })),
  ]
  const canReview = errorItems.length > 0 && !currentSession.isReview && Boolean(examId)

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 1rem' }}>
      <button type="button" onClick={onBack} style={backButtonStyle}>
        Dashboard
      </button>

      <section style={{ ...sectionStyle, textAlign: 'center' }}>
        <div
          style={{
            fontSize: '3rem',
            fontWeight: 800,
            color: pct >= 60 ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {pct}%
        </div>
        <h1 style={{ marginTop: '0.25rem', fontSize: '1.15rem' }}>
          {currentSession.score} / {currentSession.total} corrette
        </h1>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginTop: '0.75rem',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
          }}
        >
          <span>Tempo: {formatTime(currentSession.totalTime)}</span>
          {currentSession.completedByTimeout && <Badge label="Tempo scaduto" tone="warning" />}
          {currentSession.isReview && <Badge label="Ripasso" tone="accent" />}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Analisi errori</h2>
        {quizError && (
          <div role="alert" style={{ ...alertStyle, marginBottom: '0.75rem' }}>
            {quizError}
          </div>
        )}
        {errorItems.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nessun errore o domanda non risposta.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {errorItems.map(({ id, type }) => {
              const question = questionById.get(id)
              return (
                <div
                  key={`${type}-${id}`}
                  style={{
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <Badge
                      label={type === 'error' ? 'Sbagliata' : 'Non risposta'}
                      tone={type === 'error' ? 'danger' : 'warning'}
                    />
                    <span style={{ fontSize: '0.95rem' }}>{question?.testo ?? id}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {canReview && (
          <button type="button" onClick={onReview} style={primaryButtonStyle}>
            Ripassa errori
          </button>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Storico sessioni</h2>
        {allSessions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nessuna sessione registrata.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {allSessions.map((session) => (
              <div
                key={session.id}
                style={{
                  padding: '0.7rem 0.8rem',
                  borderRadius: '8px',
                  border: `1px solid ${session.isReview ? 'var(--accent)' : 'var(--border)'}`,
                  background: session.isReview
                    ? 'rgba(108, 99, 255, 0.12)'
                    : 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {formatDateTime(session.date)}
                  {session.isReview && ' · ripasso'}
                </span>
                <strong>
                  {session.score}/{session.total} ({scorePercent(session)}%)
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Badge({
  label,
  tone,
}: {
  label: string
  tone: 'accent' | 'danger' | 'warning'
}) {
  const background = {
    accent: 'var(--accent)',
    danger: 'var(--danger)',
    warning: 'var(--warning)',
  }[tone]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        minHeight: '24px',
        padding: '0.1rem 0.45rem',
        borderRadius: '6px',
        background,
        color: '#fff',
        fontSize: '0.78rem',
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  )
}

const backButtonStyle = {
  marginBottom: '1rem',
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
} satisfies React.CSSProperties

const sectionStyle = {
  marginBottom: '1rem',
  padding: '1.25rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
} satisfies React.CSSProperties

const headingStyle = {
  marginBottom: '0.75rem',
  fontSize: '1rem',
  fontWeight: 700,
} satisfies React.CSSProperties

const alertStyle = {
  padding: '0.85rem',
  border: '1px solid var(--warning)',
  borderRadius: '8px',
  background: 'rgba(224, 165, 69, 0.12)',
  color: 'var(--text)',
} satisfies React.CSSProperties

const primaryButtonStyle = {
  width: '100%',
  minHeight: '48px',
  marginTop: '1rem',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 700,
} satisfies React.CSSProperties
