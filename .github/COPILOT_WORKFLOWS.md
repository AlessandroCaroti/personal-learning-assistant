# GitHub Copilot Workflows - Personal Learning Assistant

## Enabled Development Workflows

These workflows are now possible with the installed Copilot instructions and best practices:

---

## 1. Quiz Session Component Development

**Workflow**: Build quiz management UI components following React best practices

### Process
1. Ask Copilot: "Create a component for quiz session configuration"
2. Specify requirements: state management, TypeScript types, accessibility
3. Copilot generates following react-typescript.instructions.md standards
4. Auto-generated tests using testing-standards patterns
5. Validates accessibility against accessibility-standards

### Related Files
- [src/hooks/useQuiz.ts](../src/hooks/useQuiz.ts) - Quiz state machine
- [src/pages/QuizSessionPage.tsx](../src/pages/QuizSessionPage.tsx) - Example component
- [src/pages/QuizSessionPage.test.tsx](../src/pages/QuizSessionPage.test.tsx) - Example tests

---

## 2. TypeScript Type System Enhancement

**Workflow**: Build robust type definitions for domain models

### Process
1. Ask: "Create TypeScript interfaces for quiz configuration"
2. Copilot suggests discriminated unions, generic constraints
3. Validates against typescript-patterns.instructions.md
4. Generates type guards and helpers

### Benefits
- Type-safe data flow through components
- Compile-time error prevention
- Auto-complete in IDE
- Reduced runtime errors

### Related Files
- [src/types/index.ts](../src/types/index.ts) - Central type definitions
- Domain: Quiz questions, flashcards, exams

---

## 3. Test-First Development

**Workflow**: Write tests first, then implement

### Process
1. Ask: "Create Vitest tests for flashcard shuffle logic"
2. Copilot generates tests following testing-standards
3. Mock IndexedDB using fake-indexeddb
4. Run: npm run test -- --run
5. Implement to pass tests

### Coverage Areas
- Quiz/flashcard logic (shuffle, filtering)
- State machine transitions (useQuiz, useFlashcard)
- Storage layer operations (CRUD)
- Timer management (useTimer)

### Related Files
- [src/hooks/useQuiz.test.ts](../src/hooks/useQuiz.test.ts)
- [src/services/quizService.test.ts](../src/services/quizService.test.ts)
- [src/store/appStore.test.ts](../src/store/appStore.test.ts)

---

## 4. Performance Optimization Campaign

**Workflow**: Systematically optimize bundle size and runtime performance

### Process
1. Ask: "Which components should be code-split for performance?"
2. Copilot suggests React.lazy() placements
3. Recommend: npm run build analysis
4. Implement splitting following performance-optimization.instructions.md
5. Measure improvements with Vite analyze

### Optimization Targets
- Route-based code splitting (quiz vs flashcard sessions)
- Component lazy loading (Summary views)
- Bundle size monitoring
- IndexedDB query optimization

### Related Commands
`ash
npm run build          # Creates optimized bundle
npm run preview        # Test production build locally
`

---

## 5. Accessibility Audit & Enhancement

**Workflow**: Improve accessibility systematically

### Process
1. Ask: "Review this component for WCAG 2.1 AA compliance"
2. Copilot checks against accessibility-standards
3. Suggests: aria-labels, semantic HTML, keyboard nav
4. Implement keyboard navigation testing
5. Validate with screen reader

### Audit Checklist
- Semantic HTML structure
- Keyboard navigation (Tab, Enter, Escape)
- ARIA attributes for dynamic content
- Color contrast (4.5:1 minimum)
- Focus indicators visible

### Key Components
- [src/components/ThemeToggle.tsx](../src/components/ThemeToggle.tsx) - Dark/light mode
- [src/components/Timer.tsx](../src/components/Timer.tsx) - Countdown UI
- All form inputs and interactive elements

---

## 6. State Management Pattern Implementation

**Workflow**: Implement global and local state following patterns

### Process
1. Ask: "Create a Zustand store for exam management"
2. Copilot generates following pattern from appStore.ts
3. Create custom hooks for domain logic
4. Tests for state transitions
5. Integrate with components

### Architecture
- **Global State**: Zustand (theme, currentExamId)
- **Session State**: Custom hooks (useQuiz, useFlashcard)
- **Persistence**: IndexedDB (5 stores)
- **No Redux**: Keep it simple with Zustand

### Store Hierarchy
`
Global State (Zustand) → Custom Hooks → Components
          ↓
     IndexedDB Persistence
`

---

## 7. Platform-Specific Code Patterns

**Workflow**: Handle web vs Android differences safely

### Process
1. Ask: "Create a cross-platform file picker"
2. Copilot references [src/services/fileService.ts](../src/services/fileService.ts)
3. Abstracts Capacitor calls to single service
4. Web: File Picker API or input[type=file]
5. Android: @capawesome/capacitor-file-picker

### Key Rule
- **Never import Capacitor elsewhere** - only in fileService.ts
- Tests mock @capacitor/core
- Web builds use feature detection fallbacks

### Related Files
- [src/services/fileService.ts](../src/services/fileService.ts) - Platform abstraction
- [src/App.tsx](../src/App.tsx) - Back button handling for Android

---

## 8. Service Layer Development

**Workflow**: Build business logic services

### Process
1. Ask: "Create validation for imported quiz files"
2. Copilot adds to [src/services/quizService.ts](../src/services/quizService.ts)
3. Include TypeScript validation
4. Test with various input formats
5. Export helpers used in components

### Services
- **quizService.ts**: Quiz logic, validation, shuffling
- **storageService.ts**: IndexedDB CRUD
- **fileService.ts**: Platform-aware file handling

### Validation Pattern
- Each import format: quiz.json, flashcard.json, HTML, PDF
- Schema validation before storage
- User-friendly error messages

---

## 9. Documentation & Type Stubs

**Workflow**: Generate docs and type definitions from code

### Process
1. Ask: "Document the Esame type definition"
2. Copilot generates JSDoc from interface
3. Creates README for services
4. Generates type stubs for exports
5. Update docs/ folder

### Documentation
- API documentation in README
- Type reference guide
- Setup instructions
- Architecture diagrams

---

## 10. Mobile App Release Pipeline

**Workflow**: Build and release Android APK

### Process
1. Develop feature in web
2. Run: npm run test -- --run
3. Run: npm run build
4. Run: npm run cap:sync
5. Run: npm run cap:android
6. Build APK via Android Studio
7. Run: npm run cap:android (install debug)

### Testing Before Release
- Test all quiz/flashcard flows
- Test file import (android picks different method)
- Verify back button handling
- Check IndexedDB persistence

### Release Steps
`ash
npm run build
npm run cap:sync
# Android Studio: Build → Generate Signed APK
# Or: gradlew.bat assembleRelease
`

---

## Workflow Implementation Tips

### Daily Development
`ash
npm run dev              # Start dev server
npm run test             # Run tests in watch mode (in another terminal)
                        # Make changes and see tests update
`

### Before Committing
`ash
npm run test -- --run   # Ensure all tests pass
npm run build           # Verify production build works
`

### Code Review
- Ask Copilot: "Review this PR against our standards"
- Check: TypeScript types, tests, accessibility, performance

### Adding Features
1. Define types in src/types/index.ts
2. Write tests first
3. Implement component/hook/service
4. Run tests
5. Run accessibility audit
6. Create documentation

---

## Using Copilot Effectively for These Workflows

### Best Practices
1. **Be Specific**: "Create a typed hook for quiz state with tests"
2. **Reference Files**: "Like in src/hooks/useQuiz.ts, create a flashcard hook"
3. **Request Tests**: "Generate tests following our Vitest patterns"
4. **Ask for Validation**: "Check this for TypeScript strictness"

### Example Prompts
- "Create a component for displaying quiz results with accessibility support"
- "Write comprehensive tests for the shuffle utility"
- "Refactor this to use TypeScript generics properly"
- "Add ARIA labels and keyboard navigation to this form"
- "Split this component for code splitting following our patterns"

---

## Measurement & Validation

### Quality Gates
- All tests pass: npm run test -- --run
- No TypeScript errors: npx tsc --noEmit
- Bundle size: npm run build (check dist size)
- Accessibility: Manual keyboard nav testing
- Performance: React DevTools Profiler

### Metrics
- Test coverage: Aim for >80%
- Bundle size: Keep under 500KB gzip
- Accessibility score: Aim for 95+
- Performance: Lighthouse 90+

---

## Next Actions

1. **Try a Workflow**: Ask Copilot to "Create a new quiz component"
2. **Run Tests**: npm run test -- --run
3. **Review Generated Code**: Check against these guidelines
4. **Iterate**: Refine instructions based on results
5. **Document Patterns**: Update .github/instructions as needed

---

Generated: Personal Learning Assistant
Based on: awesome-copilot repository
Last Updated: June 2, 2026
