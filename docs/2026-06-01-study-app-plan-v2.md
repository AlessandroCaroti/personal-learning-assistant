# Study App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applicazione locale per studiare per esami universitari, disponibile come web app (PC) e APK Android (Capacitor), senza backend né connessione di rete.

**Architecture:** React + Vite + TypeScript come unico codebase; Capacitor wrapperizza la stessa web app per Android. Tutta la logica platform-specific è isolata in `fileService.ts`. La persistenza avviene esclusivamente tramite IndexedDB (libreria `idb`) — nessun server, nessun sync.

**Tech Stack:** React 18, TypeScript, Vite, React Router v6, Zustand, idb, mammoth, pdfjs-dist, @capacitor/core, @capacitor/app, @capawesome/capacitor-file-picker

---

## File Structure

```
study-app/
├── src/
│   ├── types/
│   │   └── index.ts                    # Tutte le TypeScript interfaces globali
│   ├── services/
│   │   ├── storageService.ts           # Wrapper tipizzato su IndexedDB (idb), version 2
│   │   ├── fileService.ts              # Abstraction layer web/Android per file picking
│   │   └── quizService.ts             # shuffle, filtro, scoring quiz
│   ├── hooks/
│   │   ├── useTimer.ts                 # Cronometro conta-su / conta-giù con pause/resume
│   │   ├── useQuiz.ts                  # Logica sessione quiz (stato, navigazione, conferma)
│   │   ├── useFlashcard.ts             # Logica sessione flashcard (stato, autovalutazione, coda)
│   │   └── useExam.ts                  # CRUD esami (create, rename, delete, import file)
│   ├── store/
│   │   └── appStore.ts                 # Zustand store (esame corrente, tema)
│   ├── utils/
│   │   ├── shuffle.ts                  # Fisher-Yates shuffle
│   │   └── formatTime.ts              # Formattazione secondi → mm:ss
│   ├── components/
│   │   ├── Layout.tsx                  # Shell con sidebar (desktop) / bottom-tab (mobile)
│   │   ├── ThemeToggle.tsx             # Toggle dark/light persistito in localStorage
│   │   ├── ConfirmDialog.tsx           # Dialog riutilizzabile con messaggio + CTA
│   │   ├── Timer.tsx                   # Display cronometro (verde / rosso ultimi 60s)
│   │   ├── ProgressBar.tsx             # Barra progresso generica
│   │   ├── DotNav.tsx                  # Navigazione a punti per le domande quiz
│   │   └── FileImportButton.tsx        # Bottone importa/sostituisci con gestione errori inline
│   ├── pages/
│   │   ├── TutorialPage.tsx            # Guida AI step-by-step con prompt copiabili
│   │   ├── HomePage.tsx                # Lista esami con CRUD (crea, rinomina, elimina)
│   │   ├── DashboardPage.tsx           # Dashboard esame (banner pausa, 3 sezioni)
│   │   ├── SummaryPage.tsx             # Viewer riassunto (iframe / pdfjs / mammoth)
│   │   ├── QuizConfigPage.tsx          # Configurazione sessione quiz
│   │   ├── QuizSessionPage.tsx         # Sessione quiz attiva
│   │   ├── QuizResultPage.tsx          # Fine quiz: score, storico, analisi errori
│   │   ├── FlashcardConfigPage.tsx     # Configurazione sessione flashcard
│   │   └── FlashcardSessionPage.tsx    # Sessione flashcard attiva + fine mazzo
│   ├── App.tsx                         # Router setup + Capacitor back button handler
│   ├── main.tsx                        # Entry point React
│   └── index.css                       # Variabili CSS tema dark/light + reset
├── capacitor.config.ts
├── vite.config.ts
├── index.html
└── package.json
```

---

## Task 1: Scaffolding progetto e dipendenze

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `capacitor.config.ts`
- Create: `src/main.tsx`
- Create: `src/index.css`

- [ ] **Step 1: Inizializza progetto Vite + React + TypeScript**

```bash
npm create vite@latest study-app -- --template react-ts
cd study-app
```

- [ ] **Step 2: Installa tutte le dipendenze**

```bash
npm install react-router-dom zustand idb mammoth pdfjs-dist \
  @capacitor/core @capacitor/cli @capacitor/app \
  @capawesome/capacitor-file-picker
npm install -D @types/mammoth
```

- [ ] **Step 3: Configura vite.config.ts**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',   // necessario per Capacitor WebView
  build: {
    outDir: 'dist',
  },
})
```

- [ ] **Step 4: Configura capacitor.config.ts**

```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.studyapp.local',
  appName: 'Study App',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
```

- [ ] **Step 5: Crea src/index.css con variabili tema dark/light**

```css
/* src/index.css */
:root {
  --bg: #0f0f11;
  --bg-surface: #1a1a1f;
  --bg-elevated: #242429;
  --border: #2e2e36;
  --text: #e8e8f0;
  --text-muted: #8888a0;
  --accent: #6c63ff;
  --accent-hover: #7c74ff;
  --success: #4caf82;
  --danger: #e05555;
  --warning: #e0a545;
}

[data-theme="light"] {
  --bg: #f4f4f8;
  --bg-surface: #ffffff;
  --bg-elevated: #ebebf0;
  --border: #d0d0dc;
  --text: #1a1a2e;
  --text-muted: #60607a;
  --accent: #5046e5;
  --accent-hover: #4038cc;
  --success: #2d8a5e;
  --danger: #c0392b;
  --warning: #b07d20;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  min-height: 100dvh;
}

button {
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  border: none;
  background: none;
}

button:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 6: Crea src/main.tsx**

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: scaffolding progetto Vite + dipendenze"
```

---

## Task 2: TypeScript interfaces globali

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Crea src/types/index.ts con tutte le interfacce**

```typescript
// src/types/index.ts

export interface Esame {
  id: string
  name: string
  createdAt: string
  files: {
    riassunto?: FileRecord
    quiz?: FileRecord
    flashcard?: FileRecord
  }
}

export interface FileRecord {
  name: string
  type: string
  data: ArrayBuffer
}

export interface QuizSession {
  id: string
  examId: string
  date: string
  score: number
  total: number
  totalTime: number
  timeLimitSeconds: number | null
  completedByTimeout: boolean
  macroargomenti: string[]
  errors: string[]
  unanswered: string[]
  isReview: boolean
}

export interface QuestionStats {
  id: string             // `${examId}__${questionId}`
  examId: string
  questionId: string
  timesShown: number
  timesCorrect: number
}

export interface FlashcardStats {
  id: string             // `${examId}__${cardId}`
  examId: string
  cardId: string
  lastEval: 'Sì' | 'In parte' | 'No' | 'Non risposta'
  lastSeen: string
}

export type CardEval = 'Sì' | 'In parte' | 'No'

export interface PausedSession {
  id: string             // "${examId}__quiz" oppure "${examId}__flashcard"
  examId: string
  mode: 'quiz' | 'flashcard'
  savedAt: string
  elapsedSeconds: number
  timeLimitSeconds: number | null
  macroargomenti: string[]
  // Quiz only
  questionIds?: string[]
  currentQuestionIndex?: number
  confirmedAnswers?: Record<string, string>
  // Flashcard only
  cardIds?: string[]
  currentCardIndex?: number
  cardEvals?: Record<string, CardEval>
  reviewQueue?: string[]
}

// Schemi JSON file importati dall'utente
export interface QuizDomanda {
  id: string
  macroargomenti: string[]
  tipo: 'multipla' | 'vero_falso'
  testo: string
  opzioni?: string[]
  risposta_corretta: string
  spiegazione: string
}

export interface QuizFile {
  esame: string
  domande: QuizDomanda[]
}

export interface FlashCard {
  id: string
  macroargomenti: string[]
  fronte: string
  retro: string
}

export interface FlashcardFile {
  esame: string
  carte: FlashCard[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: TypeScript interfaces globali"
```

---

## Task 3: Utilities pure (shuffle, formatTime)

**Files:**
- Create: `src/utils/shuffle.ts`
- Create: `src/utils/formatTime.ts`
- Create: `src/utils/shuffle.test.ts`
- Create: `src/utils/formatTime.test.ts`

- [ ] **Step 1: Installa Vitest**

```bash
npm install -D vitest @vitest/ui
```

Aggiungi in `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 2: Scrivi test Fisher-Yates**

```typescript
// src/utils/shuffle.test.ts
import { describe, it, expect } from 'vitest'
import { shuffle } from './shuffle'

describe('shuffle', () => {
  it('restituisce array con gli stessi elementi', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffle([...arr])
    expect(result.sort()).toEqual(arr.sort())
  })

  it('non muta l\'array originale', () => {
    const arr = [1, 2, 3]
    const copy = [...arr]
    shuffle(arr)
    expect(arr).toEqual(copy)
  })

  it('array vuoto restituisce array vuoto', () => {
    expect(shuffle([])).toEqual([])
  })

  it('array singolo elemento restituisce stesso array', () => {
    expect(shuffle([42])).toEqual([42])
  })
})
```

- [ ] **Step 3: Esegui test — verifica FAIL**

```bash
npx vitest run src/utils/shuffle.test.ts
```
Expected: FAIL con "Cannot find module './shuffle'"

- [ ] **Step 4: Implementa shuffle.ts**

```typescript
// src/utils/shuffle.ts
/** Fisher-Yates shuffle — non muta l'array originale */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

- [ ] **Step 5: Esegui test shuffle — verifica PASS**

```bash
npx vitest run src/utils/shuffle.test.ts
```
Expected: PASS (4 test)

- [ ] **Step 6: Scrivi test formatTime**

```typescript
// src/utils/formatTime.test.ts
import { describe, it, expect } from 'vitest'
import { formatTime } from './formatTime'

describe('formatTime', () => {
  it('0 secondi → 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('59 secondi → 0:59', () => {
    expect(formatTime(59)).toBe('0:59')
  })

  it('60 secondi → 1:00', () => {
    expect(formatTime(60)).toBe('1:00')
  })

  it('90 secondi → 1:30', () => {
    expect(formatTime(90)).toBe('1:30')
  })

  it('3661 secondi → 61:01', () => {
    expect(formatTime(3661)).toBe('61:01')
  })
})
```

- [ ] **Step 7: Implementa formatTime.ts**

```typescript
// src/utils/formatTime.ts
/** Formatta secondi interi in mm:ss (nessun limite di ore) */
export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
```

- [ ] **Step 8: Esegui tutti i test — verifica PASS**

```bash
npx vitest run
```
Expected: PASS (8 test totali)

- [ ] **Step 9: Commit**

```bash
git add src/utils/
git commit -m "feat: utilities shuffle e formatTime con test"
```

---

## Task 4: storageService — wrapper IndexedDB

**Files:**
- Create: `src/services/storageService.ts`

- [ ] **Step 1: Crea storageService.ts**

```typescript
// src/services/storageService.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type {
  Esame, QuizSession, QuestionStats,
  FlashcardStats, PausedSession
} from '../types'

interface StudyAppDB extends DBSchema {
  esami: { key: string; value: Esame }
  quizSessions: { key: string; value: QuizSession; indexes: { 'by-examId': string } }
  questionStats: { key: string; value: QuestionStats; indexes: { 'by-examId': string } }
  flashcardStats: { key: string; value: FlashcardStats; indexes: { 'by-examId': string } }
  pausedSessions: { key: string; value: PausedSession; indexes: { 'by-examId': string } }
}

let dbPromise: Promise<IDBPDatabase<StudyAppDB>> | null = null

function getDB(): Promise<IDBPDatabase<StudyAppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StudyAppDB>('study-app-db', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('esami', { keyPath: 'id' })
          const qs = db.createObjectStore('quizSessions', { keyPath: 'id' })
          qs.createIndex('by-examId', 'examId')
          const qst = db.createObjectStore('questionStats', { keyPath: 'id' })
          qst.createIndex('by-examId', 'examId')
          const fs = db.createObjectStore('flashcardStats', { keyPath: 'id' })
          fs.createIndex('by-examId', 'examId')
        }
        if (oldVersion < 2) {
          const ps = db.createObjectStore('pausedSessions', { keyPath: 'id' })
          ps.createIndex('by-examId', 'examId')
        }
      },
    })
  }
  return dbPromise
}

// --- Esami ---
export async function getAllEsami(): Promise<Esame[]> {
  return (await getDB()).getAll('esami')
}

export async function getEsame(id: string): Promise<Esame | undefined> {
  return (await getDB()).get('esami', id)
}

export async function saveEsame(esame: Esame): Promise<void> {
  await (await getDB()).put('esami', esame)
}

export async function deleteEsame(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['esami', 'quizSessions', 'questionStats', 'flashcardStats', 'pausedSessions'],
    'readwrite'
  )
  await tx.objectStore('esami').delete(id)
  for (const session of await tx.objectStore('quizSessions').index('by-examId').getAll(id)) {
    await tx.objectStore('quizSessions').delete(session.id)
  }
  for (const stat of await tx.objectStore('questionStats').index('by-examId').getAll(id)) {
    await tx.objectStore('questionStats').delete(stat.id)
  }
  for (const stat of await tx.objectStore('flashcardStats').index('by-examId').getAll(id)) {
    await tx.objectStore('flashcardStats').delete(stat.id)
  }
  for (const ps of await tx.objectStore('pausedSessions').index('by-examId').getAll(id)) {
    await tx.objectStore('pausedSessions').delete(ps.id)
  }
  await tx.done
}

// --- QuizSessions ---
export async function getQuizSessions(examId: string): Promise<QuizSession[]> {
  return (await getDB()).getAllFromIndex('quizSessions', 'by-examId', examId)
}

export async function saveQuizSession(session: QuizSession): Promise<void> {
  await (await getDB()).put('quizSessions', session)
}

export async function deleteQuizSessionsForExam(examId: string): Promise<void> {
  const db = await getDB()
  const sessions = await db.getAllFromIndex('quizSessions', 'by-examId', examId)
  const tx = db.transaction('quizSessions', 'readwrite')
  for (const s of sessions) await tx.store.delete(s.id)
  await tx.done
}

// --- QuestionStats ---
export async function getQuestionStats(examId: string): Promise<QuestionStats[]> {
  return (await getDB()).getAllFromIndex('questionStats', 'by-examId', examId)
}

export async function saveQuestionStat(stat: QuestionStats): Promise<void> {
  await (await getDB()).put('questionStats', stat)
}

export async function deleteQuestionStatsForExam(examId: string): Promise<void> {
  const db = await getDB()
  const stats = await db.getAllFromIndex('questionStats', 'by-examId', examId)
  const tx = db.transaction('questionStats', 'readwrite')
  for (const s of stats) await tx.store.delete(s.id)
  await tx.done
}

// --- FlashcardStats ---
export async function getFlashcardStats(examId: string): Promise<FlashcardStats[]> {
  return (await getDB()).getAllFromIndex('flashcardStats', 'by-examId', examId)
}

export async function saveFlashcardStat(stat: FlashcardStats): Promise<void> {
  await (await getDB()).put('flashcardStats', stat)
}

export async function deleteFlashcardStatsForExam(examId: string): Promise<void> {
  const db = await getDB()
  const stats = await db.getAllFromIndex('flashcardStats', 'by-examId', examId)
  const tx = db.transaction('flashcardStats', 'readwrite')
  for (const s of stats) await tx.store.delete(s.id)
  await tx.done
}

// --- PausedSessions ---
export async function getPausedSession(id: string): Promise<PausedSession | undefined> {
  return (await getDB()).get('pausedSessions', id)
}

export async function savePausedSession(ps: PausedSession): Promise<void> {
  await (await getDB()).put('pausedSessions', ps)
}

export async function deletePausedSession(id: string): Promise<void> {
  await (await getDB()).delete('pausedSessions', id)
}

export async function getPausedSessionsForExam(examId: string): Promise<PausedSession[]> {
  return (await getDB()).getAllFromIndex('pausedSessions', 'by-examId', examId)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/storageService.ts
git commit -m "feat: storageService IndexedDB (versione 2)"
```

---

## Task 5: fileService — abstraction layer web/Android

**Files:**
- Create: `src/services/fileService.ts`

- [ ] **Step 1: Crea fileService.ts**

```typescript
// src/services/fileService.ts
import { Capacitor } from '@capacitor/core'

export interface PickedFile {
  name: string
  type: string
  data: ArrayBuffer
}

async function pickFileBrowser(accept: string[]): Promise<PickedFile> {
  // Tenta File System Access API (Chrome/Edge)
  if ('showOpenFilePicker' in window) {
    const [fileHandle] = await (window as any).showOpenFilePicker({
      types: [{ description: 'Files', accept: Object.fromEntries(accept.map(ext => [`application/${ext.replace('.', '')}`, [ext]])) }],
      multiple: false,
    })
    const file: File = await fileHandle.getFile()
    const data = await file.arrayBuffer()
    return { name: file.name, type: file.type, data }
  }

  // Fallback: input[type=file] dinamico
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept.join(',')
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = async () => {
      const file = input.files?.[0]
      document.body.removeChild(input)
      if (!file) { reject(new Error('Nessun file selezionato')); return }
      const data = await file.arrayBuffer()
      resolve({ name: file.name, type: file.type, data })
    }
    input.oncancel = () => {
      document.body.removeChild(input)
      reject(new Error('Selezione annullata'))
    }
    input.click()
  })
}

async function pickFileCapacitor(accept: string[]): Promise<PickedFile> {
  const { FilePicker } = await import('@capawesome/capacitor-file-picker')
  const result = await FilePicker.pickFiles({ types: accept, multiple: false, readData: true })
  const file = result.files[0]
  if (!file) throw new Error('Nessun file selezionato')
  const binary = atob(file.data!)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { name: file.name, type: file.mimeType, data: bytes.buffer }
}

export interface FileService {
  pickFile(accept: string[]): Promise<PickedFile>
}

export const fileService: FileService = Capacitor.isNativePlatform()
  ? { pickFile: pickFileCapacitor }
  : { pickFile: pickFileBrowser }
```

- [ ] **Step 2: Commit**

```bash
git add src/services/fileService.ts
git commit -m "feat: fileService abstraction layer web/Android"
```

---

## Task 6: quizService — shuffle, filtro, scoring, validazione schema

**Files:**
- Create: `src/services/quizService.ts`
- Create: `src/services/quizService.test.ts`

- [ ] **Step 1: Scrivi test quizService**

```typescript
// src/services/quizService.test.ts
import { describe, it, expect } from 'vitest'
import { validateQuizFile, filterDomande, buildSessionQuestions } from './quizService'
import type { QuizFile } from '../types'

const validQuiz: QuizFile = {
  esame: 'Test',
  domande: [
    {
      id: 'q1',
      macroargomenti: ['Limiti'],
      tipo: 'multipla',
      testo: 'Domanda 1?',
      opzioni: ['A', 'B', 'C'],
      risposta_corretta: 'A',
      spiegazione: 'Spiega',
    },
    {
      id: 'q2',
      macroargomenti: ['Derivate'],
      tipo: 'vero_falso',
      testo: 'Affermazione?',
      risposta_corretta: 'Vero',
      spiegazione: 'Spiega',
    },
  ],
}

describe('validateQuizFile', () => {
  it('accetta file valido', () => {
    expect(() => validateQuizFile(validQuiz)).not.toThrow()
  })

  it('rifiuta se domande è assente', () => {
    expect(() => validateQuizFile({ esame: 'X' } as any)).toThrow()
  })

  it('rifiuta domanda multipla senza opzioni', () => {
    const bad = { ...validQuiz, domande: [{ ...validQuiz.domande[0], opzioni: undefined }] }
    expect(() => validateQuizFile(bad as any)).toThrow()
  })

  it('rifiuta risposta_corretta non presente nelle opzioni', () => {
    const bad = { ...validQuiz, domande: [{ ...validQuiz.domande[0], risposta_corretta: 'Z' }] }
    expect(() => validateQuizFile(bad as any)).toThrow()
  })

  it('rifiuta vero_falso con risposta non Vero/Falso', () => {
    const bad = { ...validQuiz, domande: [{ ...validQuiz.domande[1], risposta_corretta: 'Forse' }] }
    expect(() => validateQuizFile(bad as any)).toThrow()
  })
})

describe('filterDomande', () => {
  it('macroargomenti=[] restituisce tutte le domande', () => {
    expect(filterDomande(validQuiz.domande, [])).toHaveLength(2)
  })

  it('filtra per macroargomento (OR)', () => {
    const result = filterDomande(validQuiz.domande, ['Limiti'])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('q1')
  })
})

describe('buildSessionQuestions', () => {
  it('restituisce al massimo N domande', () => {
    const result = buildSessionQuestions(validQuiz.domande, 1)
    expect(result).toHaveLength(1)
  })

  it('le opzioni di una domanda multipla sono shufflate (stessi elementi)', () => {
    const domanda = validQuiz.domande[0]
    const [built] = buildSessionQuestions([domanda], 1)
    expect(built.opzioniShuffled!.sort()).toEqual(domanda.opzioni!.sort())
  })
})
```

- [ ] **Step 2: Esegui test — verifica FAIL**

```bash
npx vitest run src/services/quizService.test.ts
```
Expected: FAIL con "Cannot find module './quizService'"

- [ ] **Step 3: Implementa quizService.ts**

```typescript
// src/services/quizService.ts
import type { QuizDomanda, QuizFile } from '../types'
import { shuffle } from '../utils/shuffle'

export interface SessionQuestion extends QuizDomanda {
  opzioniShuffled?: string[]  // opzioni in ordine shufflato (solo per multipla)
}

export function validateQuizFile(data: unknown): QuizFile {
  const q = data as any
  if (!q || !Array.isArray(q.domande)) throw new Error('Campo "domande" mancante o non è un array')
  for (const d of q.domande) {
    if (!d.id || !d.tipo || !d.testo || !d.risposta_corretta || !d.spiegazione) {
      throw new Error(`Domanda ${d.id ?? '?'}: campi obbligatori mancanti`)
    }
    if (!Array.isArray(d.macroargomenti) || d.macroargomenti.length === 0) {
      throw new Error(`Domanda ${d.id}: macroargomenti deve essere un array non vuoto`)
    }
    if (d.tipo === 'multipla') {
      if (!Array.isArray(d.opzioni) || d.opzioni.length < 2) {
        throw new Error(`Domanda ${d.id}: tipo multipla richiede almeno 2 opzioni`)
      }
      if (!d.opzioni.includes(d.risposta_corretta)) {
        throw new Error(`Domanda ${d.id}: risposta_corretta non è presente nelle opzioni`)
      }
    } else if (d.tipo === 'vero_falso') {
      if (d.risposta_corretta !== 'Vero' && d.risposta_corretta !== 'Falso') {
        throw new Error(`Domanda ${d.id}: risposta_corretta per vero_falso deve essere "Vero" o "Falso"`)
      }
    } else {
      throw new Error(`Domanda ${d.id}: tipo non riconosciuto "${d.tipo}"`)
    }
  }
  return q as QuizFile
}

export function validateFlashcardFile(data: unknown) {
  const f = data as any
  if (!f || !Array.isArray(f.carte)) throw new Error('Campo "carte" mancante o non è un array')
  for (const c of f.carte) {
    if (!c.id || !c.fronte || !c.retro) {
      throw new Error(`Carta ${c.id ?? '?'}: campi obbligatori mancanti (id, fronte, retro)`)
    }
    if (!Array.isArray(c.macroargomenti) || c.macroargomenti.length === 0) {
      throw new Error(`Carta ${c.id}: macroargomenti deve essere un array non vuoto`)
    }
  }
  return f
}

export function filterDomande(domande: QuizDomanda[], macroargomenti: string[]): QuizDomanda[] {
  if (macroargomenti.length === 0) return domande
  return domande.filter(d =>
    d.macroargomenti.some(m => macroargomenti.includes(m))
  )
}

export function buildSessionQuestions(domande: QuizDomanda[], n: number): SessionQuestion[] {
  const shuffled = shuffle(domande)
  const selected = shuffled.slice(0, n)
  return selected.map(d => ({
    ...d,
    opzioniShuffled: d.tipo === 'multipla' ? shuffle(d.opzioni!) : undefined,
  }))
}
```

- [ ] **Step 4: Esegui test — verifica PASS**

```bash
npx vitest run
```
Expected: PASS (tutti i test)

- [ ] **Step 5: Commit**

```bash
git add src/services/quizService.ts src/services/quizService.test.ts
git commit -m "feat: quizService con validazione schema, filtro e shuffle"
```

---

## Task 7: useTimer hook

**Files:**
- Create: `src/hooks/useTimer.ts`
- Create: `src/hooks/useTimer.test.ts`

- [ ] **Step 1: Scrivi test useTimer**

```typescript
// src/hooks/useTimer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimer } from './useTimer'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('useTimer - modalità conta in su (no limite)', () => {
  it('elapsed parte da 0', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: null, onExpire: vi.fn() }))
    expect(result.current.elapsed).toBe(0)
    expect(result.current.remaining).toBeNull()
  })

  it('incrementa elapsed ogni secondo', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: null, onExpire: vi.fn() }))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.elapsed).toBe(3)
  })
})

describe('useTimer - modalità conta in giù', () => {
  it('remaining parte da limitSeconds', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: 10, onExpire: vi.fn() }))
    expect(result.current.remaining).toBe(10)
  })

  it('chiama onExpire a zero', () => {
    const onExpire = vi.fn()
    renderHook(() => useTimer({ limitSeconds: 3, onExpire }))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(onExpire).toHaveBeenCalledOnce()
  })
})

describe('useTimer - pause/resume', () => {
  it('pause ferma il timer', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: null, onExpire: vi.fn() }))
    act(() => { result.current.pause() })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.elapsed).toBe(0)
  })

  it('resume riprende il timer dopo pausa', () => {
    const { result } = renderHook(() => useTimer({ limitSeconds: null, onExpire: vi.fn() }))
    act(() => { result.current.pause() })
    act(() => { result.current.resume() })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.elapsed).toBe(2)
  })
})
```

- [ ] **Step 2: Installa testing library**

```bash
npm install -D @testing-library/react @testing-library/react-hooks jsdom
```

- [ ] **Step 3: Esegui test — verifica FAIL**

```bash
npx vitest run src/hooks/useTimer.test.ts
```
Expected: FAIL con "Cannot find module './useTimer'"

- [ ] **Step 4: Implementa useTimer.ts**

```typescript
// src/hooks/useTimer.ts
import { useEffect, useRef, useState, useCallback } from 'react'

interface TimerConfig {
  limitSeconds: number | null
  initialElapsed?: number
  onExpire: () => void
}

export interface TimerAPI {
  elapsed: number
  remaining: number | null
  isExpired: boolean
  pause: () => void
  resume: () => void
}

export function useTimer({ limitSeconds, initialElapsed = 0, onExpire }: TimerConfig): TimerAPI {
  const [elapsed, setElapsed] = useState(initialElapsed)
  const [running, setRunning] = useState(true)
  const [expired, setExpired] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (!running || expired) return
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (limitSeconds !== null && next >= limitSeconds) {
          setExpired(true)
          setRunning(false)
          onExpireRef.current()
        }
        return next
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, expired, limitSeconds])

  const pause = useCallback(() => setRunning(false), [])
  const resume = useCallback(() => { if (!expired) setRunning(true) }, [expired])

  const remaining = limitSeconds !== null ? Math.max(0, limitSeconds - elapsed) : null

  return { elapsed, remaining, isExpired: expired, pause, resume }
}
```

- [ ] **Step 5: Esegui test — verifica PASS**

```bash
npx vitest run
```
Expected: PASS (tutti i test)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTimer.ts src/hooks/useTimer.test.ts
git commit -m "feat: useTimer hook con conta-su, conta-giù, pause/resume"
```

---

## Task 8: Zustand store e componenti UI base

**Files:**
- Create: `src/store/appStore.ts`
- Create: `src/components/ConfirmDialog.tsx`
- Create: `src/components/Timer.tsx`
- Create: `src/components/ProgressBar.tsx`
- Create: `src/components/DotNav.tsx`
- Create: `src/components/ThemeToggle.tsx`
- Create: `src/components/FileImportButton.tsx`

- [ ] **Step 1: Crea appStore.ts**

```typescript
// src/store/appStore.ts
import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface AppStore {
  theme: Theme
  toggleTheme: () => void
  currentExamId: string | null
  setCurrentExamId: (id: string | null) => void
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

const savedTheme = (localStorage.getItem('theme') as Theme) ?? 'dark'
applyTheme(savedTheme)

export const useAppStore = create<AppStore>((set) => ({
  theme: savedTheme,
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return { theme: next }
    }),
  currentExamId: null,
  setCurrentExamId: (id) => set({ currentExamId: id }),
}))
```

- [ ] **Step 2: Crea ConfirmDialog.tsx**

```tsx
// src/components/ConfirmDialog.tsx
interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  dangerous?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Conferma', cancelLabel = 'Annulla',
  dangerous = false, onConfirm, onCancel
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '1.5rem', maxWidth: '400px', width: '100%',
      }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '0.6rem 1.2rem', borderRadius: '8px',
            background: 'var(--bg-elevated)', color: 'var(--text)',
          }}>{cancelLabel}</button>
          <button onClick={onConfirm} style={{
            padding: '0.6rem 1.2rem', borderRadius: '8px',
            background: dangerous ? 'var(--danger)' : 'var(--accent)', color: '#fff',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crea Timer.tsx**

```tsx
// src/components/Timer.tsx
import { formatTime } from '../utils/formatTime'

interface TimerProps {
  elapsed: number
  remaining: number | null
}

export function Timer({ elapsed, remaining }: TimerProps) {
  const display = remaining !== null ? remaining : elapsed
  const isWarning = remaining !== null && remaining <= 60
  return (
    <span style={{
      fontVariantNumeric: 'tabular-nums',
      color: isWarning ? 'var(--danger)' : 'var(--text)',
      fontWeight: isWarning ? 700 : 400,
    }}>
      {formatTime(display)}
    </span>
  )
}
```

- [ ] **Step 4: Crea ProgressBar.tsx**

```tsx
// src/components/ProgressBar.tsx
interface ProgressBarProps {
  current: number   // 1-based
  total: number
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = total > 0 ? (current / total) * 100 : 0
  return (
    <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s' }} />
    </div>
  )
}
```

- [ ] **Step 5: Crea DotNav.tsx**

```tsx
// src/components/DotNav.tsx
export type DotState = 'unanswered' | 'selected' | 'correct' | 'wrong'

interface DotNavProps {
  total: number
  current: number
  states: DotState[]
  onSelect: (index: number) => void
}

const dotColor: Record<DotState, string> = {
  unanswered: 'var(--border)',
  selected: 'var(--accent)',
  correct: 'var(--success)',
  wrong: 'var(--danger)',
}

export function DotNav({ total, current, states, onSelect }: DotNavProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          style={{
            width: '14px', height: '14px', borderRadius: '50%',
            background: dotColor[states[i] ?? 'unanswered'],
            border: i === current ? '2px solid var(--text)' : '2px solid transparent',
            padding: 0,
          }}
          title={`Domanda ${i + 1}`}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Crea ThemeToggle.tsx**

```tsx
// src/components/ThemeToggle.tsx
import { useAppStore } from '../store/appStore'

export function ThemeToggle() {
  const { theme, toggleTheme } = useAppStore()
  return (
    <button onClick={toggleTheme} title="Cambia tema" style={{ fontSize: '1.2rem', padding: '0.25rem' }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
```

- [ ] **Step 7: Crea FileImportButton.tsx**

```tsx
// src/components/FileImportButton.tsx
import { useState } from 'react'
import { fileService } from '../services/fileService'

interface FileImportButtonProps {
  label: string
  accept: string[]
  onFile: (data: ArrayBuffer, name: string, type: string) => Promise<void>
  disabled?: boolean
}

export function FileImportButton({ label, accept, onFile, disabled }: FileImportButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setError(null)
    setLoading(true)
    try {
      const picked = await fileService.pickFile(accept)
      await onFile(picked.data, picked.name, picked.type)
    } catch (e: any) {
      if (e.message !== 'Selezione annullata') {
        setError(e.message ?? 'Errore sconosciuto')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={disabled || loading} style={{
        padding: '0.6rem 1.2rem', borderRadius: '8px',
        background: 'var(--accent)', color: '#fff', minHeight: '48px',
      }}>
        {loading ? 'Caricamento…' : label}
      </button>
      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
          File non valido: {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/store/ src/components/
git commit -m "feat: Zustand store e componenti UI base (ConfirmDialog, Timer, DotNav, ...)"
```

---

## Task 9: Layout, Router e App.tsx

**Files:**
- Create: `src/components/Layout.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: Crea Layout.tsx con sidebar (desktop) e bottom-tab (Android/mobile)**

```tsx
// src/components/Layout.tsx
import { NavLink, Outlet } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

const navItems = [
  { to: '/', label: '🏠 Esami', end: true },
  { to: '/guida', label: '❓ Guida' },
]

export function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      {/* Sidebar — desktop */}
      <nav style={{
        width: '220px', background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        padding: '1.5rem 1rem',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        // nascosta su mobile via media query in index.css
      }} className="sidebar">
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent)' }}>
          📚 Study App
        </div>
        {navItems.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
            padding: '0.6rem 0.75rem', borderRadius: '8px', textDecoration: 'none',
            background: isActive ? 'var(--accent)' : 'transparent',
            color: isActive ? '#fff' : 'var(--text)',
          })}>{label}</NavLink>
        ))}
        <div style={{ marginTop: 'auto' }}>
          <ThemeToggle />
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 'var(--sidebar-width, 220px)', padding: '1.5rem', paddingBottom: '5rem' }}
        className="main-content">
        <Outlet />
      </main>

      {/* Bottom tab — mobile */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-around', padding: '0.5rem 0',
      }} className="bottom-tab">
        {navItems.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textDecoration: 'none', fontSize: '0.75rem', padding: '0.25rem 1rem',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
          })}>{label}</NavLink>
        ))}
        <ThemeToggle />
      </nav>
    </div>
  )
}
```

Aggiungi in `src/index.css`:
```css
/* Responsive layout */
@media (min-width: 768px) {
  .bottom-tab { display: none !important; }
}
@media (max-width: 767px) {
  .sidebar { display: none !important; }
  .main-content { margin-left: 0 !important; }
}
```

- [ ] **Step 2: Crea App.tsx con tutte le route e Capacitor back button**

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Layout } from './components/Layout'
import { TutorialPage } from './pages/TutorialPage'
import { HomePage } from './pages/HomePage'
import { DashboardPage } from './pages/DashboardPage'
import { SummaryPage } from './pages/SummaryPage'
import { QuizConfigPage } from './pages/QuizConfigPage'
import { QuizSessionPage } from './pages/QuizSessionPage'
import { QuizResultPage } from './pages/QuizResultPage'
import { FlashcardConfigPage } from './pages/FlashcardConfigPage'
import { FlashcardSessionPage } from './pages/FlashcardSessionPage'

// Il Capacitor back button è gestito all'interno di QuizSessionPage e FlashcardSessionPage
// tramite listener specifici — qui registriamo solo il listener globale di default
function useCapacitorBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cleanup: (() => void) | undefined
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back()
      }).then(handle => { cleanup = () => handle.remove() })
    })
    return () => cleanup?.()
  }, [])
}

export default function App() {
  useCapacitorBackButton()
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/guida" element={<TutorialPage />} />
          <Route path="/esame/:examId" element={<DashboardPage />} />
          <Route path="/esame/:examId/riassunto" element={<SummaryPage />} />
          <Route path="/esame/:examId/quiz/config" element={<QuizConfigPage />} />
          <Route path="/esame/:examId/quiz/sessione" element={<QuizSessionPage />} />
          <Route path="/esame/:examId/quiz/risultato" element={<QuizResultPage />} />
          <Route path="/esame/:examId/flashcard/config" element={<FlashcardConfigPage />} />
          <Route path="/esame/:examId/flashcard/sessione" element={<FlashcardSessionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx src/App.tsx src/index.css
git commit -m "feat: Layout responsive (sidebar/bottom-tab) e React Router"
```

---

## Task 10: TutorialPage + onboarding al primo avvio

**Files:**
- Create: `src/pages/TutorialPage.tsx`

- [ ] **Step 1: Crea TutorialPage.tsx**

```tsx
// src/pages/TutorialPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PROMPT_QUIZ_FLASHCARD = `Ho allegato i miei documenti di studio per l'esame di [NOME ESAME].
Analizza tutto il contenuto e genera due file JSON.

━━━ FILE 1: quiz.json ━━━
Schema:
{
  "esame": "[NOME ESAME]",
  "domande": [
    {
      "id": "q1",
      "macroargomenti": ["Argomento A", "Argomento B"],
      "tipo": "multipla",
      "testo": "testo della domanda",
      "opzioni": ["opzione 1", "opzione 2", "opzione 3", "opzione 4"],
      "risposta_corretta": "testo esatto dell'opzione corretta",
      "spiegazione": "spiegazione dettagliata della risposta"
    },
    {
      "id": "q2",
      "macroargomenti": ["Argomento A"],
      "tipo": "vero_falso",
      "testo": "affermazione da valutare",
      "risposta_corretta": "Vero",
      "spiegazione": "spiegazione dettagliata"
    }
  ]
}
Regole:
- Genera il maggior numero possibile di domande (minimo 50)
- Alterna domande multipla e vero/falso
- Per multipla: da 3 a 5 opzioni, testo puro senza prefissi A/B/C
- risposta_corretta per multipla = testo esatto di una delle opzioni (non una lettera)
- risposta_corretta per vero_falso = "Vero" oppure "Falso"
- macroargomenti: argomenti tematici coerenti, riutilizzati tra le domande
- Copri uniformemente tutti gli argomenti del materiale
- id sequenziale: q1, q2, q3...

━━━ FILE 2: flashcard.json ━━━
Schema:
{
  "esame": "[NOME ESAME]",
  "carte": [
    {
      "id": "f1",
      "macroargomenti": ["Argomento A"],
      "fronte": "domanda, termine o concetto",
      "retro": "risposta o definizione completa e autosufficiente"
    }
  ]
}
Regole:
- Genera il maggior numero possibile di carte (minimo 60)
- Il fronte è una domanda aperta, un termine chiave, o una formula
- Il retro è la risposta completa, comprensibile da sola
- macroargomenti: coerenti con quelli usati in quiz.json
- id sequenziale: f1, f2, f3...

Rispondi con due blocchi di codice separati e ben etichettati:
il primo per quiz.json, il secondo per flashcard.json. Nient'altro.`

const PROMPT_RIASSUNTO = `Ho allegato i miei documenti di studio per l'esame di [NOME ESAME].
Crea un riassunto completo in formato HTML con queste caratteristiche:

- File HTML autocontenuto (CSS inline o in un tag <style> nell'<head>)
- <h1> per il titolo dell'esame, <h2> per i macroargomenti, <h3> per i sottotemi
- Usa tabelle per confronti, elenchi puntati per definizioni o passaggi
- Formule scritte in forma testuale leggibile
- Stile: sfondo bianco, font sans-serif, margini comodi, leggibile su schermo
- Copri tutto il materiale in modo esaustivo senza tralasciare nulla

Rispondi con solo il file HTML completo, nient'altro.`

interface StepProps {
  number: number
  title: string
  children: React.ReactNode
  prompt?: string
}

function Step({ number, title, children, prompt }: StepProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!prompt) return
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{
          background: 'var(--accent)', color: '#fff', borderRadius: '50%',
          width: '28px', height: '28px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
        }}>{number}</span>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{children}</div>
      {prompt && (
        <button onClick={handleCopy} style={{
          marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '8px',
          background: copied ? 'var(--success)' : 'var(--bg-elevated)',
          color: 'var(--text)', border: '1px solid var(--border)',
        }}>
          {copied ? '✓ Copiato!' : '📋 Copia prompt'}
        </button>
      )}
    </div>
  )
}

export function TutorialPage({ isOnboarding = false }: { isOnboarding?: boolean }) {
  const navigate = useNavigate()

  function handleSkip() {
    localStorage.setItem('tutorialSeen', 'true')
    navigate('/')
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>❓ Guida</h1>
        {isOnboarding && (
          <button onClick={handleSkip} style={{
            padding: '0.5rem 1rem', borderRadius: '8px',
            background: 'var(--bg-elevated)', color: 'var(--text-muted)',
          }}>
            Salta
          </button>
        )}
      </div>

      <Step number={1} title="Prepara i tuoi documenti">
        <p>Raccogli tutti i materiali dell'esame: PDF, DOCX, file di testo.</p>
        <p style={{ marginTop: '0.5rem' }}>Più materiale fornisci all'AI, più domande e flashcard verranno generate. Formati supportati da ChatGPT e Claude: PDF, DOCX, TXT.</p>
      </Step>

      <Step number={2} title="Genera quiz e flashcard" prompt={PROMPT_QUIZ_FLASHCARD}>
        <p>Apri <strong>ChatGPT</strong> o <strong>Claude</strong>, carica tutti i file dell'esame, poi incolla il prompt qui sotto. Sostituisci <code>[NOME ESAME]</code> con il nome reale prima di inviare.</p>
      </Step>

      <Step number={3} title="(Facoltativo) Genera il riassunto" prompt={PROMPT_RIASSUNTO}>
        <p>Se non hai già un riassunto, puoi chiederlo all'AI. Il file generato sarà in formato HTML, importabile direttamente nell'app.</p>
      </Step>

      <Step number={4} title="Importa nell'app">
        <p>Salva i file generati sul tuo dispositivo, poi crea un nuovo esame e importa ciascun file nella sezione corrispondente.</p>
        <button onClick={() => navigate('/')} style={{
          marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '8px',
          background: 'var(--accent)', color: '#fff',
        }}>
          Vai a "Crea nuovo esame" →
        </button>
      </Step>
    </div>
  )
}
```

- [ ] **Step 2: Aggiungi logica onboarding in App.tsx**

Modifica `src/App.tsx` — aggiungi route onboarding e controllo `tutorialSeen`:

```tsx
// Aggiungi questo componente in App.tsx prima di App()
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!localStorage.getItem('tutorialSeen')) {
      navigate('/onboarding', { replace: true })
    }
  }, [])
  return <>{children}</>
}
```

Nella Route `/`, avvolgi HomePage con OnboardingGuard. Aggiungi la route `/onboarding`:
```tsx
<Route path="/onboarding" element={<TutorialPage isOnboarding />} />
<Route path="/" element={<OnboardingGuard><HomePage /></OnboardingGuard>} />
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/TutorialPage.tsx src/App.tsx
git commit -m "feat: TutorialPage con prompt copiabili e onboarding al primo avvio"
```

---

## Task 11: HomePage — lista esami, CRUD

**Files:**
- Create: `src/pages/HomePage.tsx`
- Create: `src/hooks/useExam.ts`

- [ ] **Step 1: Crea useExam.ts**

```typescript
// src/hooks/useExam.ts
import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Esame } from '../types'
import * as storage from '../services/storageService'

export function useExam() {
  const [esami, setEsami] = useState<Esame[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const all = await storage.getAllEsami()
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    setEsami(all)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  async function createEsame(name: string): Promise<Esame> {
    const esame: Esame = { id: uuidv4(), name: name.trim(), createdAt: new Date().toISOString(), files: {} }
    await storage.saveEsame(esame)
    await reload()
    return esame
  }

  async function renameEsame(id: string, name: string) {
    const esame = await storage.getEsame(id)
    if (!esame) return
    await storage.saveEsame({ ...esame, name: name.trim() })
    await reload()
  }

  async function deleteEsame(id: string) {
    await storage.deleteEsame(id)
    await reload()
  }

  return { esami, loading, createEsame, renameEsame, deleteEsame, reload }
}
```

Installa uuid:
```bash
npm install uuid
npm install -D @types/uuid
```

- [ ] **Step 2: Crea HomePage.tsx**

```tsx
// src/pages/HomePage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExam } from '../hooks/useExam'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function HomePage() {
  const navigate = useNavigate()
  const { esami, loading, createEsame, renameEsame, deleteEsame } = useExam()
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleCreate() {
    if (!newName.trim()) return
    const esame = await createEsame(newName)
    setNewName('')
    setShowCreate(false)
    navigate(`/esame/${esame.id}`)
  }

  async function handleRename() {
    if (!renaming || !renaming.name.trim()) return
    await renameEsame(renaming.id, renaming.name)
    setRenaming(null)
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteEsame(deleting)
    setDeleting(null)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Caricamento…</div>

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>📚 I tuoi esami</h1>
        <button onClick={() => setShowCreate(true)} style={{
          padding: '0.6rem 1.2rem', borderRadius: '8px',
          background: 'var(--accent)', color: '#fff', minHeight: '48px',
        }}>+ Nuovo esame</button>
      </div>

      {/* Dialog crea esame */}
      {showCreate && (
        <div style={{ marginBottom: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Nome esame…"
            style={{
              width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: '1rem', marginBottom: '0.75rem',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreate(false)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text)' }}>Annulla</button>
            <button onClick={handleCreate} disabled={!newName.trim()} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--accent)', color: '#fff' }}>Crea</button>
          </div>
        </div>
      )}

      {/* Lista esami */}
      {esami.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '3rem' }}>
          Nessun esame ancora. Creane uno per iniziare!
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {esami.map(esame => (
            <div key={esame.id} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '1rem', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
            }}>
              {renaming?.id === esame.id ? (
                <input
                  autoFocus
                  value={renaming.name}
                  onChange={e => setRenaming({ ...renaming, name: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null) }}
                  onBlur={handleRename}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem' }}
                />
              ) : (
                <button onClick={() => navigate(`/esame/${esame.id}`)} style={{
                  flex: 1, textAlign: 'left', color: 'var(--text)', fontSize: '1rem',
                  padding: '0', fontWeight: 500,
                }}>
                  {esame.name}
                </button>
              )}

              {/* Menu contestuale ⋮ */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setMenuOpen(menuOpen === esame.id ? null : esame.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '1.2rem', color: 'var(--text-muted)' }}>⋮</button>
                {menuOpen === esame.id && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', zIndex: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: '8px', overflow: 'hidden', minWidth: '140px',
                  }}>
                    <button onClick={() => { setRenaming({ id: esame.id, name: esame.name }); setMenuOpen(null) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text)' }}>
                      ✏️ Rinomina
                    </button>
                    <button onClick={() => { setDeleting(esame.id); setMenuOpen(null) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--danger)' }}>
                      🗑️ Elimina
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Elimina esame"
        message="Questa azione eliminerà l'esame e tutte le sessioni e statistiche associate. Non è reversibile."
        confirmLabel="Elimina"
        dangerous
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useExam.ts src/pages/HomePage.tsx
git commit -m "feat: HomePage con lista esami e CRUD (crea, rinomina, elimina)"
```

---

## Task 12: DashboardPage

**Files:**
- Create: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Crea DashboardPage.tsx**

```tsx
// src/pages/DashboardPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Esame, PausedSession } from '../types'
import * as storage from '../services/storageService'
import { fileService } from '../services/fileService'
import { validateQuizFile, validateFlashcardFile } from '../services/quizService'
import { FileImportButton } from '../components/FileImportButton'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function DashboardPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [esame, setEsame] = useState<Esame | null>(null)
  const [pausedQuiz, setPausedQuiz] = useState<PausedSession | null>(null)
  const [pausedFlash, setPausedFlash] = useState<PausedSession | null>(null)
  const [confirmReplaceQuiz, setConfirmReplaceQuiz] = useState(false)
  const [confirmReplaceFlash, setConfirmReplaceFlash] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!examId) return
    const e = await storage.getEsame(examId)
    if (!e) { navigate('/'); return }
    setEsame(e)
    setPausedQuiz((await storage.getPausedSession(`${examId}__quiz`)) ?? null)
    setPausedFlash((await storage.getPausedSession(`${examId}__flashcard`)) ?? null)
  }, [examId, navigate])

  useEffect(() => { reload() }, [reload])

  async function importRiassunto(data: ArrayBuffer, name: string, type: string) {
    if (!esame) return
    await storage.saveEsame({ ...esame, files: { ...esame.files, riassunto: { name, type, data } } })
    await reload()
  }

  async function importQuiz(data: ArrayBuffer, name: string, type: string) {
    // Valida schema prima di salvare
    const text = new TextDecoder().decode(data)
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { throw new Error('JSON non valido') }
    validateQuizFile(parsed) // lancia errore se schema sbagliato
    if (!esame) return
    await storage.saveEsame({ ...esame, files: { ...esame.files, quiz: { name, type, data } } })
    await reload()
  }

  async function importFlashcard(data: ArrayBuffer, name: string, type: string) {
    const text = new TextDecoder().decode(data)
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { throw new Error('JSON non valido') }
    validateFlashcardFile(parsed)
    if (!esame) return
    await storage.saveEsame({ ...esame, files: { ...esame.files, flashcard: { name, type, data } } })
    await reload()
  }

  async function confirmQuizReplace(data: ArrayBuffer, name: string, type: string) {
    if (!esame || !examId) return
    // Elimina storico quiz
    await storage.deleteQuizSessionsForExam(examId)
    await storage.deleteQuestionStatsForExam(examId)
    await storage.deletePausedSession(`${examId}__quiz`)
    await importQuiz(data, name, type)
    setConfirmReplaceQuiz(false)
  }

  async function confirmFlashReplace(data: ArrayBuffer, name: string, type: string) {
    if (!esame || !examId) return
    await storage.deleteFlashcardStatsForExam(examId)
    await storage.deletePausedSession(`${examId}__flashcard`)
    await importFlashcard(data, name, type)
    setConfirmReplaceFlash(false)
  }

  if (!esame) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Caricamento…</div>

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <button onClick={() => navigate('/')} style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>← Tutti gli esami</button>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>{esame.name}</h1>

      {/* Banner sessione quiz in pausa */}
      {pausedQuiz && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem' }}>📌 Sessione quiz in pausa</span>
          <button onClick={() => navigate(`/esame/${examId}/quiz/sessione`, { state: { resume: true } })}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'var(--accent)', color: '#fff', fontSize: '0.85rem' }}>
            Riprendi
          </button>
        </div>
      )}

      {/* Banner sessione flashcard in pausa */}
      {pausedFlash && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem' }}>📌 Sessione flashcard in pausa</span>
          <button onClick={() => navigate(`/esame/${examId}/flashcard/sessione`, { state: { resume: true } })}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'var(--accent)', color: '#fff', fontSize: '0.85rem' }}>
            Riprendi
          </button>
        </div>
      )}

      {/* Sezione Riassunto */}
      <SectionCard title="📄 Riassunto" fileName={esame.files.riassunto?.name}>
        {esame.files.riassunto ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate(`/esame/${examId}/riassunto`)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--accent)', color: '#fff', minHeight: '48px' }}>Apri</button>
            <FileImportButton label="Sostituisci" accept={['.html', '.pdf', '.docx']} onFile={importRiassunto} />
          </div>
        ) : (
          <FileImportButton label="Importa file" accept={['.html', '.pdf', '.docx']} onFile={importRiassunto} />
        )}
      </SectionCard>

      {/* Sezione Quiz */}
      <SectionCard title="🧠 Quiz" fileName={esame.files.quiz?.name}>
        {esame.files.quiz ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate(`/esame/${examId}/quiz/config`)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--accent)', color: '#fff', minHeight: '48px' }}>Inizia quiz</button>
            <button onClick={() => setConfirmReplaceQuiz(true)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text)', minHeight: '48px' }}>Sostituisci quiz.json</button>
          </div>
        ) : (
          <FileImportButton label="Importa quiz.json" accept={['.json']} onFile={importQuiz} />
        )}
      </SectionCard>

      {/* Sezione Flashcard */}
      <SectionCard title="🃏 Flashcard" fileName={esame.files.flashcard?.name}>
        {esame.files.flashcard ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate(`/esame/${examId}/flashcard/config`)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--accent)', color: '#fff', minHeight: '48px' }}>Inizia flashcard</button>
            <button onClick={() => setConfirmReplaceFlash(true)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text)', minHeight: '48px' }}>Sostituisci flashcard.json</button>
          </div>
        ) : (
          <FileImportButton label="Importa flashcard.json" accept={['.json']} onFile={importFlashcard} />
        )}
      </SectionCard>

      {/* Dialog conferma sostituzione quiz */}
      <ReplaceDialog
        open={confirmReplaceQuiz}
        type="quiz"
        onCancel={() => setConfirmReplaceQuiz(false)}
        onConfirm={confirmQuizReplace}
        accept={['.json']}
      />

      {/* Dialog conferma sostituzione flashcard */}
      <ReplaceDialog
        open={confirmReplaceFlash}
        type="flashcard"
        onCancel={() => setConfirmReplaceFlash(false)}
        onConfirm={confirmFlashReplace}
        accept={['.json']}
      />
    </div>
  )
}

function SectionCard({ title, fileName, children }: { title: string; fileName?: string; children: React.ReactNode }) {
  const hasFile = !!fileName
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
        {!hasFile && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>File non importato</span>}
      </div>
      {children}
      {hasFile && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          📎 {fileName}
        </p>
      )}
    </div>
  )
}

function ReplaceDialog({ open, type, onCancel, onConfirm, accept }: {
  open: boolean; type: 'quiz' | 'flashcard';
  onCancel: () => void; onConfirm: (data: ArrayBuffer, name: string, type: string) => Promise<void>;
  accept: string[]
}) {
  const [picking, setPicking] = useState(false)

  async function handleConfirmAndPick() {
    setPicking(true)
    try {
      const picked = await fileService.pickFile(accept)
      await onConfirm(picked.data, picked.name, picked.type)
    } catch { /* annullato */ }
    setPicking(false)
  }

  const message = type === 'quiz'
    ? 'Sostituire il file cancellerà lo storico sessioni e le statistiche quiz. Continuare?'
    : 'Sostituire il file cancellerà le statistiche flashcard. Continuare?'

  return (
    <ConfirmDialog
      open={open}
      title={`Sostituisci ${type}.json`}
      message={message}
      confirmLabel={picking ? 'Seleziona file…' : 'Conferma e seleziona file'}
      dangerous
      onConfirm={handleConfirmAndPick}
      onCancel={onCancel}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: DashboardPage con banner pausa, import file e CRUD sezioni"
```

---

## Task 13: SummaryPage — viewer riassunto

**Files:**
- Create: `src/pages/SummaryPage.tsx`

- [ ] **Step 1: Crea SummaryPage.tsx**

```tsx
// src/pages/SummaryPage.tsx
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as storage from '../services/storageService'
import type { FileRecord } from '../types'

export function SummaryPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [file, setFile] = useState<FileRecord | null>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      if (!examId) return
      const esame = await storage.getEsame(examId)
      if (!esame?.files.riassunto) { navigate(`/esame/${examId}`); return }
      const f = esame.files.riassunto
      setFile(f)

      if (f.type === 'text/html' || f.name.endsWith('.html')) {
        setHtmlContent(new TextDecoder().decode(f.data))
      } else if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
        const blob = new Blob([f.data], { type: 'application/pdf' })
        setPdfUrl(URL.createObjectURL(blob))
      } else if (f.name.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const result = await mammoth.convertToHtml({ arrayBuffer: f.data })
        setHtmlContent(result.value)
      }
    }
    load()
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }
  }, [examId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 3rem)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button onClick={() => navigate(`/esame/${examId}`)} style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>←</button>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{file?.name ?? 'Riassunto'}</h1>
      </div>

      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', borderRadius: '12px', border: '1px solid var(--border)' }}>
        {htmlContent && (
          <iframe
            srcDoc={htmlContent}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Riassunto"
            sandbox="allow-same-origin"
          />
        )}
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Riassunto PDF"
          />
        )}
        {!htmlContent && !pdfUrl && (
          <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>Caricamento…</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/SummaryPage.tsx
git commit -m "feat: SummaryPage viewer (iframe HTML, PDF, mammoth DOCX)"
```

---

## Task 14: QuizConfigPage + useQuiz hook

**Files:**
- Create: `src/pages/QuizConfigPage.tsx`
- Create: `src/hooks/useQuiz.ts`

- [ ] **Step 1: Crea useQuiz.ts**

```typescript
// src/hooks/useQuiz.ts
import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { QuizDomanda, QuizSession, PausedSession } from '../types'
import type { SessionQuestion } from '../services/quizService'
import { buildSessionQuestions, filterDomande } from '../services/quizService'
import * as storage from '../services/storageService'
import { shuffle } from '../utils/shuffle'

export type QuizSessionState = {
  questions: SessionQuestion[]
  currentIndex: number
  confirmedAnswers: Record<string, string>   // questionId → risposta data
  selectedAnswer: string | null              // selezione non ancora confermata
}

export function useQuiz(examId: string) {
  const [sessionState, setSessionState] = useState<QuizSessionState | null>(null)
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null)
  const [macroargomenti, setMacroargomenti] = useState<string[]>([])
  const [isReviewSession, setIsReviewSession] = useState(false)  // ← traccia se la sessione corrente è un ripasso

  function startSession(
    allDomande: QuizDomanda[],
    selectedMacro: string[],
    n: number,
    limitSec: number | null
  ) {
    const filtered = filterDomande(allDomande, selectedMacro)
    const questions = buildSessionQuestions(filtered, n)
    setTimeLimitSeconds(limitSec)
    setMacroargomenti(selectedMacro)
    setIsReviewSession(false)  // sessione normale
    setSessionState({ questions, currentIndex: 0, confirmedAnswers: {}, selectedAnswer: null })
  }

  function resumeFromPaused(ps: PausedSession, allDomande: QuizDomanda[]) {
    if (ps.mode !== 'quiz' || !ps.questionIds) return
    const qMap = Object.fromEntries(allDomande.map(d => [d.id, d]))
    const questions: SessionQuestion[] = ps.questionIds.map(id => {
      const d = qMap[id]
      return { ...d, opzioniShuffled: d.tipo === 'multipla' ? shuffle(d.opzioni!) : undefined }
    })
    setTimeLimitSeconds(ps.timeLimitSeconds)
    setMacroargomenti(ps.macroargomenti)
    setSessionState({
      questions,
      currentIndex: ps.currentQuestionIndex ?? 0,
      confirmedAnswers: ps.confirmedAnswers ?? {},
      selectedAnswer: null,
    })
  }

  function selectAnswer(answer: string) {
    setSessionState(s => s ? { ...s, selectedAnswer: answer } : s)
  }

  function confirmAnswer(questionId: string, elapsedSeconds: number) {
    // Cattura selectedAnswer dentro il setter per evitare stale closure
    let capturedAnswer: string | null = null
    setSessionState(s => {
      if (!s || !s.selectedAnswer) return s
      capturedAnswer = s.selectedAnswer
      return {
        ...s,
        confirmedAnswers: { ...s.confirmedAnswers, [questionId]: s.selectedAnswer },
        selectedAnswer: null,
      }
    })
    // Aggiorna questionStats usando capturedAnswer (sicuro, non dipende dallo stato React)
    storage.getEsame(examId).then(async esame => {
      if (!esame?.files.quiz || capturedAnswer === null) return
      const data = JSON.parse(new TextDecoder().decode(esame.files.quiz.data))
      const domanda = data.domande.find((d: QuizDomanda) => d.id === questionId)
      if (!domanda) return
      const statId = `${examId}__${questionId}`
      const existing = (await storage.getQuestionStats(examId)).find(s => s.id === statId)
      const isCorrect = capturedAnswer === domanda.risposta_corretta
      await storage.saveQuestionStat({
        id: statId, examId, questionId,
        timesShown: (existing?.timesShown ?? 0) + 1,
        timesCorrect: (existing?.timesCorrect ?? 0) + (isCorrect ? 1 : 0),
      })
    })
  }

  function goTo(index: number) {
    setSessionState(s => s ? { ...s, currentIndex: index, selectedAnswer: null } : s)
  }

  async function pauseSession(elapsedSeconds: number) {
    if (!sessionState) return
    const ps: PausedSession = {
      id: `${examId}__quiz`,
      examId,
      mode: 'quiz',
      savedAt: new Date().toISOString(),
      elapsedSeconds,
      timeLimitSeconds,
      macroargomenti,
      questionIds: sessionState.questions.map(q => q.id),
      currentQuestionIndex: sessionState.currentIndex,
      confirmedAnswers: sessionState.confirmedAnswers,
    }
    await storage.savePausedSession(ps)
  }

  async function finishSession(
    elapsedSeconds: number,
    completedByTimeout: boolean,
    allDomande: QuizDomanda[]
  ): Promise<QuizSession> {
    if (!sessionState) throw new Error('No active session')
    const qMap = Object.fromEntries(allDomande.map(d => [d.id, d]))
    const errors: string[] = []
    const unanswered: string[] = []
    let score = 0

    for (const q of sessionState.questions) {
      const given = sessionState.confirmedAnswers[q.id]
      if (!given) { unanswered.push(q.id); continue }
      if (given === qMap[q.id]?.risposta_corretta) { score++ } else { errors.push(q.id) }
    }

    const session: QuizSession = {
      id: uuidv4(),
      examId,
      date: new Date().toISOString(),
      score,
      total: sessionState.questions.length,
      totalTime: elapsedSeconds,
      timeLimitSeconds,
      completedByTimeout,
      macroargomenti,
      errors,
      unanswered,
      isReview: isReviewSession,  // ← usa il flag tracciato nello stato del hook
    }
    await storage.saveQuizSession(session)
    await storage.deletePausedSession(`${examId}__quiz`)
    setSessionState(null)
    return session
  }

  async function startReviewSession(errors: string[], unanswered: string[], allDomande: QuizDomanda[]): Promise<void> {
    const ids = new Set([...errors, ...unanswered])
    const domande = allDomande.filter(d => ids.has(d.id))
    const questions = buildSessionQuestions(domande, domande.length)
    setTimeLimitSeconds(null)
    setMacroargomenti([])
    setIsReviewSession(true)  // ← marca questa sessione come ripasso
    setSessionState({ questions, currentIndex: 0, confirmedAnswers: {}, selectedAnswer: null })
  }

  return {
    sessionState, timeLimitSeconds, macroargomenti,
    startSession, resumeFromPaused, selectAnswer, confirmAnswer,
    goTo, pauseSession, finishSession, startReviewSession,
  }
}
```

- [ ] **Step 2: Crea QuizConfigPage.tsx**

```tsx
// src/pages/QuizConfigPage.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { QuizFile, PausedSession } from '../types'
import * as storage from '../services/storageService'
import { validateQuizFile } from '../services/quizService'
import { ConfirmDialog } from '../components/ConfirmDialog'

const PRESET_COUNTS = [10, 30, 50] as const
const PRESET_TIMES = [5, 10, 15, 30] as const

export function QuizConfigPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [quizData, setQuizData] = useState<QuizFile | null>(null)
  const [allMacro, setAllMacro] = useState<string[]>([])
  const [selectedMacro, setSelectedMacro] = useState<string[]>([])
  const [countPreset, setCountPreset] = useState<number | 'custom'>(30)
  const [customCount, setCustomCount] = useState('')
  const [timePreset, setTimePreset] = useState<number | 'custom' | null>(null)
  const [customTime, setCustomTime] = useState('')
  const [pausedSession, setPausedSession] = useState<PausedSession | null>(null)
  const [conflictDialog, setConflictDialog] = useState(false)
  const [maxAvailable, setMaxAvailable] = useState(0)

  useEffect(() => {
    async function load() {
      if (!examId) return
      const esame = await storage.getEsame(examId)
      if (!esame?.files.quiz) { navigate(`/esame/${examId}`); return }
      const data = validateQuizFile(JSON.parse(new TextDecoder().decode(esame.files.quiz.data)))
      setQuizData(data)
      const macros = [...new Set(data.domande.flatMap(d => d.macroargomenti))].sort()
      setAllMacro(macros)
      setMaxAvailable(data.domande.length)
      const ps = await storage.getPausedSession(`${examId}__quiz`)
      setPausedSession(ps ?? null)
    }
    load()
  }, [examId])

  // Ricalcola max disponibile al cambio filtri
  useEffect(() => {
    if (!quizData) return
    const filtered = selectedMacro.length === 0
      ? quizData.domande
      : quizData.domande.filter(d => d.macroargomenti.some(m => selectedMacro.includes(m)))
    setMaxAvailable(filtered.length)
  }, [selectedMacro, quizData])

  function toggleMacro(m: string) {
    setSelectedMacro(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function getCount(): number {
    if (countPreset === 'custom') return Math.min(parseInt(customCount) || 1, maxAvailable)
    return Math.min(countPreset, maxAvailable)
  }

  function getLimitSeconds(): number | null {
    if (timePreset === null) return null
    if (timePreset === 'custom') return Math.min(parseInt(customTime) || 1, 180) * 60
    return timePreset * 60
  }

  function handleStart() {
    if (pausedSession) { setConflictDialog(true); return }
    navigate(`/esame/${examId}/quiz/sessione`, {
      state: { selectedMacro, count: getCount(), limitSeconds: getLimitSeconds() }
    })
  }

  const noQuestions = maxAvailable === 0

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto' }}>
      <button onClick={() => navigate(`/esame/${examId}`)} style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>←</button>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem' }}>🧠 Configura quiz</h1>

      {/* Macroargomenti */}
      <Section title="Macroargomenti">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Chip label="Tutti" selected={selectedMacro.length === 0} onClick={() => setSelectedMacro([])} />
          {allMacro.map(m => (
            <Chip key={m} label={m} selected={selectedMacro.includes(m)} onClick={() => toggleMacro(m)} />
          ))}
        </div>
      </Section>

      {/* Numero domande */}
      <Section title="Numero domande">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {PRESET_COUNTS.map(n => (
            <Chip key={n} label={String(n)} selected={countPreset === n} onClick={() => setCountPreset(n)} />
          ))}
          <Chip label="Personalizzato" selected={countPreset === 'custom'} onClick={() => setCountPreset('custom')} />
        </div>
        {countPreset === 'custom' && (
          <input type="number" min={1} max={maxAvailable} value={customCount}
            onChange={e => setCustomCount(e.target.value)}
            placeholder={`1–${maxAvailable}`}
            style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)', width: '100px' }}
          />
        )}
        {maxAvailable < getCount() && (
          <p style={{ fontSize: '0.85rem', color: 'var(--warning)', marginTop: '0.5rem' }}>
            ℹ️ Solo {maxAvailable} domande disponibili con i filtri selezionati — verranno usate tutte.
          </p>
        )}
      </Section>

      {/* Tempo massimo */}
      <Section title="Tempo massimo">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Chip label="Disabilitato" selected={timePreset === null} onClick={() => setTimePreset(null)} />
          {PRESET_TIMES.map(n => (
            <Chip key={n} label={`${n}m`} selected={timePreset === n} onClick={() => setTimePreset(n)} />
          ))}
          <Chip label="Personalizzato" selected={timePreset === 'custom'} onClick={() => setTimePreset('custom')} />
        </div>
        {timePreset === 'custom' && (
          <input type="number" min={1} max={180} value={customTime}
            onChange={e => setCustomTime(e.target.value)}
            placeholder="1–180 minuti"
            style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)', width: '120px' }}
          />
        )}
      </Section>

      <button onClick={handleStart} disabled={noQuestions} style={{
        width: '100%', padding: '0.75rem', borderRadius: '10px',
        background: 'var(--accent)', color: '#fff', fontSize: '1.05rem', fontWeight: 600,
        minHeight: '48px', marginTop: '1rem',
      }}>
        {noQuestions ? 'Nessuna domanda disponibile con i filtri selezionati' : 'Inizia quiz'}
      </button>

      <ConfirmDialog
        open={conflictDialog}
        title="Sessione in pausa"
        message="Hai una sessione quiz in pausa. Cosa vuoi fare?"
        confirmLabel="Riprendi"
        cancelLabel="Abbandona e ricomincia"
        onConfirm={() => { setConflictDialog(false); navigate(`/esame/${examId}/quiz/sessione`, { state: { resume: true } }) }}
        onCancel={async () => {
          await storage.deletePausedSession(`${examId}__quiz`)
          setPausedSession(null)
          setConflictDialog(false)
          navigate(`/esame/${examId}/quiz/sessione`, {
            state: { selectedMacro, count: getCount(), limitSeconds: getLimitSeconds() }
          })
        }}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>
      {children}
    </div>
  )
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem',
      background: selected ? 'var(--accent)' : 'var(--bg-elevated)',
      color: selected ? '#fff' : 'var(--text)',
      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      minHeight: '36px',
    }}>{label}</button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useQuiz.ts src/pages/QuizConfigPage.tsx
git commit -m "feat: useQuiz hook e QuizConfigPage con filtri e configurazione"
```

---

## Task 15: QuizSessionPage

**Files:**
- Create: `src/pages/QuizSessionPage.tsx`

- [ ] **Step 1: Crea QuizSessionPage.tsx**

```tsx
// src/pages/QuizSessionPage.tsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import type { QuizFile, QuizDomanda, QuizSession } from '../types'
import * as storage from '../services/storageService'
import { validateQuizFile } from '../services/quizService'
import { useQuiz } from '../hooks/useQuiz'
import { useTimer } from '../hooks/useTimer'
import { Timer } from '../components/Timer'
import { ProgressBar } from '../components/ProgressBar'
import { DotNav, DotState } from '../components/DotNav'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function QuizSessionPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isResume = location.state?.resume === true

  const [quizData, setQuizData] = useState<QuizFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pauseDialog, setPauseDialog] = useState(false)
  const [deliverDialog, setDeliverDialog] = useState(false)
  const [finishedSession, setFinishedSession] = useState<QuizSession | null>(null)
  const [initialized, setInitialized] = useState(false)

  const quiz = useQuiz(examId!)

  // Callback timeout: auto-consegna
  const handleExpire = useCallback(async () => {
    if (!quizData || !quiz.sessionState) return
    const session = await quiz.finishSession(timer.elapsed, true, quizData.domande)
    setFinishedSession(session)
    navigate(`/esame/${examId}/quiz/risultato`, { state: { session } })
  }, [quizData, quiz.sessionState])

  const timer = useTimer({
    limitSeconds: quiz.timeLimitSeconds,
    initialElapsed: 0,
    onExpire: handleExpire,
  })

  // Inizializza sessione
  useEffect(() => {
    if (!examId || initialized) return
    async function init() {
      const esame = await storage.getEsame(examId!)
      if (!esame?.files.quiz) { navigate(`/esame/${examId}`); return }
      const data = validateQuizFile(JSON.parse(new TextDecoder().decode(esame.files.quiz.data)))
      setQuizData(data)

      if (isResume) {
        const ps = await storage.getPausedSession(`${examId}__quiz`)
        if (ps) { quiz.resumeFromPaused(ps, data.domande); }
        else {
          // Fallback: nessuna sessione in pausa, torna a config
          navigate(`/esame/${examId}/quiz/config`)
          return
        }
      } else {
        const { selectedMacro, count, limitSeconds } = location.state ?? {}
        quiz.startSession(data.domande, selectedMacro ?? [], count ?? 30, limitSeconds ?? null)
      }
      setInitialized(true)
      setLoading(false)
    }
    init()
  }, [examId, initialized])

  // Capacitor back button — intercept durante sessione
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cleanup: (() => void) | undefined
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => { setPauseDialog(true) })
        .then(h => { cleanup = () => h.remove() })
    })
    return () => cleanup?.()
  }, [])

  async function handlePause() {
    timer.pause()
    await quiz.pauseSession(timer.elapsed)
    navigate(`/esame/${examId}`)
  }

  async function handleDeliver() {
    if (!quizData) return
    const session = await quiz.finishSession(timer.elapsed, false, quizData.domande)
    navigate(`/esame/${examId}/quiz/risultato`, { state: { session } })
  }

  if (loading || !quiz.sessionState) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Caricamento…</div>

  const { questions, currentIndex, confirmedAnswers, selectedAnswer } = quiz.sessionState
  const currentQ = questions[currentIndex]
  const isConfirmed = !!confirmedAnswers[currentQ?.id]
  const unconfirmedCount = questions.filter(q => !confirmedAnswers[q.id]).length

  const dotStates: DotState[] = questions.map(q => {
    if (!confirmedAnswers[q.id]) return currentIndex === questions.indexOf(q) ? 'selected' : 'unanswered'
    const correct = quizData?.domande.find(d => d.id === q.id)?.risposta_corretta
    return confirmedAnswers[q.id] === correct ? 'correct' : 'wrong'
  })

  const displayOptions = currentQ.tipo === 'multipla'
    ? currentQ.opzioniShuffled ?? currentQ.opzioni ?? []
    : ['Vero', 'Falso']

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Domanda {currentIndex + 1} di {questions.length}</span>
        <Timer elapsed={timer.elapsed} remaining={timer.remaining} />
      </div>

      <ProgressBar current={currentIndex + 1} total={questions.length} />
      <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
        <DotNav total={questions.length} current={currentIndex} states={dotStates} onSelect={quiz.goTo} />
      </div>

      {/* Domanda */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '1rem' }}>{currentQ.testo}</p>

        {/* Opzioni */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {displayOptions.map((opt, i) => {
            const label = currentQ.tipo === 'multipla' ? String.fromCharCode(65 + i) + ') ' : ''
            const isSelected = selectedAnswer === opt || confirmedAnswers[currentQ.id] === opt
            const isCorrect = opt === quizData?.domande.find(d => d.id === currentQ.id)?.risposta_corretta

            let bg = 'var(--bg-elevated)'
            let border = 'var(--border)'
            if (isConfirmed) {
              if (isCorrect) { bg = 'rgba(76,175,130,0.15)'; border = 'var(--success)' }
              else if (isSelected && !isCorrect) { bg = 'rgba(224,85,85,0.15)'; border = 'var(--danger)' }
            } else if (isSelected) { bg = 'rgba(108,99,255,0.15)'; border = 'var(--accent)' }

            return (
              <button key={opt} onClick={() => !isConfirmed && quiz.selectAnswer(opt)}
                disabled={isConfirmed}
                style={{ textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', background: bg, border: `1px solid ${border}`, color: 'var(--text)', minHeight: '48px' }}>
                {label}{opt}
              </button>
            )
          })}
        </div>

        {/* Spiegazione (dopo conferma) */}
        {isConfirmed && currentQ.spiegazione && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-elevated)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            💡 {currentQ.spiegazione}
          </div>
        )}
      </div>

      {/* Bottoni navigazione */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button onClick={() => quiz.goTo(currentIndex - 1)} disabled={currentIndex === 0}
          style={{ padding: '0.6rem 1rem', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text)', minHeight: '48px' }}>← Prev</button>

        {!isConfirmed ? (
          <button onClick={() => quiz.confirmAnswer(currentQ.id, timer.elapsed)} disabled={!selectedAnswer}
            style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: '8px', background: 'var(--accent)', color: '#fff', fontWeight: 600, minHeight: '48px' }}>
            Conferma
          </button>
        ) : (
          <button onClick={() => currentIndex < questions.length - 1 && quiz.goTo(currentIndex + 1)}
            disabled={currentIndex === questions.length - 1}
            style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text)', minHeight: '48px' }}>
            Prossima →
          </button>
        )}

        <button onClick={() => quiz.goTo(currentIndex + 1)} disabled={currentIndex === questions.length - 1}
          style={{ padding: '0.6rem 1rem', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text)', minHeight: '48px' }}>Next →</button>
      </div>

      {/* Consegna */}
      <button onClick={() => setDeliverDialog(true)} style={{
        width: '100%', padding: '0.7rem', borderRadius: '10px',
        background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '48px',
      }}>
        Consegna quiz {unconfirmedCount > 0 && <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '10px', padding: '0.1rem 0.4rem', fontSize: '0.8rem', marginLeft: '0.4rem' }}>{unconfirmedCount}</span>}
      </button>

      {/* Dialog pausa */}
      <ConfirmDialog
        open={pauseDialog}
        title="Metti in pausa?"
        message="Vuoi mettere in pausa la sessione e tornare indietro? Il timer si fermerà."
        confirmLabel="Metti in pausa"
        cancelLabel="Continua la sessione"
        onConfirm={handlePause}
        onCancel={() => setPauseDialog(false)}
      />

      {/* Dialog consegna */}
      <ConfirmDialog
        open={deliverDialog}
        title="Consegna quiz"
        message={unconfirmedCount > 0
          ? `Hai ancora ${unconfirmedCount} domande non confermate. Vuoi consegnare comunque?`
          : 'Confermi la consegna del quiz?'}
        confirmLabel="Consegna"
        onConfirm={() => { setDeliverDialog(false); handleDeliver() }}
        onCancel={() => setDeliverDialog(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/QuizSessionPage.tsx
git commit -m "feat: QuizSessionPage con navigazione, conferma, pausa e consegna"
```

---

## Task 16: QuizResultPage

**Files:**
- Create: `src/pages/QuizResultPage.tsx`

- [ ] **Step 1: Crea QuizResultPage.tsx**

```tsx
// src/pages/QuizResultPage.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { QuizSession, QuizFile } from '../types'
import * as storage from '../services/storageService'
import { validateQuizFile } from '../services/quizService'
import { formatTime } from '../utils/formatTime'

export function QuizResultPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const currentSession: QuizSession = location.state?.session

  const [allSessions, setAllSessions] = useState<QuizSession[]>([])
  const [quizData, setQuizData] = useState<QuizFile | null>(null)

  useEffect(() => {
    async function load() {
      if (!examId) return
      const sessions = await storage.getQuizSessions(examId)
      sessions.sort((a, b) => b.date.localeCompare(a.date))
      setAllSessions(sessions)
      const esame = await storage.getEsame(examId)
      if (esame?.files.quiz) {
        const data = validateQuizFile(JSON.parse(new TextDecoder().decode(esame.files.quiz.data)))
        setQuizData(data)
      }
    }
    load()
  }, [examId])

  const hasErrors = currentSession && (currentSession.errors.length > 0 || currentSession.unanswered.length > 0)
  const pct = currentSession ? Math.round((currentSession.score / currentSession.total) * 100) : 0

  function handleReview() {
    navigate(`/esame/${examId}/quiz/sessione`, {
      state: {
        reviewErrors: currentSession.errors,
        reviewUnanswered: currentSession.unanswered,
        isReview: true,
      }
    })
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <button onClick={() => navigate(`/esame/${examId}`)} style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>← Dashboard</button>

      {/* Score corrente */}
      {currentSession && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: pct >= 60 ? 'var(--success)' : 'var(--danger)' }}>{pct}%</div>
          <div style={{ fontSize: '1.1rem', marginTop: '0.25rem' }}>{currentSession.score} / {currentSession.total} corrette</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Tempo: {formatTime(currentSession.totalTime)}
            {currentSession.completedByTimeout && ' (scaduto)'}
            {currentSession.isReview && ' · Sessione ripasso'}
          </div>
        </div>
      )}

      {/* Analisi errori */}
      {currentSession && (currentSession.errors.length > 0 || currentSession.unanswered.length > 0) && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Analisi errori</h2>
          {[...currentSession.errors.map(id => ({ id, type: 'error' as const })),
            ...currentSession.unanswered.map(id => ({ id, type: 'unanswered' as const }))].map(({ id, type }) => {
            const domanda = quizData?.domande.find(d => d.id === id)
            return (
              <div key={id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                    background: type === 'error' ? 'var(--danger)' : 'var(--warning)',
                    color: '#fff', flexShrink: 0, marginTop: '2px',
                  }}>{type === 'error' ? '✗ Sbagliata' : '⏱ Non risposta'}</span>
                  <span style={{ fontSize: '0.9rem' }}>{domanda?.testo ?? id}</span>
                </div>
              </div>
            )
          })}
          {!currentSession.isReview && (
            <button onClick={handleReview} style={{
              marginTop: '0.5rem', padding: '0.6rem 1.2rem', borderRadius: '8px',
              background: 'var(--accent)', color: '#fff', fontWeight: 600, minHeight: '48px',
            }}>🔁 Ripassa errori</button>
          )}
        </div>
      )}

      {/* Storico sessioni */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Storico sessioni</h2>
        {allSessions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nessuna sessione registrata.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {allSessions.map(s => (
              <div key={s.id} style={{
                padding: '0.6rem 0.75rem', borderRadius: '8px',
                background: s.isReview ? 'rgba(108,99,255,0.08)' : 'var(--bg-elevated)',
                border: `1px solid ${s.isReview ? 'var(--accent)' : 'var(--border)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '0.9rem',
              }}>
                <span>{new Date(s.date).toLocaleDateString('it-IT')} {s.isReview && '· ripasso'}</span>
                <span style={{ fontWeight: 600 }}>{s.score}/{s.total} ({Math.round(s.score / s.total * 100)}%)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/QuizResultPage.tsx
git commit -m "feat: QuizResultPage con score, storico e analisi errori"
```

---

## Task 17: useFlashcard hook

**Files:**
- Create: `src/hooks/useFlashcard.ts`

- [ ] **Step 1: Crea useFlashcard.ts**

```typescript
// src/hooks/useFlashcard.ts
import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { FlashCard, FlashcardFile, PausedSession, CardEval } from '../types'
import * as storage from '../services/storageService'
import { shuffle } from '../utils/shuffle'

export type FlashcardPhase = 'front' | 'back'

export interface FlashcardSessionState {
  cards: FlashCard[]
  currentIndex: number
  phase: FlashcardPhase
  cardEvals: Record<string, CardEval>
  reviewQueue: string[]
  isInReview: boolean   // true se stiamo scorrendo la coda di ripasso
}

export function useFlashcard(examId: string) {
  const [sessionState, setSessionState] = useState<FlashcardSessionState | null>(null)
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null)
  const [macroargomenti, setMacroargomenti] = useState<string[]>([])

  function startSession(
    allCards: FlashCard[],
    selectedMacro: string[],
    n: number,
    limitSec: number | null
  ) {
    const filtered = selectedMacro.length === 0
      ? allCards
      : allCards.filter(c => c.macroargomenti.some(m => selectedMacro.includes(m)))
    const cards = shuffle(filtered).slice(0, n)
    setTimeLimitSeconds(limitSec)
    setMacroargomenti(selectedMacro)
    setSessionState({ cards, currentIndex: 0, phase: 'front', cardEvals: {}, reviewQueue: [], isInReview: false })
  }

  function resumeFromPaused(ps: PausedSession, allCards: FlashCard[]) {
    if (ps.mode !== 'flashcard' || !ps.cardIds) return
    const cardMap = Object.fromEntries(allCards.map(c => [c.id, c]))
    const cards = ps.cardIds.map(id => cardMap[id]).filter(Boolean)
    setTimeLimitSeconds(ps.timeLimitSeconds)
    setMacroargomenti(ps.macroargomenti)
    setSessionState({
      cards,
      currentIndex: ps.currentCardIndex ?? 0,
      phase: 'front',
      cardEvals: (ps.cardEvals ?? {}) as Record<string, CardEval>,
      reviewQueue: ps.reviewQueue ?? [],
      isInReview: false,
    })
  }

  function showBack() {
    setSessionState(s => s ? { ...s, phase: 'back' } : s)
  }

  function dontKnow() {
    setSessionState(s => {
      if (!s) return s
      const card = s.cards[s.currentIndex]
      const newEvals = { ...s.cardEvals, [card.id]: 'No' as CardEval }
      return { ...s, phase: 'back', cardEvals: newEvals }
    })
  }

  function evaluate(cardId: string, eval_: CardEval) {
    setSessionState(s => {
      if (!s) return s
      const newEvals = { ...s.cardEvals, [cardId]: eval_ }
      const nextIndex = s.currentIndex + 1

      // Fine mazzo principale
      if (nextIndex >= s.cards.length && !s.isInReview) {
        // Costruisce coda ripasso: carte "No" o "In parte"
        const reviewIds = s.cards
          .filter(c => newEvals[c.id] === 'No' || newEvals[c.id] === 'In parte')
          .map(c => c.id)
        if (reviewIds.length > 0) {
          const shuffledReview = shuffle(reviewIds)
          const reviewCards = shuffle(s.cards.filter(c => shuffledReview.includes(c.id)))
          return { ...s, cardEvals: newEvals, cards: reviewCards, currentIndex: 0, phase: 'front', reviewQueue: shuffledReview, isInReview: true }
        }
        return { ...s, cardEvals: newEvals, currentIndex: nextIndex }  // done
      }

      // Fine coda ripasso: ricostruisci con le rimanenti Non-Sì
      if (nextIndex >= s.cards.length && s.isInReview) {
        const stillBad = s.cards
          .filter(c => newEvals[c.id] === 'No' || newEvals[c.id] === 'In parte')
          .map(c => c.id)
        if (stillBad.length > 0) {
          const reviewCards = shuffle(s.cards.filter(c => stillBad.includes(c.id)))
          return { ...s, cardEvals: newEvals, cards: reviewCards, currentIndex: 0, phase: 'front' }
        }
        return { ...s, cardEvals: newEvals, currentIndex: nextIndex } // done
      }

      return { ...s, cardEvals: newEvals, currentIndex: nextIndex, phase: 'front' }
    })
  }

  async function pauseSession(elapsedSeconds: number) {
    if (!sessionState) return
    const ps: PausedSession = {
      id: `${examId}__flashcard`,
      examId,
      mode: 'flashcard',
      savedAt: new Date().toISOString(),
      elapsedSeconds,
      timeLimitSeconds,
      macroargomenti,
      cardIds: sessionState.cards.map(c => c.id),
      currentCardIndex: sessionState.currentIndex,
      cardEvals: sessionState.cardEvals,
      reviewQueue: sessionState.reviewQueue,
    }
    await storage.savePausedSession(ps)
  }

  async function finishSession(elapsedSeconds: number, timedOut: boolean) {
    if (!sessionState) return
    // Salva flashcardStats con lastEval e lastSeen.
    // Le carte non valutate (non raggiunte per timeout) ricevono 'Non risposta'.
    // NOTA: sessionState.cards contiene solo il mazzo corrente (potrebbe essere la coda ripasso);
    // per avere tutte le carte della sessione originale usiamo allOriginalCards se disponibile,
    // altrimenti ci limitiamo al mazzo corrente.
    const now = new Date().toISOString()
    for (const card of sessionState.cards) {
      const eval_ = sessionState.cardEvals[card.id] ?? 'Non risposta'
      await storage.saveFlashcardStat({
        id: `${examId}__${card.id}`,
        examId,
        cardId: card.id,
        lastEval: eval_,
        lastSeen: now,
      })
    }
    await storage.deletePausedSession(`${examId}__flashcard`)
    setSessionState(null)
  }

  const isDone = sessionState !== null &&
    sessionState.currentIndex >= sessionState.cards.length

  return {
    sessionState, timeLimitSeconds, macroargomenti, isDone,
    startSession, resumeFromPaused, showBack, dontKnow, evaluate,
    pauseSession, finishSession,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useFlashcard.ts
git commit -m "feat: useFlashcard hook con coda ripasso e autovalutazione"
```

---

## Task 18: FlashcardConfigPage + FlashcardSessionPage

**Files:**
- Create: `src/pages/FlashcardConfigPage.tsx`
- Create: `src/pages/FlashcardSessionPage.tsx`

- [ ] **Step 1: Crea FlashcardConfigPage.tsx**

```tsx
// src/pages/FlashcardConfigPage.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { FlashcardFile, PausedSession } from '../types'
import { validateFlashcardFile } from '../services/quizService'
import * as storage from '../services/storageService'
import { ConfirmDialog } from '../components/ConfirmDialog'

const PRESET_COUNTS = [10, 30, 50] as const
const PRESET_TIMES = [5, 10, 15, 30] as const

export function FlashcardConfigPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [flashData, setFlashData] = useState<FlashcardFile | null>(null)
  const [allMacro, setAllMacro] = useState<string[]>([])
  const [selectedMacro, setSelectedMacro] = useState<string[]>([])
  const [countPreset, setCountPreset] = useState<number | 'custom'>(30)
  const [customCount, setCustomCount] = useState('')
  const [timePreset, setTimePreset] = useState<number | 'custom' | null>(null)
  const [customTime, setCustomTime] = useState('')
  const [pausedSession, setPausedSession] = useState<PausedSession | null>(null)
  const [conflictDialog, setConflictDialog] = useState(false)
  const [maxAvailable, setMaxAvailable] = useState(0)

  useEffect(() => {
    async function load() {
      if (!examId) return
      const esame = await storage.getEsame(examId)
      if (!esame?.files.flashcard) { navigate(`/esame/${examId}`); return }
      const data = validateFlashcardFile(JSON.parse(new TextDecoder().decode(esame.files.flashcard.data))) as FlashcardFile
      setFlashData(data)
      const macros = [...new Set(data.carte.flatMap(c => c.macroargomenti))].sort()
      setAllMacro(macros)
      setMaxAvailable(data.carte.length)
      const ps = await storage.getPausedSession(`${examId}__flashcard`)
      setPausedSession(ps ?? null)
    }
    load()
  }, [examId])

  useEffect(() => {
    if (!flashData) return
    const filtered = selectedMacro.length === 0
      ? flashData.carte
      : flashData.carte.filter(c => c.macroargomenti.some(m => selectedMacro.includes(m)))
    setMaxAvailable(filtered.length)
  }, [selectedMacro, flashData])

  function toggleMacro(m: string) {
    setSelectedMacro(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function getCount(): number {
    if (countPreset === 'custom') return Math.min(parseInt(customCount) || 1, maxAvailable)
    return Math.min(countPreset, maxAvailable)
  }

  function getLimitSeconds(): number | null {
    if (timePreset === null) return null
    if (timePreset === 'custom') return Math.min(parseInt(customTime) || 1, 180) * 60
    return timePreset * 60
  }

  function handleStart() {
    if (pausedSession) { setConflictDialog(true); return }
    navigate(`/esame/${examId}/flashcard/sessione`, {
      state: { selectedMacro, count: getCount(), limitSeconds: getLimitSeconds() }
    })
  }

  const noCards = maxAvailable === 0

  function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
      <button onClick={onClick} style={{
        padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem',
        background: selected ? 'var(--accent)' : 'var(--bg-elevated)',
        color: selected ? '#fff' : 'var(--text)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        minHeight: '36px',
      }}>{label}</button>
    )
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>
        {children}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto' }}>
      <button onClick={() => navigate(`/esame/${examId}`)} style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>←</button>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem' }}>🃏 Configura flashcard</h1>

      <Section title="Macroargomenti">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Chip label="Tutti" selected={selectedMacro.length === 0} onClick={() => setSelectedMacro([])} />
          {allMacro.map(m => <Chip key={m} label={m} selected={selectedMacro.includes(m)} onClick={() => toggleMacro(m)} />)}
        </div>
      </Section>

      <Section title="Numero carte">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {PRESET_COUNTS.map(n => <Chip key={n} label={String(n)} selected={countPreset === n} onClick={() => setCountPreset(n)} />)}
          <Chip label="Personalizzato" selected={countPreset === 'custom'} onClick={() => setCountPreset('custom')} />
        </div>
        {countPreset === 'custom' && (
          <input type="number" min={1} max={maxAvailable} value={customCount}
            onChange={e => setCustomCount(e.target.value)}
            placeholder={`1–${maxAvailable}`}
            style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)', width: '100px' }}
          />
        )}
      </Section>

      <Section title="Tempo massimo">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Chip label="Disabilitato" selected={timePreset === null} onClick={() => setTimePreset(null)} />
          {PRESET_TIMES.map(n => <Chip key={n} label={`${n}m`} selected={timePreset === n} onClick={() => setTimePreset(n)} />)}
          <Chip label="Personalizzato" selected={timePreset === 'custom'} onClick={() => setTimePreset('custom')} />
        </div>
        {timePreset === 'custom' && (
          <input type="number" min={1} max={180} value={customTime}
            onChange={e => setCustomTime(e.target.value)}
            placeholder="1–180 minuti"
            style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)', width: '120px' }}
          />
        )}
      </Section>

      <button onClick={handleStart} disabled={noCards} style={{
        width: '100%', padding: '0.75rem', borderRadius: '10px',
        background: 'var(--accent)', color: '#fff', fontSize: '1.05rem', fontWeight: 600,
        minHeight: '48px', marginTop: '1rem',
      }}>
        {noCards ? 'Nessuna carta disponibile con i filtri selezionati' : 'Inizia flashcard'}
      </button>

      <ConfirmDialog
        open={conflictDialog}
        title="Sessione in pausa"
        message="Hai una sessione flashcard in pausa. Cosa vuoi fare?"
        confirmLabel="Riprendi"
        cancelLabel="Abbandona e ricomincia"
        onConfirm={() => { setConflictDialog(false); navigate(`/esame/${examId}/flashcard/sessione`, { state: { resume: true } }) }}
        onCancel={async () => {
          await storage.deletePausedSession(`${examId}__flashcard`)
          setPausedSession(null)
          setConflictDialog(false)
          navigate(`/esame/${examId}/flashcard/sessione`, {
            state: { selectedMacro, count: getCount(), limitSeconds: getLimitSeconds() }
          })
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Crea FlashcardSessionPage.tsx**

```tsx
// src/pages/FlashcardSessionPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import type { FlashcardFile } from '../types'
import { validateFlashcardFile } from '../services/quizService'
import * as storage from '../services/storageService'
import { useFlashcard } from '../hooks/useFlashcard'
import { useTimer } from '../hooks/useTimer'
import { Timer } from '../components/Timer'
import { ProgressBar } from '../components/ProgressBar'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function FlashcardSessionPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isResume = location.state?.resume === true

  const [flashData, setFlashData] = useState<FlashcardFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [pauseDialog, setPauseDialog] = useState(false)
  const [finished, setFinished] = useState(false)

  const fc = useFlashcard(examId!)

  const [finishedSnapshot, setFinishedSnapshot] = useState<{
    total: number
    unansweredCount: number
    timedOut: boolean
  } | null>(null)

  const handleExpire = useCallback(async () => {
    if (!fc.sessionState) return
    // Cattura snapshot prima che finishSession azzeri sessionState
    const unansweredCount = fc.sessionState.cards.filter(
      c => !fc.sessionState!.cardEvals[c.id]
    ).length
    await fc.finishSession(timer.elapsed, true)
    setFinishedSnapshot({ total: fc.sessionState.cards.length, unansweredCount, timedOut: true })
    setFinished(true)
  }, [fc.sessionState])

  const timer = useTimer({ limitSeconds: fc.timeLimitSeconds, onExpire: handleExpire })

  useEffect(() => {
    if (!examId || initialized) return
    async function init() {
      const esame = await storage.getEsame(examId!)
      if (!esame?.files.flashcard) { navigate(`/esame/${examId}`); return }
      const data = validateFlashcardFile(JSON.parse(new TextDecoder().decode(esame.files.flashcard.data))) as FlashcardFile
      setFlashData(data)
      if (isResume) {
        const ps = await storage.getPausedSession(`${examId}__flashcard`)
        if (ps) fc.resumeFromPaused(ps, data.carte)
        else { navigate(`/esame/${examId}/flashcard/config`); return }
      } else {
        const { selectedMacro, count, limitSeconds } = location.state ?? {}
        fc.startSession(data.carte, selectedMacro ?? [], count ?? 30, limitSeconds ?? null)
      }
      setInitialized(true)
      setLoading(false)
    }
    init()
  }, [examId, initialized])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cleanup: (() => void) | undefined
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => setPauseDialog(true))
        .then(h => { cleanup = () => h.remove() })
    })
    return () => cleanup?.()
  }, [])

  async function handlePause() {
    timer.pause()
    await fc.pauseSession(timer.elapsed)
    navigate(`/esame/${examId}`)
  }

  async function handleDone() {
    if (!fc.sessionState) return
    const unansweredCount = fc.sessionState.cards.filter(
      c => !fc.sessionState!.cardEvals[c.id]
    ).length
    await fc.finishSession(timer.elapsed, false)
    setFinishedSnapshot({ total: fc.sessionState.cards.length, unansweredCount, timedOut: false })
    setFinished(true)
  }

  useEffect(() => {
    if (fc.isDone && !finished) handleDone()
  }, [fc.isDone])

  if (loading || !fc.sessionState) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Caricamento…</div>

  if (finished) {
    return (
      <div style={{ maxWidth: '540px', margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          {finishedSnapshot?.timedOut ? '⏱' : '🎉'}
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {finishedSnapshot?.timedOut ? 'Tempo scaduto!' : 'Sessione completata!'}
        </h1>
        {finishedSnapshot?.timedOut && finishedSnapshot.unansweredCount > 0 ? (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            {finishedSnapshot.unansweredCount} carte non raggiunte segnate come ⏱ Non risposta.
          </p>
        ) : (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Hai completato tutte le carte.</p>
        )}
        <button onClick={() => navigate(`/esame/${examId}`)} style={{
          padding: '0.75rem 1.5rem', borderRadius: '10px', background: 'var(--accent)',
          color: '#fff', fontWeight: 600, minHeight: '48px',
        }}>Torna alla dashboard</button>
      </div>
    )
  }

  const { cards, currentIndex, phase, cardEvals } = fc.sessionState
  const card = cards[currentIndex]
  if (!card) return null

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Carta {currentIndex + 1} di {cards.length}</span>
        <Timer elapsed={timer.elapsed} remaining={timer.remaining} />
      </div>
      <ProgressBar current={currentIndex + 1} total={cards.length} />

      <div style={{ marginTop: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{phase === 'front' ? 'Fronte' : 'Risposta'}</div>
        <p style={{ fontSize: '1.1rem', fontWeight: phase === 'front' ? 600 : 400 }}>
          {phase === 'front' ? card.fronte : card.retro}
        </p>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {phase === 'front' ? (
          <>
            <button onClick={fc.showBack} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--accent)', color: '#fff', fontWeight: 600, minHeight: '48px' }}>Mostra risposta</button>
            <button onClick={fc.dontKnow} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--bg-elevated)', color: 'var(--text-muted)', minHeight: '48px' }}>Non so</button>
          </>
        ) : (
          cardEvals[card.id] === 'No' ? (
            // Caso "Non so": solo prossima
            <button onClick={() => fc.evaluate(card.id, 'No')} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--bg-elevated)', color: 'var(--text)', minHeight: '48px' }}>Prossima →</button>
          ) : (
            // Autovalutazione
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => fc.evaluate(card.id, 'No')} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: 'rgba(224,85,85,0.15)', border: '1px solid var(--danger)', color: 'var(--text)', minHeight: '48px' }}>✗ No</button>
              <button onClick={() => fc.evaluate(card.id, 'In parte')} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: 'rgba(224,165,69,0.15)', border: '1px solid var(--warning)', color: 'var(--text)', minHeight: '48px' }}>~ In parte</button>
              <button onClick={() => fc.evaluate(card.id, 'Sì')} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: 'rgba(76,175,130,0.15)', border: '1px solid var(--success)', color: 'var(--text)', minHeight: '48px' }}>✓ Sì</button>
            </div>
          )
        )}
      </div>

      <ConfirmDialog
        open={pauseDialog}
        title="Metti in pausa?"
        message="Vuoi mettere in pausa la sessione e tornare indietro?"
        confirmLabel="Metti in pausa"
        cancelLabel="Continua la sessione"
        onConfirm={handlePause}
        onCancel={() => setPauseDialog(false)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/FlashcardConfigPage.tsx src/pages/FlashcardSessionPage.tsx
git commit -m "feat: FlashcardConfigPage e FlashcardSessionPage con coda ripasso"
```

---

## Task 19: Build web + setup Capacitor Android

**Files:**
- Modify: `package.json` (aggiunge script)

- [ ] **Step 1: Aggiungi script in package.json**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "cap:sync": "npm run build && npx cap sync",
    "cap:android": "npm run cap:sync && npx cap open android"
  }
}
```

- [ ] **Step 2: Inizializza progetto Capacitor**

```bash
npx cap init "Study App" com.studyapp.local --web-dir dist
npx cap add android
```

- [ ] **Step 3: Build web e sync Android**

```bash
npm run cap:sync
```
Expected: build Vite OK + "Sync finished in Xs"

- [ ] **Step 4: Verifica APK su emulatore o dispositivo**

```bash
npx cap open android
# In Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)
```
Expected: APK generato senza errori

- [ ] **Step 5: Esegui suite test completa**

```bash
npx vitest run
```
Expected: tutti i test PASS

- [ ] **Step 6: Commit finale**

```bash
git add .
git commit -m "feat: build web + setup Capacitor Android — app completa"
```

---

## Self-Review

### 1. Spec coverage

| Requisito spec | Task che lo implementa |
|---|---|
| React + Vite + TypeScript + Capacitor | Task 1, 19 |
| IndexedDB versione 2 con `pausedSessions` e migration | Task 4 |
| fileService abstraction web/Android | Task 5 |
| Validazione schema quiz.json e flashcard.json con errore inline | Task 6, 12 |
| Fisher-Yates shuffle + formatTime | Task 3 |
| useTimer conta-su / conta-giù / pause/resume / rosso 60s | Task 7, 8 |
| useQuiz: shuffle opzioni, scoring, errors/unanswered, isReview | Task 14 |
| useFlashcard: coda ripasso, dontKnow="No", aggiorna stats a fine sessione | Task 17 |
| Layout sidebar (desktop) / bottom-tab (Android) | Task 9 |
| Dark mode default + toggle persistito | Task 8, 9 |
| Onboarding al primo avvio + TutorialPage con prompt copiabili | Task 10 |
| HomePage: crea, rinomina (menu ⋮), elimina (dialog conferma + cascata) | Task 11 |
| DashboardPage: banner pausa, import file, sostituzione con dialog | Task 12 |
| DashboardPage: nome file importato visibile sotto bottone Sostituisci | Task 12 (fix) |
| SummaryPage: iframe HTML, pdfjs, mammoth DOCX | Task 13 |
| QuizConfigPage: macroargomenti, N domande, tempo, avviso insufficienti | Task 14 |
| QuizSessionPage: dot-nav, conferma, spiegazione, pausa, consegna con badge | Task 15 |
| QuizResultPage: score, storico (isReview distinto), analisi errori, ripassa | Task 16 |
| FlashcardConfigPage: stessa struttura QuizConfig | Task 18 |
| FlashcardSessionPage: fronte→retro, autovalutazione, "Non so", pausa, fine | Task 18 |
| FlashcardSessionPage: carte Non risposta (timeout) distinte nella schermata fine | Task 18 (fix) |
| Capacitor back button intercettato durante sessione attiva | Task 15, 18 |
| "Sessione in pausa" conflict dialog su avvio nuova sessione | Task 14, 18 |
| Sostituzione quiz.json: elimina sessions + questionStats + pausedSession | Task 12 |
| Sostituzione flashcard.json: elimina flashcardStats + pausedSession | Task 12 |
| Timer scaduto: auto-consegna / fine sessione con unanswered | Task 15, 18 |
| Build APK Android via Capacitor | Task 19 |

### 2. Placeholder scan

Nessun placeholder "TBD", "TODO" o "implement later" nel piano.

### 3. Type consistency

- `CardEval` definito in `types/index.ts` → usato in `useFlashcard.ts` e `PausedSession`
- `SessionQuestion` definito in `quizService.ts` → usato in `useQuiz.ts` e `QuizSessionPage.tsx`
- `storageService` funzioni usate con nomi coerenti in tutte le pagine
- `validateFlashcardFile` ritorna `any` in `quizService.ts` — cast esplicito a `FlashcardFile` nei punti d'uso (DashboardPage, FlashcardConfigPage, FlashcardSessionPage) ✓

### 4. Bug fix log (aggiunti in revisione 2026-06-01)

| Bug | File interessato | Fix applicato |
|---|---|---|
| `confirmAnswer` usava stale closure su `sessionState.selectedAnswer` | `useQuiz.ts` | Cattura `capturedAnswer` dentro il setter di stato prima della chiamata asincrona |
| `isReview: false` hardcoded in `finishSession` | `useQuiz.ts` | Aggiunto stato `isReviewSession`, settato a `true` in `startReviewSession` e a `false` in `startSession` |
| Carte non raggiunte per timeout non distinguibili da `'No'` | `useFlashcard.ts` + `FlashcardSessionPage.tsx` | `finishSession` normalizza eval mancante a `'Non risposta'`; `FlashcardSessionPage` cattura snapshot pre-clear e mostra conteggio "Non risposta" nella schermata di fine |
| `SectionCard` non mostrava il nome del file importato | `DashboardPage.tsx` | Prop `fileName` aggiunta a `SectionCard`; visualizzata con icona 📎 sotto i bottoni d'azione |
