import { mergeSyncStates } from './merge'
import {
  RemoteRevisionMismatchError,
  type RemoteSyncState,
  type SyncProvider,
  type SyncStatus,
} from './types'

interface SyncServiceDependencies {
  provider: SyncProvider
  getLocalExport(): Promise<{ state: RemoteSyncState; revision: string | null }>
  importMergedSyncState(state: RemoteSyncState, remoteRevision: string, syncedAt: string): Promise<void>
  getDeviceId(): Promise<string>
}

const MAX_REVISION_RETRY_COUNT = 2

export interface SyncService {
  getStatus(): SyncStatus
  signIn(): Promise<SyncStatus>
  signOut(): Promise<SyncStatus>
  syncNow(): Promise<SyncStatus>
  resolveConflict(choice: 'keep-local' | 'keep-remote'): Promise<SyncStatus>
}

function initialStatus(): SyncStatus {
  return {
    kind: 'signed-out',
    account: null,
    lastSyncedAt: null,
    pendingChanges: false,
    message: null,
    conflicts: [],
  }
}

function failedStatus(current: SyncStatus, account: SyncStatus['account'], error: unknown): SyncStatus {
  if (error instanceof RemoteRevisionMismatchError) {
    return {
      ...current,
      kind: 'failed',
      account,
      pendingChanges: true,
      message: 'Lo stato remoto e cambiato. Riprova la sincronizzazione.',
      conflicts: current.conflicts,
    }
  }

  return {
    ...current,
    kind: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'failed',
    account,
    pendingChanges: true,
    message: error instanceof Error ? error.message : 'Sincronizzazione non riuscita',
    conflicts: current.conflicts,
  }
}

export function createSyncService(dependencies: SyncServiceDependencies): SyncService {
  let status = initialStatus()

  function setStatus(next: SyncStatus): SyncStatus {
    status = next
    return status
  }

  return {
    getStatus() {
      return status
    },
    async signIn() {
      setStatus({ ...status, kind: 'signing-in', message: null })
      const account = await dependencies.provider.signIn()
      return setStatus({ ...status, kind: 'signed-out', account })
    },
    async signOut() {
      await dependencies.provider.signOut()
      return setStatus(initialStatus())
    },
    async syncNow() {
      const account = await dependencies.provider.getAccount()

      if (!account) {
        return setStatus({ ...status, kind: 'signed-out', account: null })
      }

      setStatus({ ...status, kind: 'syncing', account, message: null, conflicts: [] })

      try {
        const local = await dependencies.getLocalExport()
        const deviceId = await dependencies.getDeviceId()

        for (let attempt = 0; attempt <= MAX_REVISION_RETRY_COUNT; attempt += 1) {
          const remote = await dependencies.provider.readRemoteState()
          const nowIso = new Date().toISOString()
          const remoteState = remote.state ?? local.state
          const merged = mergeSyncStates(local.state, remoteState, deviceId, nowIso)

          if (merged.conflicts.length > 0) {
            return setStatus({
              ...status,
              kind: 'conflict',
              account,
              pendingChanges: true,
              message: 'Conflitto di sincronizzazione da risolvere',
              conflicts: merged.conflicts,
            })
          }

          try {
            const write = await dependencies.provider.writeRemoteState(merged.state, remote.revision)
            await dependencies.importMergedSyncState(merged.state, write.revision, nowIso)

            return setStatus({
              kind: 'synced',
              account,
              lastSyncedAt: nowIso,
              pendingChanges: false,
              message: null,
              conflicts: [],
            })
          } catch (error) {
            if (!(error instanceof RemoteRevisionMismatchError) || attempt === MAX_REVISION_RETRY_COUNT) {
              throw error
            }
          }
        }

        return setStatus({
          ...status,
          kind: 'failed',
          account,
          pendingChanges: true,
          message: 'Sincronizzazione non riuscita',
          conflicts: [],
        })
      } catch (error) {
        return setStatus({ ...failedStatus(status, account, error), conflicts: [] })
      }
    },
    async resolveConflict(choice) {
      const nowIso = new Date().toISOString()
      const account = await dependencies.provider.getAccount()

      try {
        if (choice === 'keep-remote') {
          const remote = await dependencies.provider.readRemoteState()

          if (!remote.state || !remote.revision) {
            throw new Error('Stato remoto non disponibile')
          }

          await dependencies.importMergedSyncState(remote.state, remote.revision, nowIso)
          return setStatus({
            ...status,
            kind: 'synced',
            account,
            lastSyncedAt: nowIso,
            pendingChanges: false,
            message: null,
            conflicts: [],
          })
        }

        const local = await dependencies.getLocalExport()
        const remote = await dependencies.provider.readRemoteState()
        const write = await dependencies.provider.writeRemoteState(local.state, remote.revision)
        await dependencies.importMergedSyncState(local.state, write.revision, nowIso)

        return setStatus({
          ...status,
          kind: 'synced',
          account,
          lastSyncedAt: nowIso,
          pendingChanges: false,
          message: null,
          conflicts: [],
        })
      } catch (error) {
        return setStatus(failedStatus(status, account, error))
      }
    },
  }
}
