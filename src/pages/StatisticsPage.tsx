import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as storageService from '../services/storageService'
import type { Esame, FlashcardStats, QuestionStats, QuizSession } from '../types'

export function StatisticsPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [esame, setEsame] = useState<Esame | null>(null)
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([])
  const [flashcardStats, setFlashcardStats] = useState<FlashcardStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStatistics = useCallback(async () => {
    if (!examId) {
      navigate('/', { replace: true })
      return
    }

    setLoading(true)
    setError(null)
    setEsame(null)
    setQuizSessions([])
    setQuestionStats([])
    setFlashcardStats([])

    try {
      const currentExam = await storageService.getEsame(examId)
      if (!currentExam) {
        navigate('/', { replace: true })
        return
      }

      const [loadedQuizSessions, loadedQuestionStats, loadedFlashcardStats] = await Promise.all([
        storageService.getQuizSessions(examId),
        storageService.getQuestionStats(examId),
        storageService.getFlashcardStats(examId),
      ])

      setEsame(currentExam)
      setQuizSessions(loadedQuizSessions)
      setQuestionStats(loadedQuestionStats)
      setFlashcardStats(loadedFlashcardStats)
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
        <StatisticsSection title="Date esame" itemCount={esame.examDates?.length ?? 0} />
        <StatisticsSection title="Quiz" itemCount={quizSessions.length + questionStats.length} />
        <StatisticsSection title="Flashcard" itemCount={flashcardStats.length} />
      </div>
    </div>
  )
}

function StatisticsSection({ title, itemCount }: { title: string; itemCount: number }) {
  return (
    <section
      aria-labelledby={`${title.toLowerCase().replace(/\s+/g, '-')}-title`}
      data-item-count={itemCount}
      style={sectionStyle}
    >
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
