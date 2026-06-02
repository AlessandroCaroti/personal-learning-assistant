---
description: 'TypeScript best practices for the personal learning assistant'
applyTo: '**/*.{ts,tsx}'
---

# TypeScript Best Practices

## Type Definitions
- Always define prop interfaces for components
- Use discriminated unions for complex types
- Avoid using 'any' type - use 'unknown' instead
- Export types from type definition files

## Type Safety
- Enable strict mode in tsconfig.json
- Use type guards for runtime type checking
- Use exhaustiveness checks with switch statements
- Properly type async/await operations

## Interfaces vs Types
- Use interfaces for object shapes
- Use types for unions, primitives, tuples
- Keep interfaces focused and single-responsibility
- Document complex types with JSDoc

## Generic Types
- Use generics for reusable hooks and utilities
- Add proper constraints to generics (extends keyword)
- Use keyof for object key access
- Properly type callbacks and event handlers

## Common Patterns
- Use Record for object with known keys
- Use Partial/Omit/Pick for type transformations
- Use Extract/Exclude for union type filtering
- Use ReturnType/Parameters for function introspection
