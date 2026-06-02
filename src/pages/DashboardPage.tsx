import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FileImportButton } from '../components/FileImportButton'
import { fileService } from '../services/fileService'
import { validateFlashcardFile, validateQuizFile } from '../services/quizService'
import * as storageService from '../services/storageService'
import type { Esame, PausedSession } from '../types'

type ReplaceTarget = 'quiz' | 'flashcard'

export function DashboardPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [esame, setEsame] = useState<Esame | null>(null)
  const [quizPausedSession, setQuizPausedSession] = useState<PausedSession | null>(null)
  const [flashcardPausedSession, setFlashcardPausedSession] = useState<PausedSession | null>(null)
  const [replaceTarget, setReplaceTarget] = useState<ReplaceTarget | null>(null)
  const [replaceError, setReplaceError] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)

  const loadDashboard = useCallback(async () => {
    if (!examId) {
      navigate('/', { replace: true })
      return
    }

    const currentExam = await storageService.getEsame(examId)
    if (!currentExam) {
      navigate('/', { replace: true })
      return
    }

    const [quizPaused, flashcardPaused] = await Promise.all([
      storageService.getPausedSession(`${examId}__quiz`),
      storageService.getPausedSession(`${examId}__flashcard`),
    ])

    setEsame(currentExam)
    setQuizPausedSession(quizPaused ?? null)
    setFlashcardPausedSession(flashcardPaused ?? null)
  }, [examId, navigate])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  async function saveFile(kind: keyof Esame['files'], data: ArrayBuffer, name: string, type: string) {
    if (!examId) return

    const currentExam = await storageService.getEsame(examId)
    if (!currentExam) {
      navigate('/', { replace: true })
      return
    }

    const updatedExam: Esame = {
      ...currentExam,
      files: {
        ...currentExam.files,
        [kind]: { name, type, data },
      },
    }

    await storageService.saveEsame(updatedExam)
    setEsame(updatedExam)
  }

  async function importSummary(data: ArrayBuffer, name: string, type: string) {
    await saveFile('riassunto', data, name, type)
  }

  async function importQuiz(data: ArrayBuffer, name: string, type: string) {
    validateQuizFile(parseJsonFile(data))
    await saveFile('quiz', data, name, type)
  }

  async function importFlashcard(data: ArrayBuffer, name: string, type: string) {
    validateFlashcardFile(parseJsonFile(data))
    await saveFile('flashcard', data, name, type)
  }

  function openReplacementDialog(target: ReplaceTarget) {
    setReplaceTarget(target)
    setReplaceError(null)
  }

  async function confirmReplacement() {
    if (!replaceTarget || !examId || replacing) return

    setReplacing(true)
    setReplaceError(null)

    try {
      const picked = await fileService.pickFile(['.json'])

      if (replaceTarget === 'quiz') {
        validateQuizFile(parseJsonFile(picked.data))

        await storageService.replaceQuizFileForExam(examId, {
          name: picked.name,
          type: picked.type,
          data: picked.data,
        })
      } else {
        validateFlashcardFile(parseJsonFile(picked.data))

        await storageService.replaceFlashcardFileForExam(examId, {
          name: picked.name,
          type: picked.type,
          data: picked.data,
        })
      }

      setReplaceTarget(null)
      await loadDashboard()
    } catch (error) {
      const message = errorMessage(error)
      if (message === `Exam ${examId} not found`) {
        navigate('/', { replace: true })
        return
      }

      if (message !== 'Selezione annullata') {
        setReplaceError(message)
      }
    } finally {
      setReplacing(false)
    }
  }

  if (!esame) {
    return <p style={mutedTextStyle}>Caricamento...</p>
  }

  const hasSummary = Boolean(esame.files.riassunto)
  const hasQuiz = Boolean(esame.files.quiz)
  const hasFlashcard = Boolean(esame.files.flashcard)
  const replacementIsQuiz = replaceTarget === 'quiz'

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label="Torna a tutti gli esami"
        style={backButtonStyle}
      >
        ← Tutti gli esami
      </button>

      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{esame.name}</h1>
      </header>

      <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {quizPausedSession && (
          <PausedBanner
            label="Hai un quiz in pausa."
            buttonLabel="Riprendi quiz"
            onResume={() =>
              navigate(`/esame/${esame.id}/quiz/sessione`, { state: { resume: true } })
            }
          />
        )}
        {flashcardPausedSession && (
          <PausedBanner
            label="Hai una sessione flashcard in pausa."
            buttonLabel="Riprendi flashcard"
            onResume={() =>
              navigate(`/esame/${esame.id}/flashcard/sessione`, { state: { resume: true } })
            }
          />
        )}
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <SectionCard
          title="Riassunto"
          status={hasSummary ? 'File importato' : 'File non importato'}
          fileName={esame.files.riassunto?.name}
        >
          {hasSummary && (
            <button
              type="button"
              onClick={() => navigate(`/esame/${esame.id}/riassunto`)}
              style={primaryButtonStyle}
            >
              Apri
            </button>
          )}
          <FileImportButton
            label={hasSummary ? 'Sostituisci' : 'Importa riassunto'}
            accept={['.html', '.pdf', '.docx']}
            onFile={importSummary}
          />
        </SectionCard>

        <SectionCard
          title="Quiz"
          status={hasQuiz ? 'File importato' : 'File non importato'}
          fileName={esame.files.quiz?.name}
        >
          {hasQuiz ? (
            <>
              <button
                type="button"
                onClick={() => navigate(`/esame/${esame.id}/quiz/config`)}
                style={primaryButtonStyle}
              >
                Inizia quiz
              </button>
              <button
                type="button"
                onClick={() => openReplacementDialog('quiz')}
                style={secondaryButtonStyle}
              >
                Sostituisci quiz.json
              </button>
            </>
          ) : (
            <FileImportButton label="Importa quiz.json" accept={['.json']} onFile={importQuiz} />
          )}
        </SectionCard>

        <SectionCard
          title="Flashcard"
          status={hasFlashcard ? 'File importato' : 'File non importato'}
          fileName={esame.files.flashcard?.name}
        >
          {hasFlashcard ? (
            <>
              <button
                type="button"
                onClick={() => navigate(`/esame/${esame.id}/flashcard/config`)}
                style={primaryButtonStyle}
              >
                Inizia flashcard
              </button>
              <button
                type="button"
                onClick={() => openReplacementDialog('flashcard')}
                style={secondaryButtonStyle}
              >
                Sostituisci flashcard.json
              </button>
            </>
          ) : (
            <FileImportButton
              label="Importa flashcard.json"
              accept={['.json']}
              onFile={importFlashcard}
            />
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        open={replaceTarget !== null}
        title={replacementIsQuiz ? 'Sostituire quiz.json?' : 'Sostituire flashcard.json?'}
        message={
          replacementIsQuiz
            ? 'La sostituzione eliminerà storico quiz, statistiche domande e sessione quiz in pausa. Il file attuale resta invariato se il nuovo JSON non è valido.'
            : 'La sostituzione eliminerà statistiche flashcard e sessione flashcard in pausa. Il file attuale resta invariato se il nuovo JSON non è valido.'
        }
        confirmLabel={
          replacing
            ? 'Sostituzione...'
            : replacementIsQuiz
              ? 'Sostituisci quiz'
              : 'Sostituisci flashcard'
        }
        cancelLabel="Annulla"
        dangerous
        busy={replacing}
        onConfirm={() => void confirmReplacement()}
        onCancel={() => {
          if (!replacing) {
            setReplaceTarget(null)
            setReplaceError(null)
          }
        }}
      />

      {replaceTarget && replaceError && (
        <p role="alert" style={replacementErrorStyle}>
          File non valido: {replaceError}
        </p>
      )}
    </div>
  )
}

function SectionCard({
  title,
  status,
  fileName,
  children,
}: {
  title: string
  status: string
  fileName?: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={`${title.toLowerCase()}-title`}
      style={{
        padding: '1rem',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        background: 'var(--bg-surface)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '0.9rem',
        }}
      >
        <div>
          <h2 id={`${title.toLowerCase()}-title`} style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            {title}
          </h2>
          <p style={mutedTextStyle}>{status}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'start' }}>
        {children}
      </div>
      {fileName && (
        <p style={{ ...mutedTextStyle, marginTop: '0.75rem' }}>
          {fileName}
        </p>
      )}
    </section>
  )
}

function PausedBanner({
  label,
  buttonLabel,
  onResume,
}: {
  label: string
  buttonLabel: string
  onResume: () => void
}) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        border: '1px solid var(--warning)',
        borderRadius: '8px',
        background: 'rgba(224, 165, 69, 0.12)',
      }}
    >
      <span>{label}</span>
      <button type="button" onClick={onResume} style={secondaryButtonStyle}>
        {buttonLabel}
      </button>
    </div>
  )
}

function parseJsonFile(data: ArrayBuffer): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(data))
  } catch {
    throw new Error('JSON non valido')
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Errore sconosciuto'
}

const backButtonStyle = {
  marginBottom: '1rem',
  color: 'var(--text-muted)',
  minHeight: '40px',
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

const mutedTextStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
}

const replacementErrorStyle = {
  position: 'fixed' as const,
  left: '50%',
  bottom: 'calc(50% - 150px)',
  zIndex: 1001,
  width: 'min(360px, calc(100% - 2rem))',
  transform: 'translateX(-50%)',
  padding: '0.75rem 1rem',
  border: '1px solid var(--danger)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
  color: 'var(--danger)',
  fontSize: '0.9rem',
}
