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
