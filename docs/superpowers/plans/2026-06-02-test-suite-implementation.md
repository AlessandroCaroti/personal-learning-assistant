# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved 2026-06-02 Vitest suite design by adding shared test infrastructure, expanding service and hook coverage, splitting bundled component tests into per-file tests, and landing focused quiz/flashcard page smoke tests.

**Architecture:** Follow the approved flat-test layout: one test file per source file, plus shared helpers in `src/__tests__/`. The repository already contains many colocated tests, so this plan expands existing files where they already match the source file and only creates new files where the design requires missing coverage or where a bundled test file (`baseComponents.test.tsx`) must be decomposed.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, jsdom, fake-indexeddb, Zustand, idb

---

## File Map

**Create**
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\__tests__\setup.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\__tests__\factories.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\__tests__\resetDb.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\ConfirmDialog.test.tsx`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\Timer.test.tsx`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\ProgressBar.test.tsx`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\DotNav.test.tsx`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\FileImportButton.test.tsx`

**Modify**
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\vite.config.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\package.json`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\services\storageService.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\utils\shuffle.test.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\utils\formatTime.test.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\services\quizService.test.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\services\storageService.test.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useTimer.test.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useQuiz.test.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useFlashcard.test.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useExam.test.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\store\appStore.test.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\pages\QuizSessionPage.test.tsx`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\pages\FlashcardSessionPage.test.tsx`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\baseComponents.test.tsx` (remove once split coverage is migrated)

**Reference Only**
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\docs\2026-06-02-test-suite-design.md`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\.github\instructions\testing-standards.instructions.md`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\services\quizService.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\services\storageService.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useQuiz.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useFlashcard.ts`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\pages\QuizSessionPage.tsx`
- `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\pages\FlashcardSessionPage.tsx`

### Task 1: Test Infrastructure And Shared Factories

**Files:**
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\vite.config.ts`
- Create: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\__tests__\setup.ts`
- Create: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\__tests__\factories.ts`
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\package.json`

- [ ] **Step 1: Write the failing infrastructure tests first**

```ts
// src/components/Timer.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Timer } from './Timer'

describe('Timer', () => {
  it('shows elapsed time when remaining is null', () => {
    render(<Timer elapsed={90} remaining={null} />)
    expect(screen.getByText('1:30')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the single failing test to prove setup is incomplete**

Run: `npm run test -- --run src/components/Timer.test.tsx`
Expected: FAIL because `toBeInTheDocument` is not available globally or the file does not exist yet.

- [ ] **Step 3: Add jsdom globals setup and the shared setup file**

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/__tests__/setup.ts'],
  },
})
```

```ts
// src/__tests__/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add the typed fixture builders used across hook, service, and page tests**

```ts
// src/__tests__/factories.ts
import type {
  Esame,
  FlashCard,
  FlashcardFile,
  PausedSession,
  QuizDomanda,
  QuizFile,
  QuizSession,
} from '../types'

export function makeQuizDomanda(overrides: Partial<QuizDomanda> = {}): QuizDomanda {
  return {
    id: 'q1',
    macroargomenti: ['Macro 1'],
    tipo: 'multipla',
    testo: 'Domanda 1',
    opzioni: ['A', 'B', 'C'],
    risposta_corretta: 'A',
    spiegazione: 'Spiegazione 1',
    ...overrides,
  }
}

export function makeEsame(overrides: Partial<Esame> = {}): Esame {
  return {
    id: 'exam-1',
    name: 'Analisi 1',
    createdAt: '2026-06-02T08:00:00.000Z',
    files: {},
    ...overrides,
  }
}
```

- [ ] **Step 5: Install or confirm the remaining test-time dependency surface**

```json
// package.json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "fake-indexeddb": "^6.2.5",
    "jsdom": "^29.1.1"
  }
}
```

- [ ] **Step 6: Re-run the seed test and then the full suite**

Run: `npm run test -- --run src/components/Timer.test.tsx`
Expected: PASS

Run: `npm run test -- --run`
Expected: PASS or FAIL only in known uncovered areas added later in this plan.

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts package.json src/__tests__/setup.ts src/__tests__/factories.ts src/components/Timer.test.tsx
git commit -m "test: add shared vitest setup and factories"
```

### Task 2: IndexedDB Test Reset Seam And Storage Helpers

**Files:**
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\services\storageService.ts`
- Create: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\__tests__\resetDb.ts`
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\services\storageService.test.ts`

- [ ] **Step 1: Write the failing storage reset test**

```ts
// src/services/storageService.test.ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '../__tests__/resetDb'
import { getAllEsami, saveEsame } from './storageService'
import { makeEsame } from '../__tests__/factories'

beforeEach(async () => {
  await resetDb()
})

describe('storageService reset', () => {
  it('starts each test from an empty database', async () => {
    expect(await getAllEsami()).toEqual([])
    await saveEsame(makeEsame())
    expect(await getAllEsami()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the targeted storage test**

Run: `npm run test -- --run src/services/storageService.test.ts`
Expected: FAIL because `resetDb` and `resetForTesting` do not exist yet.

- [ ] **Step 3: Expose a test-only reset seam in the storage service**

```ts
// src/services/storageService.ts
export async function resetForTesting(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
  }

  dbPromise = null
}
```

- [ ] **Step 4: Add the fake-indexeddb reset helper**

```ts
// src/__tests__/resetDb.ts
import { resetForTesting } from '../services/storageService'

export async function resetDb(): Promise<void> {
  await resetForTesting()

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('study-app-db')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Database deletion blocked'))
  })
}
```

- [ ] **Step 5: Expand storage coverage to the designed CRUD and cascade cases**

```ts
// src/services/storageService.test.ts
it('deleteEsame cascades only the selected exam records', async () => {
  await saveEsame(makeEsame({ id: 'exam-1' }))
  await saveEsame(makeEsame({ id: 'exam-2' }))
  await savePausedSession(makePausedQuiz({ examId: 'exam-1', id: 'exam-1__quiz' }))
  await savePausedSession(makePausedFlash({ examId: 'exam-2', id: 'exam-2__flashcard' }))

  await deleteEsame('exam-1')

  expect(await getEsame('exam-1')).toBeUndefined()
  expect(await getEsame('exam-2')).toBeDefined()
  expect(await getPausedSessionsForExam('exam-1')).toEqual([])
  expect(await getPausedSessionsForExam('exam-2')).toHaveLength(1)
})
```

- [ ] **Step 6: Re-run storage tests and the full suite**

Run: `npm run test -- --run src/services/storageService.test.ts`
Expected: PASS

Run: `npm run test -- --run`
Expected: PASS or FAIL only in later tasks.

- [ ] **Step 7: Commit**

```bash
git add src/services/storageService.ts src/__tests__/resetDb.ts src/services/storageService.test.ts
git commit -m "test: add indexeddb reset seam for storage tests"
```

### Task 3: Utilities And quizService Coverage Expansion

**Files:**
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\utils\shuffle.test.ts`
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\utils\formatTime.test.ts`
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\services\quizService.test.ts`

- [ ] **Step 1: Add the failing deterministic utility and validation cases**

```ts
// src/utils/formatTime.test.ts
it('does not cap values above one hour', () => {
  expect(formatTime(7384)).toBe('123:04')
})
```

```ts
// src/services/quizService.test.ts
it('rejects a domanda missing spiegazione', () => {
  const bad = makeQuizFile([{ ...makeQuizDomanda(), spiegazione: '' }])
  expect(() => validateQuizFile(bad)).toThrow(/spiegazione/i)
})

it('returns undefined opzioniShuffled for vero_falso questions', () => {
  const [built] = buildSessionQuestions([makeVeroFalso()], 1)
  expect(built.opzioniShuffled).toBeUndefined()
})
```

- [ ] **Step 2: Run the targeted utility and service tests**

Run: `npm run test -- --run src/utils/formatTime.test.ts src/services/quizService.test.ts`
Expected: FAIL on missing edge-case coverage or missing builders referenced from `factories.ts`.

- [ ] **Step 3: Expand the builder helpers so service tests stay typed and concise**

```ts
// src/__tests__/factories.ts
export function makeVeroFalso(overrides: Partial<QuizDomanda> = {}): QuizDomanda {
  return makeQuizDomanda({
    id: 'q2',
    tipo: 'vero_falso',
    opzioni: undefined,
    risposta_corretta: 'Vero',
    ...overrides,
  })
}

export function makeQuizFile(domande: QuizDomanda[] = [makeQuizDomanda()]): QuizFile {
  return { esame: 'Analisi 1', domande }
}
```

- [ ] **Step 4: Implement the full designed assertions in the existing service test files**

```ts
// src/services/quizService.test.ts
it('filters by any matching macroargomento', () => {
  const result = filterDomande(
    [
      makeQuizDomanda({ id: 'q1', macroargomenti: ['A'] }),
      makeQuizDomanda({ id: 'q2', macroargomenti: ['B', 'C'] }),
    ],
    ['C'],
  )

  expect(result.map((domanda) => domanda.id)).toEqual(['q2'])
})
```

```ts
// src/utils/shuffle.test.ts
it('produces both permutations of a two-element array across repeated runs', () => {
  const seen = new Set<string>()
  for (let index = 0; index < 100; index += 1) {
    seen.add(shuffle(['A', 'B']).join(','))
  }
  expect(seen).toEqual(new Set(['A,B', 'B,A']))
})
```

- [ ] **Step 5: Run the targeted files and full suite**

Run: `npm run test -- --run src/utils/shuffle.test.ts src/utils/formatTime.test.ts src/services/quizService.test.ts`
Expected: PASS

Run: `npm run test -- --run`
Expected: PASS or FAIL only in later tasks.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/factories.ts src/utils/shuffle.test.ts src/utils/formatTime.test.ts src/services/quizService.test.ts
git commit -m "test: expand utility and quiz service coverage"
```

### Task 4: Hook Baseline Coverage For `useTimer` And `useExam`

**Files:**
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useTimer.test.ts`
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useExam.test.ts`

- [ ] **Step 1: Add the failing timer and exam-hook edge tests**

```ts
// src/hooks/useTimer.test.ts
it('keeps remaining at zero after expiry', () => {
  const onExpire = vi.fn()
  const { result } = renderHook(() => useTimer({ limitSeconds: 2, onExpire }))

  act(() => {
    vi.advanceTimersByTime(5000)
  })

  expect(result.current.remaining).toBe(0)
  expect(onExpire).toHaveBeenCalledTimes(1)
})
```

```ts
// src/hooks/useExam.test.ts
it('trims whitespace when creating an exam', async () => {
  getAllEsami.mockResolvedValue([])
  const { result } = renderHook(() => useExam())

  await act(async () => {
    await result.current.createEsame('  Analisi 1  ')
  })

  expect(saveEsame).toHaveBeenCalledWith(expect.objectContaining({ name: 'Analisi 1' }))
})
```

- [ ] **Step 2: Run the targeted hook tests**

Run: `npm run test -- --run src/hooks/useTimer.test.ts src/hooks/useExam.test.ts`
Expected: FAIL until the new assertions or mocks are wired correctly.

- [ ] **Step 3: Align the test harness with repo conventions**

```ts
// src/hooks/useTimer.test.ts
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
```

```ts
// src/hooks/useExam.test.ts
vi.mock('../services/storageService', () => ({
  getAllEsami,
  getEsame,
  saveEsame,
  deleteEsame,
}))
```

- [ ] **Step 4: Add the full approved cases for loading transitions, sorting, and pause/expire semantics**

```ts
// src/hooks/useExam.test.ts
it('sorts exams by createdAt ascending after reload', async () => {
  getAllEsami.mockResolvedValue([
    makeEsame({ id: 'b', createdAt: '2026-06-02T10:00:00.000Z' }),
    makeEsame({ id: 'a', createdAt: '2026-06-02T08:00:00.000Z' }),
  ])

  const { result } = renderHook(() => useExam())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.esami.map((esame) => esame.id)).toEqual(['a', 'b'])
})
```

- [ ] **Step 5: Run the targeted files and then all tests**

Run: `npm run test -- --run src/hooks/useTimer.test.ts src/hooks/useExam.test.ts`
Expected: PASS

Run: `npm run test -- --run`
Expected: PASS or FAIL only in later tasks.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTimer.test.ts src/hooks/useExam.test.ts
git commit -m "test: expand timer and exam hook coverage"
```

### Task 5: Full `useQuiz` Behavioral Matrix

**Files:**
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useQuiz.test.ts`

- [ ] **Step 1: Add the failing matrix entries that are missing from the current hook coverage**

```ts
// src/hooks/useQuiz.test.ts
it('confirmAnswer is a no-op when no answer is selected', () => {
  const { result } = renderHook(() => useQuiz('exam-1'))

  act(() => {
    result.current.startSession([makeQuizDomanda()], [], 1, null)
    result.current.confirmAnswer('q1', 10)
  })

  expect(result.current.sessionState?.confirmedAnswers).toEqual({})
})

it('goTo clears any selected but unconfirmed answer', () => {
  const { result } = renderHook(() => useQuiz('exam-1'))

  act(() => {
    result.current.startSession([makeQuizDomanda(), makeQuizDomanda({ id: 'q2' })], [], 2, null)
    result.current.selectAnswer('A')
    result.current.goTo(1)
  })

  expect(result.current.sessionState?.selectedAnswer).toBeNull()
  expect(result.current.sessionState?.currentIndex).toBe(1)
})
```

- [ ] **Step 2: Run only `useQuiz` tests**

Run: `npm run test -- --run src/hooks/useQuiz.test.ts`
Expected: FAIL until all branches described in the design are represented.

- [ ] **Step 3: Refactor the test file onto the shared builders instead of inline fixtures**

```ts
// src/hooks/useQuiz.test.ts
import { makePausedQuiz, makeQuizDomanda } from '../__tests__/factories'

const domande = [
  makeQuizDomanda({ id: 'q1', macroargomenti: ['Algebra'], risposta_corretta: '4', opzioni: ['3', '4'] }),
  makeVeroFalso({ id: 'q2', macroargomenti: ['Geometria'] }),
  makeQuizDomanda({ id: 'q3', macroargomenti: ['Algebra', 'Analisi'], risposta_corretta: '6', opzioni: ['5', '6'] }),
]
```

- [ ] **Step 4: Add the remaining approved `startSession`, `pauseSession`, `finishSession`, `startReviewSession`, and `resumeFromPaused` cases**

```ts
// src/hooks/useQuiz.test.ts
it('stores pause payload with ordered question ids and elapsed time', async () => {
  const { result } = renderHook(() => useQuiz('exam-1'))

  act(() => {
    result.current.startSession(domande, ['Algebra'], 2, 600)
    result.current.selectAnswer('4')
    result.current.confirmAnswer('q1', 5)
  })

  await act(async () => {
    await result.current.pauseSession(123)
  })

  expect(savePausedSession).toHaveBeenCalledWith(expect.objectContaining({
    id: 'exam-1__quiz',
    mode: 'quiz',
    elapsedSeconds: 123,
  }))
})
```

- [ ] **Step 5: Re-run the hook test and the entire suite**

Run: `npm run test -- --run src/hooks/useQuiz.test.ts`
Expected: PASS

Run: `npm run test -- --run`
Expected: PASS or FAIL only in later tasks.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useQuiz.test.ts src/__tests__/factories.ts
git commit -m "test: complete useQuiz behavioral coverage"
```

### Task 6: Full `useFlashcard` Behavioral Matrix

**Files:**
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\hooks\useFlashcard.test.ts`

- [ ] **Step 1: Add the first failing cases for the flashcard review loop and pause payload**

```ts
// src/hooks/useFlashcard.test.ts
it('enters review mode when a no-eval card remains at the end', () => {
  const cards = [makeFlashCard({ id: 'f1' }), makeFlashCard({ id: 'f2' })]
  const { result } = renderHook(() => useFlashcard('exam-1'))

  act(() => {
    result.current.startSession(cards, [], 2, null)
    result.current.evaluate(result.current.sessionState!.cards[0].id, 'No')
    result.current.evaluate(result.current.sessionState!.cards[0].id, 'Sì')
  })

  expect(result.current.sessionState?.isInReview).toBe(true)
})
```

- [ ] **Step 2: Run only the flashcard hook test**

Run: `npm run test -- --run src/hooks/useFlashcard.test.ts`
Expected: FAIL until the test matrix matches the current hook branches.

- [ ] **Step 3: Move the file onto shared builders and shared storage mocks**

```ts
// src/hooks/useFlashcard.test.ts
import { makeFlashCard, makePausedFlash } from '../__tests__/factories'

vi.mock('../services/storageService', () => ({
  saveFlashcardStat,
  savePausedSession,
  deletePausedSession,
}))
```

- [ ] **Step 4: Add the full approved cases for `showBack`, `dontKnow`, `evaluate`, `isDone`, `pauseSession`, `finishSession`, and `resumeFromPaused`**

```ts
// src/hooks/useFlashcard.test.ts
it('marks unevaluated cards as Non risposta on finish', async () => {
  const cards = [makeFlashCard({ id: 'f1' }), makeFlashCard({ id: 'f2' })]
  const { result } = renderHook(() => useFlashcard('exam-1'))

  act(() => {
    result.current.startSession(cards, [], 2, null)
    result.current.evaluate(result.current.sessionState!.cards[0].id, 'Sì')
  })

  await act(async () => {
    await result.current.finishSession(30, true)
  })

  expect(saveFlashcardStat).toHaveBeenCalledWith(expect.objectContaining({
    examId: 'exam-1',
    cardId: 'f2',
    lastEval: 'Non risposta',
  }))
})
```

- [ ] **Step 5: Re-run the file and full suite**

Run: `npm run test -- --run src/hooks/useFlashcard.test.ts`
Expected: PASS

Run: `npm run test -- --run`
Expected: PASS or FAIL only in later tasks.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFlashcard.test.ts src/__tests__/factories.ts
git commit -m "test: complete useFlashcard behavioral coverage"
```

### Task 7: Store And Component Test Decomposition

**Files:**
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\store\appStore.test.ts`
- Create: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\ConfirmDialog.test.tsx`
- Create: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\Timer.test.tsx`
- Create: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\ProgressBar.test.tsx`
- Create: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\DotNav.test.tsx`
- Create: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\FileImportButton.test.tsx`
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\components\baseComponents.test.tsx`

- [ ] **Step 1: Add the first failing per-file component tests**

```ts
// src/components/ConfirmDialog.test.tsx
it('renders nothing when open is false', () => {
  render(
    <ConfirmDialog
      open={false}
      title="Titolo"
      message="Messaggio"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  )

  expect(screen.queryByText('Titolo')).toBeNull()
})
```

```ts
// src/store/appStore.test.ts
it('applies the data-theme attribute when toggled', () => {
  useAppStore.getState().toggleTheme()
  expect(document.documentElement.dataset.theme).toBe('light')
})
```

- [ ] **Step 2: Run the targeted component and store tests**

Run: `npm run test -- --run src/store/appStore.test.ts src/components/ConfirmDialog.test.tsx`
Expected: FAIL until the new files exist.

- [ ] **Step 3: Migrate the bundled component coverage into per-source test files**

```ts
// src/components/FileImportButton.test.tsx
vi.mock('../services/fileService', () => ({
  fileService: {
    pickFile: vi.fn(),
  },
}))

it('shows an inline error when file picking fails', async () => {
  vi.mocked(fileService.pickFile).mockRejectedValue(new Error('schema mancante'))
  render(<FileImportButton label="Importa" accept={['.json']} onFile={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Importa' }))
  expect(await screen.findByText(/File non valido/i)).toBeInTheDocument()
})
```

- [ ] **Step 4: Remove or shrink `baseComponents.test.tsx` once equivalent per-file coverage exists**

```ts
// src/components/baseComponents.test.tsx
describe.skip('legacy bundled component tests', () => {
  it('is replaced by per-component files', () => {})
})
```

Preferred end state: delete the file entirely after moving any useful extra assertions not covered by the design.

- [ ] **Step 5: Run all store/component tests and then the full suite**

Run: `npm run test -- --run src/store/appStore.test.ts src/components/ConfirmDialog.test.tsx src/components/Timer.test.tsx src/components/ProgressBar.test.tsx src/components/DotNav.test.tsx src/components/FileImportButton.test.tsx`
Expected: PASS

Run: `npm run test -- --run`
Expected: PASS or FAIL only in page smoke tests.

- [ ] **Step 6: Commit**

```bash
git add src/store/appStore.test.ts src/components/ConfirmDialog.test.tsx src/components/Timer.test.tsx src/components/ProgressBar.test.tsx src/components/DotNav.test.tsx src/components/FileImportButton.test.tsx src/components/baseComponents.test.tsx
git commit -m "test: split component coverage into per-file tests"
```

### Task 8: Quiz And Flashcard Session Page Smoke Tests

**Files:**
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\pages\QuizSessionPage.test.tsx`
- Modify: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\pages\FlashcardSessionPage.test.tsx`
- Reference: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\pages\QuizSessionPage.tsx`
- Reference: `C:\Users\carot\OneDrive\Desktop\Code\personal-learning-assistant\src\pages\FlashcardSessionPage.tsx`

- [ ] **Step 1: Add the first failing quiz-session smoke test using real hook logic and mocked storage**

```ts
// src/pages/QuizSessionPage.test.tsx
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

it('shows the first question after load', async () => {
  getEsame.mockResolvedValue(
    makeEsameWithQuiz([
      makeQuizDomanda({ id: 'q1', testo: 'Prima domanda?' }),
      makeQuizDomanda({ id: 'q2', testo: 'Seconda domanda?' }),
    ]),
  )

  render(
    <MemoryRouter
      initialEntries={[{
        pathname: '/esame/exam-1/quiz/sessione',
        state: { selectedMacro: [], count: 2, limitSeconds: null },
      }]}
    >
      <Routes>
        <Route path="/esame/:examId/quiz/sessione" element={<QuizSessionPage />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Prima domanda?')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the two targeted page files**

Run: `npm run test -- --run src/pages/QuizSessionPage.test.tsx src/pages/FlashcardSessionPage.test.tsx`
Expected: FAIL until the storage mocks, encoded file builders, and route-state shape are correct.

- [ ] **Step 3: Extend the factories to emit real encoded `ArrayBuffer` payloads for page decoding**

```ts
// src/__tests__/factories.ts
function encodeJson(value: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(value)).buffer
}

export function makeEsameWithQuiz(domande: QuizDomanda[] = [makeQuizDomanda()]): Esame {
  return makeEsame({
    files: {
      quiz: {
        name: 'quiz.json',
        type: 'application/json',
        data: encodeJson(makeQuizFile(domande)),
      },
    },
  })
}
```

- [ ] **Step 4: Add the approved quiz-page and flashcard-page smoke assertions**

```ts
// src/pages/FlashcardSessionPage.test.tsx
it('shows the back of the card after Mostra risposta', async () => {
  getEsame.mockResolvedValue(
    makeEsameWithFlashcard([
      makeFlashCard({ id: 'f1', fronte: 'Definizione', retro: 'Spiegazione' }),
      makeFlashCard({ id: 'f2', fronte: 'Teorema', retro: 'Dimostrazione' }),
    ]),
  )

  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Mostra risposta' }))

  expect(screen.getByText('Spiegazione')).toBeInTheDocument()
  expect(screen.getByText('Retro')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run the page files and then the full suite**

Run: `npm run test -- --run src/pages/QuizSessionPage.test.tsx src/pages/FlashcardSessionPage.test.tsx`
Expected: PASS

Run: `npm run test -- --run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/factories.ts src/pages/QuizSessionPage.test.tsx src/pages/FlashcardSessionPage.test.tsx
git commit -m "test: add quiz and flashcard session smoke tests"
```

### Task 9: Final Verification, Cleanup, And Coverage Reconciliation

**Files:**
- Modify: any touched test file only if verification exposes a real defect

- [ ] **Step 1: Run the whole suite exactly as required by the repository**

Run: `npm run test -- --run`
Expected: PASS

- [ ] **Step 2: Reconcile the repository with the approved design counts and scope**

```text
Check that the repo now has:
- shared helpers in src/__tests__/
- one colocated test file per targeted source file
- storage reset seam via resetForTesting()
- explicit page smoke coverage for QuizSessionPage and FlashcardSessionPage
- no remaining dependency on the legacy bundled baseComponents test file
```

- [ ] **Step 3: If `baseComponents.test.tsx` still exists only as a compatibility stub, remove it and rerun the suite**

Run: `npm run test -- --run src/components`
Expected: PASS

Run: `npm run test -- --run`
Expected: PASS

- [ ] **Step 4: Commit the verified suite**

```bash
git add src
git commit -m "test: land approved study-app suite expansion"
```

## Self-Review

### Spec Coverage
- Shared setup and factories from the design are covered by Task 1.
- `resetDb()` plus `storageService.resetForTesting()` from the design notes are covered by Task 2.
- Utility and `quizService` expansions from Sections 1 and 2 are covered by Task 3.
- `useTimer` and `useExam` from Section 4 are covered by Task 4.
- `useQuiz` from Section 4 is covered by Task 5.
- `useFlashcard` from Section 4 is covered by Task 6.
- Store and per-component tests from Section 5 are covered by Task 7.
- The two smoke-tested pages from Section 6 are covered by Task 8.
- Suite-wide verification and cleanup are covered by Task 9.

### Gaps Found And Resolved
- The design says `location.state = { selectedMacro: [], n: 2, limitSec: null }`, but the current pages read `count` and `limitSeconds`. The plan uses the current code shape so implementation work tests the real app, not the outdated state shape in the spec.
- The repository already has broad existing test coverage, so the plan explicitly expands or reshapes current files instead of assuming greenfield creation for every target.

### Placeholder Scan
- No `TBD`, `TODO`, or “write tests for the above” placeholders remain.
- Every task names exact files and exact commands.
- Code-changing steps include concrete snippets rather than abstract instructions.

