import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { downloadAttachment } from '../services/archiveService'
import { getPreviewKind, prepareHtmlForIframe } from '../services/fileViewerService'
import * as storageService from '../services/storageService'
import type { ExamAttachment } from '../types'

export function FileViewerPage() {
  const { examId, fileId } = useParams<{ examId: string; fileId: string }>()
  const navigate = useNavigate()
  const [attachment, setAttachment] = useState<ExamAttachment | null>(null)
  const [previewKind, setPreviewKind] = useState<ReturnType<typeof getPreviewKind> | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadAttachment() {
      if (!examId || !fileId) {
        navigate('/', { replace: true })
        return
      }

      setAttachment(null)
      setPreviewKind(null)
      setTextContent(null)
      setHtmlContent(null)
      setError(null)
      resetObjectUrl()

      try {
        const esame = await storageService.getEsame(examId)
        if (!esame) {
          navigate('/', { replace: true })
          return
        }

        const currentAttachment = (esame.attachments ?? []).find((item) => item.id === fileId)
        if (!currentAttachment) {
          if (mounted) setError('File non trovato.')
          return
        }

        if (!mounted) return

        const currentPreviewKind = getPreviewKind(currentAttachment)
        setAttachment(currentAttachment)
        setPreviewKind(currentPreviewKind)

        if (currentPreviewKind === 'text' || currentPreviewKind === 'markdown') {
          setTextContent(new TextDecoder().decode(currentAttachment.data))
          return
        }

        if (currentPreviewKind === 'html') {
          const html = new TextDecoder().decode(currentAttachment.data)
          setHtmlContent(prepareHtmlForIframe(html))
          return
        }

        if (currentPreviewKind === 'docx') {
          const mammoth = await import('mammoth')
          const result = await mammoth.convertToHtml({ arrayBuffer: currentAttachment.data })
          if (mounted) setHtmlContent(prepareHtmlForIframe(result.value))
          return
        }

        if (currentPreviewKind === 'pdf' || currentPreviewKind === 'image') {
          const previewUrl = URL.createObjectURL(
            new Blob([currentAttachment.data], { type: currentAttachment.type }),
          )

          if (!mounted) {
            URL.revokeObjectURL(previewUrl)
            return
          }

          objectUrlRef.current = previewUrl
          setObjectUrl(previewUrl)
          return
        }

        setError('Anteprima non disponibile per questo file.')
      } catch (caughtError) {
        if (mounted) setError(errorMessage(caughtError))
      }
    }

    function revokeObjectUrl() {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }

    function resetObjectUrl() {
      revokeObjectUrl()
      setObjectUrl(null)
    }

    void loadAttachment()

    return () => {
      mounted = false
      revokeObjectUrl()
    }
  }, [examId, fileId, navigate])

  const isLoading =
    !error &&
    attachment !== null &&
    textContent === null &&
    htmlContent === null &&
    objectUrl === null &&
    previewKind !== 'unsupported'

  const backTarget = examId ? `/esame/${examId}/archivio` : '/'

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <button
          type="button"
          onClick={() => navigate(backTarget)}
          aria-label="Torna all'archivio esame"
          style={backButtonStyle}
        >
          ← Archivio
        </button>
        <h1 style={titleStyle}>{attachment?.name ?? 'File'}</h1>
      </header>

      <main style={viewerStyle}>
        {textContent !== null && <pre style={textStyle}>{textContent}</pre>}
        {htmlContent !== null && (
          <iframe srcDoc={htmlContent} title="Anteprima file" sandbox="" style={iframeStyle} />
        )}
        {previewKind === 'pdf' && objectUrl && (
          <iframe src={objectUrl} title="Anteprima PDF" sandbox="" style={iframeStyle} />
        )}
        {previewKind === 'image' && objectUrl && (
          <div style={imageFrameStyle}>
            <img src={objectUrl} alt={attachment?.name ?? 'Anteprima immagine'} style={imageStyle} />
          </div>
        )}
        {isLoading && <p style={messageStyle}>Caricamento...</p>}
        {error && (
          <div style={messageWrapStyle}>
            <p role="alert" style={errorStyle}>
              {error}
            </p>
            {attachment && (
              <button
                type="button"
                onClick={() => downloadAttachment(attachment)}
                style={downloadButtonStyle}
              >
                Scarica file
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Impossibile aprire il file.'
}

const pageStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  height: 'calc(100dvh - 3rem)',
  minHeight: '520px',
}

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  marginBottom: '1rem',
}

const backButtonStyle = {
  color: 'var(--text-muted)',
  minHeight: '40px',
}

const titleStyle = {
  minWidth: 0,
  overflowWrap: 'anywhere' as const,
  fontSize: '1.1rem',
  fontWeight: 700,
}

const viewerStyle = {
  flex: 1,
  overflow: 'hidden',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
}

const iframeStyle = {
  width: '100%',
  height: '100%',
  border: 'none',
}

const textStyle = {
  margin: 0,
  padding: '1.5rem',
  height: '100%',
  overflow: 'auto',
  whiteSpace: 'pre-wrap' as const,
  overflowWrap: 'anywhere' as const,
}

const imageFrameStyle = {
  display: 'grid',
  placeItems: 'center',
  width: '100%',
  height: '100%',
  padding: '1rem',
}

const imageStyle = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain' as const,
}

const messageWrapStyle = {
  display: 'grid',
  justifyItems: 'center' as const,
  gap: '1rem',
  padding: '2rem',
}

const messageStyle = {
  padding: '2rem',
  color: 'var(--text-muted)',
  textAlign: 'center' as const,
}

const errorStyle = {
  margin: 0,
  color: 'var(--danger)',
  textAlign: 'center' as const,
}

const downloadButtonStyle = {
  minHeight: '44px',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
}
