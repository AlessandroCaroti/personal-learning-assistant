import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createExamAttachment,
  downloadAttachment,
  removeExamAttachment,
  sortAttachmentsNewestFirst,
} from '../services/archiveService'
import { fileService } from '../services/fileService'
import { isPreviewSupported } from '../services/fileViewerService'
import * as storageService from '../services/storageService'
import type { Esame, ExamAttachment } from '../types'

export function ArchivePage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [esame, setEsame] = useState<Esame | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadArchive = useCallback(async () => {
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

      setEsame(currentExam)
    } catch (caughtError) {
      setError(errorMessage(caughtError))
      setEsame(null)
    } finally {
      setLoading(false)
    }
  }, [examId, navigate])

  useEffect(() => {
    void loadArchive()
  }, [loadArchive])

  async function addAttachment() {
    if (!examId || busy) return

    setBusy(true)
    setError(null)

    try {
      const picked = await fileService.pickFile([])
      const currentExam = await storageService.getEsame(examId)
      if (!currentExam) {
        navigate('/', { replace: true })
        return
      }

      const updatedExam: Esame = {
        ...currentExam,
        attachments: [
          ...(currentExam.attachments ?? []),
          createExamAttachment({
            data: picked.data,
            name: picked.name,
            type: picked.type,
          }),
        ],
      }

      await storageService.saveEsame(updatedExam)
      setEsame(updatedExam)
    } catch (caughtError) {
      const message = errorMessage(caughtError)
      if (message !== 'Selezione annullata') setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!esame || busy) return

    setBusy(true)
    setError(null)

    try {
      const updatedExam: Esame = {
        ...esame,
        attachments: removeExamAttachment(esame.attachments ?? [], attachmentId),
      }

      await storageService.saveEsame(updatedExam)
      setEsame(updatedExam)
    } catch (caughtError) {
      setError(errorMessage(caughtError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p style={messageStyle}>Caricamento...</p>
  }

  if (!esame) {
    return (
      <p role="alert" style={errorStyle}>
        {error ?? 'Impossibile caricare l\'archivio.'}
      </p>
    )
  }

  const attachments = sortAttachmentsNewestFirst(esame.attachments ?? [])

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <button
          type="button"
          onClick={() => navigate(`/esame/${esame.id}`)}
          aria-label="Torna alla dashboard esame"
          style={backButtonStyle}
        >
          ← Dashboard
        </button>
        <div>
          <h1 style={titleStyle}>Archivio</h1>
          <p style={mutedTextStyle}>{esame.name}</p>
        </div>
      </header>

      <div style={toolbarStyle}>
        <button
          type="button"
          onClick={() => void addAttachment()}
          disabled={busy}
          style={primaryButtonStyle}
        >
          {busy ? 'Operazione...' : 'Aggiungi file'}
        </button>
      </div>

      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}

      {attachments.length === 0 ? (
        <p style={emptyStyle}>Nessun file archiviato</p>
      ) : (
        <ul style={listStyle}>
          {attachments.map((attachment) => (
            <ArchiveItem
              key={attachment.id}
              attachment={attachment}
              busy={busy}
              onOpen={() => navigate(`/esame/${esame.id}/file/${attachment.id}`)}
              onDownload={() => downloadAttachment(attachment)}
              onDelete={() => void deleteAttachment(attachment.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ArchiveItem({
  attachment,
  busy,
  onOpen,
  onDownload,
  onDelete,
}: {
  attachment: ExamAttachment
  busy: boolean
  onOpen: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const canPreview = isPreviewSupported(attachment)

  return (
    <li style={itemStyle}>
      <div style={itemMetaStyle}>
        <strong style={fileNameStyle}>{attachment.name}</strong>
        <span style={mutedTextStyle}>{formatDate(attachment.createdAt)}</span>
      </div>
      <div style={itemActionsStyle}>
        {canPreview && (
          <button type="button" onClick={onOpen} disabled={busy} style={secondaryButtonStyle}>
            Apri {attachment.name}
          </button>
        )}
        <button type="button" onClick={onDownload} disabled={busy} style={secondaryButtonStyle}>
          Scarica {attachment.name}
        </button>
        <button type="button" onClick={onDelete} disabled={busy} style={dangerButtonStyle}>
          Elimina {attachment.name}
        </button>
      </div>
    </li>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Errore sconosciuto'
}

const pageStyle = { maxWidth: '860px', margin: '0 auto' }
const headerStyle = { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }
const backButtonStyle = { color: 'var(--text-muted)', minHeight: '40px' }
const titleStyle = { fontSize: '1.6rem', fontWeight: 700 }
const mutedTextStyle = { color: 'var(--text-muted)', fontSize: '0.95rem' }
const toolbarStyle = { display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }
const primaryButtonStyle = {
  minHeight: '48px',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
}
const secondaryButtonStyle = {
  minHeight: '44px',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
}
const dangerButtonStyle = { ...secondaryButtonStyle, color: 'var(--danger)' }
const messageStyle = { color: 'var(--text-muted)', textAlign: 'center' as const }
const errorStyle = { color: 'var(--danger)', marginBottom: '1rem' }
const emptyStyle = {
  padding: '1.5rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
  color: 'var(--text-muted)',
}
const listStyle = { display: 'grid', gap: '0.75rem', listStyle: 'none', padding: 0 }
const itemStyle = {
  display: 'grid',
  gap: '0.75rem',
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
}
const itemMetaStyle = { display: 'grid', gap: '0.25rem' }
const fileNameStyle = { overflowWrap: 'anywhere' as const }
const itemActionsStyle = { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' }
