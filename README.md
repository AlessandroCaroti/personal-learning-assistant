# Personal Learning Assistant

Local study app for university exams, built with React, TypeScript, Vite, and Capacitor.

It runs as a web app on desktop and as an Android APK, with all study data stored locally on the device.

## What It Does

- Create and manage exams from a local dashboard
- Import `quiz.json`, `flashcard.json`, and summary files for each exam
- Run quiz sessions with scoring, review mode, pause/resume, and question stats
- Run flashcard sessions with spaced review queues and per-card stats
- Read study summaries in `.html`, `.pdf`, or `.docx` format
- Provide a tutorial/onboarding flow for generating import files with AI tools
- Support Android back-button handling during active sessions

## Quick Start

```bash
npm install
npm run dev
```

Open the app at the Vite dev server shown in the terminal.

### Common Commands

```bash
npm run dev         # Start the web dev server
npm run build       # Type-check and build the production web app
npm run preview     # Preview the production build locally
npm run test -- --run  # Run the test suite once
npm run cap:sync    # Build and sync the web app into Android
npm run cap:android # Sync and open the Android project in Android Studio
npm run build:win   # Build a portable Windows EXE via Electron
```

## Project Structure

- `src/` - app source: pages, components, hooks, services, store, types, and utilities
- `docs/` - product and codebase documentation
- `android/` - Capacitor-generated Android project
- `electron/` - Electron entry point for Windows packaging
- `.github/instructions/` - repository-specific engineering guidance
- `.vscode/` - reusable VS Code tasks and debug configs

## Architecture

The app is a layered client-side SPA:

- `src/App.tsx` owns the route tree and onboarding guard
- `src/pages/` contains route-level screens
- `src/hooks/` contains the session state machines for quiz, flashcard, timer, and exam workflows
- `src/services/` contains the persistence, file-import, and quiz validation boundaries
- `src/store/` contains only minimal global state

Persistence is local-only through IndexedDB (`study-app-db`), with no backend or network dependency.

> [!NOTE]
> Platform-specific file picking is centralized in `src/services/fileService.ts`. Android back-button handling is also wired into the app shell and session pages.

## Data Model

The app works with these imported file types:

- `quiz.json` - exam name plus a `domande` array
- `flashcard.json` - exam name plus a `carte` array
- Summary files - `.html`, `.pdf`, or `.docx`

Stored exam data includes:

- exam metadata
- quiz session history
- question statistics
- flashcard statistics
- paused session state

## Documentation

The `docs/` folder contains the project’s source documentation:

- [docs/codebase/ARCHITECTURE.md](docs/codebase/ARCHITECTURE.md)
- [docs/codebase/STACK.md](docs/codebase/STACK.md)
- [docs/codebase/STRUCTURE.md](docs/codebase/STRUCTURE.md)
- [docs/codebase/CONVENTIONS.md](docs/codebase/CONVENTIONS.md)
- [docs/codebase/CONCERNS.md](docs/codebase/CONCERNS.md)
- [docs/codebase/TESTING.md](docs/codebase/TESTING.md)
- [docs/codebase/INTEGRATIONS.md](docs/codebase/INTEGRATIONS.md)

## Development Notes

- Use `npm run test -- --run` after code changes; tests are the main safety net.
- Do not edit `android/` manually.
- After web changes that need to reach Android, run `npm run build` and then `npm run cap:sync`.
- The repo uses React 18, TypeScript strict mode, Vitest, React Testing Library, IndexedDB via `idb`, and Capacitor for native integration.

## File Validation

Imported quiz and flashcard JSON must match the expected schemas before storage. Validation happens in `src/services/quizService.ts`.

## Status

- Offline-first, local-only study app
- Web, Android, and Windows packaging workflows are configured
- No backend services are required
