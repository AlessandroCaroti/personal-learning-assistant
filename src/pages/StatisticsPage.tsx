import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { countdownLabel, sortExamDates, validateExamDateInput } from '../services/examDateService'
import * as storageService from '../services/storageService'
import {
  buildFlashcardSummary,
  buildQuizSummary,
  decodeFlashcardSource,
  decodeQuizSource,
  weakFlashcards,
  weakMacroargomenti,
  weakQuizQuestions,
} from '../services/statisticsService'
import type { Esame, ExamDate, FlashcardStats, QuestionStats, QuizSession } from '../types'

export function StatisticsPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [esame, setEsame] = useState<Esame | null>(null)
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([])
  const [flashcardStats, setFlashcardStats] = useState<FlashcardStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateForm, setDateForm] = useState({ date: '', label: '', notes: '' })
  const [editingDateId, setEditingDateId] = useState<string | null>(null)
  const [deleteDateId, setDeleteDateId] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const loadSequence = useRef(0)

  const loadStatistics = useCallback(async () => {
    if (!examId) {
      navigate('/', { replace: true })
      return
    }

    const requestId = loadSequence.current + 1
    loadSequence.current = requestId

    setLoading(true)
    setError(null)
    setEsame(null)
    setQuizSessions([])
    setQuestionStats([])
    setFlashcardStats([])
    setDateForm({ date: '', label: '', notes: '' })
    setEditingDateId(null)
    setDeleteDateId(null)
    setDateError(null)

    try {
      const currentExam = await storageService.getEsame(examId)
      if (loadSequence.current !== requestId) return

      if (!currentExam) {
        navigate('/', { replace: true })
        return
      }

      const [loadedQuizSessions, loadedQuestionStats, loadedFlashcardStats] = await Promise.all([
        storageService.getQuizSessions(examId),
        storageService.getQuestionStats(examId),
        storageService.getFlashcardStats(examId),
      ])
      if (loadSequence.current !== requestId) return

      setEsame(currentExam)
      setQuizSessions(loadedQuizSessions)
      setQuestionStats(loadedQuestionStats)
      setFlashcardStats(loadedFlashcardStats)
    } catch (loadError) {
      if (loadSequence.current !== requestId) return
      setError(errorMessage(loadError))
    } finally {
      if (loadSequence.current !== requestId) return
      setLoading(false)
    }
  }, [examId, navigate])

  useEffect(() => {
    void loadStatistics()
  }, [loadStatistics])

  async function saveExamDates(nextDates: ExamDate[]) {
    if (!esame) return

    const updated = { ...esame, examDates: sortExamDates(nextDates) }
    await storageService.saveEsame(updated)
    setEsame(updated)
  }

  async function submitDateForm() {
    if (!esame) return

    const result = validateExamDateInput(dateForm)
    if (!result.valid) {
      setDateError(result.error)
      return
    }

    setDateError(null)

    if (editingDateId) {
      await saveExamDates(
        (esame.examDates ?? []).map((examDate) =>
          examDate.id === editingDateId ? { ...examDate, ...result.value } : examDate,
        ),
      )
    } else {
      await saveExamDates([
        ...(esame.examDates ?? []),
        {
          id: uuidv4(),
          ...result.value,
          createdAt: new Date().toISOString(),
        },
      ])
    }

    setDateForm({ date: '', label: '', notes: '' })
    setEditingDateId(null)
  }

  function startEditDate(examDate: ExamDate) {
    setEditingDateId(examDate.id)
    setDateForm({
      date: examDate.date,
      label: examDate.label ?? '',
      notes: examDate.notes ?? '',
    })
    setDeleteDateId(null)
    setDateError(null)
  }

  async function confirmDeleteDate() {
    if (!esame || !deleteDateId) return

    await saveExamDates((esame.examDates ?? []).filter((examDate) => examDate.id !== deleteDateId))

    if (editingDateId === deleteDateId) {
      setEditingDateId(null)
      setDateForm({ date: '', label: '', notes: '' })
    }

    setDeleteDateId(null)
    setDateError(null)
  }

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

  const quizSummary = buildQuizSummary(quizSessions)
  const flashcardSummary = buildFlashcardSummary(flashcardStats)
  const quizSource = decodeQuizSource(esame.files.quiz?.data)
  const flashcardSource = decodeFlashcardSource(esame.files.flashcard?.data)
  const weakQuestions =
    quizSource.status === 'ready' ? weakQuizQuestions(questionStats, quizSource.questions).slice(0, 5) : []
  const weakMacros =
    quizSource.status === 'ready' ? weakMacroargomenti(questionStats, quizSource.questions).slice(0, 5) : []
  const weakCards =
    flashcardSource.status === 'ready'
      ? weakFlashcards(flashcardStats, flashcardSource.cards).slice(0, 5)
      : []

  const examDates = esame.examDates ?? []

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
        <StatisticsSection title="Date esame">
          {examDates.length === 0 ? (
            <p style={mutedTextStyle}>Nessuna data esame configurata.</p>
          ) : (
            <ul style={listStyle}>
              {examDates.map((examDate) => (
                <li key={examDate.id} style={itemStyle}>
                  <strong>{examDate.label ?? 'Data esame'}</strong>
                  <span>{countdownLabel(examDate.date)}</span>
                  <span>{examDate.date}</span>
                  {examDate.notes && <span>{examDate.notes}</span>}
                  <div style={actionRowStyle}>
                    <button
                      type="button"
                      onClick={() => startEditDate(examDate)}
                      style={secondaryButtonStyle}
                    >
                      Modifica {examDate.label ?? examDate.date}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteDateId(examDate.id)}
                      style={secondaryButtonStyle}
                    >
                      Elimina {examDate.label ?? examDate.date}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div style={formGridStyle}>
            <label style={fieldStyle}>
              <span>Data</span>
              <input
                type="date"
                value={dateForm.date}
                onChange={(event) => {
                  setDateForm((form) => ({ ...form, date: event.target.value }))
                  if (dateError) setDateError(null)
                }}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>Etichetta</span>
              <input
                type="text"
                value={dateForm.label}
                onChange={(event) => {
                  setDateForm((form) => ({ ...form, label: event.target.value }))
                  if (dateError) setDateError(null)
                }}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>Note</span>
              <textarea
                value={dateForm.notes}
                onChange={(event) => {
                  setDateForm((form) => ({ ...form, notes: event.target.value }))
                  if (dateError) setDateError(null)
                }}
                style={textareaStyle}
              />
            </label>
            {dateError && (
              <p role="alert" style={{ ...mutedTextStyle, color: 'var(--danger)', margin: 0 }}>
                {dateError}
              </p>
            )}
            <div style={actionRowStyle}>
              <button type="button" onClick={() => void submitDateForm()} style={primaryButtonStyle}>
                {editingDateId ? 'Salva data' : 'Aggiungi data'}
              </button>
              {editingDateId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDateId(null)
                    setDateForm({ date: '', label: '', notes: '' })
                    setDateError(null)
                  }}
                  style={secondaryButtonStyle}
                >
                  Annulla modifica
                </button>
              )}
            </div>
          </div>
        </StatisticsSection>

        <StatisticsSection title="Quiz">
          {!esame.files.quiz && <p style={mutedTextStyle}>Nessun file quiz importato.</p>}
          {esame.files.quiz && quizSummary.totalSessions === 0 && (
            <p style={mutedTextStyle}>Nessuna sessione quiz completata.</p>
          )}
          <MetricGrid
            metrics={[
              ['Sessioni completate', String(quizSummary.totalSessions)],
              ['Media', formatPercent(quizSummary.averageScorePercent)],
              ['Migliore', formatPercent(quizSummary.bestScorePercent)],
              ['Ultimo risultato', formatPercent(quizSummary.latestScorePercent)],
              ['Tempo medio', formatDuration(quizSummary.averageTimeSeconds)],
              ['Timeout', String(quizSummary.timeoutCount)],
              ['Ripassi', String(quizSummary.reviewCount)],
            ]}
          />
          {quizSource.status === 'error' && (
            <p role="status" style={mutedTextStyle}>
              {quizSource.message}
            </p>
          )}
          {weakQuestions.length > 0 && (
            <>
              <h3 style={subsectionTitleStyle}>Domande deboli</h3>
              <ul style={listStyle}>
                {weakQuestions.map((question) => (
                  <li key={question.questionId} style={itemStyle}>
                    <strong>{question.text}</strong>
                    <span>
                      {question.accuracyPercent}% corrette su {question.timesShown} tentativi
                    </span>
                    <span>{question.macroargomenti.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {weakMacros.length > 0 && (
            <>
              <h3 style={subsectionTitleStyle}>Macroargomenti deboli</h3>
              <ul style={listStyle}>
                {weakMacros.map((macro) => (
                  <li key={macro.name} style={itemStyle}>
                    <strong>{macro.name}</strong>
                    <span>
                      {macro.accuracyPercent}% corrette su {macro.timesShown} tentativi
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </StatisticsSection>

        <StatisticsSection title="Flashcard">
          {!esame.files.flashcard && <p style={mutedTextStyle}>Nessun file flashcard importato.</p>}
          {esame.files.flashcard && flashcardSummary.totalSeen === 0 && (
            <p style={mutedTextStyle}>Nessun progresso flashcard registrato.</p>
          )}
          <MetricGrid
            metrics={[
              ['Flashcard con progressi', String(flashcardSummary.totalSeen)],
              ['Sì', String(flashcardSummary.si)],
              ['In parte', String(flashcardSummary.inParte)],
              ['No', String(flashcardSummary.no)],
              ['Non risposta', String(flashcardSummary.nonRisposta)],
            ]}
          />
          {flashcardSource.status === 'error' && (
            <p role="status" style={mutedTextStyle}>
              {flashcardSource.message}
            </p>
          )}
          {weakCards.length > 0 && (
            <>
              <h3 style={subsectionTitleStyle}>Flashcard deboli</h3>
              <ul style={listStyle}>
                {weakCards.map((card) => (
                  <li key={card.cardId} style={itemStyle}>
                    <strong>{card.front}</strong>
                    <span>{card.lastEval}</span>
                    <span>{card.macroargomenti.join(', ')}</span>
                    <span>{new Date(card.lastSeen).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </StatisticsSection>
      </div>

      {deleteDateId && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-date-title" style={dialogStyle}>
          <h2 id="delete-date-title" style={sectionTitleStyle}>
            Conferma eliminazione
          </h2>
          <div style={actionRowStyle}>
            <button type="button" onClick={() => void confirmDeleteDate()} style={primaryButtonStyle}>
              Conferma eliminazione
            </button>
            <button type="button" onClick={() => setDeleteDateId(null)} style={secondaryButtonStyle}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatisticsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const titleId = `${title.toLowerCase().replace(/\s+/g, '-')}-title`

  return (
    <section aria-labelledby={titleId} style={sectionStyle}>
      <h2 id={titleId} style={sectionTitleStyle}>
        {title}
      </h2>
      <div style={{ display: 'grid', gap: '0.9rem' }}>{children}</div>
    </section>
  )
}

function MetricGrid({ metrics }: { metrics: [string, string][] }) {
  return (
    <dl style={metricGridStyle}>
      {metrics.map(([label, value]) => (
        <div key={label} style={metricStyle}>
          <dt style={metricLabelStyle}>{label}</dt>
          <dd style={metricValueStyle}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function formatPercent(value: number | null): string {
  return value === null ? '-' : `${value}%`
}

function formatDuration(value: number | null): string {
  if (value === null) {
    return '-'
  }

  const minutes = Math.floor(value / 60)
  const seconds = value % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
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

const subsectionTitleStyle = {
  fontSize: '0.98rem',
  fontWeight: 700,
}

const metricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: '0.75rem',
}

const metricStyle = {
  display: 'grid',
  gap: '0.2rem',
  padding: '0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
}

const metricLabelStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
}

const metricValueStyle = {
  fontSize: '1.15rem',
  fontWeight: 700,
}

const listStyle = {
  display: 'grid',
  gap: '0.6rem',
  listStyle: 'none',
  padding: 0,
}

const itemStyle = {
  display: 'grid',
  gap: '0.2rem',
  padding: '0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
}

const actionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '0.75rem',
}

const primaryButtonStyle = {
  minHeight: '44px',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
}

const secondaryButtonStyle = {
  minHeight: '44px',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
}

const formGridStyle = {
  display: 'grid',
  gap: '0.75rem',
}

const fieldStyle = {
  display: 'grid',
  gap: '0.35rem',
  fontWeight: 600,
}

const inputStyle = {
  minHeight: '44px',
  padding: '0.6rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg)',
  color: 'var(--text)',
  font: 'inherit',
}

const textareaStyle = {
  ...inputStyle,
  minHeight: '96px',
  resize: 'vertical' as const,
}

const dialogStyle = {
  position: 'fixed' as const,
  left: '50%',
  top: '50%',
  zIndex: 1000,
  display: 'grid',
  gap: '1rem',
  width: 'min(360px, calc(100% - 2rem))',
  transform: 'translate(-50%, -50%)',
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.35)',
}

const mutedTextStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
}
