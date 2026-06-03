# Test Suite Guide

This repository uses Vitest with React Testing Library. Tests are colocated with the code they cover and are the main safety net for the app.

Current suite size at the time of writing:

- 26 test files
- 193 tests

## What Is Tested

### App Shell

- [src/App.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/App.test.tsx)
  - Verifies the top-level routing shell
  - Checks onboarding redirect behavior
  - Verifies `isSessionRoute()` only matches active quiz and flashcard session paths

### Components

- [src/components/ConfirmDialog.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/components/ConfirmDialog.test.tsx)
  - Confirms the dialog only renders when open
  - Checks confirm/cancel actions and basic accessibility behavior

- [src/components/DotNav.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/components/DotNav.test.tsx)
  - Verifies the dot navigation renders the right number of items
  - Checks active, answered, and unreachable states

- [src/components/FileImportButton.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/components/FileImportButton.test.tsx)
  - Covers file selection flows
  - Checks success and failure states for import handling

- [src/components/ProgressBar.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/components/ProgressBar.test.tsx)
  - Verifies percentage display and progress rendering

- [src/components/ThemeToggle.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/components/ThemeToggle.test.tsx)
  - Verifies theme switching behavior and document theme updates

- [src/components/Timer.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/components/Timer.test.tsx)
  - Verifies elapsed and remaining time display
  - Checks expiry behavior and timer presentation

### Hooks

- [src/hooks/useExam.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/hooks/useExam.test.ts)
  - Covers exam loading, sorting, creation, deletion, and selection

- [src/hooks/useFlashcard.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/hooks/useFlashcard.test.ts)
  - Covers flashcard session setup, evaluation, review queue behavior, pause/resume, timeout handling, and completion persistence

- [src/hooks/useQuiz.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/hooks/useQuiz.test.ts)
  - Covers quiz session setup, answer confirmation, navigation, pause/resume, review mode, timeout handling, and completion persistence

- [src/hooks/useTimer.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/hooks/useTimer.test.ts)
  - Covers timer tick behavior, expiry handling, and remaining-time updates

### Services

- [src/services/fileService.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/services/fileService.test.ts)
  - Covers file picking and platform-specific file import behavior

- [src/services/quizService.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/services/quizService.test.ts)
  - Covers quiz and flashcard JSON validation
  - Covers question filtering and session-question building

- [src/services/storageService.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/services/storageService.test.ts)
  - Covers IndexedDB persistence for exams, sessions, stats, and paused sessions
  - Verifies cascade behavior when exams are deleted
  - Uses the test-only reset seam to start from a clean database

### Store

- [src/store/appStore.test.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/store/appStore.test.ts)
  - Covers the minimal global Zustand store
  - Verifies theme changes and current exam selection behavior

### Pages

- [src/pages/DashboardPage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/DashboardPage.test.tsx)
  - Covers dashboard import, replacement, and paused-session entry points

- [src/pages/FlashcardConfigPage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/FlashcardConfigPage.test.tsx)
  - Covers flashcard session configuration and route-state driven setup

- [src/pages/FlashcardSessionPage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/FlashcardSessionPage.test.tsx)
  - Covers flashcard session startup, navigation, pause/resume, timeout completion, and review paths

- [src/pages/HomePage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/HomePage.test.tsx)
  - Covers exam list behavior and basic home-page interactions

- [src/pages/QuizConfigPage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/QuizConfigPage.test.tsx)
  - Covers quiz session configuration and route-state driven setup

- [src/pages/QuizResultPage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/QuizResultPage.test.tsx)
  - Covers result rendering, error review actions, and session metadata display

- [src/pages/QuizSessionPage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/QuizSessionPage.test.tsx)
  - Covers quiz session startup, answer flow, pause/resume, timeout completion, review mode, and delivery behavior

- [src/pages/SummaryPage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/SummaryPage.test.tsx)
  - Covers imported summary rendering for supported file types

- [src/pages/TutorialPage.test.tsx](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/pages/TutorialPage.test.tsx)
  - Covers the onboarding/tutorial flow

## Shared Test Helpers

- [src/__tests__/setup.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/__tests__/setup.ts)
  - Loads `@testing-library/jest-dom` for custom matchers

- [src/__tests__/factories.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/__tests__/factories.ts)
  - Provides reusable builders for exams, quiz questions, flashcards, sessions, and encoded file payloads

- [src/__tests__/resetDb.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/__tests__/resetDb.ts)
  - Clears the test IndexedDB database between storage tests

## How To Run Tests

### Full suite

```bash
npm run test -- --run
```

Use this after code changes when you want the full one-shot suite.

### Watch mode

```bash
npm run test
```

Use this while iterating locally. Vitest stays open and reruns matching tests as files change.

### Single file or subset

```bash
npm run test -- --run src/hooks/useQuiz.test.ts
npm run test -- --run src/pages/QuizSessionPage.test.tsx src/pages/FlashcardSessionPage.test.tsx
```

You can pass one file or several files to focus on a specific area.

### Component-only check

```bash
npm run test -- --run src/components
```

This is useful when you change shared UI primitives.

## Test Setup Notes

- Vitest is configured with `jsdom`, globals, and a shared setup file in [vite.config.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/vite.config.ts)
- `@testing-library/jest-dom` is loaded once from [src/__tests__/setup.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/__tests__/setup.ts)
- IndexedDB tests use `fake-indexeddb/auto` and the reset helper in [src/__tests__/resetDb.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/__tests__/resetDb.ts)
- Most tests mock `@capacitor/core` so web behavior is the default in tests
- Shared builders in [src/__tests__/factories.ts](/C:/Users/carot/OneDrive/Desktop/Code/personal-learning-assistant/src/__tests__/factories.ts) keep tests concise and typed

## Practical Notes

- Tests are colocated with the source file they cover, so the fastest way to understand behavior is to read the implementation and its test side by side.
- When you change hooks or services, update the corresponding page tests as well if the user-visible flow changes.
- For storage-related work, reset the database between tests instead of relying on implicit state.
- If a new test fails because a matcher like `toBeInTheDocument()` is missing, check the Vitest setup file first.

