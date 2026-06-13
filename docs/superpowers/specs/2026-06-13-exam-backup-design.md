# Exam Backup Design

## Context

The app currently stores each exam as a single `Esame` record in IndexedDB and keeps all exam-scoped progress in adjacent stores:

- `esami` for exam metadata and embedded files
- `quizSessions` for completed quiz runs
- `questionStats` for per-question progress
- `flashcardStats` for per-card progress
- `pausedSessions` for resumable quiz and flashcard work

Users can already import study source files into an exam and can attach extra documents through the archive flow. What is missing is a way to export one exam as a portable offline backup and restore it later on the same device or a different installation without relying on sync.

## Goals

- Export one exam as a portable backup artifact.
- Include both exam content and exam study state in the backup.
- Restore backups as new local exams by default.
- Preserve source files in their original binary form rather than base64-wrapping everything into one JSON blob.
- Keep the backup format versioned and migration-friendly.
- Fit the feature into the current page structure:
  - export from the exam dashboard
  - import from the home page

## Non-Goals

- No in-place restore over an existing exam in this version.
- No multi-exam backup bundles in one file.
- No cloud backup target, sharing flow, or background sync integration.
- No archive encryption or password protection in this version.
- No selective restore of only files or only progress.
- No user-facing merge flow between an imported backup and an existing exam.

## Product Decisions

### Restore Semantics

Import is additive, not destructive.

When a backup is imported:

1. the app validates the archive and manifest;
2. it creates a new local exam id;
3. it rewrites every imported record that references the backed-up exam id to that new local id;
4. it saves the new exam and all associated records locally.

This avoids accidental overwrite and makes backup restore safe even when an exam with the same name already exists.

### Backup Container

The export file should use a custom extension such as `.pla-exam-backup`, while remaining a standard ZIP archive internally.

Rationale:

- raw files remain raw files;
- large binaries avoid base64 inflation;
- users can recover individual files manually if needed;
- validation and future migrations can be anchored on a versioned manifest;
- the format stays portable across web, desktop, and Android-capable clients.

## Archive Format

Each backup archive contains one top-level manifest and the referenced files for exactly one exam.

Proposed structure:

- `manifest.json`
- `files/quiz.json` when the exam has a quiz file
- `files/flashcard.json` when the exam has a flashcard file
- `files/riassunto.<ext>` when the exam has a summary file
- `attachments/<attachment-id>-<original-name>` for archive attachments

The exact filenames do not need to mirror this proposal exactly, but the structure must satisfy these rules:

- `manifest.json` is required and authoritative.
- Every referenced path must exist in the ZIP.
- Every packaged non-manifest file must be referenced by the manifest.
- The archive represents exactly one exam backup payload.

## Manifest Shape

`manifest.json` should be a dedicated backup schema, separate from sync payload types.

Proposed top-level shape:

- `version: number`
- `exportedAt: string`
- `source`
  - `app: string`
  - `appVersion?: string`
- `exam`
  - `originalExamId: string`
  - `name: string`
  - `createdAt: string`
  - `files`
  - `attachments`
- `studyState`
  - `quizSessions`
  - `questionStats`
  - `flashcardStats`
  - `pausedSessions`

### `exam.files`

Each optional file entry should contain metadata plus the relative path inside the ZIP:

- `quiz?: { path, name, type }`
- `flashcard?: { path, name, type }`
- `riassunto?: { path, name, type }`

### `exam.attachments`

Each attachment entry should contain:

- `id`
- `path`
- `name`
- `type`
- `createdAt`

### `studyState`

This block should contain the same logical data the app already persists for one exam:

- `quizSessions: QuizSession[]`
- `questionStats: QuestionStats[]`
- `flashcardStats: FlashcardStats[]`
- `pausedSessions: PausedSession[]`

All records in this block must reference the archived exam through the original backed-up exam id before import remapping.

## Validation Rules

Import validation should happen in layers and fail before any write if a layer does not pass.

### Archive-Level Validation

- The selected file must be a readable ZIP archive.
- `manifest.json` must exist at the archive root.
- Unknown extra files are rejected in this version to keep the format strict.
- Missing files referenced by the manifest are rejected.
- Files present in the archive but absent from manifest references are rejected.

### Manifest-Level Validation

- `version` is required.
- Unknown major versions are rejected with a migration-oriented message.
- Exactly one exam payload must be described.
- `exam.originalExamId`, `exam.name`, and `exam.createdAt` are required.
- All `studyState` arrays must exist, even if empty.
- Paths must be relative archive paths only and must not permit traversal.

### Embedded Content Validation

- If `quiz` exists, its decoded JSON must pass `validateQuizFile()`.
- If `flashcard` exists, its decoded JSON must pass `validateFlashcardFile()`.
- Summary files and archive attachments are treated as opaque binaries; only metadata and path consistency are validated.
- Paused sessions must use supported modes only.
- Every imported state record must belong to the archived `originalExamId`; records with mismatched ids are rejected.

## Restore Mapping Rules

The import flow should produce a cloned exam package with a newly generated local exam id.

### New Identifiers

- Generate a new local `exam.id`.
- Preserve the backed-up exam name by default.
- Preserve `createdAt` from the backup unless product requirements later prefer “restored at” semantics.

### Rewritten Fields

Every imported record that contains `examId` must be rewritten to the new local exam id.

This applies to:

- `quizSessions[].examId`
- `questionStats[].examId`
- `flashcardStats[].examId`
- `pausedSessions[].examId`

Paused-session primary keys must also be recomputed:

- quiz pause id becomes `${newExamId}__quiz`
- flashcard pause id becomes `${newExamId}__flashcard`

Question-stat primary keys are already exam-scoped and must be recomputed as:

- `${newExamId}__${questionId}`

Flashcard-stat primary keys must be recomputed as:

- `${newExamId}__${cardId}`

Session ids can remain unchanged if they are already unique UUIDs. The safety property comes from remapping the exam linkage and writing into a new exam namespace.

### Filtering Before Remapping

Before remapping, the importer must filter and verify that all incoming records truly belong to the archived `originalExamId`. This prevents malformed manifests from importing unrelated records into the new exam.

## Architecture

### Backup Service

Add a dedicated service, for example `src/services/examBackupService.ts`, as the orchestration layer for this feature.

Responsibilities:

- build the backup manifest for one exam;
- gather the exam record plus all exam-scoped progress from storage;
- create the ZIP archive for export;
- unpack and validate an imported archive;
- decode embedded files;
- remap ids for additive restore;
- return normalized data ready for persistence.

This service should remain independent from sync internals. Sync solves device reconciliation. Backup solves portable one-exam export and restore. Reusing sync wire types would leak the wrong abstraction into a user-facing format.

## Persistence Boundary

`storageService` should remain the only persistence boundary.

It will likely need a new helper to persist a full imported exam bundle atomically, for example:

- save the cloned `Esame`
- save its `quizSessions`
- save its `questionStats`
- save its `flashcardStats`
- save its `pausedSessions`

That helper should use a single IndexedDB transaction across the affected stores so that a failed import cannot leave behind a half-restored exam.

Atomic import should also preserve existing dirty/sync metadata behavior in a coherent way. At minimum, the imported records should be treated as local state and not bypass the app’s persistence invariants.

## File Access Boundary

The feature should continue to use `fileService` for user-selected import files.

For export, the app needs a browser-side download path similar to the existing attachment export pattern, but targeted at the generated backup archive and custom extension.

No other page or component should deal directly with ZIP manipulation.

## UI Flow

### Dashboard Export

`DashboardPage` gains an `Esporta backup` action for the current exam.

Expected behavior:

1. user taps export;
2. the app loads the current exam bundle;
3. the backup service builds the ZIP archive;
4. the app triggers a download using the custom extension;
5. any generation failure surfaces as a user-visible error near the action.

This action belongs on the exam dashboard because export is exam-scoped.

### Home Import

`HomePage` gains an `Importa backup` action near the existing exam creation entry point.

Expected behavior:

1. user picks a `.pla-exam-backup` file;
2. the app validates the archive;
3. the app imports the backup as a new exam;
4. the exam list reloads;
5. optionally, the app navigates directly into the imported exam after success.

Import belongs on the home page because that is already the app’s exam entry surface.

## Error Handling

The feature should provide explicit, user-readable failures for the most likely cases:

- unreadable archive;
- missing or malformed `manifest.json`;
- unsupported backup version;
- missing referenced file in ZIP;
- invalid `quiz.json`;
- invalid `flashcard.json`;
- mismatched state records that do not belong to the archived exam;
- persistence failure during import.

Error handling principles:

- fail before writes whenever possible;
- do not partially import;
- keep messages concrete enough that the user can distinguish corrupted backup, unsupported version, and invalid embedded study files.

## Testing Strategy

The feature should be covered from pure transformation logic up through page integration.

### Service Tests

`examBackupService` tests should cover:

- manifest creation;
- export archive structure;
- import validation failures;
- id remapping for additive restore;
- round-trip export then import of a fully populated exam;
- filtering out records that do not belong to the archived exam id.

### Storage Tests

`storageService` tests should cover the new atomic import helper:

- persists exam and all associated state together;
- recomputed paused-session ids are readable after import;
- no partial writes remain if one write fails.

### Page Tests

`DashboardPage` tests should cover:

- export action visibility;
- successful export trigger;
- visible export error on failure.

`HomePage` tests should cover:

- import action visibility;
- successful backup import and exam list reload;
- imported exam appears as a distinct new exam even when the same name already exists;
- visible validation error for invalid backup files.

## Open Implementation Decisions

These choices are intentionally deferred to planning and implementation, not product design:

- which ZIP library best fits the current Vite/browser environment;
- the exact downloaded filename pattern;
- whether successful import should automatically navigate into the restored exam or remain on the home page with a success message;
- the exact manifest TypeScript types and helper boundaries inside the backup service.

## Recommended Next Step

The implementation plan should keep the work split into:

1. backup format types and pure service tests;
2. storage-level atomic import support;
3. dashboard export UI;
4. home import UI;
5. end-to-end verification with the existing test suite.
