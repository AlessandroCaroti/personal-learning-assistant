# Study App — Design Document
**Data:** 2026-06-01
**Stato:** Approvato
**Versione:** 3.0 (aggiornamento su v2.0 del 2026-06-01)
**Stack:** React + Vite + TypeScript + Capacitor

---

## 1. Obiettivo

Applicazione locale per studiare per esami universitari, disponibile come web app su PC e come APK Android (via Capacitor WebView wrapper). Nessun backend, nessuna connessione di rete richiesta. Tutto il dato risiede sul dispositivo dell'utente.

---

## 2. Architettura Generale

```
React + Vite + TypeScript (unico codebase)
│
├── Browser (PC)     → apri index.html o `vite preview`
└── Android (APK)    → Capacitor wrapperizza la stessa web app
```

**Principio fondamentale:** il codebase React non sa su quale piattaforma gira. Tutta la logica platform-specific è isolata in `fileService.ts`.

---

## 3. Struttura del Progetto

```
study-app/
├── src/
│   ├── components/           # Componenti React riutilizzabili
│   ├── pages/                # Schermate (Home, Dashboard, Quiz, Flashcard, Riassunto, Tutorial)
│   ├── store/                # Stato globale (Zustand)
│   ├── hooks/                # Custom hooks (useQuiz, useFlashcard, useExam, useTimer)
│   ├── services/
│   │   ├── fileService.ts    # Abstraction layer web/Android per file picking
│   │   ├── storageService.ts # Wrapper tipizzato su IndexedDB (idb)
│   │   └── quizService.ts    # Logica quiz: shuffle, filtro, scoring
│   ├── types/                # TypeScript interfaces globali
│   └── utils/                # Helper puri (shuffle, formatDate, ecc.)
├── android/                  # Generato da Capacitor (non editare a mano)
├── public/
├── vite.config.ts
├── capacitor.config.ts
└── package.json
```

---

## 4. Formati File

### 4.1 Struttura cartelle esame (solo riferimento concettuale)
I file vengono importati uno per uno tramite file picker e salvati in IndexedDB. Non è richiesta una struttura di cartelle specifica sul disco.

### 4.2 Riassunto
Formati accettati: `.html`, `.pdf`, `.docx`
Visualizzazione:
- `.html` → `<iframe>`
- `.pdf` → `pdfjs`
- `.docx` → conversione in HTML lato client con `mammoth.js`

### 4.3 Quiz — `quiz.json`

```json
{
  "esame": "Analisi Matematica",
  "domande": [
    {
      "id": "q1",
      "macroargomenti": ["Limiti", "Continuità"],
      "tipo": "multipla",
      "testo": "Quale delle seguenti è la definizione formale di limite?",
      "opzioni": ["La definizione epsilon-delta", "Il teorema di Bolzano", "Il criterio del rapporto", "Il teorema di Weierstrass"],
      "risposta_corretta": "La definizione epsilon-delta",
      "spiegazione": "La definizione epsilon-delta afferma che..."
    },
    {
      "id": "q2",
      "macroargomenti": ["Derivate"],
      "tipo": "vero_falso",
      "testo": "La derivata di una costante è sempre zero.",
      "risposta_corretta": "Vero",
      "spiegazione": "Per definizione, la derivata di f(x) = c è f'(x) = 0."
    }
  ]
}
```

**Regole schema:**
- `macroargomenti`: array di stringhe, min 1 elemento
- `tipo`: `"multipla"` | `"vero_falso"`
- `opzioni`: obbligatorio solo per `tipo: "multipla"`, da 2 a 5 elementi; **testo puro senza prefissi lettera** (no "A) ...", "B) ...")
- `risposta_corretta`: per multipla = **testo esatto** di una delle opzioni (confronto stringa); per vero/falso = `"Vero"` o `"Falso"`

### 4.4 Flashcard — `flashcard.json`

```json
{
  "esame": "Analisi Matematica",
  "carte": [
    {
      "id": "f1",
      "macroargomenti": ["Derivate", "Teoremi"],
      "fronte": "Enunciare il teorema di Lagrange.",
      "retro": "Se f è continua in [a,b] e derivabile in (a,b), allora esiste c in (a,b) tale che f'(c) = (f(b)-f(a))/(b-a)."
    }
  ]
}
```

---

## 5. Navigazione

```
Home (lista esami)
├── [+ Nuovo Esame]
│   └── Dialog: inserisci nome esame → crea
│
├── [Azione esame: ⋮] (menu contestuale per ogni esame nella lista)
│   ├── Rinomina → modifica inline o modal
│   └── Elimina → dialog conferma → elimina esame + cascata su tutte le sessioni/stats
│
├── [? Guida] (voce fissa nel menu principale — bottom-tab Android / sidebar desktop)
│   └── → Pagina Tutorial (stessa pagina dell'onboarding, sempre accessibile)
│
└── Esame selezionato → Dashboard Esame
    │
    ├── [Banner "Sessione quiz in pausa"] (solo se esiste pausedSession quiz)
    │   └── [Riprendi] → riapre la sessione quiz nel punto lasciato
    │
    ├── [Banner "Sessione flashcard in pausa"] (solo se esiste pausedSession flashcard)
    │   └── [Riprendi] → riapre la sessione flashcard nel punto lasciato
    │
    ├── 📄 Riassunto
    │   ├── [Importa file] (se non ancora importato)
    │   ├── [Sostituisci] (se già importato — nessun dialogo, nessun effetto su sessioni)
    │   └── Viewer (iframe / pdfjs / mammoth)
    │
    ├── 🧠 Quiz
    │   │   [Disabilitato con label "File non importato" se quiz.json assente]
    │   │
    │   ├── [Importa quiz.json] (se non ancora importato)
    │   ├── [Sostituisci quiz.json] (se già importato)
    │   │   └── Dialog: "Sostituire il file cancellerà lo storico sessioni e le statistiche quiz. Continuare?"
    │   │       ├── Annulla
    │   │       └── Conferma → sostituzione file + elimina quizSessions, questionStats, pausedSession quiz
    │   │
    │   ├── Configurazione sessione
    │   │   ├── Selezione macroargomenti (checkbox, default: Tutti)
    │   │   ├── Numero domande (10 | 30 | 50 | personalizzato, default: 30)
    │   │   │   └── Personalizzato: intero, min 1, max = domande disponibili dopo filtro
    │   │   └── Tempo massimo (disabilitato | 5m | 10m | 15m | 30m | personalizzato, default: disabilitato)
    │   │       └── Personalizzato: intero in minuti, min 1, max 180
    │   │
    │   ├── [Avvio con sessione in pausa esistente]
    │   │   └── Dialog: "Hai una sessione quiz in pausa. Cosa vuoi fare?"
    │   │       ├── [Riprendi] → carica pausedSession, riapre quiz nel punto lasciato
    │   │       └── [Abbandona e ricomincia] → elimina pausedSession (non salvata nello storico)
    │   │                                      → mostra schermata di configurazione
    │   │
    │   ├── Sessione Quiz (flusso exam-style)
    │   │   ├── Barra di progresso + indicatore "Domanda X di N"
    │   │   ├── Cronometro (conta in su; oppure in giù se tempo massimo impostato, rosso ultimi 60s)
    │   │   ├── Navigazione libera tra domande (prev / next / dot-nav)
    │   │   │   └── Dot-nav: ogni punto mostra lo stato (non risposta / selezionata / confermata ✓ / confermata ✗)
    │   │   ├── Per ogni domanda:
    │   │   │   ├── Stato "non confermata": seleziona risposta → [Conferma]
    │   │   │   │   └── [Conferma] disabilitato finché nessuna risposta è selezionata
    │   │   │   └── Stato "confermata": risposta bloccata, risposta corretta + spiegazione visibili inline
    │   │   ├── [Consegna quiz] sempre visibile
    │   │   │   └── Badge con numero di domande non ancora confermate
    │   │   │       → Dialog conferma se ci sono domande non confermate → fine sessione
    │   │   └── [Back / Android back]
    │   │       └── Dialog: "Mettere in pausa la sessione e tornare indietro?"
    │   │           ├── Continua la sessione
    │   │           └── Metti in pausa → ferma timer + salva pausedSession → torna a Dashboard
    │   │
    │   └── Fine Quiz (completamento, consegna esplicita, o scadenza tempo)
    │       ├── Punteggio sessione (domande corrette / totale)
    │       ├── Storico sessioni precedenti (sessioni isReview visivamente distinte)
    │       ├── Analisi errori: lista con badge "✗ Sbagliata" o "⏱ Non risposta"
    │       └── [Ripassa errori] → nuova sessione immediata, senza configurazione, senza limite di tempo
    │                              con sole le domande errors[] + unanswered[] della sessione appena conclusa
    │                              [nascosto se errors[] e unanswered[] sono entrambi vuoti]
    │
    └── 🃏 Flashcard
        │   [Disabilitato con label "File non importato" se flashcard.json assente]
        │
        ├── [Importa flashcard.json] (se non ancora importato)
        ├── [Sostituisci flashcard.json] (se già importato)
        │   └── Dialog: "Sostituire il file cancellerà le statistiche flashcard. Continuare?"
        │       ├── Annulla
        │       └── Conferma → sostituzione file + elimina flashcardStats, pausedSession flashcard
        │
        ├── Configurazione sessione
        │   ├── Selezione macroargomenti (checkbox, default: Tutti)
        │   ├── Numero carte (10 | 30 | 50 | personalizzato, default: 30)
        │   │   └── Personalizzato: intero, min 1, max = carte disponibili dopo filtro
        │   └── Tempo massimo (disabilitato | 5m | 10m | 15m | 30m | personalizzato, default: disabilitato)
        │       └── Personalizzato: intero in minuti, min 1, max 180
        │
        ├── [Avvio con sessione in pausa esistente]
        │   └── Dialog: "Hai una sessione flashcard in pausa. Cosa vuoi fare?"
        │       ├── [Riprendi] → carica pausedSession
        │       └── [Abbandona e ricomincia] → elimina pausedSession → schermata di configurazione
        │
        ├── Sessione Flashcard
        │   ├── Barra di progresso + indicatore "Carta X di N"
        │   ├── Cronometro (conta in su; oppure in giù se tempo massimo impostato, rosso ultimi 60s)
        │   ├── Fronte carta
        │   ├── [Mostra risposta] → Retro carta → Autovalutazione: Sì / In parte / No
        │   ├── [Non so]          → Retro carta → valutazione automatica "No" (no pulsanti) → [Prossima]
        │   └── [Back / Android back]
        │       └── Dialog: "Mettere in pausa la sessione e tornare indietro?"
        │           ├── Continua la sessione
        │           └── Metti in pausa → ferma timer + salva pausedSession → torna a Dashboard
        │
        └── Fine mazzo (completamento o scadenza tempo)
            ├── Carte rimanenti segnate come "⏱ Non risposta" (distinte da "No")
            └── Riproponi "No" e "In parte" finché tutte → "Sì"
                (le "Non risposta" entrano nella coda ripasso)
```

**Avviso domande insufficienti:** se le domande/carte disponibili dopo il filtro sono meno del numero selezionato, l'app usa tutte quelle disponibili e mostra un banner informativo.

**Nessuna domanda disponibile:** se dopo il filtro per macroargomenti il risultato è zero domande/carte, il bottone "Inizia" è disabilitato con il messaggio "Nessuna domanda disponibile con i filtri selezionati".

**Errori di import:** se il file importato è JSON malformato o non rispetta lo schema atteso (§4.3 / §4.4), l'app mostra un messaggio di errore inline ("File non valido: [descrizione]"). Il file non viene salvato in IndexedDB e lo slot resta invariato.

---

## 6. UX e Layout

- **Mobile-first:** layout a colonna singola, bottoni min 48px
- **Android:** navigazione bottom-tab (Home, Guida)
- **Desktop:** sidebar laterale (Home, Guida)
- **Tema:** dark mode di default, toggle light/dark persistito in localStorage
- **Router:** React Router, SPA senza page reload
- **Back Android:** gestito da Capacitor App plugin; durante una sessione attiva intercettato per mostrare il dialog di pausa

---

## 7. Persistenza Dati

**Libreria:** `idb` (wrapper tipizzato su IndexedDB)
**Database:** `study-app-db` — **version 2**
**Funziona identicamente su browser e Android/Capacitor.**

### Object Stores

```typescript
// esami
{
  id: string,           // uuid
  name: string,
  createdAt: string,
  files: {
    riassunto?: { name: string, type: string, data: ArrayBuffer },
    quiz?: { name: string, type: string, data: ArrayBuffer },
    flashcard?: { name: string, type: string, data: ArrayBuffer },
  }
}

// quizSessions
{
  id: string,
  examId: string,
  date: string,
  score: number,                    // domande con risposta corretta confermata
  total: number,                    // totale domande nella sessione
  totalTime: number,                // secondi effettivi impiegati
  timeLimitSeconds: number | null,  // null se nessun limite impostato
  completedByTimeout: boolean,
  macroargomenti: string[],         // filtri usati nella sessione
  errors: string[],                 // question id con risposta confermata errata
  unanswered: string[],             // question id non confermati (timeout o consegna)
  isReview: boolean,                // true se avviata da "Ripassa errori"
}

// questionStats
{
  id: string,           // `${examId}__${questionId}`
  examId: string,
  questionId: string,
  timesShown: number,
  timesCorrect: number,
}

// flashcardStats
{
  id: string,           // `${examId}__${cardId}`
  examId: string,
  cardId: string,
  lastEval: "Sì" | "In parte" | "No" | "Non risposta",
  lastSeen: string,
}

// pausedSessions  ← NUOVO in v2
{
  id: string,                  // "${examId}__quiz" oppure "${examId}__flashcard"
  examId: string,
  mode: "quiz" | "flashcard",
  savedAt: string,

  // Timer
  elapsedSeconds: number,
  timeLimitSeconds: number | null,

  // Config sessione
  macroargomenti: string[],

  // Campi Quiz (presenti solo se mode === "quiz")
  questionIds: string[],                      // lista ordinata post-shuffle
  currentQuestionIndex: number,
  confirmedAnswers: Record<string, string>,   // questionId → risposta data

  // Campi Flashcard (presenti solo se mode === "flashcard")
  cardIds: string[],
  currentCardIndex: number,
  cardEvals: Record<string, "Sì" | "In parte" | "No">,
  reviewQueue: string[],
}
```

**Nota DB versioning:** il passaggio da version 1 a version 2 aggiunge l'object store `pausedSessions` e il campo `isReview` su `quizSessions`. La migration idb gestisce l'upgrade in `onupgradeneeded`.

---

## 8. Cronometro — hook useTimer

Il cronometro è una funzionalità trasversale usata sia da Quiz che da Flashcard. Risiede in un hook dedicato `useTimer.ts`:

```typescript
interface TimerConfig {
  limitSeconds: number | null   // null = solo cronometro, nessun limite
  initialElapsed?: number       // secondi già trascorsi (per ripresa sessione in pausa)
  onExpire: () => void          // callback invocata alla scadenza
}

// Espone:
// - elapsed: number          → secondi trascorsi
// - remaining: number | null → secondi rimanenti (null se no limite)
// - isExpired: boolean
// - pause() / resume()
```

**Comportamento:**
- Se `limitSeconds` è `null`: conta in su (cronometro), nessuna scadenza
- Se `limitSeconds` è impostato: conta in giù, chiama `onExpire()` a zero
- Il display in sessione mostra il tempo rimanente in rosso negli ultimi 60 secondi
- Alla scadenza: le domande/carte non ancora confermate vengono marcate `unanswered`, la sessione termina automaticamente e si apre la schermata di fine sessione
- **Ripresa da pausa:** `initialElapsed` permette di ripartire dal secondo esatto in cui la sessione è stata sospesa
- **Background Android:** il timer continua a scorrere quando l'app è in background — nessuna pausa automatica; la pausa è esclusivamente un'azione esplicita dell'utente

---

## 9. FileService — Abstraction Layer

`fileService.ts` è l'unico modulo platform-aware. Espone un'interfaccia unica:

```typescript
interface FileService {
  pickFile(accept: string[]): Promise<{ name: string, type: string, data: ArrayBuffer }>
}
```

Selezione automatica a runtime:

```typescript
export const fileService: FileService = Capacitor.isNativePlatform()
  ? { pickFile: pickFileCapacitor }   // Capacitor FilePicker plugin
  : { pickFile: pickFileBrowser }     // File System Access API con fallback
```

**Fallback browser:** `pickFileBrowser` tenta prima la File System Access API (`window.showOpenFilePicker`). Se non disponibile (es. Firefox), ricade su un `<input type="file">` creato dinamicamente, aggiunto al DOM, cliccato programmaticamente e rimosso dopo l'uso. Il componente React non è a conoscenza di questo dettaglio.

**Flusso import file:** il file viene letto come `ArrayBuffer` e immediatamente salvato in IndexedDB. Da quel momento l'app non accede più al file system — tutto viene letto da DB.

---

## 10. Dipendenze Principali

| Pacchetto | Scopo |
|---|---|
| `react` + `react-dom` | UI |
| `typescript` | Type safety |
| `vite` | Build tool |
| `react-router-dom` | Navigazione SPA |
| `zustand` | Stato globale |
| `idb` | IndexedDB wrapper tipizzato |
| `mammoth` | Conversione DOCX → HTML |
| `pdfjs-dist` | Viewer PDF |
| `@capacitor/core` | Bridge web/Android |
| `@capacitor/app` | Gestione back button Android |
| `@capawesome/capacitor-file-picker` | File picker nativo Android |

---

## 11. Logica Quiz — quizService.ts

```
1. Leggi domande da IndexedDB (parse JSON salvato)
2. Filtra per macroargomenti selezionati (logica OR)
3. Shuffle domande (Fisher-Yates)
4. Prendi le prime N (numero selezionato dall'utente)
5. Per ogni domanda multipla: shuffle delle opzioni (Fisher-Yates, in memoria)
   → le etichette A/B/C/D/E mostrate in UI sono generate a runtime sull'ordine shuffled
   → la verifica della risposta avviene per confronto stringa con risposta_corretta
6. Per ogni risposta confermata: aggiorna questionStats (timesShown, timesCorrect)
7. A fine sessione: salva quizSession con score, errors, unanswered, isReview
```

**Shuffle opzioni:** avviene esclusivamente in memoria al caricamento della sessione; lo storage non viene mai modificato. Per le sessioni riprese da pausa, l'ordine shuffled è quello già serializzato nella `pausedSession` (campo `confirmedAnswers` usa il testo dell'opzione, non la posizione).

**Scoring:**
- `score` = numero di risposte confermate corrette
- `total` = numero totale di domande nella sessione
- Le domande non confermate al momento della consegna/scadenza → `unanswered` (non `errors`)

**Sessione "Ripassa errori":**
- Avvia direttamente senza schermata di configurazione
- Nessun limite di tempo (timer conta solo in su)
- Domande = `errors[]` + `unanswered[]` della sessione appena conclusa, shuffled
- Viene salvata come nuova `quizSession` con `isReview: true`

---

## 12. Logica Flashcard — hook useFlashcard

```
1. Leggi carte da IndexedDB
2. Filtra per macroargomenti (OR)
3. Shuffle, prendi prime N
4. Sessione: fronte → [Mostra risposta / Non so] → retro → autovalutazione
5. "Non so" conta come "No" per la sessione corrente
6. A fine mazzo: coda ripasso = carte con eval "No" o "In parte"
7. Riproponi coda ripasso (shuffled) finché coda è vuota
8. Aggiorna flashcardStats (lastEval, lastSeen) solo a fine sessione completa
```

---

## 13. Gestione Esami — CRUD completo

### Creazione
Dialog con campo nome → crea esame vuoto. Tutte e tre le sezioni (Riassunto, Quiz, Flashcard) appaiono disabilitate nella dashboard con label "File non importato" e non sono cliccabili.

### Rinomina
Disponibile dal menu contestuale (⋮) nella lista esami della Home. Modifica solo il campo `name` senza toccare file né sessioni.

### Eliminazione
Dialog di conferma → elimina in cascata dall'IndexedDB: il record in `esami`, tutte le `quizSessions`, `questionStats`, `flashcardStats` e `pausedSessions` con l'`examId` corrispondente.

### Sostituzione file
Bottone "Sostituisci" disponibile nella Dashboard accanto a ciascun file già importato.

| File | Dialogo di conferma | Dati eliminati |
|---|---|---|
| Riassunto | Nessuno | Nessuno |
| quiz.json | Sì — avvisa che lo storico verrà cancellato | `quizSessions`, `questionStats`, `pausedSession` quiz |
| flashcard.json | Sì — avvisa che le statistiche verranno cancellate | `flashcardStats`, `pausedSession` flashcard |

---

## 14. Sessioni in Pausa

### Trigger pausa
Back button (Android back gesture, o navigazione browser) durante una sessione quiz o flashcard attiva → dialog di conferma con due opzioni:
- **"Continua la sessione"** → chiude il dialog, la sessione prosegue
- **"Metti in pausa"** → ferma il timer, salva `pausedSession` in IndexedDB, reindirizza a Dashboard

Può esistere al massimo una `pausedSession` per tipo (quiz / flashcard) per esame. La chiave `id` è `${examId}__quiz` o `${examId}__flashcard`, quindi una nuova pausa sovrascrive l'eventuale precedente (caso non raggiungibile normalmente grazie al conflict dialog).

### Ripresa
La Dashboard mostra un banner per ogni sessione in pausa. Cliccando "Riprendi": la `pausedSession` viene letta, il timer riprende da `elapsedSeconds`, la sessione riapre esattamente nel punto lasciato.

### Conflict: tentativo di nuova sessione
Se esiste una `pausedSession` e l'utente preme "Inizia" per lo stesso tipo → modal:
- **"Riprendi sessione precedente"** → carica e riapre la `pausedSession`
- **"Abbandona e ricomincia"** → elimina la `pausedSession` (non viene salvata nello storico), mostra la schermata di configurazione

### Timer in background (Android)
Il timer non si pausa automaticamente quando l'app va in background (Home, notifica, chiamata). La pausa è esclusivamente un'azione esplicita dell'utente tramite il back button.

---

## 15. Tutorial AI — Pagina "Guida"

### Scopo
Istruire l'utente a generare i file `quiz.json`, `flashcard.json` e (opzionalmente) il riassunto HTML usando un AI esterno (ChatGPT, Claude, ecc.) a partire dai propri documenti di studio.

### Onboarding al primo avvio
- Schermata full-screen mostrata automaticamente al primo avvio dell'app
- Flag `tutorialSeen: true` salvato in `localStorage` dopo la prima visualizzazione (o al primo skip)
- Bottone **"Salta"** prominente in alto a destra
- Dopo skip o chiusura → reindirizza alla Home
- Il contenuto è identico alla Pagina Tutorial accessibile dal menu

### Pagina Tutorial (sempre accessibile da menu)
Struttura a step verticali, ognuno con titolo, testo esplicativo e (dove presente) un blocco prompt con bottone **"Copia"**.

```
Step 1 — Prepara i tuoi documenti
  Testo: raccogli tutti i materiali dell'esame (PDF, DOCX, testo).
  Più materiale fornisci all'AI, più domande e flashcard verranno generate.
  Formati supportati da ChatGPT e Claude: PDF, DOCX, TXT.
  [Nessun prompt — solo testo informativo]

Step 2 — Genera quiz e flashcard
  Testo: apri ChatGPT o Claude, carica tutti i file dell'esame,
  poi incolla il prompt qui sotto. Sostituisci [NOME ESAME] con il
  nome reale prima di inviare.
  [Prompt copiabile — bottone "Copia"]

Step 3 — (Facoltativo) Genera il riassunto
  Testo: se non hai già un riassunto, puoi chiederlo all'AI.
  Il file generato sarà in formato HTML, importabile direttamente nell'app.
  [Prompt copiabile — bottone "Copia"]

Step 4 — Importa nell'app
  Testo: salva i file generati sul tuo dispositivo, poi crea un nuovo
  esame e importa ciascun file nella sezione corrispondente.
  [Vai a "Crea nuovo esame" →]   ← link che porta alla Home
```

### Prompt 1 — Quiz + Flashcard

```
Ho allegato i miei documenti di studio per l'esame di [NOME ESAME].
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
il primo per quiz.json, il secondo per flashcard.json. Nient'altro.
```

### Prompt 2 — Riassunto HTML *(opzionale)*

```
Ho allegato i miei documenti di studio per l'esame di [NOME ESAME].
Crea un riassunto completo in formato HTML con queste caratteristiche:

- File HTML autocontenuto (CSS inline o in un tag <style> nell'<head>)
- <h1> per il titolo dell'esame, <h2> per i macroargomenti, <h3> per i sottotemi
- Usa tabelle per confronti, elenchi puntati per definizioni o passaggi
- Formule scritte in forma testuale leggibile
- Stile: sfondo bianco, font sans-serif, margini comodi, leggibile su schermo
- Copri tutto il materiale in modo esaustivo senza tralasciare nulla

Rispondi con solo il file HTML completo, nient'altro.
```

---

## 16. Decisioni Aperte

Nessuna — tutte le decisioni architetturali sono state prese e approvate.

---

## 17. Fuori Scope (per ora)

- Sync tra dispositivi
- Export/import backup del database
- Statistiche avanzate / grafici di progresso
- Modalità "esame simulato" con timer
