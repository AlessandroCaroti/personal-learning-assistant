# Codebase Concerns

## Core Sections (Required)

### 1) Top Risks (Prioritized)

| Severity | Concern | Evidence | Impact | Suggested action |
|----------|---------|----------|--------|------------------|
| high | Windows packaging config points to `electron/main.mjs`, but the `electron/` directory is currently empty | `package.json`, `docs/2026-06-03-windows-packaging-design.md`, `Get-ChildItem -Recurse electron` result | `npm run build:win` is unlikely to work as documented until the entry file exists | Implement the Electron entry or remove/disable the packaging path until it is real |
| high | The documented “only `fileService.ts` contains platform-specific code” rule is violated by direct Capacitor usage in app/session pages | `AGENTS.md`, `src/App.tsx`, `src/pages/QuizSessionPage.tsx`, `src/pages/FlashcardSessionPage.tsx` | Platform boundary is harder to reason about and more expensive to test | Either update the architectural rule or extract native back-button behavior behind a dedicated platform adapter |
| medium | Summary PDF rendering does not match the design/agent docs that reference `pdfjs-dist`; the current page uses an `iframe` object URL instead | `AGENTS.md`, `docs/2026-06-01-study-app-design-v2.md`, `src/pages/SummaryPage.tsx`, `package.json` | Runtime behavior may differ from expectations for advanced PDF features or compatibility | Decide whether iframe rendering is intentional; if yes, update docs and dependency list |
| medium | Page files use extensive inline style objects despite `AGENTS.md` saying styling should be in `src/index.css` and “No inline styles” | `AGENTS.md`, `src/pages/HomePage.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/QuizSessionPage.tsx` | Styling conventions are inconsistent and harder to maintain globally | Align the rule with reality or migrate page-level styles into CSS systematically |
| medium | No lint/CI/coverage enforcement was found | `package.json`, `docs/codebase/.codebase-scan.txt`, `vite.config.ts` | Regressions depend on local discipline rather than automated gates | Add at least a lint command and CI test run if this repo is intended for ongoing collaboration |

### 2) Technical Debt

List the most important debt items only.

| Debt item | Why it exists | Where | Risk if ignored | Suggested fix |
|-----------|---------------|-------|-----------------|---------------|
| Missing Electron runtime files under a configured packaging path | Packaging design appears partially implemented | `package.json`, `docs/2026-06-03-windows-packaging-design.md`, `electron/` | Broken packaging workflow and misleading docs | Complete or remove the feature path |
| Large route components combine UI, navigation, and workflow error handling | Session flows were implemented directly in pages | `src/pages/QuizSessionPage.tsx`, `src/pages/FlashcardSessionPage.tsx`, `src/pages/DashboardPage.tsx` | Higher regression risk during feature changes | Extract more page orchestration into hooks/helpers |
| Documented conventions lag actual code | Repo guidance has not kept pace with implementation | `AGENTS.md` vs. current `src/` files | Contributors may follow incorrect constraints | Reconcile AGENTS/design docs with the current code |

### 3) Security Concerns

| Risk | OWASP category (if applicable) | Evidence | Current mitigation | Gap |
|------|--------------------------------|----------|--------------------|-----|
| Imported HTML summaries are rendered from user-controlled content via `iframe srcDoc` | A03:2021 Injection / N/A for local-only desktop usage | `src/pages/SummaryPage.tsx` | `sandbox=""` is set on the iframe | No explicit sanitization step was found before rendering HTML |
| Imported JSON/summary file sizes are not capped in inspected code | N/A | `src/services/fileService.ts`, `src/pages/DashboardPage.tsx`, `src/pages/SummaryPage.tsx` | Validation checks schema for quiz/flashcard JSON | No apparent size guard for large files or storage exhaustion |

### 4) Performance and Scaling Concerns

| Concern | Evidence | Current symptom | Scaling risk | Suggested improvement |
|---------|----------|-----------------|-------------|-----------------------|
| Entire imported files are stored as `ArrayBuffer` inside IndexedDB exam records | `src/types/index.ts`, `src/services/storageService.ts`, `src/pages/DashboardPage.tsx` | Acceptable for small local study materials | Large PDFs/DOCX/HTML files can bloat local DB size and load times | Add file-size guidance or caps; consider chunking/streaming only if requirements grow |
| Per-answer question stat updates re-read all stats for an exam | `src/hooks/useQuiz.ts` | Fine for small quiz sets | More questions per exam increases repeated DB reads | Query by exact stat key instead of fetching all exam stats on every confirm |

### 5) Fragile/High-Churn Areas

| Area | Why fragile | Churn signal | Safe change strategy |
|------|-------------|-------------|----------------------|
| `src/pages/QuizSessionPage.tsx` | Couples routing, timer wiring, pause dialogs, timeout completion, and result navigation | Listed in high-churn section of `docs/codebase/.codebase-scan.txt` | Change with page tests and hook tests together |
| `src/App.tsx` | Owns onboarding guard plus native back-button registration | Listed in high-churn section of `docs/codebase/.codebase-scan.txt` | Validate both web and native/back-button assumptions when editing |
| `src/hooks/useQuiz.ts` and `src/services/storageService.ts` | State persistence contract must match resume/finish behavior | Both appear in high-churn section of `docs/codebase/.codebase-scan.txt` | Update pause/resume and storage tests in the same change |
| `package.json` | Mixes app scripts, Android commands, and intended Windows packaging config | Highest churn in scan output | Treat packaging/tooling edits as release-affecting changes and verify commands explicitly |

### 6) `[ASK USER]` Questions

1. [ASK USER] Should the Windows/Electron packaging path remain a project goal, or should the current `package.json`/README/design-doc references be removed until the feature actually exists?
2. [ASK USER] Do you want the “platform-specific code only in `fileService.ts`” rule preserved as a hard boundary, or should native back-button handling be accepted as an explicit exception?
3. [ASK USER] Is iframe-based PDF rendering the intended long-term behavior, or do you want the code brought in line with the `pdfjs-dist` design references?

### 7) Evidence

- `docs/codebase/.codebase-scan.txt`
- `package.json`
- `AGENTS.md`
- `src/App.tsx`
- `src/pages/QuizSessionPage.tsx`
- `src/pages/FlashcardSessionPage.tsx`
- `src/pages/SummaryPage.tsx`
- `docs/2026-06-03-windows-packaging-design.md`
