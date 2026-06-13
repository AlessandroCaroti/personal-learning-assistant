import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSyncProvider } from './fakeSyncProvider'
import { createSyncService } from './syncService'
import {
  RemoteRevisionMismatchError,
  SYNC_SCHEMA_VERSION,
  type RemoteSyncState,
  type SyncProvider,
} from './types'

function emptyState(deviceId: string): RemoteSyncState {
  return {
    syncVersion: SYNC_SCHEMA_VERSION,
    updatedAt: '2026-06-01T10:00:00.000Z',
    writerDeviceId: deviceId,
    data: {
      esami: [],
      quizSessions: [],
      questionStats: [],
      flashcardStats: [],
    },
    tombstones: [],
  }
}

describe('syncService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('signs in and pushes local state when remote is empty', async () => {
    const provider = createFakeSyncProvider()
    const importMergedSyncState = vi.fn().mockResolvedValue(undefined)
    const service = createSyncService({
      provider,
      getLocalExport: vi.fn().mockResolvedValue({ state: emptyState('local-device'), revision: null }),
      importMergedSyncState,
      getDeviceId: vi.fn().mockResolvedValue('local-device'),
    })

    await service.signIn()
    const result = await service.syncNow()

    expect(result.kind).toBe('synced')
    expect(importMergedSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ writerDeviceId: 'local-device' }),
      expect.any(String),
      '2026-06-01T12:00:00.000Z',
    )
  })

  it('reports conflicts without importing merged state', async () => {
    const provider = createFakeSyncProvider({
      state: {
        ...emptyState('remote-device'),
        data: {
          ...emptyState('remote-device').data,
          esami: [
            {
              id: 'exam-1',
              name: 'Remote',
              createdAt: '2026-06-01T08:00:00.000Z',
              files: {},
              attachments: [],
              updatedAt: '2026-06-01T11:00:00.000Z',
              updatedByDeviceId: 'remote-device',
            },
          ],
        },
      },
      revision: 'remote-1',
    })
    const local = emptyState('local-device')
    local.tombstones.push({
      id: 'exam-1',
      kind: 'exam',
      deletedAt: '2026-06-01T10:00:00.000Z',
      deletedByDeviceId: 'local-device',
    })
    const importMergedSyncState = vi.fn().mockResolvedValue(undefined)
    const service = createSyncService({
      provider,
      getLocalExport: vi.fn().mockResolvedValue({ state: local, revision: 'remote-1' }),
      importMergedSyncState,
      getDeviceId: vi.fn().mockResolvedValue('local-device'),
    })

    await service.signIn()
    const result = await service.syncNow()

    expect(result.kind).toBe('conflict')
    expect(result.conflicts).toHaveLength(1)
    expect(importMergedSyncState).not.toHaveBeenCalled()
  })

  it('pulls, merges, and retries when remote revision changes during write', async () => {
    const account = { id: 'fake-account', email: 'student@example.com', provider: 'fake' as const }
    const localState = emptyState('local-device')
    const firstRemote = emptyState('remote-device')
    const secondRemote = emptyState('remote-device')
    localState.data.quizSessions.push({
      id: 'session-local',
      examId: 'exam-1',
      date: '2026-06-01T10:00:00.000Z',
      score: 1,
      total: 1,
      totalTime: 10,
      timeLimitSeconds: null,
      completedByTimeout: false,
      macroargomenti: [],
      errors: [],
      unanswered: [],
      isReview: false,
      updatedByDeviceId: 'local-device',
    })
    secondRemote.data.quizSessions.push({
      id: 'session-remote',
      examId: 'exam-1',
      date: '2026-06-01T11:00:00.000Z',
      score: 1,
      total: 1,
      totalTime: 20,
      timeLimitSeconds: null,
      completedByTimeout: false,
      macroargomenti: [],
      errors: [],
      unanswered: [],
      isReview: false,
      updatedByDeviceId: 'remote-device',
    })
    const importMergedSyncState = vi.fn().mockResolvedValue(undefined)
    const provider: SyncProvider = {
      getAccount: vi.fn().mockResolvedValue(account),
      signIn: vi.fn().mockResolvedValue(account),
      signOut: vi.fn().mockResolvedValue(undefined),
      readRemoteState: vi
        .fn()
        .mockResolvedValueOnce({ state: firstRemote, revision: 'remote-1' })
        .mockResolvedValueOnce({ state: secondRemote, revision: 'remote-2' }),
      writeRemoteState: vi
        .fn()
        .mockRejectedValueOnce(new RemoteRevisionMismatchError())
        .mockResolvedValueOnce({ revision: 'remote-3', updatedAt: '2026-06-01T12:00:00.000Z' }),
    }
    const service = createSyncService({
      provider,
      getLocalExport: vi.fn().mockResolvedValue({ state: localState, revision: 'remote-1' }),
      importMergedSyncState,
      getDeviceId: vi.fn().mockResolvedValue('local-device'),
    })

    const result = await service.syncNow()

    expect(result.kind).toBe('synced')
    expect(provider.readRemoteState).toHaveBeenCalledTimes(2)
    expect(provider.writeRemoteState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quizSessions: expect.arrayContaining([
            expect.objectContaining({ id: 'session-local' }),
            expect.objectContaining({ id: 'session-remote' }),
          ]),
        }),
      }),
      'remote-2',
    )
    expect(importMergedSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quizSessions: expect.arrayContaining([
            expect.objectContaining({ id: 'session-local' }),
            expect.objectContaining({ id: 'session-remote' }),
          ]),
        }),
      }),
      'remote-3',
      '2026-06-01T12:00:00.000Z',
    )
  })

  it('resolves conflicts by keeping remote state', async () => {
    const remoteState = emptyState('remote-device')
    const provider = createFakeSyncProvider({ state: remoteState, revision: 'remote-1' })
    const importMergedSyncState = vi.fn().mockResolvedValue(undefined)
    const service = createSyncService({
      provider,
      getLocalExport: vi.fn().mockResolvedValue({ state: emptyState('local-device'), revision: 'remote-1' }),
      importMergedSyncState,
      getDeviceId: vi.fn().mockResolvedValue('local-device'),
    })

    await service.signIn()
    const result = await service.resolveConflict('keep-remote')

    expect(result.kind).toBe('synced')
    expect(importMergedSyncState).toHaveBeenCalledWith(
      remoteState,
      'remote-1',
      '2026-06-01T12:00:00.000Z',
    )
  })

  it('resolves conflicts by overwriting remote with local state', async () => {
    const provider = createFakeSyncProvider()
    const localState = emptyState('local-device')
    const importMergedSyncState = vi.fn().mockResolvedValue(undefined)
    const service = createSyncService({
      provider,
      getLocalExport: vi.fn().mockResolvedValue({ state: localState, revision: null }),
      importMergedSyncState,
      getDeviceId: vi.fn().mockResolvedValue('local-device'),
    })

    await service.signIn()
    const result = await service.resolveConflict('keep-local')

    expect(result.kind).toBe('synced')
    expect(importMergedSyncState).toHaveBeenCalledWith(
      localState,
      expect.any(String),
      '2026-06-01T12:00:00.000Z',
    )
  })

  it('reports a failed status when keeping remote but remote state is unavailable', async () => {
    const provider = createFakeSyncProvider()
    const service = createSyncService({
      provider,
      getLocalExport: vi.fn().mockResolvedValue({ state: emptyState('local-device'), revision: null }),
      importMergedSyncState: vi.fn().mockResolvedValue(undefined),
      getDeviceId: vi.fn().mockResolvedValue('local-device'),
    })

    await service.signIn()
    const result = await service.resolveConflict('keep-remote')

    expect(result.kind).toBe('failed')
    expect(result.pendingChanges).toBe(true)
    expect(result.message).toBe('Stato remoto non disponibile')
  })

  it('reports a failed status when keeping local hits a revision mismatch', async () => {
    const account = { id: 'fake-account', email: 'student@example.com', provider: 'fake' as const }
    const provider: SyncProvider = {
      getAccount: vi.fn().mockResolvedValue(account),
      signIn: vi.fn().mockResolvedValue(account),
      signOut: vi.fn().mockResolvedValue(undefined),
      readRemoteState: vi.fn().mockResolvedValue({ state: emptyState('remote-device'), revision: 'remote-1' }),
      writeRemoteState: vi.fn().mockRejectedValue(new RemoteRevisionMismatchError()),
    }
    const service = createSyncService({
      provider,
      getLocalExport: vi.fn().mockResolvedValue({ state: emptyState('local-device'), revision: 'remote-1' }),
      importMergedSyncState: vi.fn().mockResolvedValue(undefined),
      getDeviceId: vi.fn().mockResolvedValue('local-device'),
    })

    await service.signIn()
    const result = await service.resolveConflict('keep-local')

    expect(result.kind).toBe('failed')
    expect(result.pendingChanges).toBe(true)
    expect(result.message).toBe('Lo stato remoto e cambiato. Riprova la sincronizzazione.')
  })
})
