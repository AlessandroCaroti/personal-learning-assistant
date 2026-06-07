# Sync Between Installations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build automatic offline-first sync of study data across Android, browser web, and Windows desktop using Google Drive `appDataFolder` behind a thin provider interface.

**Architecture:** Add sync as a focused layer beside `storageService`: typed sync models and pure merge logic, IndexedDB sync metadata/export/import helpers, a provider interface, sync orchestration, and compact Home-page status UI. The app writes locally first and sync reconciles in the background; Google Drive details stay inside one provider module.

**Tech Stack:** React 18, TypeScript 5.6, Vite 6, Vitest, React Testing Library, IndexedDB via `idb`, Google Identity Services, Google Drive API v3.

---

## Scope Check

This plan covers one sequential feature with dependent phases: local sync model, merge engine, storage integration, provider contract, sync orchestration, UI, Google Drive provider, and documentation. The work is not split into separate plans because each phase depends on interfaces created earlier and each task below produces testable software.

## File Structure

- Create `src/services/sync/types.ts`: sync record types, remote state types, status types, provider interface, constants.
- Create `src/services/sync/serialization.ts`: ArrayBuffer/base64 conversion and sync-state normalization helpers.
- Create `src/services/sync/merge.ts`: pure deterministic local/remote merge logic and conflict detection.
- Create `src/services/sync/merge.test.ts`: merge behavior tests.
- Create `src/services/sync/fakeSyncProvider.ts`: in-memory provider for tests and local development.
- Create `src/services/sync/syncService.ts`: orchestration of pull, merge, import, push, retry, status.
- Create `src/services/sync/syncService.test.ts`: orchestration tests with fake provider and fake storage functions.
- Create `src/services/sync/googleDriveSyncProvider.ts`: Google Identity Services + Drive `appDataFolder` provider.
- Create `src/services/sync/googleDriveSyncProvider.test.ts`: request-building and provider contract tests using mocked `fetch` and GIS globals.
- Create `src/hooks/useSync.ts`: React hook exposing sync status and actions.
- Create `src/hooks/useSync.test.ts`: hook tests.
- Create `src/components/SyncStatus.tsx`: compact account/status/actions UI.
- Create `src/components/SyncStatus.test.tsx`: status UI tests.
- Modify `src/services/storageService.ts`: add DB v3 stores and helpers for sync metadata, dirty markers, export, import, and synced replacement cleanup.
- Modify `src/services/storageService.test.ts`: cover DB v3 sync stores and export/import helpers.
- Modify `src/pages/HomePage.tsx`: render `SyncStatus`.
- Modify `src/pages/HomePage.test.tsx`: mock and assert sync status UI.
- Modify `src/index.css`: add SyncStatus styles using existing CSS variables.
- Create: `.env.example`: document public Google OAuth client ID variable.
- Modify `docs/diataxis/reference/integrations.md`: document Google Drive integration.
- Modify `docs/diataxis/how-to/`: add Google OAuth setup and manual verification guide.

## Shared Test Commands

Use targeted tests during each task, then run the full suite at task completion:

```powershell
npm run test -- --run
```

Expected final result after each completed task: all tests pass.

---

### Task 1: Sync Types And Serialization

**Files:**
- Create: `src/services/sync/types.ts`
- Create: `src/services/sync/serialization.ts`
- Create: `src/services/sync/serialization.test.ts`

- [ ] **Step 1: Write failing serialization tests**

Create `src/services/sync/serialization.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { FileRecord } from '../../types'
import { decodeFileRecord, encodeFileRecord } from './serialization'

function fileRecord(): FileRecord {
  const bytes = new TextEncoder().encode('quiz payload')
  return {
    name: 'quiz.json',
    type: 'application/json',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}

describe('sync serialization', () => {
  it('round-trips file records through base64 payloads', () => {
    const encoded = encodeFileRecord(fileRecord())
    const decoded = decodeFileRecord(encoded)

    expect(encoded).toEqual({
      name: 'quiz.json',
      type: 'application/json',
      dataBase64: 'cXVpeiBwYXlsb2Fk',
    })
    expect(decoded.name).toBe('quiz.json')
    expect(decoded.type).toBe('application/json')
    expect(new TextDecoder().decode(decoded.data)).toBe('quiz payload')
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm run test -- src/services/sync/serialization.test.ts --run
```

Expected: FAIL because `src/services/sync/serialization.ts` does not exist.

- [ ] **Step 3: Create sync types**

Create `src/services/sync/types.ts`:

```ts
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

export interface SyncTombstone {
  id: string
  deletedAt: string
  deletedByDeviceId: string
  kind: 'exam' | 'file'
  examId?: string
  fileSlot?: SyncFileSlot
}

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
```

- [ ] **Step 4: Implement serialization helpers**

Create `src/services/sync/serialization.ts`:

```ts
import type { FileRecord } from '../../types'
import type { EncodedFileRecord } from './types'

export function arrayBufferToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  let binary = ''

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  return btoa(binary)
}

export function base64ToArrayBuffer(dataBase64: string): ArrayBuffer {
  const binary = atob(dataBase64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

export function encodeFileRecord(file: FileRecord): EncodedFileRecord {
  return {
    name: file.name,
    type: file.type,
    dataBase64: arrayBufferToBase64(file.data),
  }
}

export function decodeFileRecord(file: EncodedFileRecord): FileRecord {
  return {
    name: file.name,
    type: file.type,
    data: base64ToArrayBuffer(file.dataBase64),
  }
}
```

- [ ] **Step 5: Run serialization tests**

Run:

```powershell
npm run test -- src/services/sync/serialization.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add src/services/sync/types.ts src/services/sync/serialization.ts src/services/sync/serialization.test.ts
git commit -m "feat: add sync data types"
```

---

### Task 2: Pure Merge Engine

**Files:**
- Create: `src/services/sync/merge.ts`
- Create: `src/services/sync/merge.test.ts`
- Modify: `src/services/sync/types.ts`

- [ ] **Step 1: Write failing merge tests**

Create `src/services/sync/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SYNC_SCHEMA_VERSION, type RemoteSyncState } from './types'
import { mergeSyncStates } from './merge'

function emptyState(deviceId: string, updatedAt: string): RemoteSyncState {
  return {
    syncVersion: SYNC_SCHEMA_VERSION,
    updatedAt,
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

describe('mergeSyncStates', () => {
  it('unions quiz sessions by id', () => {
    const local = emptyState('local-device', '2026-06-01T10:00:00.000Z')
    const remote = emptyState('remote-device', '2026-06-01T11:00:00.000Z')
    local.data.quizSessions.push({
      id: 'session-local',
      examId: 'exam-1',
      date: '2026-06-01T10:00:00.000Z',
      score: 2,
      total: 3,
      totalTime: 60,
      timeLimitSeconds: null,
      completedByTimeout: false,
      macroargomenti: [],
      errors: ['q1'],
      unanswered: [],
      isReview: false,
      updatedByDeviceId: 'local-device',
    })
    remote.data.quizSessions.push({
      id: 'session-remote',
      examId: 'exam-1',
      date: '2026-06-01T11:00:00.000Z',
      score: 3,
      total: 3,
      totalTime: 45,
      timeLimitSeconds: null,
      completedByTimeout: false,
      macroargomenti: [],
      errors: [],
      unanswered: [],
      isReview: false,
      updatedByDeviceId: 'remote-device',
    })

    const result = mergeSyncStates(local, remote, 'local-device', '2026-06-01T12:00:00.000Z')

    expect(result.conflicts).toEqual([])
    expect(result.state.data.quizSessions.map((session) => session.id).sort()).toEqual([
      'session-local',
      'session-remote',
    ])
  })

  it('merges question stats by preserving per-device counters and aggregate totals', () => {
    const local = emptyState('local-device', '2026-06-01T10:00:00.000Z')
    const remote = emptyState('remote-device', '2026-06-01T11:00:00.000Z')
    local.data.questionStats.push({
      id: 'exam-1__q1',
      examId: 'exam-1',
      questionId: 'q1',
      deviceCounters: {
        'local-device': { timesShown: 2, timesCorrect: 1 },
      },
    })
    remote.data.questionStats.push({
      id: 'exam-1__q1',
      examId: 'exam-1',
      questionId: 'q1',
      deviceCounters: {
        'remote-device': { timesShown: 3, timesCorrect: 2 },
      },
    })

    const result = mergeSyncStates(local, remote, 'local-device', '2026-06-01T12:00:00.000Z')

    expect(result.conflicts).toEqual([])
    expect(result.state.data.questionStats).toEqual([
      {
        id: 'exam-1__q1',
        examId: 'exam-1',
        questionId: 'q1',
        deviceCounters: {
          'local-device': { timesShown: 2, timesCorrect: 1 },
          'remote-device': { timesShown: 3, timesCorrect: 2 },
        },
      },
    ])
  })

  it('keeps the newest flashcard stat by lastSeen', () => {
    const local = emptyState('local-device', '2026-06-01T10:00:00.000Z')
    const remote = emptyState('remote-device', '2026-06-01T11:00:00.000Z')
    local.data.flashcardStats.push({
      id: 'exam-1__f1',
      examId: 'exam-1',
      cardId: 'f1',
      lastEval: 'No',
      lastSeen: '2026-06-01T10:00:00.000Z',
      updatedByDeviceId: 'local-device',
    })
    remote.data.flashcardStats.push({
      id: 'exam-1__f1',
      examId: 'exam-1',
      cardId: 'f1',
      lastEval: 'Sì',
      lastSeen: '2026-06-01T11:00:00.000Z',
      updatedByDeviceId: 'remote-device',
    })

    const result = mergeSyncStates(local, remote, 'local-device', '2026-06-01T12:00:00.000Z')

    expect(result.conflicts).toEqual([])
    expect(result.state.data.flashcardStats[0].lastEval).toBe('Sì')
  })

  it('marks delete versus newer exam update as a conflict', () => {
    const local = emptyState('local-device', '2026-06-01T12:00:00.000Z')
    const remote = emptyState('remote-device', '2026-06-01T11:00:00.000Z')
    local.tombstones.push({
      id: 'exam-1',
      kind: 'exam',
      deletedAt: '2026-06-01T10:00:00.000Z',
      deletedByDeviceId: 'local-device',
    })
    remote.data.esami.push({
      id: 'exam-1',
      name: 'Updated remotely',
      createdAt: '2026-06-01T09:00:00.000Z',
      files: {},
      updatedAt: '2026-06-01T11:00:00.000Z',
      updatedByDeviceId: 'remote-device',
    })

    const result = mergeSyncStates(local, remote, 'local-device', '2026-06-01T12:00:00.000Z')

    expect(result.conflicts).toEqual([
      {
        id: 'exam-1',
        kind: 'exam-delete-vs-update',
        localUpdatedAt: '2026-06-01T10:00:00.000Z',
        remoteUpdatedAt: '2026-06-01T11:00:00.000Z',
        localDeviceId: 'local-device',
        remoteDeviceId: 'remote-device',
      },
    ])
  })
})
```

- [ ] **Step 2: Run the failing merge tests**

Run:

```powershell
npm run test -- src/services/sync/merge.test.ts --run
```

Expected: FAIL because `merge.ts` does not exist.

- [ ] **Step 3: Implement merge helpers**

Create `src/services/sync/merge.ts`:

```ts
import { SYNC_SCHEMA_VERSION, type MergeResult, type RemoteSyncState, type SyncConflict, type SyncExamRecord, type SyncFlashcardStatRecord, type SyncQuestionStatRecord, type SyncQuizSessionRecord, type SyncTombstone } from './types'

function byId<T extends { id: string }>(records: T[]): Map<string, T> {
  return new Map(records.map((record) => [record.id, record]))
}

function newestByTimestamp<T>(left: T, right: T, getTimestamp: (record: T) => string): T {
  return getTimestamp(left) >= getTimestamp(right) ? left : right
}

function mergeQuizSessions(
  local: SyncQuizSessionRecord[],
  remote: SyncQuizSessionRecord[],
): { records: SyncQuizSessionRecord[]; conflicts: SyncConflict[] } {
  const merged = byId(remote)
  const conflicts: SyncConflict[] = []

  for (const localRecord of local) {
    const remoteRecord = merged.get(localRecord.id)
    if (!remoteRecord) {
      merged.set(localRecord.id, localRecord)
      continue
    }

    if (JSON.stringify(localRecord) !== JSON.stringify(remoteRecord)) {
      const winner = newestByTimestamp(localRecord, remoteRecord, (record) => record.date)
      merged.set(localRecord.id, winner)
      conflicts.push({
        id: localRecord.id,
        kind: 'duplicate-quiz-session',
        localUpdatedAt: localRecord.date,
        remoteUpdatedAt: remoteRecord.date,
        localDeviceId: localRecord.updatedByDeviceId,
        remoteDeviceId: remoteRecord.updatedByDeviceId,
      })
    }
  }

  return { records: [...merged.values()].sort((a, b) => a.id.localeCompare(b.id)), conflicts }
}

function mergeQuestionStats(
  local: SyncQuestionStatRecord[],
  remote: SyncQuestionStatRecord[],
): SyncQuestionStatRecord[] {
  const merged = byId(remote)

  for (const localRecord of local) {
    const existing = merged.get(localRecord.id)
    if (!existing) {
      merged.set(localRecord.id, localRecord)
      continue
    }

    merged.set(localRecord.id, {
      id: localRecord.id,
      examId: localRecord.examId,
      questionId: localRecord.questionId,
      deviceCounters: {
        ...existing.deviceCounters,
        ...localRecord.deviceCounters,
      },
    })
  }

  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function mergeFlashcardStats(
  local: SyncFlashcardStatRecord[],
  remote: SyncFlashcardStatRecord[],
): SyncFlashcardStatRecord[] {
  const merged = byId(remote)

  for (const localRecord of local) {
    const existing = merged.get(localRecord.id)
    merged.set(
      localRecord.id,
      existing ? newestByTimestamp(localRecord, existing, (record) => record.lastSeen) : localRecord,
    )
  }

  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function mergeTombstones(local: SyncTombstone[], remote: SyncTombstone[]): SyncTombstone[] {
  const merged = byId(remote)

  for (const localRecord of local) {
    const existing = merged.get(localRecord.id)
    merged.set(
      localRecord.id,
      existing ? newestByTimestamp(localRecord, existing, (record) => record.deletedAt) : localRecord,
    )
  }

  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function mergeExams(
  local: SyncExamRecord[],
  remote: SyncExamRecord[],
  tombstones: SyncTombstone[],
): { records: SyncExamRecord[]; conflicts: SyncConflict[] } {
  const merged = byId(remote)
  const conflicts: SyncConflict[] = []
  const tombstoneById = byId(tombstones.filter((tombstone) => tombstone.kind === 'exam'))

  for (const localRecord of local) {
    const existing = merged.get(localRecord.id)
    merged.set(
      localRecord.id,
      existing ? newestByTimestamp(localRecord, existing, (record) => record.updatedAt) : localRecord,
    )
  }

  for (const [examId, tombstone] of tombstoneById) {
    const record = merged.get(examId)
    if (!record) continue

    if (tombstone.deletedAt >= record.updatedAt) {
      merged.delete(examId)
      continue
    }

    conflicts.push({
      id: examId,
      kind: 'exam-delete-vs-update',
      localUpdatedAt: tombstone.deletedAt,
      remoteUpdatedAt: record.updatedAt,
      localDeviceId: tombstone.deletedByDeviceId,
      remoteDeviceId: record.updatedByDeviceId,
    })
  }

  return { records: [...merged.values()].sort((a, b) => a.id.localeCompare(b.id)), conflicts }
}

export function mergeSyncStates(
  local: RemoteSyncState,
  remote: RemoteSyncState,
  writerDeviceId: string,
  nowIso: string,
): MergeResult {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones)
  const quizSessions = mergeQuizSessions(local.data.quizSessions, remote.data.quizSessions)
  const exams = mergeExams(local.data.esami, remote.data.esami, tombstones)

  return {
    state: {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: nowIso,
      writerDeviceId,
      data: {
        esami: exams.records,
        quizSessions: quizSessions.records,
        questionStats: mergeQuestionStats(local.data.questionStats, remote.data.questionStats),
        flashcardStats: mergeFlashcardStats(local.data.flashcardStats, remote.data.flashcardStats),
      },
      tombstones,
    },
    conflicts: [...quizSessions.conflicts, ...exams.conflicts],
  }
}
```

- [ ] **Step 4: Run merge tests**

Run:

```powershell
npm run test -- src/services/sync/merge.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/services/sync/merge.ts src/services/sync/merge.test.ts src/services/sync/types.ts
git commit -m "feat: add sync merge engine"
```

---

### Task 3: IndexedDB Sync Metadata And Export

**Files:**
- Modify: `src/services/storageService.ts`
- Modify: `src/services/storageService.test.ts`

- [ ] **Step 1: Write failing storage tests**

Append these tests to `src/services/storageService.test.ts` inside the `describe('storageService', () => { ... })` block:

```ts
  it('creates stable sync metadata with a device id', async () => {
    const first = await getSyncMetadata()
    const second = await getSyncMetadata()

    expect(first.id).toBe('sync')
    expect(first.deviceId).toEqual(expect.any(String))
    expect(first.deviceId.length).toBeGreaterThan(10)
    expect(first).toEqual(second)
    expect(first.pendingLocalChanges).toBe(false)
    expect(first.syncSchemaVersion).toBe(1)
  })

  it('marks syncable writes as pending local changes', async () => {
    await saveEsame(exam)

    await expect(getSyncMetadata()).resolves.toMatchObject({
      pendingLocalChanges: true,
    })
  })

  it('exports syncable data and excludes paused sessions', async () => {
    await saveEsame(exam)
    await saveQuizSession(makeQuizSession({ id: 'quiz-1', examId: exam.id }))
    await saveQuestionStat(questionStat({ id: 'exam-1__q1', examId: exam.id }))
    await saveFlashcardStat(flashcardStat({ id: 'exam-1__f1', examId: exam.id }))
    await savePausedSession(makePausedQuiz({ id: 'exam-1__quiz', examId: exam.id }))

    const exported = await exportLocalSyncState()

    expect(exported.state.data.esami).toHaveLength(1)
    expect(exported.state.data.quizSessions).toHaveLength(1)
    expect(exported.state.data.questionStats).toHaveLength(1)
    expect(exported.state.data.flashcardStats).toHaveLength(1)
    expect(JSON.stringify(exported.state)).not.toContain('pausedSessions')
    expect(exported.revision).toBeNull()
  })
```

Add imports at the top of the same file:

```ts
  exportLocalSyncState,
  getSyncMetadata,
```

- [ ] **Step 2: Run failing storage tests**

Run:

```powershell
npm run test -- src/services/storageService.test.ts --run
```

Expected: FAIL because `getSyncMetadata` and `exportLocalSyncState` do not exist.

- [ ] **Step 3: Update DB schema and imports**

In `src/services/storageService.ts`, add imports:

```ts
import { v4 as uuidv4 } from 'uuid'
import { encodeFileRecord } from './sync/serialization'
import {
  SYNC_SCHEMA_VERSION,
  type LocalSyncRecordMetadata,
  type RemoteSyncState,
  type SyncDirtyStore,
  type SyncMetadata,
} from './sync/types'
```

Update constants:

```ts
const DB_VERSION = 3
const SYNC_METADATA_ID = 'sync'
```

Extend `StudyAppDB`:

```ts
  syncMetadata: {
    key: string
    value: SyncMetadata
  }
  syncRecordMetadata: {
    key: string
    value: LocalSyncRecordMetadata
    indexes: { 'by-store': SyncDirtyStore }
  }
  syncTombstones: {
    key: string
    value: import('./sync/types').SyncTombstone
  }
```

In `upgrade`, add:

```ts
      if (oldVersion < 3) {
        db.createObjectStore('syncMetadata', { keyPath: 'id' })
        const syncRecordMetadata = db.createObjectStore('syncRecordMetadata', { keyPath: 'id' })
        syncRecordMetadata.createIndex('by-store', 'store')
        db.createObjectStore('syncTombstones', { keyPath: 'id' })
      }
```

- [ ] **Step 4: Add sync metadata helpers**

Add these functions near the bottom of `src/services/storageService.ts`:

```ts
export async function getSyncMetadata(): Promise<SyncMetadata> {
  const db = await getDB()
  const existing = await db.get('syncMetadata', SYNC_METADATA_ID)

  if (existing) return existing

  const created: SyncMetadata = {
    id: SYNC_METADATA_ID,
    deviceId: uuidv4(),
    lastSyncedAt: null,
    lastRemoteRevision: null,
    pendingLocalChanges: false,
    syncSchemaVersion: SYNC_SCHEMA_VERSION,
    account: null,
  }

  await db.put('syncMetadata', created)
  return created
}

async function saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
  await (await getDB()).put('syncMetadata', metadata)
}

async function markSyncDirty(store: SyncDirtyStore, recordId: string): Promise<void> {
  const metadata = await getSyncMetadata()
  const now = new Date().toISOString()
  const db = await getDB()
  const tx = db.transaction(['syncMetadata', 'syncRecordMetadata'], 'readwrite')

  await tx.objectStore('syncMetadata').put({
    ...metadata,
    pendingLocalChanges: true,
  })
  await tx.objectStore('syncRecordMetadata').put({
    id: `${store}__${recordId}`,
    store,
    recordId,
    updatedAt: now,
    updatedByDeviceId: metadata.deviceId,
  })
  await tx.done
}
```

- [ ] **Step 5: Mark existing syncable writes dirty**

In `saveEsame`, replace:

```ts
  await (await getDB()).put('esami', esame)
```

with:

```ts
  await (await getDB()).put('esami', esame)
  await markSyncDirty('esami', esame.id)
```

In `saveQuizSession`, `saveQuestionStat`, and `saveFlashcardStat`, add the matching dirty calls after the existing `put`:

```ts
  await markSyncDirty('quizSessions', session.id)
```

```ts
  await markSyncDirty('questionStats', stat.id)
```

```ts
  await markSyncDirty('flashcardStats', stat.id)
```

In `replaceQuizFileForExam`, add sync metadata to the existing transaction by including `syncMetadata` and `syncRecordMetadata` in the transaction store list, loading metadata with `await tx.objectStore('syncMetadata').get(SYNC_METADATA_ID) ?? await getSyncMetadata()`, and adding these writes before `await tx.done`:

```ts
  const syncMetadata = await tx.objectStore('syncMetadata').get(SYNC_METADATA_ID) ?? await getSyncMetadata()
  const now = new Date().toISOString()

  await tx.objectStore('syncMetadata').put({
    ...syncMetadata,
    pendingLocalChanges: true,
  })
  await tx.objectStore('syncRecordMetadata').put({
    id: `esami__${examId}`,
    store: 'esami',
    recordId: examId,
    updatedAt: now,
    updatedByDeviceId: syncMetadata.deviceId,
  })
```

Apply the same transaction-local dirty marker in `replaceFlashcardFileForExam`.

In `deleteEsame`, include `syncMetadata`, `syncRecordMetadata`, and `syncTombstones` in the transaction store list. Add this before `await tx.done`:

```ts
  const syncMetadata = await tx.objectStore('syncMetadata').get(SYNC_METADATA_ID) ?? await getSyncMetadata()
  const now = new Date().toISOString()

  await tx.objectStore('syncMetadata').put({
    ...syncMetadata,
    pendingLocalChanges: true,
  })
  await tx.objectStore('syncRecordMetadata').delete(`esami__${id}`)
  await tx.objectStore('syncTombstones').put({
    id,
    kind: 'exam',
    deletedAt: now,
    deletedByDeviceId: syncMetadata.deviceId,
  })
```

- [ ] **Step 6: Add export helper**

Add this function to `src/services/storageService.ts`:

```ts
export async function exportLocalSyncState(): Promise<{ state: RemoteSyncState; revision: string | null }> {
  const db = await getDB()
  const metadata = await getSyncMetadata()
  const [esami, quizSessions, questionStats, flashcardStats, tombstones] = await Promise.all([
    db.getAll('esami'),
    db.getAll('quizSessions'),
    db.getAll('questionStats'),
    db.getAll('flashcardStats'),
    db.getAll('syncTombstones'),
  ])

  return {
    revision: metadata.lastRemoteRevision,
    state: {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      writerDeviceId: metadata.deviceId,
      data: {
        esami: esami.map((esame) => ({
          ...esame,
          files: Object.fromEntries(
            Object.entries(esame.files).map(([slot, file]) => [slot, encodeFileRecord(file)]),
          ),
          updatedAt: esame.createdAt,
          updatedByDeviceId: metadata.deviceId,
        })),
        quizSessions: quizSessions.map((session) => ({
          ...session,
          updatedByDeviceId: metadata.deviceId,
        })),
        questionStats: questionStats.map((stat) => ({
          id: stat.id,
          examId: stat.examId,
          questionId: stat.questionId,
          deviceCounters: {
            [metadata.deviceId]: {
              timesShown: stat.timesShown,
              timesCorrect: stat.timesCorrect,
            },
          },
        })),
        flashcardStats: flashcardStats.map((stat) => ({
          ...stat,
          updatedByDeviceId: metadata.deviceId,
        })),
      },
      tombstones,
    },
  }
}
```

- [ ] **Step 7: Run storage tests and fix transaction conflicts**

Run:

```powershell
npm run test -- src/services/storageService.test.ts --run
```

Expected: PASS after ensuring all syncable writes mark dirty and existing tests still pass.

- [ ] **Step 8: Run full test suite**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```powershell
git add src/services/storageService.ts src/services/storageService.test.ts
git commit -m "feat: export local sync state"
```

---

### Task 4: Import Merged Sync State Into IndexedDB

**Files:**
- Modify: `src/services/storageService.ts`
- Modify: `src/services/storageService.test.ts`

- [ ] **Step 1: Write failing import tests**

Append to `src/services/storageService.test.ts`:

```ts
  it('imports merged sync state and aggregates question stat device counters', async () => {
    const metadata = await getSyncMetadata()
    const importedExam = makeEsame({ id: 'exam-imported', name: 'Importato' })

    await importMergedSyncState(
      {
        syncVersion: 1,
        updatedAt: '2026-06-02T10:00:00.000Z',
        writerDeviceId: 'remote-device',
        data: {
          esami: [
            {
              ...importedExam,
              files: {},
              updatedAt: '2026-06-02T09:00:00.000Z',
              updatedByDeviceId: 'remote-device',
            },
          ],
          quizSessions: [],
          questionStats: [
            {
              id: 'exam-imported__q1',
              examId: 'exam-imported',
              questionId: 'q1',
              deviceCounters: {
                [metadata.deviceId]: { timesShown: 2, timesCorrect: 1 },
                'remote-device': { timesShown: 3, timesCorrect: 2 },
              },
            },
          ],
          flashcardStats: [],
        },
        tombstones: [],
      },
      'remote-revision-1',
      '2026-06-02T10:05:00.000Z',
    )

    await expect(getEsame('exam-imported')).resolves.toEqual(importedExam)
    await expect(getQuestionStats('exam-imported')).resolves.toEqual([
      {
        id: 'exam-imported__q1',
        examId: 'exam-imported',
        questionId: 'q1',
        timesShown: 5,
        timesCorrect: 3,
      },
    ])
    await expect(getSyncMetadata()).resolves.toMatchObject({
      lastRemoteRevision: 'remote-revision-1',
      lastSyncedAt: '2026-06-02T10:05:00.000Z',
      pendingLocalChanges: false,
    })
  })
```

Add import:

```ts
  importMergedSyncState,
```

- [ ] **Step 2: Run failing import tests**

Run:

```powershell
npm run test -- src/services/storageService.test.ts --run
```

Expected: FAIL because `importMergedSyncState` does not exist.

- [ ] **Step 3: Implement import helper**

Add imports to `src/services/storageService.ts`:

```ts
import { decodeFileRecord } from './sync/serialization'
```

Add this function:

```ts
export async function importMergedSyncState(
  state: RemoteSyncState,
  remoteRevision: string,
  syncedAt: string,
): Promise<void> {
  const metadata = await getSyncMetadata()
  const db = await getDB()
  const tx = db.transaction(
    [
      'esami',
      'quizSessions',
      'questionStats',
      'flashcardStats',
      'syncMetadata',
      'syncRecordMetadata',
      'syncTombstones',
    ],
    'readwrite',
  )

  await Promise.all([
    tx.objectStore('esami').clear(),
    tx.objectStore('quizSessions').clear(),
    tx.objectStore('questionStats').clear(),
    tx.objectStore('flashcardStats').clear(),
    tx.objectStore('syncRecordMetadata').clear(),
    tx.objectStore('syncTombstones').clear(),
  ])

  await Promise.all(
    state.data.esami.map((record) =>
      tx.objectStore('esami').put({
        id: record.id,
        name: record.name,
        createdAt: record.createdAt,
        files: Object.fromEntries(
          Object.entries(record.files).map(([slot, file]) => [slot, decodeFileRecord(file)]),
        ),
      }),
    ),
  )
  await Promise.all(state.data.quizSessions.map((record) => tx.objectStore('quizSessions').put(record)))
  await Promise.all(
    state.data.questionStats.map((record) => {
      const aggregate = Object.values(record.deviceCounters).reduce(
        (total, counter) => ({
          timesShown: total.timesShown + counter.timesShown,
          timesCorrect: total.timesCorrect + counter.timesCorrect,
        }),
        { timesShown: 0, timesCorrect: 0 },
      )

      return tx.objectStore('questionStats').put({
        id: record.id,
        examId: record.examId,
        questionId: record.questionId,
        ...aggregate,
      })
    }),
  )
  await Promise.all(state.data.flashcardStats.map((record) => tx.objectStore('flashcardStats').put(record)))
  await Promise.all(state.tombstones.map((record) => tx.objectStore('syncTombstones').put(record)))
  await tx.objectStore('syncMetadata').put({
    ...metadata,
    lastRemoteRevision: remoteRevision,
    lastSyncedAt: syncedAt,
    pendingLocalChanges: false,
  })

  await tx.done
}
```

- [ ] **Step 4: Run storage tests**

Run:

```powershell
npm run test -- src/services/storageService.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add src/services/storageService.ts src/services/storageService.test.ts
git commit -m "feat: import merged sync state"
```

---

### Task 5: Fake Provider And Sync Service

**Files:**
- Create: `src/services/sync/fakeSyncProvider.ts`
- Create: `src/services/sync/syncService.ts`
- Create: `src/services/sync/syncService.test.ts`

- [ ] **Step 1: Write failing sync service tests**

Create `src/services/sync/syncService.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSyncProvider } from './fakeSyncProvider'
import { createSyncService } from './syncService'
import { SYNC_SCHEMA_VERSION, type RemoteSyncState } from './types'

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
})
```

- [ ] **Step 2: Run failing sync service tests**

Run:

```powershell
npm run test -- src/services/sync/syncService.test.ts --run
```

Expected: FAIL because fake provider and sync service do not exist.

- [ ] **Step 3: Implement fake provider**

Create `src/services/sync/fakeSyncProvider.ts`:

```ts
import { RemoteRevisionMismatchError, type RemoteSyncState, type SyncAccount, type SyncProvider } from './types'

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
```

- [ ] **Step 4: Implement sync service**

Create `src/services/sync/syncService.ts`:

```ts
import { mergeSyncStates } from './merge'
import { RemoteRevisionMismatchError, type LocalSyncExport, type RemoteSyncState, type SyncProvider, type SyncStatus } from './types'

interface SyncServiceDependencies {
  provider: SyncProvider
  getLocalExport(): Promise<{ state: RemoteSyncState; revision: string | null }>
  importMergedSyncState(state: RemoteSyncState, remoteRevision: string, syncedAt: string): Promise<void>
  getDeviceId(): Promise<string>
}

export interface SyncService {
  getStatus(): SyncStatus
  signIn(): Promise<SyncStatus>
  signOut(): Promise<SyncStatus>
  syncNow(): Promise<SyncStatus>
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
        const remote = await dependencies.provider.readRemoteState()
        const nowIso = new Date().toISOString()
        const deviceId = await dependencies.getDeviceId()
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
        if (error instanceof RemoteRevisionMismatchError) {
          return setStatus({
            ...status,
            kind: 'failed',
            account,
            pendingChanges: true,
            message: 'Lo stato remoto è cambiato. Riprova la sincronizzazione.',
            conflicts: [],
          })
        }

        return setStatus({
          ...status,
          kind: navigator.onLine === false ? 'offline' : 'failed',
          account,
          pendingChanges: true,
          message: error instanceof Error ? error.message : 'Sincronizzazione non riuscita',
          conflicts: [],
        })
      }
    },
  }
}
```

- [ ] **Step 5: Run sync service tests**

Run:

```powershell
npm run test -- src/services/sync/syncService.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```powershell
git add src/services/sync/fakeSyncProvider.ts src/services/sync/syncService.ts src/services/sync/syncService.test.ts
git commit -m "feat: add sync orchestration"
```

---

### Task 6: React Sync Hook And Home Status UI

**Files:**
- Create: `src/hooks/useSync.ts`
- Create: `src/hooks/useSync.test.ts`
- Create: `src/components/SyncStatus.tsx`
- Create: `src/components/SyncStatus.test.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write failing SyncStatus component tests**

Create `src/components/SyncStatus.test.tsx`:

```tsx
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
})
```

- [ ] **Step 2: Implement SyncStatus component**

Create `src/components/SyncStatus.tsx`:

```tsx
import type { SyncStatus as SyncStatusModel } from '../services/sync/types'

interface SyncStatusProps {
  status: SyncStatusModel
  onSignIn(): Promise<void>
  onSignOut(): Promise<void>
  onSyncNow(): Promise<void>
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

export function SyncStatus({ status, onSignIn, onSignOut, onSyncNow }: SyncStatusProps) {
  const isBusy = status.kind === 'signing-in' || status.kind === 'syncing'

  return (
    <section className="sync-status" aria-label="Sincronizzazione">
      <div>
        <p className="sync-status__title">Google Drive</p>
        <p className="sync-status__text">
          {status.account ? `${status.account.email} - ${statusLabel(status)}` : statusLabel(status)}
        </p>
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
    </section>
  )
}
```

- [ ] **Step 3: Add styles**

Append to `src/index.css`:

```css
.sync-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-surface);
}

.sync-status__title {
  margin: 0 0 0.15rem;
  font-weight: 700;
}

.sync-status__text {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.92rem;
}

.sync-status__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.sync-status__actions button {
  min-height: 40px;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text);
}

@media (max-width: 640px) {
  .sync-status {
    align-items: stretch;
    flex-direction: column;
  }
}
```

- [ ] **Step 4: Create useSync hook with fake provider default**

Create `src/hooks/useSync.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { exportLocalSyncState, getSyncMetadata, importMergedSyncState } from '../services/storageService'
import { createFakeSyncProvider } from '../services/sync/fakeSyncProvider'
import { createSyncService } from '../services/sync/syncService'
import type { SyncStatus } from '../services/sync/types'

export function useSync() {
  const service = useMemo(
    () =>
      createSyncService({
        provider: createFakeSyncProvider(),
        getLocalExport: exportLocalSyncState,
        importMergedSyncState,
        getDeviceId: async () => (await getSyncMetadata()).deviceId,
      }),
    [],
  )
  const [status, setStatus] = useState<SyncStatus>(service.getStatus())

  const signIn = useCallback(async () => {
    setStatus(await service.signIn())
    setStatus(await service.syncNow())
  }, [service])

  const signOut = useCallback(async () => {
    setStatus(await service.signOut())
  }, [service])

  const syncNow = useCallback(async () => {
    setStatus(await service.syncNow())
  }, [service])

  useEffect(() => {
    void service.syncNow().then(setStatus)
  }, [service])

  return { status, signIn, signOut, syncNow }
}
```

- [ ] **Step 5: Render SyncStatus on HomePage**

Modify `src/pages/HomePage.tsx` imports:

```ts
import { SyncStatus } from '../components/SyncStatus'
import { useSync } from '../hooks/useSync'
```

Inside `HomePage`, after `useExam()`:

```ts
  const sync = useSync()
```

Render immediately under the header:

```tsx
      <SyncStatus
        status={sync.status}
        onSignIn={sync.signIn}
        onSignOut={sync.signOut}
        onSyncNow={sync.syncNow}
      />
```

- [ ] **Step 6: Update HomePage tests to mock useSync**

In `src/pages/HomePage.test.tsx`, add:

```ts
const syncSignIn = vi.fn()
const syncSignOut = vi.fn()
const syncNow = vi.fn()

vi.mock('../hooks/useSync', () => ({
  useSync: () => ({
    status: {
      kind: 'signed-out',
      account: null,
      lastSyncedAt: null,
      pendingChanges: false,
      message: null,
      conflicts: [],
    },
    signIn: syncSignIn,
    signOut: syncSignOut,
    syncNow,
  }),
}))
```

Add assertion to the loading/empty-state test:

```ts
    expect(screen.getByLabelText('Sincronizzazione')).not.toBeNull()
```

- [ ] **Step 7: Run UI tests**

Run:

```powershell
npm run test -- src/components/SyncStatus.test.tsx src/pages/HomePage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 8: Run full test suite**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 9: Commit Task 6**

```powershell
git add src/hooks/useSync.ts src/components/SyncStatus.tsx src/components/SyncStatus.test.tsx src/pages/HomePage.tsx src/pages/HomePage.test.tsx src/index.css
git commit -m "feat: show sync status on home"
```

---

### Task 7: Automatic Sync Triggers

**Files:**
- Modify: `src/hooks/useSync.ts`
- Create: `src/hooks/useAutomaticSync.ts`
- Create: `src/hooks/useAutomaticSync.test.ts`

- [ ] **Step 1: Write failing automatic sync hook tests**

Create `src/hooks/useAutomaticSync.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutomaticSync } from './useAutomaticSync'

describe('useAutomaticSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs sync on startup and on online events', async () => {
    const syncNow = vi.fn().mockResolvedValue(undefined)

    renderHook(() => useAutomaticSync(syncNow))
    await vi.runAllTimersAsync()

    expect(syncNow).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('online'))
    await vi.runAllTimersAsync()

    expect(syncNow).toHaveBeenCalledTimes(2)
  })

  it('debounces requested sync', async () => {
    const syncNow = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutomaticSync(syncNow))

    result.current.requestSync()
    result.current.requestSync()
    vi.advanceTimersByTime(799)
    expect(syncNow).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(syncNow).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Implement automatic sync hook**

Create `src/hooks/useAutomaticSync.ts`:

```ts
import { useCallback, useEffect, useRef } from 'react'

export function useAutomaticSync(syncNow: () => Promise<void>, debounceMs = 800) {
  const syncNowRef = useRef(syncNow)
  const timeoutRef = useRef<number | null>(null)

  syncNowRef.current = syncNow

  const requestSync = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      void syncNowRef.current()
    }, debounceMs)
  }, [debounceMs])

  useEffect(() => {
    void syncNowRef.current()

    function handleOnline() {
      requestSync()
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', requestSync)

    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', requestSync)
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [requestSync])

  return { requestSync }
}
```

- [ ] **Step 3: Wire automatic sync into useSync**

Modify `src/hooks/useSync.ts`:

```ts
import { useAutomaticSync } from './useAutomaticSync'
```

Before return:

```ts
  const automaticSync = useAutomaticSync(syncNow)
```

Return:

```ts
  return { status, signIn, signOut, syncNow, requestSync: automaticSync.requestSync }
```

- [ ] **Step 4: Run automatic sync tests**

Run:

```powershell
npm run test -- src/hooks/useAutomaticSync.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```powershell
git add src/hooks/useAutomaticSync.ts src/hooks/useAutomaticSync.test.ts src/hooks/useSync.ts
git commit -m "feat: add automatic sync triggers"
```

---

### Task 8: Google Drive Provider

**Files:**
- Create: `src/services/sync/googleDriveSyncProvider.ts`
- Create: `src/services/sync/googleDriveSyncProvider.test.ts`
- Modify: `src/hooks/useSync.ts`
- Create: `.env.example`

- [ ] **Step 1: Write failing provider tests**

Create `src/services/sync/googleDriveSyncProvider.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGoogleDriveSyncProvider } from './googleDriveSyncProvider'

describe('googleDriveSyncProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('reads missing remote state as null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] }),
    } as Response)

    const provider = createGoogleDriveSyncProvider({
      clientId: 'client-id',
      getAccessToken: async () => 'token',
    })

    await expect(provider.readRemoteState()).resolves.toEqual({ state: null, revision: null })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('spaces=appDataFolder'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
      }),
    )
  })

  it('writes remote state with appDataFolder parent', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-1', version: '7', modifiedTime: '2026-06-01T12:00:00.000Z' }),
      } as Response)

    const provider = createGoogleDriveSyncProvider({
      clientId: 'client-id',
      getAccessToken: async () => 'token',
    })

    const result = await provider.writeRemoteState(
      {
        syncVersion: 1,
        updatedAt: '2026-06-01T12:00:00.000Z',
        writerDeviceId: 'device',
        data: { esami: [], quizSessions: [], questionStats: [], flashcardStats: [] },
        tombstones: [],
      },
      null,
    )

    expect(result.revision).toBe('7')
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/upload/drive/v3/files'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    )
  })
})
```

- [ ] **Step 2: Implement Google provider request layer**

Create `src/services/sync/googleDriveSyncProvider.ts`:

```ts
import { RemoteRevisionMismatchError, type RemoteSyncState, type SyncAccount, type SyncProvider } from './types'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const SYNC_FILE_NAME = 'study-app-sync-state.json'

interface GoogleDriveProviderOptions {
  clientId: string
  getAccessToken?: () => Promise<string>
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Google Drive request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function createGoogleDriveSyncProvider(options: GoogleDriveProviderOptions): SyncProvider {
  let account: SyncAccount | null = null

  async function getToken(): Promise<string> {
    if (options.getAccessToken) return options.getAccessToken()

    const google = (window as typeof window & {
      google?: {
        accounts: {
          oauth2: {
            initTokenClient(config: {
              client_id: string
              scope: string
              callback(response: { access_token?: string; error?: string }): void
            }): { requestAccessToken(): void }
          }
        }
      }
    }).google

    if (!google) throw new Error('Google Identity Services non disponibile')

    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: options.clientId,
        scope: DRIVE_SCOPE,
        callback(response) {
          if (response.error || !response.access_token) {
            reject(new Error(response.error ?? 'Accesso Google non riuscito'))
            return
          }

          resolve(response.access_token)
        },
      })

      client.requestAccessToken()
    })
  }

  async function findSyncFile(token: string): Promise<{ id: string; version: string } | null> {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      fields: 'files(id,name,version)',
      q: `name='${SYNC_FILE_NAME}'`,
    })
    const result = await parseJsonResponse<{ files: { id: string; version: string }[] }>(
      await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    )

    return result.files[0] ?? null
  }

  return {
    async getAccount() {
      return account
    },
    async signIn() {
      await getToken()
      account = {
        id: 'google-drive',
        email: 'Google Drive',
        provider: 'google-drive',
      }
      return account
    },
    async signOut() {
      account = null
    },
    async readRemoteState() {
      const token = await getToken()
      const file = await findSyncFile(token)
      if (!file) return { state: null, revision: null }

      const state = await parseJsonResponse<RemoteSyncState>(
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )

      return { state, revision: file.version }
    },
    async writeRemoteState(state, expectedRevision) {
      const token = await getToken()
      const existing = await findSyncFile(token)

      if (expectedRevision !== null && existing?.version !== expectedRevision) {
        throw new RemoteRevisionMismatchError()
      }

      const metadata = {
        name: SYNC_FILE_NAME,
        parents: existing ? undefined : ['appDataFolder'],
        mimeType: 'application/json',
      }
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append('file', new Blob([JSON.stringify(state)], { type: 'application/json' }))

      const url = existing
        ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,version,modifiedTime`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version,modifiedTime'
      const response = await parseJsonResponse<{ version: string; modifiedTime: string }>(
        await fetch(url, {
          method: existing ? 'PATCH' : 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }),
      )

      return {
        revision: response.version,
        updatedAt: response.modifiedTime,
      }
    },
  }
}
```

- [ ] **Step 3: Add environment example**

Create `.env.example` if it does not exist:

```env
VITE_GOOGLE_DRIVE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

- [ ] **Step 4: Wire provider selection in useSync**

In `src/hooks/useSync.ts`, replace `createFakeSyncProvider()` with:

```ts
const provider = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID
  ? createGoogleDriveSyncProvider({ clientId: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID })
  : createFakeSyncProvider()
```

Add import:

```ts
import { createGoogleDriveSyncProvider } from '../services/sync/googleDriveSyncProvider'
```

- [ ] **Step 5: Run provider tests**

Run:

```powershell
npm run test -- src/services/sync/googleDriveSyncProvider.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 7: Commit Task 8**

```powershell
git add src/services/sync/googleDriveSyncProvider.ts src/services/sync/googleDriveSyncProvider.test.ts src/hooks/useSync.ts .env.example
git commit -m "feat: add google drive sync provider"
```

---

### Task 9: Conflict Resolution UX

**Files:**
- Modify: `src/components/SyncStatus.tsx`
- Modify: `src/components/SyncStatus.test.tsx`
- Modify: `src/services/sync/syncService.ts`
- Modify: `src/services/sync/syncService.test.ts`

- [ ] **Step 1: Write failing conflict UI test**

Append to `src/components/SyncStatus.test.tsx`:

```tsx
  it('shows conflict details and resolve action', () => {
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
      />,
    )

    expect(screen.getByText(/Conflitto da risolvere/)).not.toBeNull()
    expect(screen.getByText(/exam-1/)).not.toBeNull()
  })
```

- [ ] **Step 2: Render conflict list**

In `src/components/SyncStatus.tsx`, after action buttons:

```tsx
      {status.kind === 'conflict' && status.conflicts.length > 0 && (
        <ul className="sync-status__conflicts">
          {status.conflicts.map((conflict) => (
            <li key={`${conflict.kind}-${conflict.id}`}>
              {conflict.id}: {conflict.kind}
            </li>
          ))}
        </ul>
      )}
```

Append CSS:

```css
.sync-status__conflicts {
  grid-column: 1 / -1;
  margin: 0.5rem 0 0;
  padding-left: 1rem;
  color: var(--danger);
  font-size: 0.9rem;
}
```

- [ ] **Step 3: Add service methods for keep-local and keep-remote**

Extend `SyncService` in `src/services/sync/syncService.ts`:

```ts
  resolveConflict(choice: 'keep-local' | 'keep-remote'): Promise<SyncStatus>
```

Implementation:

```ts
    async resolveConflict(choice) {
      if (choice === 'keep-remote') {
        const remote = await dependencies.provider.readRemoteState()
        if (!remote.state || !remote.revision) return status
        await dependencies.importMergedSyncState(remote.state, remote.revision, new Date().toISOString())
        return setStatus({ ...status, kind: 'synced', pendingChanges: false, conflicts: [] })
      }

      const local = await dependencies.getLocalExport()
      const write = await dependencies.provider.writeRemoteState(local.state, null)
      await dependencies.importMergedSyncState(local.state, write.revision, new Date().toISOString())
      return setStatus({ ...status, kind: 'synced', pendingChanges: false, conflicts: [] })
    },
```

- [ ] **Step 4: Add service tests for conflict resolution**

Append to `src/services/sync/syncService.test.ts`:

```ts
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
```

- [ ] **Step 5: Run conflict tests**

Run:

```powershell
npm run test -- src/components/SyncStatus.test.tsx src/services/sync/syncService.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 7: Commit Task 9**

```powershell
git add src/components/SyncStatus.tsx src/components/SyncStatus.test.tsx src/services/sync/syncService.ts src/services/sync/syncService.test.ts src/index.css
git commit -m "feat: show sync conflicts"
```

---

### Task 10: Documentation And Manual Verification

**Files:**
- Modify: `docs/diataxis/reference/integrations.md`
- Add: `docs/diataxis/how-to/configure-google-drive-sync.md`
- Add: `docs/diataxis/how-to/verify-sync.md`

- [ ] **Step 1: Add Google Drive integration reference**

In `docs/diataxis/reference/integrations.md`, add:

```md
## Google Drive Sync

The sync feature stores app-owned data in the user's Google Drive `appDataFolder` using the `https://www.googleapis.com/auth/drive.appdata` scope. The app does not request broad Drive file access.

Runtime configuration:

- `VITE_GOOGLE_DRIVE_CLIENT_ID`: public OAuth client ID for Google Identity Services.

Synced data:

- exams
- imported quiz, flashcard, and summary files
- quiz session history
- question stats
- flashcard stats

Local-only data:

- paused sessions
- theme
- current exam selection
- active route/session state
```

- [ ] **Step 2: Add OAuth setup guide**

Create `docs/diataxis/how-to/configure-google-drive-sync.md`:

```md
# Configure Google Drive Sync

## Prerequisites

- Google Cloud project
- OAuth consent screen configured
- OAuth client ID for the app platform being tested

## Steps

1. Enable the Google Drive API in the Google Cloud project.
2. Configure the OAuth consent screen with the `drive.appdata` scope.
3. Create an OAuth client ID for the platform you are testing.
4. Set the client ID in `.env`:

   ```env
   VITE_GOOGLE_DRIVE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
   ```

5. Start the app:

   ```powershell
   npm run dev
   ```

6. Open the Home page and click `Accedi a Google Drive`.
7. Confirm the sync status changes to `Sincronizzato`.

## Notes

- The app stores sync data in `appDataFolder`, so users will not see the sync file in normal My Drive browsing.
- Normal tests use a fake provider and do not require Google credentials.
```

- [ ] **Step 3: Add manual verification guide**

Create `docs/diataxis/how-to/verify-sync.md`:

```md
# Verify Sync Across Installations

## Browser To Browser

1. Start the dev server with `npm run dev`.
2. Open the app in two browser profiles.
3. Sign in to the same Google account in both profiles.
4. In profile A, create an exam and import quiz or flashcard data.
5. Wait for the Home page status to show `Sincronizzato`.
6. In profile B, click `Sincronizza ora`.
7. Confirm the exam appears with the imported file available.

## Study Stats

1. Complete a quiz in profile A.
2. Wait for sync.
3. Sync profile B.
4. Confirm the quiz result appears in the result history.

## Conflict Smoke Test

1. Create the same exam state on two profiles.
2. Disconnect profile A from the network.
3. Delete the exam in profile A.
4. Rename the same exam in profile B and sync.
5. Reconnect profile A and sync.
6. Confirm the conflict status appears instead of silently deleting or resurrecting the exam.
```

- [ ] **Step 4: Run documentation-adjacent tests**

Run:

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 5: Commit Task 10**

```powershell
git add docs/diataxis/reference/integrations.md docs/diataxis/how-to/configure-google-drive-sync.md docs/diataxis/how-to/verify-sync.md
git commit -m "docs: add google drive sync guides"
```

---

## Final Verification

- [ ] **Step 1: Run full Vitest suite**

```powershell
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 2: Run production build**

```powershell
npm run build
```

Expected: TypeScript build and Vite production build complete successfully.

- [ ] **Step 3: Run Android sync if Android delivery is needed**

```powershell
npm run cap:sync
```

Expected: Web build succeeds, icons generate, Capacitor sync completes.

- [ ] **Step 4: Manual provider verification**

Follow `docs/diataxis/how-to/verify-sync.md` for browser profiles first. Then repeat sign-in and "sync now" smoke checks in Windows Tauri and Android builds once OAuth platform configuration is ready.

## Self-Review Checklist

- Spec coverage: tasks cover local sync model, merge rules, sync metadata, provider interface, fake provider, Google Drive `appDataFolder`, automatic triggers, Home status UI, failure/conflict states, and documentation.
- Excluded scope preserved: no task syncs paused sessions, theme, current exam, route state, or active session state.
- Provider boundary preserved: only `googleDriveSyncProvider.ts` contains Google Drive API request details.
- Testability preserved: merge and sync service tests use pure logic and fake provider; normal Vitest does not require network or Google credentials.
