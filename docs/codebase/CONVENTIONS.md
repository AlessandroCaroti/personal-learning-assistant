# Coding Conventions

## Core Sections (Required)

### 1) Naming Rules

| Item | Rule | Example | Evidence |
|------|------|---------|----------|
| Files | PascalCase for components/pages, camelCase for hooks/services/utils/store | `DashboardPage.tsx`, `useQuiz.ts`, `storageService.ts` | `docs/codebase/.codebase-scan.txt` |
| Functions/methods | camelCase verbs or verb phrases | `savePausedSession`, `startReviewSession`, `validateFlashcardFile` | `src/services/storageService.ts`, `src/hooks/useQuiz.ts`, `src/services/quizService.ts` |
| Types/interfaces | PascalCase interfaces and type aliases | `QuizSession`, `PausedSession`, `CardEval` | `src/types/index.ts` |
| Constants/env vars | `UPPER_SNAKE_CASE` for module constants | `DB_NAME`, `DB_VERSION`, `TIME_PRESETS` | `src/services/storageService.ts`, `src/pages/QuizConfigPage.tsx` |

### 2) Formatting and Linting

- Formatter: `[TODO]` No formatter config file was found in inspected repository files.
- Linter: `[TODO]` No ESLint or equivalent lint config was found; the scan only detected TypeScript config.
- Most relevant enforced rules: TypeScript `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`.
- Run commands: `[TODO]` No lint/format commands are defined in `package.json`; build and test commands are `npm run build` and `npm run test -- --run`.

### 3) Import and Module Conventions

- Import grouping/order: imports are grouped by external modules first, then local relative modules; type-only imports are used in multiple files (`import type`).
- Alias vs relative import policy: inspected source uses relative imports only; no alias mapping exists in `tsconfig.app.json`.
- Public exports/barrel policy: no barrel export files were found in `src/`; modules are imported directly from their file paths.

### 4) Error and Logging Conventions

- Error strategy by layer: service validation throws `Error`; pages catch and convert to user-facing strings or redirects; hooks often swallow failures after setting UI state or logging.
- Logging style and required context fields: logging is minimal and ad hoc via `console.error`, usually with a human-readable prefix plus the caught error object.
- Sensitive-data redaction rules: `[TODO]` no explicit redaction policy or logging standard was found.

### 5) Testing Conventions

- Test file naming/location rule: colocated `*.test.ts` and `*.test.tsx` files next to source, plus shared helpers under `src/__tests__/`.
- Mocking strategy norm: mock `@capacitor/core`; use `fake-indexeddb/auto` for IndexedDB tests; mock storage modules directly in hook tests.
- Coverage expectation: tests are described as the “main safety net” and `npm run test -- --run` is required after code changes in `AGENTS.md`, but no numeric coverage threshold was found.

### 6) Evidence

- `tsconfig.app.json`
- `package.json`
- `src/types/index.ts`
- `src/services/storageService.ts`
- `src/services/quizService.ts`
- `src/hooks/useQuiz.ts`
- `.github/instructions/testing-standards.instructions.md`
- `.github/instructions/react-typescript.instructions.md`
- `AGENTS.md`

