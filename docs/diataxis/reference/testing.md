# Testing reference

This page captures the test setup used in the repository.

## Tools

- Vitest
- React Testing Library
- `@testing-library/jest-dom`
- `fake-indexeddb`

## Test layout

- Test files live next to the source as `*.test.ts` and `*.test.tsx`.
- Shared setup runs from `src/__tests__/setup.ts`.
- IndexedDB tests use `fake-indexeddb/auto`.

## Mocking rules

- Mock `@capacitor/core` in tests that touch native-aware code.
- Use module mocks for storage and platform adapters when a test does not need the real implementation.

## Commands

| Command | Description |
|---|---|
| `npm run test -- --run` | Run the suite once |
| `npm run test` | Run the suite in watch mode |

