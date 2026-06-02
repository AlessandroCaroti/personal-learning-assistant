# Test Suite Design — Study App

**Date:** 2026-06-02
**Status:** Approved
**Total tests:** 208 across 19 files

---

## Goal

Implement a comprehensive Vitest test suite for the study app (React + Vite + TypeScript + IndexedDB). The suite covers all layers: utils, services, hooks, store, components, and two key page smoke tests.

---

## Architecture Decision

**Option B — Flat test files + shared fixture factory.**

One test file per source file. A single `src/__tests__/factories.ts` provides typed builder functions used across all test files, eliminating fixture duplication and making type-shape changes easy to propagate.

---

## Setup & Infrastructure

### New dependencies

```bash
npm install -D fake-indexeddb @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

### `vite.config.ts` additions

```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['src/__tests__/setup.ts'],
}
```

### `src/__tests__/setup.ts`

- Imports `@testing-library/jest-dom` for DOM matchers (`toBeInTheDocument`, `toHaveStyle`, etc.)
- No other global setup needed

### `src/__tests__/factories.ts`

Typed builder functions with deterministic defaults and optional overrides:

```
makeEsame(overrides?)             → Esame  (no files attached)
makeEsameWithQuiz(domande?)       → Esame  (files.quiz.data = encoded QuizFile ArrayBuffer)
makeEsameWithFlashcard(carte?)    → Esame  (files.flashcard.data = encoded FlashcardFile ArrayBuffer)
makeQuizDomanda(overrides?)       → QuizDomanda  (tipo: 'multipla')
makeVeroFalso(overrides?)         → QuizDomanda  (tipo: 'vero_falso')
makeQuizFile(domande?)            → QuizFile
makeFlashCard(overrides?)         → FlashCard
makeFlashcardFile(carte?)         → FlashcardFile
makeQuizSession(overrides?)       → QuizSession
makePausedQuiz(overrides?)        → PausedSession (mode: 'quiz')
makePausedFlash(overrides?)       → PausedSession (mode: 'flashcard')
```

`makeEsameWithQuiz` and `makeEsameWithFlashcard` encode their payload with `new TextEncoder().encode(JSON.stringify(payload))` so the `ArrayBuffer` matches what the real app stores and what pages decode via `new TextDecoder().decode(...)`.

Default IDs are deterministic (`'exam-1'`, `'q1'`, `'f1'`) so tests can assert exact values without generating UUIDs.

### `src/__tests__/resetDb.ts`

Helper called in `beforeEach` in storageService tests. Deletes the in-memory IDB instance and clears the module-level `dbPromise` in `storageService` so `getDB()` opens a fresh database on the next call.

```ts
// Usage pattern in storageService tests
import 'fake-indexeddb/auto'
import { resetDb } from '../__tests__/resetDb'
beforeEach(() => resetDb())
```

---

## Section 1: Utils

### `src/utils/shuffle.test.ts` — 6 tests (4 existing + 2 new)

| # | Description |
|---|---|
| 1 | Returns array with same elements |
| 2 | Does not mutate original array |
| 3 | Empty array returns empty array |
| 4 | Single-element array returns same array |
| 5 | Both permutations of a 2-element array occur across 100 runs |
| 6 | No element stays in its original index 100% of the time (50 runs, 5-element array) |

### `src/utils/formatTime.test.ts` — 6 tests (5 existing + 1 new)

| # | Input | Expected |
|---|---|---|
| 1 | 0 | `'0:00'` |
| 2 | 59 | `'0:59'` |
| 3 | 60 | `'1:00'` |
| 4 | 90 | `'1:30'` |
| 5 | 3661 | `'61:01'` |
| 6 | 7384 | `'123:04'` (no hour cap) |

---

## Section 2: quizService

### `src/services/quizService.test.ts` — 28 tests (10 existing + 18 new)

#### `validateQuizFile` — 12 tests (5 existing + 7 new)

| # | Test |
|---|---|
| 1 | Accepts valid quiz file |
| 2 | Rejects if `domande` is absent |
| 3 | Rejects `multipla` without `opzioni` |
| 4 | Rejects `risposta_corretta` not in `opzioni` |
| 5 | Rejects `vero_falso` with answer not `'Vero'`/`'Falso'` |
| 6 | Accepts `risposta_corretta: 'Falso'` for `vero_falso` |
| 7 | Rejects unknown `tipo` |
| 8 | Rejects domanda missing `testo` |
| 9 | Rejects domanda with empty `macroargomenti: []` |
| 10 | Rejects `multipla` with fewer than 2 options |
| 11 | Rejects empty `domande: []` array |
| 12 | Rejects domanda missing `spiegazione` |

#### `validateFlashcardFile` — 6 tests (all new, 0 existing)

| # | Test |
|---|---|
| 13 | Accepts valid flashcard file |
| 14 | Rejects missing `carte` field |
| 15 | Rejects non-array `carte` |
| 16 | Rejects card missing `id` |
| 17 | Rejects card missing `fronte` or `retro` |
| 18 | Rejects card with empty `macroargomenti: []` |

#### `filterDomande` — 5 tests (2 existing + 3 new)

| # | Test |
|---|---|
| 19 | `macroargomenti: []` returns all questions |
| 20 | Filters by single macroargomento (OR) |
| 21 | Multi-macro OR: question with `['A','B']` matches filter `['A']` |
| 22 | Filter with no matching macro → `[]` |
| 23 | Question with multiple macros: included if any match |

#### `buildSessionQuestions` — 4 tests (2 existing + 2 new)

| # | Test |
|---|---|
| 24 | Returns at most N questions |
| 25 | Options of `multipla` question are shuffled (same elements) |
| 26 | N greater than available → returns all, no error |
| 27 | `vero_falso` question has `opzioniShuffled: undefined` |

---

## Section 3: storageService

### `src/services/storageService.test.ts` — 32 tests (all new)

Uses `fake-indexeddb/auto` + `resetDb()` in `beforeEach`.

#### `describe('esami')` — 9 tests

| # | Test |
|---|---|
| 1 | `getAllEsami` on empty DB → `[]` |
| 2 | `getAllEsami` returns all saved esami |
| 3 | `getEsame` existing id → record |
| 4 | `getEsame` unknown id → `undefined` |
| 5 | `saveEsame` saves and retrieves |
| 6 | `saveEsame` upserts (same id updates name) |
| 7 | `deleteEsame` removes the esame record |
| 8 | `deleteEsame` does NOT affect a different exam's data |
| 9 | `deleteEsame` cascade: removes quiz sessions, question stats, flashcard stats, and paused sessions for that exam only |

Note: Test 9 seeds all 4 child stores for two exams, deletes one, and asserts the other's data is untouched.

#### `describe('quizSessions')` — 4 tests

| # | Test |
|---|---|
| 10 | `getQuizSessions` empty → `[]` |
| 11 | `getQuizSessions` returns only sessions for given `examId` |
| 12 | `saveQuizSession` saves and retrieves |
| 13 | `deleteQuizSessionsForExam` removes all for exam, leaves other exam's sessions |

#### `describe('questionStats')` — 5 tests

| # | Test |
|---|---|
| 14 | `getQuestionStats` empty → `[]` |
| 15 | `getQuestionStats` filtered by `examId` |
| 16 | `saveQuestionStat` saves |
| 17 | `saveQuestionStat` upserts (same `examId__questionId`) |
| 18 | `deleteQuestionStatsForExam` removes all for exam only |

#### `describe('flashcardStats')` — 5 tests

| # | Test |
|---|---|
| 19 | `getFlashcardStats` empty → `[]` |
| 20 | `getFlashcardStats` filtered by `examId` |
| 21 | `saveFlashcardStat` saves |
| 22 | `saveFlashcardStat` upserts |
| 23 | `deleteFlashcardStatsForExam` removes all for exam only |

#### `describe('pausedSessions')` — 8 tests

| # | Test |
|---|---|
| 24 | `getPausedSession` existing id → record |
| 25 | `getPausedSession` unknown id → `undefined` |
| 26 | `savePausedSession` saves quiz paused session |
| 27 | `savePausedSession` saves flashcard paused session |
| 28 | `savePausedSession` upserts (same id overwrites) |
| 29 | `deletePausedSession` removes record |
| 30 | `getPausedSessionsForExam` returns both quiz and flashcard paused sessions |
| 31 | `getPausedSessionsForExam` returns `[]` when none exist |

---

## Section 4: Hooks

All hook tests use `renderHook` + `act` from `@testing-library/react`.
`useQuiz`, `useFlashcard`, `useExam` mock storage with `vi.mock('../services/storageService')`.

### `src/hooks/useTimer.test.ts` — 14 tests (6 existing + 8 new)

| # | Test |
|---|---|
| 1–6 | (existing) elapsed, remaining, onExpire, pause, resume |
| 7 | `initialElapsed: 5` with `limitSeconds: 10` → `remaining` starts at 5 |
| 8 | `remaining` never goes below 0 |
| 9 | `onExpire` called exactly once, not again on further ticks |
| 10 | `resume()` after expiry is a no-op |
| 11 | Multiple pause/resume cycles accumulate elapsed correctly |
| 12 | `elapsed` increments and `remaining` decrements in sync |
| 13 | No-limit mode: `remaining` is always `null` |
| 14 | Interval cleared on unmount — no state-update warning |

### `src/hooks/useQuiz.test.ts` — 33 tests (all new)

Storage mock defaults: `getEsame` → `makeEsame()` with quiz file, `getQuestionStats` → `[]`, all writes → `Promise.resolve()`.

#### `describe('startSession')` — 7

| # | Test |
|---|---|
| 1 | `sessionState` populated with questions |
| 2 | `currentIndex` starts at 0 |
| 3 | `confirmedAnswers` starts empty |
| 4 | `selectedAnswer` is null |
| 5 | `isReview` is false (verified via subsequent `finishSession`) |
| 6 | Macroargomenti filter applied |
| 7 | N limit applied |

#### `describe('selectAnswer / confirmAnswer')` — 5

| # | Test |
|---|---|
| 8 | `selectAnswer` updates `selectedAnswer` |
| 9 | Calling `selectAnswer` twice replaces previous value |
| 10 | `confirmAnswer` moves answer to `confirmedAnswers[questionId]` |
| 11 | `confirmAnswer` clears `selectedAnswer` |
| 12 | `confirmAnswer` with no `selectedAnswer` is no-op |

#### `describe('goTo')` — 2

| # | Test |
|---|---|
| 13 | `goTo(2)` sets `currentIndex` to 2 |
| 14 | `goTo` resets `selectedAnswer` to null |

#### `describe('pauseSession')` — 3

| # | Test |
|---|---|
| 15 | Calls `savePausedSession` with `mode: 'quiz'` |
| 16 | Saved record contains correct `questionIds`, `currentQuestionIndex`, `confirmedAnswers` |
| 17 | `elapsedSeconds` stored correctly |

#### `describe('finishSession')` — 9

| # | Test |
|---|---|
| 18 | All correct → `score === total` |
| 19 | Mixed → `errors` contains wrong question IDs |
| 20 | Unconfirmed → `unanswered` contains those IDs |
| 21 | `completedByTimeout: true` stored correctly |
| 22 | `completedByTimeout: false` stored correctly |
| 23 | Calls `saveQuizSession` with full record |
| 24 | Calls `deletePausedSession(\`${examId}__quiz\`)` |
| 25 | `sessionState` is null after finish |
| 26 | `isReview: false` after normal `startSession → finishSession` |

#### `describe('startReviewSession')` — 4

| # | Test |
|---|---|
| 27 | Only error + unanswered IDs included as questions |
| 28 | `timeLimitSeconds` reset to null |
| 29 | `macroargomenti` reset to `[]` |
| 30 | `finishSession` after `startReviewSession` → `isReview: true` in saved session |

#### `describe('resumeFromPaused')` — 3

| # | Test |
|---|---|
| 31 | Restores questions from `questionIds` mapped via `allDomande` |
| 32 | Restores `currentIndex` and `confirmedAnswers` |
| 33 | Ignores paused session with `mode: 'flashcard'` |

### `src/hooks/useFlashcard.test.ts` — 32 tests (all new)

#### `describe('startSession')` — 6

| # | Test |
|---|---|
| 1 | Cards shuffled and limited to N |
| 2 | Macroargomenti filter applied |
| 3 | `phase` is `'front'` |
| 4 | `cardEvals` is empty |
| 5 | `reviewQueue` is empty |
| 6 | `isDone` is false |

#### `describe('showBack / dontKnow')` — 4

| # | Test |
|---|---|
| 7 | `showBack` sets `phase` to `'back'` |
| 8 | `showBack` is no-op when no session |
| 9 | `dontKnow` sets `cardEvals[card.id]` to `'No'` |
| 10 | `dontKnow` sets `phase` to `'back'` |

#### `describe('evaluate')` — 9

| # | Test |
|---|---|
| 11 | `'Sì'` advances to next card, phase resets to `'front'` |
| 12 | `'No'` advances to next card |
| 13 | `'In parte'` advances to next card |
| 14 | Last card, all `'Sì'` → `isDone` true, no review queue |
| 15 | Last card, one `'No'` → enters review queue (`isInReview: true`) |
| 16 | Last card, one `'In parte'` → enters review queue |
| 17 | Review queue, all `'Sì'` → `isDone` true |
| 18 | Review queue, still `'No'` → new review queue (loops) |
| 19 | Review queue contains only `'No'`/`'In parte'` cards, not `'Sì'` |

#### `describe('isDone')` — 2

| # | Test |
|---|---|
| 20 | `true` when `currentIndex >= cards.length` |
| 21 | `false` while cards remain |

#### `describe('pauseSession')` — 3

| # | Test |
|---|---|
| 22 | Calls `savePausedSession` with `mode: 'flashcard'` |
| 23 | Saved record contains `cardIds`, `currentCardIndex`, `cardEvals`, `reviewQueue` |
| 24 | `elapsedSeconds` stored correctly |

#### `describe('finishSession')` — 5

| # | Test |
|---|---|
| 25 | Saves `FlashcardStat` for each card with correct `lastEval` |
| 26 | Unevaluated cards get `lastEval: 'Non risposta'` |
| 27 | Calls `deletePausedSession(\`${examId}__flashcard\`)` |
| 28 | `sessionState` is null after finish |
| 29 | `timedOut: true` — unevaluated cards still get `'Non risposta'` |

#### `describe('resumeFromPaused')` — 3

| # | Test |
|---|---|
| 30 | Restores cards from `cardIds`, `currentIndex`, `cardEvals` |
| 31 | Phase resets to `'front'` on resume |
| 32 | Ignores paused session with `mode: 'quiz'` |

### `src/hooks/useExam.test.ts` — 9 tests (all new)

| # | Test |
|---|---|
| 1 | Loads all esami on mount |
| 2 | `loading` true during fetch, false after |
| 3 | `createEsame` saves to storage and adds to list |
| 4 | `createEsame` trims whitespace from name |
| 5 | `createEsame` returns esame with non-empty `id` and `createdAt` |
| 6 | `renameEsame` calls `saveEsame` with updated name |
| 7 | `renameEsame` trims whitespace |
| 8 | `deleteEsame` calls `storage.deleteEsame` and removes from list |
| 9 | Esami list sorted by `createdAt` ascending |

---

## Section 5: Store & Components

### `src/store/appStore.test.ts` — 9 tests (all new)

`beforeEach`: `localStorage.clear()` + Zustand store reset via `useAppStore.setState`.

| # | Test |
|---|---|
| 1 | Default theme is `'dark'` when `localStorage` is empty |
| 2 | Theme initialized from `localStorage` if `'light'` was previously saved |
| 3 | `toggleTheme` dark → light |
| 4 | `toggleTheme` light → dark |
| 5 | `toggleTheme` persists new theme to `localStorage` |
| 6 | `toggleTheme` applies `data-theme` attribute to `document.documentElement` |
| 7 | `currentExamId` initially null |
| 8 | `setCurrentExamId('abc')` sets value |
| 9 | `setCurrentExamId(null)` resets to null |

### `src/components/ConfirmDialog.test.tsx` — 10 tests (all new)

| # | Test |
|---|---|
| 1 | Returns nothing when `open: false` |
| 2 | Shows `title` when `open: true` |
| 3 | Shows `message` when `open: true` |
| 4 | Calls `onConfirm` when confirm button clicked |
| 5 | Calls `onCancel` when cancel button clicked |
| 6 | Default confirm label is `'Conferma'` |
| 7 | Default cancel label is `'Annulla'` |
| 8 | Custom `confirmLabel` renders correctly |
| 9 | Custom `cancelLabel` renders correctly |
| 10 | `dangerous: true` — confirm button has `var(--danger)` background style |

### `src/components/Timer.test.tsx` — 5 tests (all new)

| # | Test |
|---|---|
| 1 | Shows `elapsed` as mm:ss when `remaining` is null |
| 2 | Shows `remaining` as mm:ss when provided |
| 3 | Has warning color style when `remaining ≤ 60` |
| 4 | No warning color when `remaining > 60` |
| 5 | Shows `'0:00'` for `elapsed: 0`, no `remaining` |

### `src/components/ProgressBar.test.tsx` — 4 tests (all new)

| # | Test |
|---|---|
| 1 | Renders without crashing |
| 2 | `current: 0, total: 10` → inner bar width `'0%'` |
| 3 | `current: 5, total: 10` → inner bar width `'50%'` |
| 4 | `current: 10, total: 10` → inner bar width `'100%'` |

### `src/components/DotNav.test.tsx` — 6 tests (all new)

| # | Test |
|---|---|
| 1 | Renders exactly `total` dots |
| 2 | Clicking dot at index 2 calls `onSelect(2)` |
| 3 | `'selected'` state → accent color style |
| 4 | `'correct'` state → success color style |
| 5 | `'wrong'` state → danger color style |
| 6 | `'unanswered'` state → muted color style |

### `src/components/FileImportButton.test.tsx` — 3 tests (all new)

`vi.mock('../services/fileService')` — no real file picker fires.

| # | Test |
|---|---|
| 1 | Renders button with given `label` |
| 2 | Clicking calls `fileService.pickFile` with correct `accept`; `onFile` called with returned data |
| 3 | When `pickFile` throws, inline error message displayed |

---

## Section 6: Page Smoke Tests

Both pages rendered inside `MemoryRouter`. Storage fully mocked. Hooks (`useQuiz`, `useFlashcard`, `useTimer`) run for real against mocked storage — full hook→page integration.

### `src/pages/QuizSessionPage.test.tsx` — 8 tests (all new)

**Setup:** `getEsame` returns `makeEsameWithQuiz()` — a variant of `makeEsame` whose `files.quiz.data` is a real `ArrayBuffer` encoding a 2-question `QuizFile` (use `new TextEncoder().encode(JSON.stringify(makeQuizFile()))`.buffer`). `getPausedSession` → `undefined`. All writes → `Promise.resolve()`.

Route: `/esame/exam-1/quiz/sessione` with `location.state = { selectedMacro: [], n: 2, limitSec: null }` (fields are at the top level of state, not nested — matches how `QuizConfigPage` navigates).

| # | Test |
|---|---|
| 1 | Shows loading indicator before data resolves |
| 2 | After load, renders first question text |
| 3 | All option buttons rendered for a `multipla` question |
| 4 | Confirm button disabled until an option is selected |
| 5 | Selecting an option enables the confirm button |
| 6 | After confirm, `spiegazione` text appears |
| 7 | Clicking pause button opens pause `ConfirmDialog` |
| 8 | Clicking "Consegna quiz" opens deliver `ConfirmDialog` |

### `src/pages/FlashcardSessionPage.test.tsx` — 8 tests (all new)

**Setup:** `getEsame` returns `makeEsameWithFlashcard()` — same pattern, `files.flashcard.data` encodes a 2-card `FlashcardFile`. Route: `/esame/exam-1/flashcard/sessione` with `location.state = { selectedMacro: [], n: 2, limitSec: null }`.

| # | Test |
|---|---|
| 1 | Shows loading indicator before data resolves |
| 2 | After load, shows card front text |
| 3 | Phase label reads `'Fronte'` initially |
| 4 | "Mostra risposta" button visible in front phase |
| 5 | After "Mostra risposta", back text appears and phase label reads `'Risposta'` |
| 6 | Evaluation buttons (✓ Sì, ~ In parte, ✗ No) visible after showing back |
| 7 | After "Non so", only "Prossima →" shown (no evaluation row) |
| 8 | Clicking pause button opens pause `ConfirmDialog` |

---

## Full Suite Summary

| Layer | Files | Tests |
|---|---|---|
| Setup & factories | 3 helper files | — |
| Utils | 2 | 13 |
| quizService | 1 | 28 |
| storageService | 1 | 32 |
| Hooks | 4 | 82 |
| Store | 1 | 9 |
| Components | 5 | 28 |
| Pages | 2 | 16 |
| **Total** | **19 test files** | **208 tests** |

---

## Coverage gaps (explicit out-of-scope)

- `fileService.test.ts` — excluded: too tightly coupled to browser File System Access API and Capacitor native bridge; candidates for manual or E2E testing
- All other pages (HomePage, DashboardPage, QuizConfigPage, etc.) — excluded: logic covered by hook tests; candidates for future Playwright E2E
- `Layout.tsx`, `ThemeToggle.tsx` — excluded: purely presentational with no testable logic beyond appStore (already covered)

---

## Notes on fake-indexeddb reset strategy

`storageService` uses a module-level singleton `dbPromise`. Between tests, `resetDb()` must:
1. Call `indexedDB.deleteDatabase('study-app-db')` on the fake IDB instance
2. Set the `dbPromise` variable back to `null` (requires exporting it or using a dedicated `resetForTesting()` export)

The cleanest approach is to add a `resetForTesting()` export to `storageService.ts` that nulls `dbPromise`, called only in test environments.
