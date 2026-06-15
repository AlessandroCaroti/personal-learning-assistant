import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as storageService from '../services/storageService'
import type { Esame } from '../types'

export function StatisticsPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [esame, setEsame] = useState<Esame | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStatistics = useCallback(async () => {
    if (!examId) {
      navigate('/', { replace: true })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const currentExam = await storageService.getEsame(examId)
      if (!currentExam) {
        navigate('/', { replace: true })
        return
      }

      await Promise.all([
        storageService.getQuizSessions(examId),
        storageService.getQuestionStats(examId),
        storageService.getFlashcardStats(examId),
      ])

      setEsame(currentExam)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [examId, navigate])

  useEffect(() => {
    void loadStatistics()
  }, [loadStatistics])

  if (loading && !esame) {
    return <p style={mutedTextStyle}>Caricamento...</p>
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <button
          type="button"
          onClick={() => navigate(examId ? `/esame/${examId}` : '/')}
          aria-label="Torna alla dashboard dell'esame"
          style={backButtonStyle}
        >
          ← Dashboard esame
        </button>
        <div style={sectionStyle}>
          <h1 style={pageTitleStyle}>Statistiche</h1>
          <p role="alert" style={{ ...mutedTextStyle, color: 'var(--danger)', marginBottom: '1rem' }}>
            {error}
          </p>
          <button type="button" onClick={() => void loadStatistics()} style={secondaryButtonStyle}>
            Riprova
          </button>
        </div>
      </div>
    )
  }

  if (!esame) {
    return null
  }

  return (
    <div style={pageStyle}>
      <button
        type="button"
        onClick={() => navigate(`/esame/${esame.id}`)}
        aria-label="Torna alla dashboard dell'esame"
        style={backButtonStyle}
      >
        ← Dashboard esame
      </button>

      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={pageTitleStyle}>Statistiche</h1>
        <p style={{ ...mutedTextStyle, marginTop: '0.35rem' }}>{esame.name}</p>
      </header>

      <div style={sectionsGridStyle}>
        <StatisticsSection title="Date esame" />
        <StatisticsSection title="Quiz" />
        <StatisticsSection title="Flashcard" />
      </div>
    </div>
  )
}

function StatisticsSection({ title }: { title: string }) {
  return (
    <section aria-labelledby={`${title.toLowerCase().replace(/\s+/g, '-')}-title`} style={sectionStyle}>
      <h2 id={`${title.toLowerCase().replace(/\s+/g, '-')}-title`} style={sectionTitleStyle}>
        {title}
      </h2>
      <p style={mutedTextStyle}>Contenuto in arrivo.</p>
    </section>
  )
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Errore sconosciuto'
}

const pageStyle = {
  maxWidth: '760px',
  margin: '0 auto',
}

const backButtonStyle = {
  marginBottom: '1rem',
  color: 'var(--text-muted)',
  minHeight: '40px',
}

const pageTitleStyle = {
  fontSize: '1.6rem',
  fontWeight: 700,
}

const sectionsGridStyle = {
  display: 'grid',
  gap: '1rem',
}

const sectionStyle = {
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
}

const sectionTitleStyle = {
  fontSize: '1.05rem',
  fontWeight: 700,
  marginBottom: '0.75rem',
}

const secondaryButtonStyle = {
  minHeight: '44px',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
}

const mutedTextStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
}
