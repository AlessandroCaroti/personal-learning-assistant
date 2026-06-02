import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as storageService from '../services/storageService'
import type { FileRecord } from '../types'

export function SummaryPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [file, setFile] = useState<FileRecord | null>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadSummary() {
      if (!examId) {
        navigate('/', { replace: true })
        return
      }

      try {
        const esame = await storageService.getEsame(examId)
        const summary = esame?.files.riassunto

        if (!summary) {
          navigate(`/esame/${examId}`, { replace: true })
          return
        }

        if (!mounted) return

        setFile(summary)
        setHtmlContent(null)
        setError(null)
        resetPdfUrl()

        const summaryName = summary.name.toLowerCase()
        const summaryType = summary.type.toLowerCase()

        if (summaryType === 'text/html' || summaryName.endsWith('.html')) {
          const html = new TextDecoder().decode(summary.data)
          if (mounted) setHtmlContent(html)
          return
        }

        if (summaryType === 'application/pdf' || summaryName.endsWith('.pdf')) {
          const objectUrl = URL.createObjectURL(
            new Blob([summary.data], { type: 'application/pdf' }),
          )
          if (!mounted) {
            URL.revokeObjectURL(objectUrl)
            return
          }

          pdfUrlRef.current = objectUrl
          setPdfUrl(objectUrl)
          return
        }

        if (summaryName.endsWith('.docx')) {
          const mammoth = await import('mammoth')
          const result = await mammoth.convertToHtml({ arrayBuffer: summary.data })
          if (mounted) setHtmlContent(result.value)
          return
        }

        setError('Formato riassunto non supportato. Importa un file HTML, PDF o DOCX.')
      } catch (loadError) {
        if (mounted) setError(errorMessage(loadError))
      }
    }

    function revokePdfUrl() {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current)
        pdfUrlRef.current = null
      }
    }

    function resetPdfUrl() {
      revokePdfUrl()
      setPdfUrl(null)
    }

    void loadSummary()

    return () => {
      mounted = false
      revokePdfUrl()
    }
  }, [examId, navigate])

  const isLoading = !error && htmlContent === null && !pdfUrl

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <button
          type="button"
          onClick={() => navigate(examId ? `/esame/${examId}` : '/')}
          aria-label="Torna alla dashboard esame"
          style={backButtonStyle}
        >
          ← Dashboard
        </button>
        <h1 style={titleStyle}>{file?.name ?? 'Riassunto'}</h1>
      </header>

      <main style={viewerStyle}>
        {htmlContent !== null && (
          <iframe
            srcDoc={htmlContent}
            title="Riassunto"
            sandbox=""
            style={iframeStyle}
          />
        )}
        {pdfUrl && (
          <iframe src={pdfUrl} title="Riassunto PDF" sandbox="" style={iframeStyle} />
        )}
        {isLoading && <p style={messageStyle}>Caricamento...</p>}
        {error && (
          <p role="alert" style={errorStyle}>
            {error}
          </p>
        )}
      </main>
    </div>
  )
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Impossibile aprire il riassunto.'
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

const messageStyle = {
  padding: '2rem',
  color: 'var(--text-muted)',
  textAlign: 'center' as const,
}

const errorStyle = {
  ...messageStyle,
  color: 'var(--danger)',
}
