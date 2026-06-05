# Data model reference

This page describes the main application data shapes and storage records.

## Imported exam files

### `quiz.json`

```ts
{ esame: string, domande: QuizDomanda[] }
```

- `risposta_corretta` must match one of the `opzioni` values exactly.
- `tipo: "vero_falso"` questions do not have `opzioni`.
- The answer for `tipo: "vero_falso"` is `Vero` or `Falso`.

### `flashcard.json`

```ts
{ esame: string, carte: FlashCard[] }
```

- Card IDs are sequential: `f1`, `f2`, and so on.

## Core types

### `Esame`

```ts
{ id, name, createdAt, files: { quiz?, flashcard?, riassunto? } }
```

### `QuizDomanda`

```ts
{
  id,
  tipo: 'multipla' | 'vero_falso',
  testo,
  opzioni?,
  risposta_corretta,
  spiegazione,
  macroargomenti[]
}
```

### `FlashCard`

```ts
{ id, macroargomenti[], fronte, retro }
```

### `PausedSession`

Paused sessions are keyed in IndexedDB as `${examId}__quiz` or `${examId}__flashcard`.

## IndexedDB stores

| Store | Important fields |
|---|---|
| `esami` | exam metadata plus imported file payloads |
| `quizSessions` | `score`, `total`, `errors`, `unanswered`, `isReview`, timestamps |
| `questionStats` | `examId`, `questionId`, `timesShown`, `timesCorrect` |
| `flashcardStats` | `examId`, `cardId`, `lastEval`, `lastSeen` |
| `pausedSessions` | `examId`, `sessionType`, `elapsedSeconds`, `confirmedAnswers`, `reviewQueue` |

