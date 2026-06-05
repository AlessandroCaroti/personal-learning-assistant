# Tutorial: Get the app running locally

This tutorial is for a new contributor who wants to see the app running and understand the main study flows without learning the whole codebase first.

## What you will learn

- Install dependencies
- Start the Vite dev server
- Open the app
- Recognize the main routes and study modes
- Confirm that the local-only storage model is working

## Prerequisites

- Node.js 18 or newer
- npm
- A clone of this repository

## Step 1: Install dependencies

Run:

```bash
npm install
```

This installs the app runtime, build tooling, and test dependencies.

## Step 2: Start the development server

Run:

```bash
npm run dev
```

Vite prints the local URL in the terminal, usually `http://localhost:5173`.

## Step 3: Open the app

Open the dev server URL in a browser.

You should see the home screen for the local study app. From there you can:

- create or select an exam
- import a quiz file
- import flashcards
- open summaries in supported formats

## Step 4: Walk the main flow

Use the UI to move through the core path:

1. Start from the home page.
2. Choose or create an exam.
3. Open the dashboard for that exam.
4. Launch a quiz session or flashcard session.
5. Return to the dashboard and inspect history or stats.

This confirms the route tree, session hooks, and local persistence all work together.

## Step 5: Verify local persistence

Refresh the page after creating or importing exam data.

The app should retain the stored exam and session history because persistence is handled locally through IndexedDB, not a backend service.

## Step 6: Try a production build

Run:

```bash
npm run build
```

This checks the TypeScript project and produces the production web build in `dist/`.

## What to read next

- [How to import study files](../how-to/import-study-files.md)
- [How to run Android sync](../how-to/run-android-sync.md)
- [Project reference](../reference/project-reference.md)
- [Architecture explanation](../explanation/architecture.md)

