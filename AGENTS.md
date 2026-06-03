# Agent Instructions — Personal Learning Assistant

Offline study app for university exams. React + TypeScript + Vite, packaged as Android app via Capacitor.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (localhost:5173) |
| Production build | `npm run build` |
| Tests (single run) | `npm run test -- --run` |
| Tests (watch) | `npm run test` |
| Android sync | `npm run cap:sync` (builds first) |
| Open Android Studio | `npm run cap:android` |

> Run `npm run test -- --run` after every code change — tests are the main safety net.

## Instruction References

Repository instruction files:
- [.github/instructions/accessibility-standards.instructions.md](.github/instructions/accessibility-standards.instructions.md)
- [.github/instructions/performance-optimization.instructions.md](.github/instructions/performance-optimization.instructions.md)
- [.github/instructions/react-typescript.instructions.md](.github/instructions/react-typescript.instructions.md)
- [.github/instructions/testing-standards.instructions.md](.github/instructions/testing-standards.instructions.md)
- [.github/instructions/typescript-patterns.instructions.md](.github/instructions/typescript-patterns.instructions.md)

## Architecture

### State Management
- **Zustand** ([src/store/appStore.ts](src/store/appStore.ts)): global state only (`theme`, `currentExamId`)
- **Custom hooks**: session state machines — `useQuiz`, `useFlashcard`, `useTimer`, `useExam` (in [src/hooks/](src/hooks/))
- **IndexedDB** ([src/services/storageService.ts](src/services/storageService.ts)): all persistence — 5 stores: `esami`, `quizSessions`, `questionStats`, `flashcardStats`, `pausedSessions`

### Routing
`/` → `HomePage` → `/esame/:examId/*` → `DashboardPage` → quiz/flashcard/summary flows. One-time onboarding guard at `/onboarding`. Full route map in [src/App.tsx](src/App.tsx).

### Platform Abstraction
[src/services/fileService.ts](src/services/fileService.ts) is the **only** file with platform-specific code:
- **Web**: File Picker API (fallback to `<input type="file">`)
- **Android**: `@capawesome/capacitor-file-picker` + base64 decode

Do not import `@capacitor/core` or `@capawesome/*` anywhere else.

## Key Types

Full definitions in [src/types/index.ts](src/types/index.ts). Core shapes:

```ts
Esame       { id, name, createdAt, files: { quiz?, flashcard?, riassunto? } }
QuizDomanda { id, tipo: 'multipla'|'vero_falso', testo, opzioni?, risposta_corretta, spiegazione, macroargomenti[] }
FlashCard   { id, macroargomenti[], fronte, retro }
PausedSession  // keyed as `${examId}__quiz` or `${examId}__flashcard` in IndexedDB
```

## Conventions

### Styling
- Single stylesheet: [src/index.css](src/index.css)
- CSS variables for theming: `--bg`, `--text`, `--accent`, `--card-bg`, etc.
- Theme toggled via `data-theme="dark|light"` on `<html>` — see [src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx)
- Do **not** add Tailwind or any UI component library

### Tests
- Framework: Vitest + React Testing Library
- Colocated test files: `*.test.tsx` / `*.test.ts` next to the source
- Always mock `@capacitor/core` (return `{ isNativePlatform: false }`) in test files
- Use `fake-indexeddb/auto` import for any test touching IndexedDB
- Reference example: [src/hooks/useQuiz.test.ts](src/hooks/useQuiz.test.ts)

### File Validation
Quiz and flashcard JSON must pass validation in [src/services/quizService.ts](src/services/quizService.ts) before storage. When adding a new importable format, add a `validate*File()` function there.

## Imported File Schemas

Full specs: [docs/2026-06-01-study-app-design-v2.md](docs/2026-06-01-study-app-design-v2.md)

**quiz.json** — `{ esame: string, domande: QuizDomanda[] }`
- `risposta_corretta` must be the **exact text** of one entry in `opzioni`
- `tipo: "vero_falso"` questions have no `opzioni` field; answer is `"Vero"` or `"Falso"`

**flashcard.json** — `{ esame: string, carte: FlashCard[] }`
- Card IDs are sequential: `f1`, `f2`, ...

**Summary files** — `.html` (iframe), `.pdf` (pdfjs-dist), `.docx` (mammoth)

AI prompt templates for generating quiz/flashcard JSON are in [docs/skills-and-prompts/](docs/skills-and-prompts/).

## Android

`android/` is Capacitor-generated — **do not edit manually**.

After any web change that needs to land on Android:
1. `npm run build`
2. `npm run cap:sync`
3. Build APK via Android Studio or VS Code Gradle tasks (`Android: assembleDebug`, etc.)

Android back-button handling (prevents leaving active sessions) is in [src/App.tsx](src/App.tsx).

## Dependency Versions & Compatibility

| Dependency | Version | Notes |
|---|---|---|
| `node` | ^18.x | Vite 6 requires Node 18+ |
| `react` | 18.3.1 | Use hooks, functional components only |
| `typescript` | 5.6.0 | Strict mode enabled (`tsconfig.json`) |
| `vite` | 6.0.0 | ESM only, no CommonJS |
| `vitest` | 4.1.8 | Compatible with Vite, uses `jsdom` |
| `@capacitor/core` | 7.0.0 | Mock `Capacitor.isNativePlatform()` in tests |
| `idb` | 8.0.0 | Async-first IndexedDB wrapper |

**Note:** Always run `npm install` before first development session. Database schema is version 2 (handles migration from v1 via IndexedDB `onupgradeneeded`).

## IndexedDB Schema (Version 2)

Five object stores in `study-app-db`:

```ts
// esami — exam metadata
{ id (uuid), name, createdAt, files: { quiz?, flashcard?, riassunto? } }

// quizSessions — session history (index: by-examId)
{ id (uuid), examId, score, total, errors[], unanswered[], isReview, startedAt, endedAt }

// questionStats — per-question correctness (index: by-examId)
{ id: `${examId}__${questionId}`, examId, questionId, timesShown, timesCorrect }

// flashcardStats — per-card proficiency (index: by-examId)
{ id: `${examId}__${cardId}`, examId, cardId, lastEval, lastSeen }

// pausedSessions — active session state (index: by-examId)
{ id: `${examId}__quiz|flashcard`, examId, sessionType, elapsedSeconds, confirmedAnswers[], reviewQueue[] }
```

**Migration from v1→v2:** Adds `pausedSessions` store and `isReview` field to `quizSessions`. Handled automatically in `getDB()` `onupgradeneeded` callback.

## Common Development Patterns

### Adding a new page/feature
1. Create component in `src/pages/` (or `src/components/`)
2. Add route in `src/App.tsx`
3. Use `useExam()`, `useQuiz()`, `useFlashcard()`, or `useTimer()` hooks as needed
4. Import types from `src/types/index.ts`
5. Persist data via `storageService` (never direct IndexedDB)
6. Write `*.test.tsx` colocated test file
7. Run `npm run test -- --run` before commit

### Importing a quiz/flashcard file
1. User picks file via `FileImportButton.tsx` (wraps `fileService.pickFile()`)
2. Parse JSON and call `validateQuizFile()` or `validateFlashcardFile()` from `quizService.ts`
3. If validation fails, show inline error (no file saved)
4. If valid, save to IndexedDB via `saveEsame()` + associated stats
5. Clear any existing `pausedSession` for that exam + type to avoid conflicts

### Pausing and resuming a session
1. Back button detected → show `ConfirmDialog`
2. User chooses "Metti in pausa" → call `savePausedSession()` with current state + timer elapsed
3. Dashboard shows resume banner for paused sessions
4. Clicking resume → `getPausedSession()` → recreate session state from checkpoint
5. New session attempt while paused → conflict dialog (user chooses resume or abandon)

### Styling a new component
1. Use CSS variables from `[data-theme="dark|light"]` in `src/index.css`
2. No inline styles; write in `<style>` block or import from `index.css`
3. Mobile-first: single column, 48px+ tap targets
4. Test both themes: add `[data-theme="light"]` inspection in dev tools

### Testing with IndexedDB
```ts
import 'fake-indexeddb/auto'  // Must be first import in test file
import { render, screen } from '@testing-library/react'

// Tests now use fake-indexeddb instead of real browser IndexedDB
```

## Troubleshooting

### "Cannot find module '@capacitor/core'"
- Running test without mock: Add `vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))` at top of test
- Ensure all tests import `fake-indexeddb/auto` before any storage service code

### "DB operation fails silently"
- IndexedDB errors often fail silently. Always add `.catch()` or `try/catch` around `storageService` calls
- Check browser DevTools → Application → IndexedDB → `study-app-db` to verify data was saved

### "Android app shows old web build"
- Clear Android build cache: run `npm run cap:sync` (does full rebuild)
- Verify `npm run build` succeeds before syncing: `npm run build && npm run cap:sync`
- In Android Studio: Build → Clean Project, then Build → Rebuild Project

### "Changes not appearing in dev server"
- Ensure `npm run dev` is running (watches `src/` and rebuilds on save)
- Hard refresh browser: `Ctrl+Shift+R` (clears cache)
- Check Vite terminal for errors: may be silent TypeScript errors preventing HMR

### "File import validation fails unexpectedly"
- Quiz/flashcard JSON must match schema exactly: see `validateQuizFile()` and `validateFlashcardFile()` in `src/services/quizService.ts`
- Common issue: `risposta_corretta` not matching any `opzioni[i]` (case-sensitive string comparison)
- Vero/falso questions must have `risposta_corretta: "Vero"` or `"Falso"` exactly

### "Timer runs in background (Android)"
- Intentional behavior: no auto-pause when app backgrounded
- Only explicit "Metti in pausa" via back button pauses the session
- Background timer continues because device OS keeps the WebView alive

## Project-Specific Commands Quick Reference

```bash
# Development
npm run dev                    # Start Vite dev server on localhost:5173
npm run test                   # Run tests in watch mode
npm run test -- --run         # Single test run (use after changes)

# Build & Deploy
npm run build                  # TypeScript check + Vite build → dist/
npm run build:win             # Build Windows EXE via Electron
npm run preview               # Serve dist/ locally (test production build)

# Android
npm run cap:sync              # Build web + sync to android/
npm run cap:android           # cap:sync + open Android Studio
npm run cap:android           # In VS Code: run Gradle tasks (assembleDebug, etc.)

# One-liner: full web build + test
npm run build && npm run test -- --run
```

## Key Files by Task

| Task | File | Purpose |
|---|---|---|
| **Add route** | [src/App.tsx](src/App.tsx) | Router setup, back button handler |
| **Add type** | [src/types/index.ts](src/types/index.ts) | Global TypeScript interfaces |
| **Persist data** | [src/services/storageService.ts](src/services/storageService.ts) | IndexedDB wrapper (only place for DB ops) |
| **Session state** | [src/hooks/useQuiz.ts](src/hooks/useQuiz.ts), [useFlashcard.ts](src/hooks/useFlashcard.ts) | State machines for sessions |
| **Import files** | [src/services/fileService.ts](src/services/fileService.ts) | Web/Android file picker abstraction |
| **Validate quiz** | [src/services/quizService.ts](src/services/quizService.ts) | JSON schema validation + filtering |
| **Theme toggle** | [src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx) | Dark/light mode (CSS vars) |
| **Test setup** | [src/__tests__/setup.ts](src/__tests__/setup.ts) | Vitest config, global mocks |
