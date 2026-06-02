import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { validateFlashcardFile } from '../services/quizService'
import * as storage from '../services/storageService'
import type { FlashCard, FlashcardFile, PausedSession } from '../types'

const COUNT_PRESETS = [10, 30, 50] as const
const TIME_PRESETS = [5, 10, 15, 30] as const

type CountPreset = (typeof COUNT_PRESETS)[number] | 'custom'
type TimePreset = (typeof TIME_PRESETS)[number] | 'custom' | null

function parseJsonFile(data: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(data))
}

function filterCards(cards: FlashCard[], selectedMacro: string[]): FlashCard[] {
  if (selectedMacro.length === 0) return cards

  const selected = new Set(selectedMacro)
  return cards.filter((card) => card.macroargomenti.some((macro) => selected.has(macro)))
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

function Section({ title, children }: { title: string; children: ReactNode }) {
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

export function FlashcardConfigPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [flashcardData, setFlashcardData] = useState<FlashcardFile | null>(null)
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

        if (!esame.files.flashcard) {
          navigate(`/esame/${examId}`)
          return
        }

        const parsed = validateFlashcardFile(parseJsonFile(esame.files.flashcard.data))
        const paused = await storage.getPausedSession(`${examId}__flashcard`)
        if (cancelled) return

        setFlashcardData(parsed)
        setPausedSession(paused?.mode === 'flashcard' ? paused : null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Flashcard non valide')
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
    if (!flashcardData) return []

    return [...new Set(flashcardData.carte.flatMap((card) => card.macroargomenti))].sort()
  }, [flashcardData])

  const availableCards = useMemo(() => {
    if (!flashcardData) return []

    return filterCards(flashcardData.carte, selectedMacro)
  }, [flashcardData, selectedMacro])

  const maxAvailable = availableCards.length
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
  const noCards = maxAvailable === 0

  const toggleMacro = (macro: string) => {
    setSelectedMacro((current) =>
      current.includes(macro) ? current.filter((item) => item !== macro) : [...current, macro],
    )
  }

  const startNewSession = () => {
    navigate(`/esame/${examId}/flashcard/sessione`, {
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

  if (!flashcardData) return null

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate(`/esame/${examId}`)}
        style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}
      >
        Indietro
      </button>
      <h1 style={{ marginBottom: '1.25rem', fontSize: '1.35rem' }}>Configura flashcard</h1>

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
        <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {maxAvailable} {maxAvailable === 1 ? 'carta disponibile' : 'carte disponibili'}
        </p>
      </Section>

      <Section title="Numero carte">
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
            Carte
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
            Sono disponibili solo {maxAvailable} carte con i filtri selezionati.
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
        disabled={noCards}
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
        {noCards ? 'Nessuna carta disponibile con i filtri selezionati' : 'Inizia flashcard'}
      </button>

      <ConfirmDialog
        open={conflictDialog}
        title="Sessione in pausa"
        message="Hai una sessione flashcard in pausa. Cosa vuoi fare?"
        confirmLabel="Riprendi"
        cancelLabel="Abbandona e ricomincia"
        onConfirm={() => {
          setConflictDialog(false)
          navigate(`/esame/${examId}/flashcard/sessione`, { state: { resume: true } })
        }}
        onCancel={async () => {
          await storage.deletePausedSession(`${examId}__flashcard`)
          setPausedSession(null)
          setConflictDialog(false)
          startNewSession()
        }}
      />
    </div>
  )
}
