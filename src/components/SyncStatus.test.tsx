import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SyncStatus as SyncStatusModel } from '../services/sync/types'
import { SyncStatus } from './SyncStatus'

function status(overrides: Partial<SyncStatusModel> = {}): SyncStatusModel {
  return {
    kind: 'signed-out',
    account: null,
    lastSyncedAt: null,
    pendingChanges: false,
    message: null,
    conflicts: [],
    ...overrides,
  }
}

describe('SyncStatus', () => {
  it('shows signed-out state and sign-in action', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined)

    render(<SyncStatus status={status()} onSignIn={onSignIn} onSignOut={vi.fn()} onSyncNow={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accedi a Google Drive' }))

    await waitFor(() => expect(onSignIn).toHaveBeenCalled())
  })

  it('shows synced timestamp and sync-now action', async () => {
    const onSyncNow = vi.fn().mockResolvedValue(undefined)

    render(
      <SyncStatus
        status={status({
          kind: 'synced',
          account: { id: '1', email: 'student@example.com', provider: 'google-drive' },
          lastSyncedAt: '2026-06-01T12:00:00.000Z',
        })}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onSyncNow={onSyncNow}
      />,
    )

    expect(screen.getByText(/student@example.com/)).not.toBeNull()
    expect(screen.getByText(/Sincronizzato/)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizza ora' }))

    await waitFor(() => expect(onSyncNow).toHaveBeenCalled())
  })

  it('shows a loading indicator while signing in', () => {
    render(
      <SyncStatus
        status={status({ kind: 'signing-in' })}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onSyncNow={vi.fn()}
      />,
    )

    expect(screen.getByRole('status', { name: 'Accesso in corso...' })).not.toBeNull()
    expect(screen.getAllByText('Accesso in corso...')).toHaveLength(1)
    expect(screen.getByText('Accesso in corso...')).toHaveClass('sync-status__text')
    expect(screen.getByRole('button', { name: 'Accedi a Google Drive' })).toHaveProperty('disabled', true)
  })

  it('shows a loading indicator while syncing', () => {
    render(
      <SyncStatus
        status={status({
          kind: 'syncing',
          account: { id: '1', email: 'student@example.com', provider: 'google-drive' },
        })}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onSyncNow={vi.fn()}
      />,
    )

    expect(screen.getByRole('status', { name: 'Sincronizzazione in corso...' })).not.toBeNull()
    expect(screen.getAllByText(/Sincronizzazione in corso\.\.\./)).toHaveLength(1)
    expect(screen.getByText('student@example.com - Sincronizzazione in corso...')).toHaveClass('sync-status__text')
    expect(screen.getByRole('button', { name: 'Sincronizza ora' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Esci' })).toHaveProperty('disabled', true)
  })

  it('shows conflict details and resolve actions', async () => {
    const onResolveConflict = vi.fn().mockResolvedValue(undefined)

    render(
      <SyncStatus
        status={status({
          kind: 'conflict',
          account: { id: '1', email: 'student@example.com', provider: 'google-drive' },
          pendingChanges: true,
          conflicts: [
            {
              id: 'exam-1',
              kind: 'exam-delete-vs-update',
              localUpdatedAt: '2026-06-01T10:00:00.000Z',
              remoteUpdatedAt: '2026-06-01T11:00:00.000Z',
              localDeviceId: 'local',
              remoteDeviceId: 'remote',
            },
          ],
        })}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onSyncNow={vi.fn()}
        onResolveConflict={onResolveConflict}
      />,
    )

    expect(screen.getByText(/Conflitto da risolvere/)).not.toBeNull()
    expect(screen.getByText(/exam-1/)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mantieni remoto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mantieni locale' }))

    await waitFor(() => expect(onResolveConflict).toHaveBeenCalledWith('keep-remote'))
    expect(onResolveConflict).toHaveBeenCalledWith('keep-local')
  })
})
