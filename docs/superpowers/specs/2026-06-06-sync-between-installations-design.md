# Sync Between Installations Design

## Context

The app is an offline-first study app built with React, TypeScript, Vite, Capacitor for Android, and Tauri for Windows. All durable app data currently lives in IndexedDB through `src/services/storageService.ts`.

The goal is automatic sync across Android, browser web, and Windows desktop installations without running an app backend. The first provider is Google Drive `appDataFolder`, hidden behind a small provider interface so the app does not hard-code Google Drive throughout the codebase. The design intentionally avoids a full multi-provider framework until another provider is required.

## Goals

- Sync study data automatically after sign-in across Android, browser web, and Windows desktop.
- Preserve offline-first behavior: studying must work without network access.
- Use user-owned cloud storage, not an app-operated backend.
- Merge records where safe instead of using raw last-write-wins everywhere.
- Keep provider-specific code behind a small adapter interface.
- Keep sync failures isolated from local study flows.

## Non-Goals

- No sync for paused sessions in the first version.
- No sync for theme, current exam, route state, or transient UI state.
- No real-time multi-device collaboration.
- No general provider marketplace or broad Dropbox/OneDrive abstraction.
- No manual edits to generated `android/` files.

## Sync Scope

The first version syncs:

- `esami`
- imported `quiz`, `flashcard`, and `riassunto` file records
- `quizSessions`
- `questionStats`
- `flashcardStats`

The first version excludes:

- `pausedSessions`
- app theme
- current exam selection
- active quiz or flashcard route/session state

Paused sessions stay local because resuming an in-progress session on another device creates fragile edge cases around timers, shuffled order, replaced source files, and back-button behavior.

## Architecture

Sync is a separate layer next to `storageService`, not a page-level concern.

Core units:

- `storageService`: remains the only IndexedDB access layer and gains sync export/import helpers plus sync metadata persistence.
- `syncService`: orchestrates local export, remote pull, merge, local import, remote push, retry, and status updates.
- `syncProvider`: small remote storage interface.
- `googleDriveSyncProvider`: first provider implementation using Google Drive `appDataFolder`.
- `syncMetadata`: local device ID, last sync time, remote revision/checkpoint, pending local changes, provider account state, and sync schema version.
- `SyncStatus` UI: compact account and sync state surface, initially on the Home page.

The app continues to write local data first. Sync observes local changes, queues them, and reconciles in the background. Sync failure must not block local creates, imports, quiz completion, flashcard completion, or stats updates.

## Provider Interface

The provider interface should be intentionally small:

```ts
export interface SyncProvider {
  getAccount(): Promise<SyncAccount | null>
  signIn(): Promise<SyncAccount>
  signOut(): Promise<void>
  readRemoteState(): Promise<RemoteSyncState | null>
  writeRemoteState(state: RemoteSyncState, expectedRevision: string | null): Promise<RemoteWriteResult>
}
```

`expectedRevision` protects against overwriting a remote state that changed after the local device last read it. If the provider reports a revision mismatch, `syncService` must pull, merge, and retry rather than overwrite blindly.

Provider-specific OAuth, Drive file IDs, access tokens, and refresh behavior stay inside the Google provider and provider metadata. Application code consumes account and status state, not Google API details.

## Remote Data Shape

Google Drive stores app data in `appDataFolder`.

Remote state contains:

- `syncVersion`
- `updatedAt`
- `writerDeviceId`
- `data`: normalized syncable records
- `tombstones`: deleted exams and deleted file slots
- `metadata`: optional remote checkpoint details

The first implementation can use a single JSON remote state file plus provider revision checks. An operation log can be added later if snapshot conflict frequency or payload size becomes a real problem.

The first version stores imported file payloads inline as base64 inside the remote JSON state, matching current IndexedDB behavior. If payload size becomes a measured problem, a later version can split file payloads into separate provider objects keyed by content hash.

## Local Sync Metadata

Add local metadata in companion sync records rather than exposing sync fields in page and hook code:

- `deviceId`: stable UUID generated once per installation.
- `lastSyncedAt`: timestamp of the last successful sync.
- `lastRemoteRevision`: provider revision last merged locally.
- `pendingLocalChanges`: queue or dirty markers for syncable stores.
- `syncSchemaVersion`: local schema version for sync data.
- per-record metadata for mutable records: `updatedAt`, `deletedAt`, `updatedByDeviceId`.

Mutable records need reliable timestamps because current app records do not consistently track updates. Exam `createdAt`, quiz session `date`, and flashcard `lastSeen` are not enough for all merge cases.

## Merge Rules

Merge must be deterministic and testable as pure logic.

- `quizSessions`: union by session `id`. Duplicate IDs are treated as a conflict and the newest record wins, but UUID collisions should be practically impossible.
- `questionStats`: merge without double-counting by storing per-device counters in the sync representation. The domain model can still expose aggregate `timesShown` and `timesCorrect`, but sync state must preserve each device's contribution.
- `flashcardStats`: keep the record with the newest `lastSeen`.
- exam rename and metadata updates: newest `updatedAt` wins.
- quiz, flashcard, and summary file replacement: newest file-slot `updatedAt` wins.
- exam delete: tombstone wins over older updates.
- delete-vs-newer-edit or delete-vs-newer-file-replacement: mark as conflict requiring user resolution.

When a synced quiz or flashcard file replacement lands locally, dependent local data for that exam type must be cleared using the same semantics as existing replacement helpers:

- quiz replacement clears quiz sessions, question stats, and paused quiz session.
- flashcard replacement clears flashcard stats and paused flashcard session.

Paused sessions are not uploaded, but local paused sessions may still need clearing when synced file replacement invalidates them.

## Automatic Sync Flow

Sync triggers:

- after sign-in
- on app startup
- on app resume where the platform exposes a reliable event
- after syncable writes, debounced
- after a completed quiz or flashcard session
- on explicit "sync now"
- before app close where supported, as best effort only

Flow:

1. Local write completes.
2. Storage marks sync dirty.
3. Debounced sync starts when online and signed in.
4. Sync pulls remote state.
5. Sync merges local and remote state.
6. Sync writes merged local data to IndexedDB.
7. Sync pushes merged remote state with provider revision protection.
8. Sync updates status and metadata.

If the remote revision changed during push, repeat pull-merge-push with a bounded retry count.

## UX

Add a compact sync/account area on the Home page.

States:

- signed out
- signing in
- syncing
- synced with last synced time
- offline with pending changes
- failed with retry
- needs sign-in
- conflict needs attention

Actions:

- sign in
- sync now
- retry
- sign out
- resolve conflict

Normal study flow should not show blocking sync modals. User attention is required only for explicit sign-in/auth actions, unsupported remote data, remote corruption recovery, or true conflicts.

Conflict resolution can be simple in the first version: show local and remote timestamps/device labels and let the user keep local or keep remote. Most merges should happen silently.

## Error Handling

- Local storage errors remain local errors and should not be hidden by sync.
- Network failures queue pending changes and show a non-blocking status.
- OAuth expiration moves sync to `needs sign-in` without deleting local data.
- Provider revision mismatch triggers pull-merge-retry.
- Provider quota/rate-limit errors use backoff and keep pending changes.
- Unsupported remote `syncVersion` stops automatic merge and asks the user to upgrade or choose recovery.
- Invalid or corrupt remote state requires explicit recovery: keep local and overwrite remote, or replace local with remote if the remote can be validated.

## Security And Privacy

Use the narrow Google Drive `drive.appdata` scope for app-specific hidden storage. Do not request broad Drive file access for this feature.

No OAuth client secrets belong in frontend code. Public OAuth client IDs and platform-specific configuration can be present, but secrets must not be hard-coded.

Client-side encryption is not part of the first version. If encryption is added later, it needs a passphrase/key recovery design; adding encryption without recovery UX would create data-loss risk.

## Testing Strategy

Tests should cover the sync engine before provider integration.

- Merge unit tests for every store and conflict case.
- Storage tests for sync metadata, export helpers, and import helpers using `fake-indexeddb`.
- Provider contract tests with a fake provider.
- UI tests for signed-out, syncing, synced, offline, failed, needs sign-in, and conflict states.
- Regression tests for quiz and flashcard file replacement cleanup.
- Manual Google Drive OAuth checklist for browser, Windows Tauri, and Android Capacitor.

Normal Vitest runs must not require Google credentials or network access.

## Rollout Plan

Phase 1: local sync model, sync metadata, fake provider, merge engine, and tests.

Phase 2: Google Drive provider and OAuth wiring for browser, Windows Tauri, and Android Capacitor.

Phase 3: automatic triggers, debouncing, retry/backoff, and Home page sync status UI.

Phase 4: real-device verification and documentation for configuring Google OAuth credentials.

## Open Implementation Decisions

- Exact Google OAuth implementation details for Android and Tauri after provider research.

These decisions do not change the approved product direction. They should be resolved during implementation planning or early Phase 1 spikes.
