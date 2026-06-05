# How-to: Run the test suite

Use this guide when you want to check a change locally before you hand it off.

## Run tests once

```bash
npm run test -- --run
```

This is the repository's standard single-run test command.

## When to use it

Use the single-run form after code changes so you can confirm the repository still passes without leaving a watch process open.

## What to expect

- Vitest runs the colocated `*.test.ts` and `*.test.tsx` files.
- React Testing Library covers components and flows.
- IndexedDB tests use `fake-indexeddb/auto`.
- Capacitor-dependent tests should mock native platform access.

## Common mistakes

- Forgetting to mock `@capacitor/core`
- Forgetting `fake-indexeddb/auto` in tests that touch storage
- Running only the watch mode and assuming it proves the change

## Related reference

- [Testing reference](../reference/testing.md)
- [Commands reference](../reference/commands.md)

