# Testing Patterns

## Core Sections (Required)

### 1) Test Stack and Commands

- Primary test framework: Vitest `^4.1.8`
- Assertion/mocking tools: React Testing Library, `@testing-library/jest-dom`, Vitest mocks/spies, `fake-indexeddb`
- Commands:

```bash
npm run test -- --run
[TODO] No separate unit/integration/e2e commands are defined
[TODO] No coverage command is defined
```

### 2) Test Layout

- Test file placement pattern: colocated with source under `src/`, with shared helpers in `src/__tests__/`.
- Naming convention: `*.test.ts` and `*.test.tsx`.
- Setup files and where they run: `vite.config.ts` configures `src/__tests__/setup.ts` as the shared setup file for all Vitest runs.

### 3) Test Scope Matrix

| Scope | Covered? | Typical target | Notes |
|-------|----------|----------------|-------|
| Unit | Yes | utilities, services, store, hooks, isolated components | Examples include `src/services/quizService.test.ts`, `src/store/appStore.test.ts`, `src/hooks/useQuiz.test.ts` |
| Integration | Partial | page-level flows across routing/state/storage boundaries | Page tests cover route-driven behavior with mocked storage and browser APIs |
| E2E | No | [TODO] none found | No Playwright/Cypress-style app flow tests were found |

### 4) Mocking and Isolation Strategy

- Main mocking approach: module-level mocking with `vi.mock(...)` for Capacitor and storage modules; browser APIs and IndexedDB are simulated in-process.
- Isolation guarantees: storage tests reset IndexedDB state between tests through `src/__tests__/resetDb.ts`; tests commonly clear mocks between cases.
- Common failure mode in tests: platform-dependent code needs explicit Capacitor mocking; `AGENTS.md` and `.github` instructions both call that out.

### 5) Coverage and Quality Signals

- Coverage tool + threshold: `[TODO]` no coverage reporter or threshold config found.
- Current reported coverage: `[TODO]` not found in inspected files.
- Known gaps/flaky areas: no CI pipeline enforces tests; no E2E coverage exists; Windows/Electron packaging has no runtime tests in the current tree.

### 6) Evidence

- `package.json`
- `vite.config.ts`
- `src/__tests__/setup.ts`
- `src/services/storageService.test.ts`
- `src/hooks/useQuiz.test.ts`
- `src/App.test.tsx`
- `.github/instructions/testing-standards.instructions.md`
- `docs/testing.md`

