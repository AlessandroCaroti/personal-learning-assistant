# Contributor Onboarding

## Purpose

This repository contains an offline study app for university exams. The same React + TypeScript + Vite codebase runs:

- as a web app in the browser
- as an Android app through Capacitor

There is no backend. All user data is stored locally on the device.

## Start Here

Read these files first:

1. `AGENTS.md`
2. `docs/2026-06-01-study-app-design-v2.md`
3. `src/App.tsx`
4. `src/types/index.ts`
5. `src/services/storageService.ts`
6. `src/services/fileService.ts`
7. `src/services/quizService.ts`

Those files define the project constraints, architecture boundaries, routing, persistence model, and import/session rules.

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- Zustand
- IndexedDB via `idb`
- Vitest + React Testing Library
- Capacitor Android
- `pdfjs-dist` for PDF viewing
- `mammoth` for DOCX to HTML conversion

See [package.json](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/package.json).

## Local Setup

### Prerequisites

- Node.js compatible with the current toolchain
- npm
- For Android work:
  - Android Studio
  - JDK 17
  - Android SDK installed locally

### Install dependencies

```bash
npm install
```

### Main commands

```bash
npm run dev
npm run build
npm run test -- --run
npm run cap:sync
npm run cap:android
```

The dev server runs on `http://localhost:5173`.

## Repository Layout

### Core source tree

- `src/components`
  Shared UI primitives and layout pieces.
- `src/pages`
  Route-level screens such as Home, Dashboard, Quiz, Flashcard, Summary, and Tutorial.
- `src/hooks`
  Stateful session logic and app-specific hooks.
- `src/services`
  Persistence, file import, and quiz preparation logic.
- `src/store`
  Minimal global state via Zustand.
- `src/types`
  Shared TypeScript domain models.
- `src/utils`
  Pure helper functions.

### Important docs

- [AGENTS.md](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/AGENTS.md)
- [2026-06-01-study-app-design-v2.md](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/docs/2026-06-01-study-app-design-v2.md)
- [2026-06-01-study-app-plan-v2.md](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/docs/2026-06-01-study-app-plan-v2.md)
- [2026-06-02-test-suite-design.md](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/docs/2026-06-02-test-suite-design.md)

## Application Map

### Top-level flow

- `/`
  Home page with exam CRUD.
- `/onboarding`
  First-run tutorial.
- `/guida`
  Tutorial page outside onboarding.
- `/esame/:examId`
  Exam dashboard.
- `/esame/:examId/riassunto`
  Summary viewer.
- `/esame/:examId/quiz/config`
  Quiz session configuration.
- `/esame/:examId/quiz/sessione`
  Quiz session.
- `/esame/:examId/quiz/risultato`
  Quiz results and error review.
- `/esame/:examId/flashcard/config`
  Flashcard session configuration.
- `/esame/:examId/flashcard/sessione`
  Flashcard session.

The route tree is defined in [App.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/App.tsx).

### Page responsibilities

- `HomePage`
  Create, rename, delete, and open exams.
- `DashboardPage`
  Import or replace quiz, flashcard, and summary files. Entry point for paused sessions.
- `SummaryPage`
  Renders imported `.html`, `.pdf`, or `.docx` summaries.
- `QuizConfigPage`
  Builds a quiz session from macro filters, question count, and optional time limit.
- `QuizSessionPage`
  Runs the active quiz, pause flow, timer behavior, and submission.
- `QuizResultPage`
  Shows score, previous sessions, error analysis, and "review errors" flow.
- `FlashcardConfigPage`
  Builds a flashcard session from macro filters, card count, and optional time limit.
- `FlashcardSessionPage`
  Runs the flashcard deck, self-evaluation flow, review queue, pause flow, and timer behavior.
- `TutorialPage`
  First-run onboarding and reusable AI prompt guide.

## Architecture Rules

### 1. Keep platform-specific code isolated

`src/services/fileService.ts` is the only file that should directly handle platform-specific file picking logic.

Do not import Capacitor platform APIs elsewhere unless there is a strong reason and the architecture is deliberately updated.

### 2. Keep global state small

Global state lives in [appStore.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/store/appStore.ts) and is intentionally limited. Session logic belongs in hooks, not in Zustand.

### 3. Persistence goes through `storageService`

Do not scatter raw IndexedDB usage around the app. Use [storageService.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/services/storageService.ts) as the boundary.

### 4. Validation happens before storage

Quiz and flashcard imports must be validated before being persisted. That logic lives in [quizService.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/services/quizService.ts).

### 5. `android/` is generated

Do not manually edit generated Android application source under `android/` unless the change is explicitly part of Capacitor platform maintenance. Normal product changes belong in `src/`, then flow into Android via `npm run cap:sync`.

## Data Model

Core shapes are defined in [index.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/types/index.ts).

The most important domain entities are:

- `Esame`
- `QuizDomanda`
- `FlashCard`
- `PausedSession`

Persistence stores managed by IndexedDB:

- `esami`
- `quizSessions`
- `questionStats`
- `flashcardStats`
- `pausedSessions`

## Hook Boundaries

### `useExam`

Owns exam CRUD behavior and Home page data flow.

### `useQuiz`

Owns quiz session state, confirmation logic, scoring, persistence, review-session behavior, and pause/resume integration.

### `useFlashcard`

Owns flashcard session state, self-evaluations, review queue behavior, persistence, and pause/resume integration.

### `useTimer`

Shared timer abstraction used by both quiz and flashcard flows.

When changing session behavior, start from the hook and then validate the affected pages.

## Styling Conventions

- Single stylesheet: [index.css](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/index.css)
- Theme variables are defined as CSS custom properties
- Theme is toggled via `data-theme="dark|light"` on `<html>`
- Do not add Tailwind
- Do not add a UI component library

Preserve the existing styling direction instead of introducing a second styling system.

## Testing Expectations

Testing is the main safety net in this repo.

After every code change, run:

```bash
npm run test -- --run
```

### Test patterns

- Keep tests colocated next to the source file
- Use `*.test.ts` and `*.test.tsx`
- For tests touching IndexedDB, import `fake-indexeddb/auto`
- Mock `@capacitor/core` in tests so the default behavior is web, not native

Examples:

- [useQuiz.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/hooks/useQuiz.test.ts)
- [storageService.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/services/storageService.test.ts)
- [QuizSessionPage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/QuizSessionPage.test.tsx)

## Common Contributor Workflows

### Add or change a page

1. Find the route in `src/App.tsx`
2. Update or add the page in `src/pages`
3. Reuse existing hooks where possible
4. Add or update page tests
5. Run `npm run test -- --run`

### Change quiz behavior

1. Start in `src/hooks/useQuiz.ts`
2. Check helper logic in `src/services/quizService.ts`
3. Validate result-page implications in `QuizResultPage`
4. Update tests for the hook and affected pages
5. Run the full test suite

### Change flashcard behavior

1. Start in `src/hooks/useFlashcard.ts`
2. Check config/session pages in `src/pages`
3. Confirm pause/review behavior still works
4. Update tests
5. Run the full test suite

### Change file import behavior

1. Check `src/services/fileService.ts`
2. Check validation and parsing in `src/services/quizService.ts`
3. Check import entry points in `DashboardPage`
4. Add tests for malformed input and replacement flows

### Ship a web change to Android

1. `npm run build`
2. `npm run cap:sync`
3. Build or run from Android Studio

If a change only exists in `src/` and was not synced, Android does not have it yet.

## Common Pitfalls

- Importing Capacitor-specific logic outside `fileService.ts`
- Bypassing `storageService.ts` for IndexedDB operations
- Forgetting that replacing quiz or flashcard files has cleanup consequences for stats and paused sessions
- Changing session behavior without checking pause/resume and timeout paths
- Editing generated Android files instead of the web source
- Skipping the full test run after a change

## How To Review Changes Safely

When reviewing or extending the app, prefer this order:

1. Read the relevant hook or service
2. Read the page that consumes it
3. Read the colocated tests
4. Make the smallest change that preserves the architecture boundaries
5. Run `npm run test -- --run`

## Suggested First Tasks For New Contributors

- Add a small UI improvement to an existing page and its test
- Improve error messaging for one import edge case
- Add test coverage around an existing hook behavior
- Refactor a page-level helper without changing behavior

Avoid starting with platform abstraction or persistence changes until you understand the current architecture boundaries.
