# Windows Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing study app build into a working portable Windows `.exe` by adding the missing Electron entrypoint, wiring a minimal Electron development workflow, and verifying packaging without changing the web application layer.

**Architecture:** Keep the React + Vite app as the only application implementation and add a thin Electron shell that loads either the packaged `dist/index.html` or the Vite dev server. Reuse the existing `electron-builder` configuration in `package.json`, keep all app logic in `src/`, and validate the result with the current Vitest suite plus a Windows packaging smoke test.

**Tech Stack:** React 18, TypeScript, Vite 6, Electron 42, electron-builder 26, Vitest

---

## File Structure

### Files to Create

- `electron/main.mjs`
  - Electron main-process entrypoint
  - Creates the single BrowserWindow
  - Loads `http://localhost:5173` in dev and `dist/index.html` in packaged mode
  - Owns only desktop-shell lifecycle logic

### Files to Modify

- `package.json`
  - Keep existing Windows packaging config
  - Add a dedicated Electron development script
  - Keep `main` pointed at `electron/main.mjs`

- `README.md`
  - Document the supported Electron development flow
  - Keep the Windows packaging instructions aligned with the real scripts

- `.gitignore`
  - Only modify if Electron development introduces a new ignored artifact

### Files That Must Stay Unchanged

- `src/**`
- `src/services/fileService.ts`
- `src/services/storageService.ts`
- `vite.config.ts`
- `android/**`

---

### Task 1: Add the Electron Main Process

**Files:**
- Create: `electron/main.mjs`
- Verify against: `package.json`

- [ ] **Step 1: Confirm the current packaging gap**

Run:

```bash
rg -n "\"main\"|\"build:win\"|\"electron\"" package.json
```

Expected:

```text
package.json contains:
- "main": "electron/main.mjs"
- "build:win": "npm run build && electron-builder --win portable"
- electron and electron-builder devDependencies
```

- [ ] **Step 2: Create `electron/main.mjs` with a minimal secure Electron shell**

Write:

```js
import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEV_SERVER_URL = 'http://localhost:5173'
const isDev =
  !app.isPackaged ||
  process.env.ELECTRON_RENDERER_URL === DEV_SERVER_URL ||
  process.env.NODE_ENV === 'development'

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL || DEV_SERVER_URL)
    return window
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
  window.loadFile(indexPath)
  return window
}

app.whenReady().then(() => {
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

- [ ] **Step 3: Sanity-check the new file exists at the exact path referenced by `package.json`**

Run:

```bash
Get-Content electron\main.mjs
```

Expected:

```text
The file opens successfully and contains:
- BrowserWindow setup
- contextIsolation: true
- nodeIntegration: false
- dev URL loading
- dist/index.html loading
```

- [ ] **Step 4: Commit the Electron entrypoint**

Run:

```bash
git add electron/main.mjs
git commit -m "feat: add electron main process entrypoint"
```

Expected:

```text
A commit is created with the new Electron shell file.
```

---

### Task 2: Add a Supported Electron Development Script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Write the failing workflow expectation down by checking scripts**

Run:

```bash
rg -n "\"scripts\"|\"dev\"|\"build:win\"|\"electron:dev\"" package.json
```

Expected:

```text
There is no "electron:dev" script yet.
```

- [ ] **Step 2: Add the minimal Electron development script**

Update the `scripts` block in `package.json` to include:

```json
{
  "scripts": {
    "dev": "vite",
    "electron:dev": "electron .",
    "build": "tsc -b && vite build",
    "build:win": "npm run build && electron-builder --win portable",
    "test": "vitest",
    "preview": "vite preview",
    "cap:sync": "npm run build && npx cap sync",
    "cap:android": "npm run cap:sync && npx cap open android"
  }
}
```

Notes for the implementing agent:

- Keep the existing script names and order stable where practical.
- Do not add `cross-env`, `wait-on`, `concurrently`, or hot-reload tooling.
- The plan intentionally keeps Electron dev as a simple second process.

- [ ] **Step 3: Verify the package metadata still matches the design**

Run:

```bash
rg -n "\"main\"|\"electron:dev\"|\"build:win\"|\"appId\"|\"productName\"" package.json
```

Expected:

```text
package.json contains:
- "main": "electron/main.mjs"
- "electron:dev": "electron ."
- "build:win": "npm run build && electron-builder --win portable"
- "appId": "com.carot.personal-learning-assistant"
- "productName": "Personal Learning Assistant"
```

- [ ] **Step 4: Commit the script update**

Run:

```bash
git add package.json
git commit -m "chore: add electron development script"
```

Expected:

```text
A commit is created with the package script update.
```

---

### Task 3: Document the Windows Development and Packaging Workflow

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Confirm the README gap**

Run:

```bash
rg -n "Windows EXE|build:win|electron:dev|Vite dev server|portable" README.md
```

Expected:

```text
README documents build:win, but does not fully document the Electron development workflow.
```

- [ ] **Step 2: Update `README.md` to document both packaging and local Electron development**

Add or revise content so the Windows sections include:

```md
## Windows EXE

The `npm run build:win` command creates a portable Windows `.exe` in `release/`.
It uses Electron to wrap the Vite build output, so the generated executable runs the same app without depending on a browser shell.

## Electron development

Use two terminals:

1. Start the renderer:

```bash
npm run dev
```

2. Start Electron:

```bash
npm run electron:dev
```

Electron loads `http://localhost:5173` during development and the built `dist/index.html` during packaging.
```

Implementation notes:

- Keep the rest of the README intact.
- Do not introduce unsupported workflow claims such as hot reload inside Electron unless you verify them separately.

- [ ] **Step 3: Verify the documentation now matches the scripts**

Run:

```bash
rg -n "electron:dev|build:win|release/|localhost:5173" README.md package.json
```

Expected:

```text
README and package.json both reference:
- npm run build:win
- npm run electron:dev
- release/
- localhost:5173
```

- [ ] **Step 4: Commit the README update**

Run:

```bash
git add README.md
git commit -m "docs: document electron development workflow"
```

Expected:

```text
A commit is created with the updated Windows workflow documentation.
```

---

### Task 4: Verify the Existing Test Suite Still Passes

**Files:**
- Verify only: existing test files under `src/**`

- [ ] **Step 1: Run the full application test suite**

Run:

```bash
npm run test -- --run
```

Expected:

```text
PASS
All existing Vitest suites complete successfully with no application regressions.
```

- [ ] **Step 2: If the suite fails, stop and fix only Electron-induced regressions**

Allowed fixes:

```text
- Packaging metadata mistakes in package.json
- Electron entrypoint issues in electron/main.mjs
- Documentation-only mismatches if a script name was wrong
```

Disallowed fixes:

```text
- Unrelated refactors in src/
- New Windows-specific branches in fileService.ts
- Test rewrites to hide real regressions
```

- [ ] **Step 3: Commit only if a regression fix was needed**

Run:

```bash
git add package.json electron/main.mjs README.md
git commit -m "fix: resolve windows packaging regression"
```

Expected:

```text
Skip this commit if no regression fix was necessary.
```

---

### Task 5: Verify the Windows Package Builds

**Files:**
- Verify only: `electron/main.mjs`, `package.json`, `dist/`, `release/`

- [ ] **Step 1: Run the web production build**

Run:

```bash
npm run build
```

Expected:

```text
PASS
Vite produces dist/ without TypeScript or bundling errors.
```

- [ ] **Step 2: Build the portable Windows executable**

Run:

```bash
npm run build:win
```

Expected:

```text
PASS
electron-builder produces a portable .exe in release/
```

- [ ] **Step 3: Verify the expected output artifact exists**

Run:

```bash
Get-ChildItem release
```

Expected:

```text
release/ contains a file named like:
Personal Learning Assistant-0.1.0-x64.exe
```

- [ ] **Step 4: Commit only if build verification required a packaging fix**

Run:

```bash
git add package.json electron/main.mjs README.md
git commit -m "fix: complete windows packaging configuration"
```

Expected:

```text
Skip this commit if the build passed without further code changes.
```

---

### Task 6: Perform a Manual Smoke Test of the Packaged App

**Files:**
- Verify only: packaged executable under `release/`

- [ ] **Step 1: Launch the generated executable and verify startup**

Run:

```bash
Start-Process .\release\Personal*Assistant*.exe
```

Expected:

```text
The application window opens without requiring a browser window.
```

- [ ] **Step 2: Walk the core app flows manually**

Verify:

```text
- Home page loads
- Navigation to an exam dashboard works
- Quiz flow renders and advances
- Flashcard flow renders and advances
- Summary flow opens supported content
- Theme toggle still works
```

- [ ] **Step 3: Verify persistence and relaunch behavior**

Verify:

```text
- Create or open app data
- Close the packaged app
- Relaunch the same executable
- Confirm IndexedDB-backed data is still present
```

- [ ] **Step 4: Verify file import still works through the existing web path**

Verify:

```text
- Import a valid quiz.json
- Import a valid flashcard.json
- Confirm the imported data appears in the UI
- Confirm there is no new Electron-specific import branch
```

- [ ] **Step 5: Record findings in the implementation PR or handoff notes**

Template:

```md
## Windows smoke test

- Launch: PASS/FAIL
- Routing: PASS/FAIL
- Quiz flow: PASS/FAIL
- Flashcard flow: PASS/FAIL
- Summary flow: PASS/FAIL
- Persistence across relaunch: PASS/FAIL
- File import: PASS/FAIL
- Notes: <short factual note>
```

---

## Self-Review

### Spec Coverage Check

- Thin Electron wrapper: covered by Task 1
- `electron/main.mjs` entrypoint: covered by Task 1
- Existing `package.json` builder config retained: covered by Task 2
- Simple Electron development workflow: covered by Tasks 2 and 3
- No web-layer changes: enforced in File Structure and Task 4 constraints
- Test suite remains safety net: covered by Task 4
- Portable `.exe` build verification: covered by Task 5
- Manual smoke test: covered by Task 6

### Placeholder Scan

No `TODO`, `TBD`, or deferred “implement later” placeholders remain in the plan. Each task includes exact files, commands, and expected outcomes.

### Type and Naming Consistency

- Electron entrypoint is consistently `electron/main.mjs`
- Dev script is consistently `electron:dev`
- Packaging command is consistently `build:win`
- Product name is consistently `Personal Learning Assistant`

