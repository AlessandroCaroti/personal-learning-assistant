import { useCallback, useState } from 'react'
import { exportLocalSyncState, getSyncMetadata, importMergedSyncState } from '../services/storageService'
import { createGoogleDriveSyncProvider } from '../services/sync/googleDriveSyncProvider'
import { createSyncService } from '../services/sync/syncService'
import type { SyncProvider, SyncStatus } from '../services/sync/types'
import { useAutomaticSync } from './useAutomaticSync'

const MISSING_GOOGLE_CLIENT_ID_MESSAGE = 'Configura VITE_GOOGLE_DRIVE_CLIENT_ID per usare Google Drive Sync'

function createUnconfiguredGoogleDriveProvider(): SyncProvider {
  return {
    async getAccount() {
      return null
    },
    async signIn() {
      throw new Error(MISSING_GOOGLE_CLIENT_ID_MESSAGE)
    },
    async signOut() {},
    async readRemoteState() {
      throw new Error(MISSING_GOOGLE_CLIENT_ID_MESSAGE)
    },
    async writeRemoteState() {
      throw new Error(MISSING_GOOGLE_CLIENT_ID_MESSAGE)
    },
  }
}

let syncServiceKey: string | null = null
let syncService: ReturnType<typeof createSyncService> | null = null

function getSyncService() {
  const key = [
    import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID ?? '',
    import.meta.env.VITE_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? '',
    import.meta.env.VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID ?? '',
  ].join('|')

  if (syncService && syncServiceKey === key) return syncService

  syncServiceKey = key
  syncService = createSyncService({
    provider: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID
      ? createGoogleDriveSyncProvider({
          clientId: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID,
          nativeClientId: import.meta.env.VITE_GOOGLE_DRIVE_ANDROID_CLIENT_ID,
          desktopClientId: import.meta.env.VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID,
        })
      : createUnconfiguredGoogleDriveProvider(),
    getLocalExport: exportLocalSyncState,
    importMergedSyncState,
    getDeviceId: async () => (await getSyncMetadata()).deviceId,
  })

  return syncService
}

export function useSync() {
  const service = getSyncService()
  const [status, setStatus] = useState<SyncStatus>(service.getStatus())

  const signIn = useCallback(async () => {
    try {
      setStatus(await service.signIn())
      setStatus(await service.syncNow())
    } catch (error) {
      setStatus((currentStatus) => ({
        ...currentStatus,
        kind: 'failed',
        pendingChanges: currentStatus.pendingChanges,
        message: error instanceof Error ? error.message : 'Accesso Google non riuscito',
        conflicts: [],
      }))
    }
  }, [service])

  const signOut = useCallback(async () => {
    setStatus(await service.signOut())
  }, [service])

  const syncNow = useCallback(async () => {
    setStatus(await service.syncNow())
  }, [service])

  const resolveConflict = useCallback(
    async (choice: 'keep-local' | 'keep-remote') => {
      setStatus(await service.resolveConflict(choice))
    },
    [service],
  )

  const automaticSync = useAutomaticSync(syncNow)

  return { status, signIn, signOut, syncNow, resolveConflict, requestSync: automaticSync.requestSync }
}
