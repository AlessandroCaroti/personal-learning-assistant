# GitHub Copilot Customization Index

Welcome! This directory contains GitHub Copilot customization files for the Personal Learning Assistant project.

## Quick Start

1. **View Summary**: [COPILOT_SUMMARY.md](COPILOT_SUMMARY.md) - Overview of installed files and usage
2. **Explore Workflows**: [COPILOT_WORKFLOWS.md](COPILOT_WORKFLOWS.md) - 10 practical development workflows
3. **Development Standards**: See [instructions/](instructions/) folder for detailed guidelines

## What's Here

### Summary Documents
- **[COPILOT_SUMMARY.md](COPILOT_SUMMARY.md)** - Installation summary and quick reference
- **[COPILOT_WORKFLOWS.md](COPILOT_WORKFLOWS.md)** - 10 development workflows you can use
- **[README.md](README.md)** - This file

### Instruction Files (in /instructions/)

| File | Purpose | Applies To |
|------|---------|-----------|
| react-typescript.instructions.md | React component patterns with TypeScript | *.tsx, *.ts |
| testing-standards.instructions.md | Vitest and RTL testing patterns | *.test.tsx, *.test.ts |
| typescript-patterns.instructions.md | TypeScript best practices | *.tsx, *.ts |
| accessibility-standards.instructions.md | WCAG accessibility guidelines | *.tsx, *.ts |
| performance-optimization.instructions.md | Performance optimization techniques | *.tsx, *.ts |

## How It Works

GitHub Copilot automatically discovers and applies these instruction files when you:
- Create or edit TypeScript/TSX files
- Ask for code generation or suggestions
- Request improvements to existing code
- Work with components, hooks, or services

The instructions guide Copilot to maintain consistency with your project standards and best practices.

## Getting Started

### For Developers
1. Read [COPILOT_SUMMARY.md](COPILOT_SUMMARY.md) for context
2. Skim [COPILOT_WORKFLOWS.md](COPILOT_WORKFLOWS.md) for available workflows
3. Start coding! Copilot will apply these guidelines automatically

### For Code Reviewers
Use [COPILOT_WORKFLOWS.md](COPILOT_WORKFLOWS.md) as a checklist:
- Does the code follow React/TypeScript patterns?
- Are tests comprehensive using Vitest/RTL?
- Is it accessible (WCAG 2.1 AA)?
- Are TypeScript types properly used?
- Is performance considered?

### For Project Managers
- Standards are documented in [COPILOT_SUMMARY.md](COPILOT_SUMMARY.md)
- Quality gates are defined in [COPILOT_WORKFLOWS.md](COPILOT_WORKFLOWS.md)
- Development velocity increases with consistent patterns

## Key Features of Your Setup

✅ **React 18 + TypeScript** - Modern React with full type safety
✅ **Vitest + React Testing Library** - Comprehensive testing framework
✅ **Zustand + IndexedDB** - Scalable state management
✅ **Vite** - Lightning-fast development and builds
✅ **Capacitor** - Cross-platform mobile support
✅ **WCAG Accessibility** - Inclusive design built-in
✅ **Performance-First** - Code splitting and optimization

## Project Commands

`ash
# Development
npm run dev              # Start dev server (localhost:5173)
npm run test             # Run tests in watch mode
npm run test -- --run    # Run tests once

# Production
npm run build            # Build for production
npm run preview          # Preview production build

# Mobile (Android)
npm run cap:sync         # Sync web build to Android
npm run cap:android      # Open Android Studio
`

## Architecture Overview

`
.github/
├── instructions/              # Copilot instruction files
│   ├── react-typescript.instructions.md
│   ├── testing-standards.instructions.md
│   ├── typescript-patterns.instructions.md
│   ├── accessibility-standards.instructions.md
│   └── performance-optimization.instructions.md
├── COPILOT_SUMMARY.md        # This installation summary
├── COPILOT_WORKFLOWS.md      # 10 development workflows
└── README.md                 # This index file

src/
├── hooks/                     # Custom state machine hooks
│   ├── useQuiz.ts
│   ├── useFlashcard.ts
│   ├── useTimer.ts
│   └── useExam.ts
├── services/                  # Business logic
│   ├── quizService.ts
│   ├── storageService.ts      # IndexedDB
│   └── fileService.ts         # Platform abstraction
├── types/                     # TypeScript definitions
├── components/                # Reusable UI components
├── pages/                     # Page components
└── store/                     # Zustand global store
`

## Recommended Workflows by Role

### Frontend Developer
1. Component Development (Workflow 1)
2. TypeScript Enhancement (Workflow 2)
3. Testing (Workflow 3)
4. Accessibility (Workflow 5)

### Full-Stack Developer
1. State Management (Workflow 6)
2. Service Layer (Workflow 8)
3. Platform-Specific Code (Workflow 7)
4. Mobile Release Pipeline (Workflow 10)

### QA/Tester
1. Testing (Workflow 3)
2. Accessibility Audit (Workflow 5)
3. Performance (Workflow 4)
4. Integration Testing (Workflow 10)

## Resources

- 📖 [Project AGENTS.md](../AGENTS.md) - Project overview and conventions
- 📚 [awesome-copilot](https://github.com/github/awesome-copilot) - Source of our patterns
- 🎯 [VS Code Copilot Docs](https://code.visualstudio.com/docs/copilot/copilot-customization)
- 📝 [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- ⚡ [Vite Documentation](https://vitejs.dev/)

## Support & Questions

1. Check [COPILOT_SUMMARY.md](COPILOT_SUMMARY.md) for general questions
2. Review [COPILOT_WORKFLOWS.md](COPILOT_WORKFLOWS.md) for specific workflows
3. Look at example files in src/ for implementation patterns
4. Ask Copilot directly: "How should I implement this following our patterns?"

## Contributing

When adding new patterns or improving existing ones:

1. Update the relevant instruction file in /instructions/
2. Document the pattern in [COPILOT_WORKFLOWS.md](COPILOT_WORKFLOWS.md)
3. Add example code to src/ demonstrating the pattern
4. Update this README if needed

---

**Personal Learning Assistant** | React + TypeScript + Vite + Capacitor
Generated with Copilot Best Practices from awesome-copilot repository
Last Updated: June 2, 2026
