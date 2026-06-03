# Technology Stack

## Core Sections (Required)

### 1) Runtime Summary

| Area | Value | Evidence |
|------|-------|----------|
| Primary language | TypeScript (`.ts` and `.tsx`) | `src/` file inventory in `docs/codebase/.codebase-scan.txt`, `tsconfig.app.json` |
| Runtime + version | Node.js `^18.x` for tooling; React 18.3.1 in the browser/WebView runtime | `AGENTS.md`, `package.json` |
| Package manager | npm with lockfile version 3 | `package.json`, `package-lock.json` |
| Module/build system | ESM package (`"type": "module"`) built with Vite 6 and TypeScript project build mode | `package.json`, `vite.config.ts`, `tsconfig.app.json` |

### 2) Production Frameworks and Dependencies

List only high-impact production dependencies (frameworks, data, transport, auth).

| Dependency | Version | Role in system | Evidence |
|------------|---------|----------------|----------|
| `react` | `^18.3.1` | Component runtime for the UI | `package.json` |
| `react-dom` | `^18.3.1` | Browser render target | `package.json`, `src/main.tsx` |
| `react-router-dom` | `^6.28.0` | Client-side route tree for onboarding, dashboard, quiz, flashcard, and summary flows | `package.json`, `src/App.tsx` |
| `zustand` | `^5.0.0` | Minimal global state for theme and current exam selection | `package.json`, `src/store/appStore.ts` |
| `idb` | `^8.0.0` | Typed IndexedDB wrapper for all local persistence | `package.json`, `src/services/storageService.ts` |
| `@capacitor/core` | `^7.0.0` | Runtime platform detection and native bridge | `package.json`, `src/App.tsx`, `src/services/fileService.ts` |
| `@capacitor/app` | `^7.0.0` | Android back-button listener registration | `package.json`, `src/App.tsx`, `src/pages/QuizSessionPage.tsx`, `src/pages/FlashcardSessionPage.tsx` |
| `@capawesome/capacitor-file-picker` | `^7.0.0` | Native Android file picker adapter | `package.json`, `src/services/fileService.ts` |
| `mammoth` | `^1.8.0` | Client-side `.docx` to HTML conversion for summaries | `package.json`, `src/pages/SummaryPage.tsx` |
| `pdfjs-dist` | `^4.10.0` | Declared PDF-related dependency; current summary page does not import it directly | `package.json`, `src/pages/SummaryPage.tsx` |
| `uuid` | `^14.0.0` | IDs for exams and quiz sessions | `package.json`, `src/hooks/useExam.ts`, `src/hooks/useQuiz.ts` |

### 3) Development Toolchain

| Tool | Purpose | Evidence |
|------|---------|----------|
| TypeScript 5.6 | Static type-checking in strict mode | `package.json`, `tsconfig.app.json` |
| Vite 6 | Dev server and production web build | `package.json`, `vite.config.ts` |
| `@vitejs/plugin-react` | React integration for Vite | `package.json`, `vite.config.ts` |
| Vitest 4 | Test runner | `package.json`, `vite.config.ts` |
| React Testing Library | Component and hook testing utilities | `package.json`, `src/App.test.tsx`, `src/hooks/useQuiz.test.ts` |
| `fake-indexeddb` | IndexedDB isolation in tests | `package.json`, `src/services/storageService.test.ts` |
| Capacitor CLI | Android sync/open commands | `package.json`, `capacitor.config.ts` |
| Electron + `electron-builder` | Intended Windows packaging toolchain | `package.json`, `docs/2026-06-03-windows-packaging-design.md` |

### 4) Key Commands

```bash
npm install
npm run build
npm run test -- --run
[TODO] No lint command is configured in package.json
```

### 5) Environment and Config

- Config sources: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `capacitor.config.ts`, `.vscode/launch.json`, `.vscode/tasks.json`
- Required env vars: `[TODO]` No `.env.example` or code-level `process.env` / `import.meta.env` usage was found in the inspected files or scan output.
- Deployment/runtime constraints: local-only app, no backend, browser/Capacitor runtime for product code; Android sync depends on `dist/`; Windows packaging is configured in `package.json` but the referenced Electron entry file is currently missing.

### 6) Evidence

- `package.json`
- `package-lock.json`
- `tsconfig.app.json`
- `vite.config.ts`
- `capacitor.config.ts`
- `AGENTS.md`
- `docs/codebase/.codebase-scan.txt`

