import { type KeyboardEvent, useEffect, useId, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  dangerous?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  dangerous = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusTarget = confirmButtonRef.current ?? getFocusableElements(dialogRef.current)[0]
    focusTarget?.focus()

    return () => {
      previouslyFocused?.focus()
    }
  }, [open])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }

    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements(dialogRef.current)
    if (focusableElements.length === 0) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '1.5rem',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          background: 'var(--bg-surface)',
          color: 'var(--text)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
        }}
      >
        <h2 id={titleId} style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
          {title}
        </h2>
        <p
          id={messageId}
          style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              color: 'var(--text)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              background: dangerous ? 'var(--danger)' : 'var(--accent)',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return []

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}
