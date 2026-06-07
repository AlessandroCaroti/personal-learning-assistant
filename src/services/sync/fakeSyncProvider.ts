import {
  RemoteRevisionMismatchError,
  type RemoteSyncState,
  type SyncAccount,
  type SyncProvider,
} from './types'

interface FakeProviderOptions {
  account?: SyncAccount | null
  state?: RemoteSyncState | null
  revision?: string | null
}

export function createFakeSyncProvider(options: FakeProviderOptions = {}): SyncProvider {
  let account = options.account ?? null
  let state = options.state ?? null
  let revision = options.revision ?? null
  let revisionCounter = revision ? 1 : 0

  return {
    async getAccount() {
      return account
    },
    async signIn() {
      account = {
        id: 'fake-account',
        email: 'student@example.com',
        name: 'Student',
        provider: 'fake',
      }
      return account
    },
    async signOut() {
      account = null
    },
    async readRemoteState() {
      return { state, revision }
    },
    async writeRemoteState(nextState, expectedRevision) {
      if (revision !== expectedRevision) {
        throw new RemoteRevisionMismatchError()
      }

      revisionCounter += 1
      revision = `fake-revision-${revisionCounter}`
      state = nextState

      return {
        revision,
        updatedAt: nextState.updatedAt,
      }
    },
  }
}
