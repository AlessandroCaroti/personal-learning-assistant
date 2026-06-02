---
description: 'React with TypeScript development standards for the personal learning assistant'
applyTo: '**/*.{ts,tsx}'
---

# React + TypeScript Development Standards

## Component Patterns
- Use functional components with hooks for all new code
- Define prop interfaces explicitly using TypeScript
- Keep components focused and composable
- Use proper prop validation with TypeScript

## State Management
- Use Zustand for global state only (theme, currentExamId)
- Use custom hooks for session state machines
- Use IndexedDB via storageService for all persistence
- Prefer local component state over prop drilling

## Testing
- Use Vitest for unit tests
- Use React Testing Library for component tests
- Write tests colocated next to source files (*.test.tsx / *.test.ts)
- Mock @capacitor/core in all tests
- Use fake-indexeddb for tests touching IndexedDB

## TypeScript Rules
- Enable strict mode
- Use interfaces over types for object shapes
- Proper error handling with type guards
- Document complex types with JSDoc comments
