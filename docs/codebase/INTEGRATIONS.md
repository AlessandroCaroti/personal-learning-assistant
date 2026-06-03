# External Integrations

## Core Sections (Required)

### 1) Integration Inventory

| System | Type (API/DB/Queue/etc) | Purpose | Auth model | Criticality | Evidence |
|--------|---------------------------|---------|------------|-------------|----------|
| IndexedDB (`study-app-db`) | Browser database | Persists exams, quiz sessions, question stats, flashcard stats, and paused sessions | None | High | `src/services/storageService.ts` |
| Capacitor runtime | Native bridge/runtime adapter | Detects native platform and supports Android back-button behavior | None in app code | Medium | `src/App.tsx`, `src/pages/QuizSessionPage.tsx`, `src/pages/FlashcardSessionPage.tsx` |
| `@capawesome/capacitor-file-picker` | Native plugin | Android file selection with base64 payload reading | None in app code | Medium | `src/services/fileService.ts` |
| Browser File System Access API / file input | Browser integration | Web file selection for quiz, flashcard, and summary imports | None | High | `src/services/fileService.ts` |
| `mammoth` | Client-side library | Converts imported `.docx` summaries to HTML | None | Low | `src/pages/SummaryPage.tsx` |

### 2) Data Stores

| Store | Role | Access layer | Key risk | Evidence |
|-------|------|--------------|----------|----------|
| `esami` | Exam metadata plus imported file payloads | `src/services/storageService.ts` | Stores raw file contents in IndexedDB; large files may increase local storage pressure | `src/services/storageService.ts` |
| `quizSessions` | Quiz history per exam | `src/services/storageService.ts` | Session cleanup depends on replacement/delete flows remaining correct | `src/services/storageService.ts` |
| `questionStats` | Per-question correctness counters | `src/services/storageService.ts`, `src/hooks/useQuiz.ts` | Updates are async and best-effort with console-only failure handling | `src/services/storageService.ts`, `src/hooks/useQuiz.ts` |
| `flashcardStats` | Last evaluation and last seen per card | `src/services/storageService.ts`, `src/hooks/useFlashcard.ts` | Entire session writes are deferred until finish | `src/services/storageService.ts`, `src/hooks/useFlashcard.ts` |
| `pausedSessions` | Resume payloads for quiz and flashcard flows | `src/services/storageService.ts`, `src/hooks/useQuiz.ts`, `src/hooks/useFlashcard.ts` | Payload shape must stay in sync with hook resume logic | `src/services/storageService.ts`, `src/hooks/useQuiz.ts`, `src/hooks/useFlashcard.ts` |

### 3) Secrets and Credentials Handling

- Credential sources: none found in inspected code or config; no `.env` template was detected in the scan output.
- Hardcoding checks: no API keys, service URLs, or auth tokens were found in inspected runtime files; the app appears local-only.
- Rotation or lifecycle notes: `[TODO]` not applicable unless future networked integrations are added.

### 4) Reliability and Failure Behavior

- Retry/backoff behavior: none found for file, storage, or native plugin operations.
- Timeout policy: only user-study session timers exist via `useTimer`; no integration timeout wrappers were found.
- Circuit-breaker or fallback behavior: browser file import falls back from `showOpenFilePicker` to a hidden `<input type="file">`; summary rendering falls back to an error message for unsupported types.

### 5) Observability for Integrations

- Logging around external calls: partial; some storage failures are logged with `console.error` in hooks, but many page-level load failures are only shown in UI state.
- Metrics/tracing coverage: none found.
- Missing visibility gaps: no centralized error collection for IndexedDB failures, native plugin failures, or summary conversion failures.

### 6) Evidence

- `src/services/storageService.ts`
- `src/services/fileService.ts`
- `src/pages/SummaryPage.tsx`
- `src/hooks/useQuiz.ts`
- `src/hooks/useFlashcard.ts`
- `docs/codebase/.codebase-scan.txt`

