import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { filterDomande, validateQuizFile } from '../services/quizService'
import * as storage from '../services/storageService'
import type { PausedSession, QuizFile } from '../types'

const COUNT_PRESETS = [10, 30, 50] as const
const TIME_PRESETS = [5, 10, 15, 30] as const

type CountPreset = (typeof COUNT_PRESETS)[number] | 'custom'
type TimePreset = (typeof TIME_PRESETS)[number] | 'custom' | null

function parseJsonFile(data: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(data))
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        padding: '0.45rem 0.8rem',
        borderRadius: '999px',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        background: selected ? 'var(--accent)' : 'var(--bg-elevated)',
        color: selected ? '#fff' : 'var(--text)',
        minHeight: '36px',
      }}
    >
      {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: '1rem',
        marginBottom: '1rem',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        background: 'var(--bg-surface)',
      }}
    >
      <h2
        style={{
          marginBottom: '0.75rem',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

export function QuizConfigPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [quizData, setQuizData] = useState<QuizFile | null>(null)
  const [selectedMacro, setSelectedMacro] = useState<string[]>([])
  const [countPreset, setCountPreset] = useState<CountPreset>(30)
  const [customCount, setCustomCount] = useState('30')
  const [timePreset, setTimePreset] = useState<TimePreset>(null)
  const [customTime, setCustomTime] = useState('30')
  const [pausedSession, setPausedSession] = useState<PausedSession | null>(null)
  const [conflictDialog, setConflictDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!examId) {
        navigate('/')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const esame = await storage.getEsame(examId)
        if (!esame) {
          navigate('/')
          return
        }

        if (!esame.files.quiz) {
          navigate(`/esame/${examId}`)
          return
        }

        const parsed = validateQuizFile(parseJsonFile(esame.files.quiz.data))
        const paused = await storage.getPausedSession(`${examId}__quiz`)
        if (cancelled) return

        setQuizData(parsed)
        setPausedSession(paused?.mode === 'quiz' ? paused : null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Quiz non valido')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [examId, navigate])

  const allMacro = useMemo(() => {
    if (!quizData) return []

    return [...new Set(quizData.domande.flatMap((domanda) => domanda.macroargomenti))].sort()
  }, [quizData])

  const availableQuestions = useMemo(() => {
    if (!quizData) return []

    return filterDomande(quizData.domande, selectedMacro)
  }, [quizData, selectedMacro])

  const maxAvailable = availableQuestions.length
  const rawRequestedCount =
    countPreset === 'custom'
      ? Number.parseInt(customCount, 10) || 1
      : countPreset
  const requestedCount =
    countPreset === 'custom'
      ? clampNumber(rawRequestedCount, 1, Math.max(1, maxAvailable))
      : rawRequestedCount
  const actualCount = Math.min(requestedCount, maxAvailable)
  const limitSeconds =
    timePreset === null
      ? null
      : timePreset === 'custom'
        ? clampNumber(Number.parseInt(customTime, 10) || 1, 1, 180) * 60
        : timePreset * 60
  const noQuestions = maxAvailable === 0

  const toggleMacro = (macro: string) => {
    setSelectedMacro((current) =>
      current.includes(macro) ? current.filter((item) => item !== macro) : [...current, macro],
    )
  }

  const startNewSession = () => {
    navigate(`/esame/${examId}/quiz/sessione`, {
      state: { selectedMacro, count: actualCount, limitSeconds },
    })
  }

  const handleStart = () => {
    if (pausedSession) {
      setConflictDialog(true)
      return
    }

    startNewSession()
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)' }}>Caricamento...</div>
  }

  if (error) {
    return (
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate(`/esame/${examId}`)}
          style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}
        >
          Indietro
        </button>
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
      </div>
    )
  }

  if (!quizData) return null

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate(`/esame/${examId}`)}
        style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}
      >
        Indietro
      </button>
      <h1 style={{ marginBottom: '1.25rem', fontSize: '1.35rem' }}>Configura quiz</h1>

      <Section title="Macroargomenti">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Chip label="Tutti" selected={selectedMacro.length === 0} onClick={() => setSelectedMacro([])} />
          {allMacro.map((macro) => (
            <Chip
              key={macro}
              label={macro}
              selected={selectedMacro.includes(macro)}
              onClick={() => toggleMacro(macro)}
            />
          ))}
        </div>
      </Section>

      <Section title="Numero domande">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {COUNT_PRESETS.map((count) => (
            <Chip
              key={count}
              label={String(count)}
              selected={countPreset === count}
              onClick={() => setCountPreset(count)}
            />
          ))}
          <Chip
            label="Personalizzato"
            selected={countPreset === 'custom'}
            onClick={() => setCountPreset('custom')}
          />
        </div>
        {countPreset === 'custom' && (
          <label
            style={{
              display: 'block',
              marginTop: '0.75rem',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Domande
            <input
              type="number"
              min={1}
              max={Math.max(1, maxAvailable)}
              value={customCount}
              onChange={(event) => setCustomCount(event.target.value)}
              style={{
                display: 'block',
                width: '120px',
                marginTop: '0.35rem',
                padding: '0.45rem 0.6rem',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--bg-elevated)',
                color: 'var(--text)',
              }}
            />
          </label>
        )}
        {rawRequestedCount > maxAvailable && maxAvailable > 0 && (
          <p role="status" style={{ marginTop: '0.75rem', color: 'var(--warning)' }}>
            Sono disponibili solo {maxAvailable} domande con i filtri selezionati.
          </p>
        )}
      </Section>

      <Section title="Tempo massimo">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Chip label="Disabilitato" selected={timePreset === null} onClick={() => setTimePreset(null)} />
          {TIME_PRESETS.map((minutes) => (
            <Chip
              key={minutes}
              label={`${minutes}m`}
              selected={timePreset === minutes}
              onClick={() => setTimePreset(minutes)}
            />
          ))}
          <Chip
            label="Personalizzato"
            selected={timePreset === 'custom'}
            onClick={() => setTimePreset('custom')}
          />
        </div>
        {timePreset === 'custom' && (
          <label
            style={{
              display: 'block',
              marginTop: '0.75rem',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Minuti
            <input
              type="number"
              min={1}
              max={180}
              value={customTime}
              onChange={(event) => setCustomTime(event.target.value)}
              style={{
                display: 'block',
                width: '120px',
                marginTop: '0.35rem',
                padding: '0.45rem 0.6rem',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--bg-elevated)',
                color: 'var(--text)',
              }}
            />
          </label>
        )}
      </Section>

      <button
        type="button"
        disabled={noQuestions}
        onClick={handleStart}
        style={{
          width: '100%',
          minHeight: '48px',
          padding: '0.8rem 1rem',
          borderRadius: '8px',
          background: 'var(--accent)',
          color: '#fff',
          fontWeight: 700,
        }}
      >
        {noQuestions ? 'Nessuna domanda disponibile con i filtri selezionati' : 'Inizia quiz'}
      </button>

      <ConfirmDialog
        open={conflictDialog}
        title="Sessione in pausa"
        message="Hai una sessione quiz in pausa. Cosa vuoi fare?"
        confirmLabel="Riprendi"
        cancelLabel="Abbandona e ricomincia"
        onConfirm={() => {
          setConflictDialog(false)
          navigate(`/esame/${examId}/quiz/sessione`, { state: { resume: true } })
        }}
        onCancel={async () => {
          await storage.deletePausedSession(`${examId}__quiz`)
          setPausedSession(null)
          setConflictDialog(false)
          startNewSession()
        }}
      />
    </div>
  )
}
