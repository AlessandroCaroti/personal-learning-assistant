# Codebase Structure

## Core Sections (Required)

### 1) Top-Level Map

List only meaningful top-level directories and files.

| Path | Purpose | Evidence |
|------|---------|----------|
| `src/` | Application source: pages, components, hooks, services, store, types, and utils | `docs/codebase/.codebase-scan.txt` |
| `docs/` | Product/design docs, prompts, testing notes, and generated codebase docs | `docs/codebase/.codebase-scan.txt` |
| `android/` | Capacitor-generated Android project and Gradle wrapper | `docs/codebase/.codebase-scan.txt`, `AGENTS.md` |
| `.github/instructions/` | Repository-specific coding/testing/accessibility/performance guidance | `docs/codebase/.codebase-scan.txt` |
| `.vscode/` | Local debug and task automation definitions | `.vscode/launch.json`, `.vscode/tasks.json` |
| `.codex/skills/` | Local Codex skill definitions; not part of the runtime product | `docs/codebase/.codebase-scan.txt` |
| `package.json` | Manifest for scripts, dependencies, Electron builder config, and module mode | `package.json` |
| `capacitor.config.ts` | Capacitor app identity and Android web asset config | `capacitor.config.ts` |
| `vite.config.ts` | Build and test configuration | `vite.config.ts` |
| `AGENTS.md` | Project constraints and workflow rules | `AGENTS.md` |

### 2) Entry Points

- Main runtime entry: `src/main.tsx`
- Secondary entry points (worker/cli/jobs): route shell in `src/App.tsx`; Android wrapper configured by `capacitor.config.ts`; intended Electron entry `electron/main.mjs` is referenced by `package.json` but not present in the current tree.
- How entry is selected (script/config): `npm run dev`, `npm run build`, and `npm run preview` use Vite from `package.json`; Android loads the built `dist/` directory via Capacitor `webDir`; Electron packaging is selected via `package.json` `main` and `build` fields.

### 3) Module Boundaries

| Boundary | What belongs here | What must not be here |
|----------|-------------------|------------------------|
| `src/pages/` | Route-level screen composition, navigation, and page-local UI state | Low-level IndexedDB access or reusable global state containers |
| `src/components/` | Reusable view pieces such as layout, dialogs, timers, nav dots, and import button | Route ownership or persistence orchestration |
| `src/hooks/` | Session state machines and exam CRUD orchestration (`useQuiz`, `useFlashcard`, `useTimer`, `useExam`) | Platform-specific file picker code |
| `src/services/` | Persistence boundary, import/file access boundary, and quiz data validation/helpers | Page rendering concerns |
| `src/store/` | Minimal app-wide state (`theme`, `currentExamId`) | Session workflow logic or persistence |
| `src/types/` | Shared domain models | Runtime behavior |
| `android/` | Generated native wrapper project | Manual product-feature edits per `AGENTS.md` |

### 4) Naming and Organization Rules

- File naming pattern: React components/pages use PascalCase file names such as `DashboardPage.tsx` and `ThemeToggle.tsx`; hooks and services use camelCase such as `useQuiz.ts` and `storageService.ts`; tests mirror source names with `.test.ts` or `.test.tsx`.
- Directory organization pattern: mostly layered by technical role (`pages`, `components`, `hooks`, `services`, `store`, `types`, `utils`) rather than by feature directory.
- Import aliasing or path conventions: relative imports only in inspected source; no TypeScript path aliases are configured in `tsconfig.app.json`.

### 5) Evidence

- `docs/codebase/.codebase-scan.txt`
- `src/main.tsx`
- `src/App.tsx`
- `package.json`
- `tsconfig.app.json`
- `AGENTS.md`

