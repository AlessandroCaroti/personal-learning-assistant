# Windows Packaging - Design Spec

**Date:** 2026-06-03  
**Status:** Approved  
**Goal:** Package the existing React + TypeScript + Vite study app as a portable Windows `.exe` using Electron, while keeping the web application layer unchanged.

---

## Approach

Use Electron as a thin desktop shell around the existing Vite build, and package it with `electron-builder` as a portable Windows executable.

This is a target-state design document. It defines the intended final packaging shape, not a changelog of the repo's partial in-progress state.

**Out of scope:** auto-update, code signing, installer-based Windows distribution, IPC-driven native features, preload APIs, macOS/Linux packaging, and changes to the React application architecture.

---

## Architecture

```text
personal-learning-assistant/
|- src/                 <- existing web app, unchanged
|- dist/                <- Vite production build output
|- electron/
|  `- main.mjs          <- Electron main process entry point
|- release/             <- portable Windows build output
|- package.json         <- scripts + electron-builder config
`- README.md            <- packaging usage documentation
```

### Web Layer

The React app under `src/` remains the single application implementation. Routing, state, IndexedDB persistence, file import behavior, and theming stay in the web layer exactly as they are today.

No Windows-specific branch is added to `src/services/fileService.ts`. Inside Electron, the renderer still runs in Chromium, so the existing web path remains the default behavior unless a future requirement justifies native desktop integration.

### Electron Layer

The Electron process is intentionally minimal:

- creates the main `BrowserWindow`
- loads the packaged `dist/index.html` in production
- loads the Vite dev server in development
- owns desktop shell lifecycle only

The Electron layer does not own business logic, storage logic, routing, or file parsing.

### Data Persistence

The app continues to use the existing IndexedDB-based persistence layer implemented in `src/services/storageService.ts`. No persistence redesign is required for Windows packaging.

### Security

The BrowserWindow configuration should keep the renderer locked down:

- `contextIsolation: true`
- `nodeIntegration: false`

No preload script and no IPC surface should be introduced in the initial Windows packaging design.

---

## Packaging Design

### Main Process Entry

The final target state uses `electron/main.mjs` as the Electron entry point.

This matches the current package shape:

- repository root is already ESM (`"type": "module"`)
- `package.json` points `main` at `electron/main.mjs`
- the Electron process is small enough that a separate TypeScript compilation pipeline is unnecessary

Responsibilities of `electron/main.mjs`:

- create a single application window
- hide the default menu bar
- define sensible default and minimum window sizes
- load `dist/index.html` when packaged
- load the dev server URL during local Electron development
- handle standard Electron lifecycle events such as `window-all-closed` and `activate`

### Builder Configuration

The final target state keeps `electron-builder` configuration inside `package.json`.

Canonical packaging identity:

- `appId`: `com.carot.personal-learning-assistant`
- `productName`: `Personal Learning Assistant`

Packaged files:

- `dist/**/*`
- `electron/**/*`
- `package.json`

Windows target:

- `portable`

Output directory:

- `release/`

Portable artifact naming may remain versioned and architecture-specific.

---

## Scripts

### Production Build

The Windows packaging entry point remains:

```json
"build:win": "npm run build && electron-builder --win portable"
```

This flow is:

```text
npm run build                    -> dist/
electron-builder --win portable  -> release/Personal Learning Assistant-<version>-<arch>.exe
```

### Development Workflow

The design supports a simple Electron development workflow without adding extra tooling:

1. Run the Vite dev server for the renderer.
2. Start Electron so it loads the dev URL.

This can be documented as a two-terminal workflow. The design does not require hot-reload helpers, preload tooling, or a second build pipeline for the Electron process.

---

## Impact on Existing Application Code

### Files Expected to Change

- `electron/main.mjs`
- `package.json`
- `README.md`
- optionally `.gitignore` if additional Electron artifacts are introduced

### Files Expected to Stay Unchanged

- `src/**`
- `src/services/fileService.ts`
- `src/services/storageService.ts`
- `vite.config.ts`
- Capacitor Android source under `android/`

The central design constraint is that Windows packaging wraps the existing web app rather than forking it.

---

## Testing

No Windows-specific unit test suite is required for the initial packaging layer. The Electron shell is deliberately thin and should contain minimal logic.

The main safety net remains the existing application test suite:

```bash
npm run test -- --run
```

Validation for this packaging design should focus on:

- web test suite passing unchanged
- `npm run build` succeeding
- `npm run build:win` producing a portable executable in `release/`
- manual smoke test of the generated `.exe`

Recommended smoke-test checklist:

- app launches without a browser installed or open
- existing routing works
- IndexedDB-backed data persists across relaunches
- quiz, flashcard, and summary flows render correctly
- file import still works through the existing web path

---

## Prerequisites

- Node 18+
- installed npm dependencies
- Windows environment capable of running Electron packaging

No Android tooling is required for Windows packaging.

---

## Decisions

### Chosen

- Electron is a thin wrapper, not a second application layer.
- The Electron entry point is plain ESM JavaScript (`main.mjs`), not a TypeScript sub-build.
- `electron-builder` configuration stays in `package.json`.
- Windows distribution uses a portable executable target.

### Rejected

- separate `electron-dist/` compilation output
- preload and IPC before a concrete native requirement exists
- introducing Windows-specific code paths into the React application
- installer-first packaging

---

## Key Files by Task

| Task | File |
|---|---|
| Electron main process | `electron/main.mjs` |
| Windows packaging command and builder config | `package.json` |
| End-user packaging instructions | `README.md` |
| Web application implementation | `src/` |
