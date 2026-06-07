import type { SyncStatus as SyncStatusModel } from '../services/sync/types'

interface SyncStatusProps {
  status: SyncStatusModel
  onSignIn(): Promise<void>
  onSignOut(): Promise<void>
  onSyncNow(): Promise<void>
  onResolveConflict?(choice: 'keep-local' | 'keep-remote'): Promise<void>
}

function statusLabel(status: SyncStatusModel): string {
  if (status.kind === 'signed-out') return 'Sincronizzazione non attiva'
  if (status.kind === 'signing-in') return 'Accesso in corso...'
  if (status.kind === 'syncing') return 'Sincronizzazione in corso...'
  if (status.kind === 'offline') return 'Offline: modifiche in attesa'
  if (status.kind === 'failed') return status.message ?? 'Sincronizzazione non riuscita'
  if (status.kind === 'needs-sign-in') return 'Accedi di nuovo per sincronizzare'
  if (status.kind === 'conflict') return 'Conflitto da risolvere'
  if (status.lastSyncedAt) {
    return `Sincronizzato ${new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(status.lastSyncedAt))}`
  }

  return 'Sincronizzato'
}

export function SyncStatus({ status, onSignIn, onSignOut, onSyncNow, onResolveConflict }: SyncStatusProps) {
  const isBusy = status.kind === 'signing-in' || status.kind === 'syncing'
  const label = statusLabel(status)

  return (
    <section className="sync-status" aria-label="Sincronizzazione">
      <div>
        <p className="sync-status__title">Google Drive</p>
        <p className="sync-status__text">
          {status.account ? `${status.account.email} - ${label}` : label}
        </p>
        {isBusy && (
          <div className="sync-status__busy" role="status" aria-label={label}>
            <span className="sync-status__spinner" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="sync-status__actions">
        {status.account ? (
          <>
            <button type="button" disabled={isBusy} onClick={() => void onSyncNow()}>
              Sincronizza ora
            </button>
            <button type="button" disabled={isBusy} onClick={() => void onSignOut()}>
              Esci
            </button>
          </>
        ) : (
          <button type="button" disabled={isBusy} onClick={() => void onSignIn()}>
            Accedi a Google Drive
          </button>
        )}
      </div>
      {status.kind === 'conflict' && status.conflicts.length > 0 && (
        <div className="sync-status__conflicts">
          <ul>
            {status.conflicts.map((conflict) => (
              <li key={`${conflict.kind}-${conflict.id}`}>
                {conflict.id}: {conflict.kind}
              </li>
            ))}
          </ul>
          {onResolveConflict && (
            <div className="sync-status__conflict-actions">
              <button type="button" onClick={() => void onResolveConflict('keep-remote')}>
                Mantieni remoto
              </button>
              <button type="button" onClick={() => void onResolveConflict('keep-local')}>
                Mantieni locale
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
