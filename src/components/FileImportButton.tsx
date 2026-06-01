import { useState } from 'react'
import { fileService } from '../services/fileService'

interface FileImportButtonProps {
  label: string
  accept: string[]
  onFile: (data: ArrayBuffer, name: string, type: string) => Promise<void>
  disabled?: boolean
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Errore sconosciuto'
}

export function FileImportButton({ label, accept, onFile, disabled = false }: FileImportButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setError(null)
    setLoading(true)

    try {
      const picked = await fileService.pickFile(accept)
      await onFile(picked.data, picked.name, picked.type)
    } catch (caughtError) {
      const message = errorMessage(caughtError)

      if (message !== 'Selezione annullata') {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        style={{
          minHeight: '48px',
          padding: '0.6rem 1.2rem',
          borderRadius: '8px',
          background: 'var(--accent)',
          color: '#fff',
          fontWeight: 600,
        }}
      >
        {loading ? 'Importazione...' : label}
      </button>
      {error && (
        <p role="alert" style={{ marginTop: '0.4rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
          File non valido: {error}
        </p>
      )}
    </div>
  )
}
