import type { CardEval, Esame, FileRecord, FlashcardStats, QuestionStats, QuizSession } from '../../types'

export const SYNC_SCHEMA_VERSION = 1

export type SyncProviderKind = 'google-drive' | 'fake'
export type SyncDirtyStore = 'esami' | 'quizSessions' | 'questionStats' | 'flashcardStats'
export type SyncFileSlot = 'quiz' | 'flashcard' | 'riassunto'

export interface SyncAccount {
  id: string
  email: string
  name?: string
  provider: SyncProviderKind
}

export interface EncodedFileRecord {
  name: string
  type: string
  dataBase64: string
}

export interface SyncExamRecord extends Omit<Esame, 'files'> {
  files: Partial<Record<SyncFileSlot, EncodedFileRecord>>
  updatedAt: string
  updatedByDeviceId: string
}

export interface SyncQuestionStatRecord extends Omit<QuestionStats, 'timesShown' | 'timesCorrect'> {
  deviceCounters: Record<string, { timesShown: number; timesCorrect: number }>
}

export interface SyncFlashcardStatRecord extends FlashcardStats {
  updatedByDeviceId: string
}

export interface SyncQuizSessionRecord extends QuizSession {
  updatedByDeviceId: string
}

interface SyncTombstoneBase {
  id: string
  deletedAt: string
  deletedByDeviceId: string
}

export interface SyncExamTombstone extends SyncTombstoneBase {
  kind: 'exam'
}

export interface SyncFileTombstone extends SyncTombstoneBase {
  kind: 'file'
  examId: string
  fileSlot: SyncFileSlot
}

export type SyncTombstone = SyncExamTombstone | SyncFileTombstone

export interface RemoteSyncData {
  esami: SyncExamRecord[]
  quizSessions: SyncQuizSessionRecord[]
  questionStats: SyncQuestionStatRecord[]
  flashcardStats: SyncFlashcardStatRecord[]
}

export interface RemoteSyncState {
  syncVersion: number
  updatedAt: string
  writerDeviceId: string
  data: RemoteSyncData
  tombstones: SyncTombstone[]
}

export type SyncConflictKind = 'exam-delete-vs-update' | 'file-delete-vs-update' | 'duplicate-quiz-session'

export interface SyncConflict {
  id: string
  kind: SyncConflictKind
  localUpdatedAt: string
  remoteUpdatedAt: string
  localDeviceId?: string
  remoteDeviceId?: string
}

export interface MergeResult {
  state: RemoteSyncState
  conflicts: SyncConflict[]
}

export type SyncStatusKind =
  | 'signed-out'
  | 'signing-in'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'failed'
  | 'needs-sign-in'
  | 'conflict'

export interface SyncStatus {
  kind: SyncStatusKind
  account: SyncAccount | null
  lastSyncedAt: string | null
  pendingChanges: boolean
  message: string | null
  conflicts: SyncConflict[]
}

export interface RemoteWriteResult {
  revision: string
  updatedAt: string
}

export class RemoteRevisionMismatchError extends Error {
  constructor() {
    super('Remote sync state changed before write')
    this.name = 'RemoteRevisionMismatchError'
  }
}

export interface SyncProvider {
  getAccount(): Promise<SyncAccount | null>
  signIn(): Promise<SyncAccount>
  signOut(): Promise<void>
  readRemoteState(): Promise<{ state: RemoteSyncState | null; revision: string | null }>
  writeRemoteState(state: RemoteSyncState, expectedRevision: string | null): Promise<RemoteWriteResult>
}

export interface SyncMetadata {
  id: 'sync'
  deviceId: string
  lastSyncedAt: string | null
  lastRemoteRevision: string | null
  pendingLocalChanges: boolean
  syncSchemaVersion: number
  account: SyncAccount | null
}

export interface LocalSyncRecordMetadata {
  id: string
  store: SyncDirtyStore
  recordId: string
  updatedAt: string
  updatedByDeviceId: string
  deletedAt?: string
}

export interface LocalSyncExport {
  metadata: SyncMetadata
  data: RemoteSyncData
  tombstones: SyncTombstone[]
}

export type SyncableFileRecord = FileRecord
export type SyncableCardEval = CardEval
