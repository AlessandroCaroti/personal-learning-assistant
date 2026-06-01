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
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
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
        <h2 id="confirm-dialog-title" style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
          {title}
        </h2>
        <p
          id="confirm-dialog-message"
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
