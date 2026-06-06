# Project reference

This page is a quick technical reference for the repository structure and the main moving parts.

## Top-level layout

| Path | Purpose |
|---|---|
| `src/` | Application source code |
| `docs/` | Product and repository documentation |
| `android/` | Capacitor-generated Android project |
| `src-tauri/` | Tauri desktop wrapper and Windows bundling config |
| `.github/instructions/` | Repository-specific engineering guidance |
| `.vscode/` | Local debug and task definitions |

## Main application layers

| Layer | Responsibility |
|---|---|
| `src/App.tsx` | Route tree and top-level onboarding/back-button behavior |
| `src/pages/` | Route-level screens |
| `src/components/` | Reusable UI parts |
| `src/hooks/` | Session and workflow state machines |
| `src/services/` | Persistence, file handling, and validation |
| `src/store/` | Minimal global state |
| `src/types/` | Shared domain types |

## Key commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build production assets |
| `npm run test -- --run` | Run tests once |
| `npm run cap:sync` | Build and sync to Android |
| `npm run cap:android` | Sync and open Android Studio |
| `npm run tauri:dev` | Start the Tauri desktop shell against the Vite dev server |
| `npm run build:win` | Build the Windows NSIS installer |
| `npm run preview` | Preview the production web build |

## Local persistence stores

| Store | Purpose |
|---|---|
| `esami` | Exam metadata and imported file payloads |
| `quizSessions` | Quiz session history |
| `questionStats` | Per-question correctness tracking |
| `flashcardStats` | Per-card spacing and progress tracking |
| `pausedSessions` | Resume payloads for quiz and flashcard sessions |

## Supported imported files

| File | Purpose |
|---|---|
| `quiz.json` | Quiz exam content |
| `flashcard.json` | Flashcard deck content |
| `.html` | Summary content |
| `.pdf` | Summary content |
| `.docx` | Summary content |
