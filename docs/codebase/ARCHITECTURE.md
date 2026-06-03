# Architecture

## Core Sections (Required)

### 1) Architectural Style

- Primary style: layered client-side SPA with stateful workflow hooks.
- Why this classification: the code is split by role into pages, components, hooks, services, store, and types; route pages compose reusable components and delegate session behavior to custom hooks; persistence is isolated in `storageService.ts`.
- Primary constraints:
  - local-only persistence through IndexedDB with no backend (`src/services/storageService.ts`, `docs/2026-06-01-study-app-design-v2.md`)
  - route-driven quiz/flashcard flows inside a single React Router SPA (`src/App.tsx`)
  - platform differences concentrated mainly in file import, with additional native back-button handling in route files (`src/services/fileService.ts`, `src/App.tsx`, `src/pages/*SessionPage.tsx`)

### 2) System Flow

```text
src/main.tsx -> src/App.tsx routes -> page component -> hook/service logic -> IndexedDB or file adapter -> rendered UI/navigation
```

Observed flow for a quiz session:

1. `src/main.tsx` mounts `App` inside React strict mode.
2. `src/App.tsx` routes the user to `QuizConfigPage`, `QuizSessionPage`, or `QuizResultPage` based on the URL and onboarding state.
3. `src/pages/QuizConfigPage.tsx` loads the exam from `storageService`, validates the imported quiz JSON with `validateQuizFile`, derives available filters, and pushes session config into route state.
4. `src/pages/QuizSessionPage.tsx` re-loads and validates the quiz file, then starts/resumes/reviews a session through `useQuiz`.
5. `src/hooks/useQuiz.ts` builds/shuffles questions via `quizService`, tracks answers, updates question stats, persists paused sessions, and writes final quiz sessions through `storageService`.
6. `src/pages/QuizResultPage.tsx` reads saved sessions plus quiz file content to render score history and review actions.

### 3) Layer/Module Responsibilities

| Layer or module | Owns | Must not own | Evidence |
|-----------------|------|--------------|----------|
| `src/App.tsx` | Route tree, onboarding guard, top-level native back-button registration | Session persistence details | `src/App.tsx` |
| `src/pages/*` | Screen composition, navigation, page-local dialogs/errors | Raw IndexedDB schema management | `src/pages/DashboardPage.tsx`, `src/pages/QuizSessionPage.tsx` |
| `src/hooks/useQuiz.ts` | Quiz session lifecycle, scoring, pause/resume payloads, stat updates | File picking or summary rendering | `src/hooks/useQuiz.ts` |
| `src/hooks/useFlashcard.ts` | Flashcard deck lifecycle, review queue, pause/resume, stat persistence | Quiz validation or routing | `src/hooks/useFlashcard.ts` |
| `src/hooks/useTimer.ts` | Shared elapsed/remaining timer behavior and expiry callback | Session-specific scoring logic | `src/hooks/useTimer.ts` |
| `src/services/storageService.ts` | All IndexedDB store definitions and CRUD | UI state or route decisions | `src/services/storageService.ts` |
| `src/services/fileService.ts` | Browser/native file-picking adapter | Persistence and validation | `src/services/fileService.ts` |
| `src/services/quizService.ts` | JSON validation, question filtering, session-question building | Storage and navigation | `src/services/quizService.ts` |
| `src/store/appStore.ts` | Theme and current exam store | Session workflow state | `src/store/appStore.ts` |

### 4) Reused Patterns

| Pattern | Where found | Why it exists |
|---------|-------------|---------------|
| Repository/service boundary | `src/services/storageService.ts` | Keeps raw IndexedDB access in one module |
| Adapter pattern | `src/services/fileService.ts` | Switches browser vs Capacitor file picking behind one `pickFile()` interface |
| Workflow/state-machine hooks | `src/hooks/useQuiz.ts`, `src/hooks/useFlashcard.ts`, `src/hooks/useTimer.ts` | Encapsulates user-session behavior outside pages |
| Route-state handoff | `src/pages/QuizConfigPage.tsx`, `src/pages/QuizSessionPage.tsx`, `src/pages/FlashcardConfigPage.tsx`, `src/pages/FlashcardSessionPage.tsx` | Avoids global stores for per-session startup config |
| Singleton-ish lazy DB initialization | `dbPromise` inside `src/services/storageService.ts` | Reuses one IndexedDB connection promise across calls |

### 5) Known Architectural Risks

- The “platform-specific code only in `fileService.ts`” rule from `AGENTS.md` is not true in the current code: `src/App.tsx` and both session pages directly use Capacitor APIs for back-button handling. That makes the platform boundary broader than the stated architecture.
- Route pages contain substantial session-orchestration and inline styling logic in addition to rendering, especially `src/pages/QuizSessionPage.tsx`, `src/pages/FlashcardSessionPage.tsx`, and `src/pages/DashboardPage.tsx`. This raises coupling between UI and behavior.

### 6) Evidence

- `src/main.tsx`
- `src/App.tsx`
- `src/hooks/useQuiz.ts`
- `src/hooks/useFlashcard.ts`
- `src/hooks/useTimer.ts`
- `src/services/storageService.ts`
- `src/services/fileService.ts`
- `src/services/quizService.ts`
- `AGENTS.md`

