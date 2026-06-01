import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useExam } from '../hooks/useExam'
import type { Esame } from '../types'

export function HomePage() {
  const navigate = useNavigate()
  const { esami, loading, createEsame, renameEsame, deleteEsame } = useExam()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newExamName, setNewExamName] = useState('')
  const [creating, setCreating] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [savingRename, setSavingRename] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Esame | null>(null)
  const [deleting, setDeleting] = useState(false)
  const createInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showCreateForm) createInputRef.current?.focus()
  }, [showCreateForm])

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus()
  }, [renamingId])

  const canCreate = newExamName.trim().length > 0 && !creating

  async function handleCreate() {
    if (!canCreate) return

    setCreating(true)
    try {
      const esame = await createEsame(newExamName)
      setNewExamName('')
      setShowCreateForm(false)
      navigate(`/esame/${esame.id}`)
    } finally {
      setCreating(false)
    }
  }

  function handleCreateKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return

    event.preventDefault()
    void handleCreate()
  }

  function openMenu(event: MouseEvent<HTMLButtonElement>, examId: string) {
    event.stopPropagation()
    setOpenMenuId((current) => (current === examId ? null : examId))
  }

  function startRename(esame: Esame) {
    setRenamingId(esame.id)
    setRenameValue(esame.name)
    setOpenMenuId(null)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function saveRename() {
    if (!renamingId || savingRename) return

    const trimmedName = renameValue.trim()
    if (!trimmedName) {
      cancelRename()
      return
    }

    setSavingRename(true)
    try {
      await renameEsame(renamingId, trimmedName)
      cancelRename()
    } finally {
      setSavingRename(false)
    }
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelRename()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      void saveRename()
    }
  }

  function askDelete(esame: Esame) {
    setDeleteTarget(esame)
    setOpenMenuId(null)
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return

    setDeleting(true)
    try {
      await deleteEsame(deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>I tuoi esami</h1>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            minHeight: '44px',
          }}
        >
          + Nuovo esame
        </button>
      </header>

      {showCreateForm && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleCreate()
          }}
          style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--bg-surface)',
          }}
        >
          <input
            ref={createInputRef}
            value={newExamName}
            onChange={(event) => setNewExamName(event.target.value)}
            onKeyDown={handleCreateKeyDown}
            placeholder="Nome esame…"
            aria-label="Nome esame"
            disabled={creating}
            style={inputStyle}
          />
          <button type="submit" disabled={!canCreate} style={primaryButtonStyle}>
            Crea esame
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={() => {
              setNewExamName('')
              setShowCreateForm(false)
            }}
            style={secondaryButtonStyle}
          >
            Annulla
          </button>
        </form>
      )}

      {loading ? (
        <p style={mutedTextStyle}>Caricamento…</p>
      ) : esami.length === 0 ? (
        <p style={mutedTextStyle}>Nessun esame ancora. Creane uno per iniziare!</p>
      ) : (
        <ul style={{ display: 'grid', gap: '0.75rem', listStyle: 'none' }}>
          {esami.map((esame) => {
            const isRenaming = renamingId === esame.id

            return (
              <li
                key={esame.id}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.9rem 1rem',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                }}
              >
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={() => {
                      if (renameValue.trim()) void saveRename()
                    }}
                    aria-label={`Rinomina ${esame.name}`}
                    disabled={savingRename}
                    style={inputStyle}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/esame/${esame.id}`)}
                    aria-label={`Apri esame ${esame.name}`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      color: 'var(--text)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 650 }}>{esame.name}</span>
                    <span style={{ display: 'block', marginTop: '0.15rem', ...mutedTextStyle }}>
                      Creato il {formatDate(esame.createdAt)}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  aria-label={`Azioni per ${esame.name}`}
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === esame.id}
                  onClick={(event) => openMenu(event, esame.id)}
                  style={iconButtonStyle}
                >
                  ⋮
                </button>

                {openMenuId === esame.id && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      right: '1rem',
                      top: 'calc(100% - 0.25rem)',
                      zIndex: 5,
                      display: 'grid',
                      minWidth: '150px',
                      padding: '0.35rem',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: 'var(--bg-elevated)',
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => startRename(esame)}
                      style={menuItemStyle}
                    >
                      Rinomina
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => askDelete(esame)}
                      style={{ ...menuItemStyle, color: 'var(--danger)' }}
                    >
                      Elimina
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Elimina esame?"
        message="L'esame e tutte le sessioni e statistiche associate verranno eliminate definitivamente."
        confirmLabel={deleting ? 'Eliminazione…' : 'Elimina esame'}
        cancelLabel="Annulla"
        dangerous
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
    </div>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

const inputStyle = {
  flex: 1,
  minWidth: 0,
  padding: '0.65rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  minHeight: '44px',
}

const primaryButtonStyle = {
  padding: '0.65rem 1rem',
  borderRadius: '8px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
  minHeight: '44px',
}

const secondaryButtonStyle = {
  padding: '0.65rem 1rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  minHeight: '44px',
}

const iconButtonStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  fontSize: '1.25rem',
  lineHeight: 1,
}

const menuItemStyle = {
  padding: '0.55rem 0.65rem',
  borderRadius: '6px',
  color: 'var(--text)',
  textAlign: 'left' as const,
}

const mutedTextStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
}
