---
description: 'Vitest and React Testing Library standards for personal learning assistant'
applyTo: '**/*.test.{ts,tsx}'
---

# Testing Standards - Vitest + React Testing Library

## Test Structure
- Name test files with .test.ts or .test.tsx suffix
- Place test files next to the code they test (colocated)
- Use describe blocks to organize related tests
- Use it() for individual test cases

## Mocking Strategy
- Always mock @capacitor/core in tests
- Use fake-indexeddb/auto for IndexedDB tests
- Mock external dependencies (APIs, services)
- Reset mocks between tests with afterEach

## Component Testing
- Render components with React Testing Library
- Query using accessible selectors (getByRole, getByLabel, getByText)
- Avoid querying by DOM structure or implementation details
- Test user interactions and visible outcomes

## Async Testing
- Use screen.findBy for async elements
- Use waitFor for complex async scenarios
- Always await async operations
- Set appropriate timeouts for slow operations

## Hooks Testing
- Use @testing-library/react hooks utilities
- Test hook behavior through components
- Mock dependencies the hook uses
- Verify state updates and side effects
