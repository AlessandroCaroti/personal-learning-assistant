# Exam Statistics And Exam Dates Design

## Context

The app already stores enough progress data to show useful exam-level statistics without adding a new statistics table:

- `quizSessions` stores completed quiz attempts with score, duration, timeout state, review state, and macroargomenti.
- `questionStats` stores per-question attempts and correct answers.
- `flashcardStats` stores the latest evaluation and last seen timestamp for each flashcard.
- `Esame.files.quiz` and `Esame.files.flashcard` contain the imported JSON source files needed to map IDs back to text and macroargomenti.

The current exam dashboard is already responsible for file import, archive access, backup export, paused-session banners, and launch actions. Statistics should therefore live on a separate page instead of crowding the dashboard.

## Goals

- Add a separate statistics page for each exam at `/esame/:examId/statistiche`.
- Show high-level quiz and flashcard statistics.
- Show weak quiz questions, weak quiz macroargomenti, and weak flashcards.
- Let users manage one or more exam dates with a required date, optional label, and optional notes.
- Show countdowns for active exam dates.
- Store exam dates with the exam so they participate in sync and backup.
- Automatically delete exam dates more than 24 hours after the end of the exam date.

## Non-Goals

- No charting library in the first version.
- No persisted precomputed statistics.
- No time-of-day support for exam dates.
- No recurring exam dates.
- No Android-generated file edits.

## Data Model

Add an `ExamDate` type:

```ts
export interface ExamDate {
  id: string
  date: string
  label?: string
  notes?: string
  createdAt: string
}
```

Add optional exam dates to `Esame`:

```ts
export interface Esame {
  id: string
  name: string
  createdAt: string
  files: {
    riassunto?: FileRecord
    quiz?: FileRecord
    flashcard?: FileRecord
  }
  attachments?: ExamAttachment[]
  examDates?: ExamDate[]
}
```

`date` is a calendar date in `YYYY-MM-DD` format. It has no time zone or time-of-day meaning in storage. Countdown and expiration logic interpret the date in the user's local time zone.

Missing `examDates` are normalized to an empty array when exams are read from storage.

## Expiration Rule

An exam date remains active through the exam day and the following 24-hour grace period. For a date `YYYY-MM-DD`, the expiration instant is local midnight after the next calendar day.

Example: an exam date of `2026-07-10` remains visible through `2026-07-11 23:59:59` local time. It expires at local `2026-07-12 00:00:00`.

Expired dates are automatically removed when an exam is loaded through the normal storage read path used by dashboard/statistics flows. If pruning removes at least one date, the pruned exam is saved back to IndexedDB and marked dirty for sync. This means expired-date deletion propagates to synced devices, matching the requirement that exam dates are synced.

## Routing And Navigation

Add a route:

```txt
/esame/:examId/statistiche
```

The existing dashboard gets a `Statistiche` action near the other exam-level actions. Statistics remain off the dashboard.

If the exam does not exist, the statistics page follows the existing dashboard pattern and redirects to `/`.

## Statistics Page Content

The page loads:

- the current `Esame`;
- all quiz sessions for the exam;
- all question stats for the exam;
- all flashcard stats for the exam.

When available, it parses the imported quiz and flashcard JSON from `Esame.files` to map stored IDs to question/card text and macroargomenti.

### Exam Dates

Show active dates sorted ascending by date:

- optional label;
- countdown text;
- calendar date;
- optional notes.

Empty state: no exam dates configured.

Countdown copy should be simple and local:

- today: `oggi`;
- yesterday but still inside the grace period: `ieri`;
- future date: number of days remaining.

### Quiz Summary

Show high-level quiz progress:

- completed quiz sessions;
- average score percentage;
- best score percentage;
- latest score percentage;
- average time;
- timeout count;
- review-session count.

Primary attempts and review attempts are both shown in the totals, with review attempts separately counted so the user can interpret the numbers.

Empty states:

- no quiz file imported;
- quiz file imported but no completed quiz sessions yet.

### Quiz Weak Areas

Use `questionStats` and the quiz JSON source to show weak quiz items.

Weak questions are questions with at least one recorded attempt, sorted by ascending accuracy. Ties are sorted by more attempts first, then by source order. Show enough context to study:

- question text;
- accuracy;
- attempts;
- macroargomenti.

Weak macroargomenti are aggregated from attempted questions by summing attempts and correct answers per macroargomento, then sorting by ascending accuracy. Macroargomenti with more attempts win ties.

If the quiz JSON is missing or invalid at render time, the page still shows summary statistics from sessions but shows a concrete message that question text and macroargomenti cannot be resolved.

### Flashcard Summary

Use `flashcardStats` to show latest card state:

- total cards with saved progress;
- count of `Sì`;
- count of `In parte`;
- count of `No`;
- count of `Non risposta`.

Empty states:

- no flashcard file imported;
- flashcard file imported but no flashcard progress yet.

### Flashcard Weak Areas

Use `flashcardStats` and the flashcard JSON source to show cards whose latest evaluation is `No` or `In parte`.

Sort weak flashcards by urgency:

1. `No`
2. `In parte`
3. older `lastSeen` first within the same evaluation

Show:

- front text;
- latest evaluation;
- last seen date;
- macroargomenti.

If the flashcard JSON is missing or invalid at render time, the page still shows summary counts from stats but shows a concrete message that card text and macroargomenti cannot be resolved.

## Date Management

The statistics page owns date management controls:

- add exam date;
- edit exam date;
- delete exam date with confirmation.

Validation:

- `date` is required and must be valid `YYYY-MM-DD`;
- `label` is optional and trimmed before save;
- `notes` is optional and trimmed before save;
- empty trimmed label and notes are stored as omitted fields;
- duplicate dates are allowed.

Dates are sorted ascending after save.

All date changes save the full `Esame` record through existing storage service APIs so sync dirty metadata is updated.

## Sync And Backup

Because `examDates` are part of `Esame`, they are included in sync and backup alongside the existing exam metadata.

Sync export/import must preserve `examDates`.

Backup export/import must preserve `examDates`. Backup validation should accept absent `examDates` from older backups and normalize them to an empty array.

Merge behavior for synced exams follows existing exam-record conflict behavior. There is no separate per-date merge in this first version.

## Error Handling

- Storage read failure shows a page-level error with a retry action.
- Invalid imported quiz JSON on the statistics page does not break the page; it only disables resolved quiz weak-item details.
- Invalid imported flashcard JSON on the statistics page does not break the page; it only disables resolved flashcard weak-item details.
- Invalid date form submissions keep the form open and show inline validation feedback.
- Delete confirmation can be cancelled without changing data.

## Accessibility And UI Constraints

- Use existing CSS variables and `src/index.css` patterns.
- Do not add Tailwind or a component library.
- Form controls must have labels.
- Countdown, summary, and weak-area sections should use semantic headings.
- Buttons should keep at least 44px tap targets.
- Empty states should be text, not disabled controls only.

## Testing

Add focused tests for:

- `Esame.examDates` normalization from missing data.
- expired date pruning after the 24-hour grace period.
- active dates not being pruned before the expiration instant.
- sync export/import preserving `examDates`.
- backup export/import preserving `examDates`.
- dashboard navigation to the statistics page.
- statistics page rendering quiz summary from `quizSessions`.
- statistics page rendering weak quiz questions and macroargomenti from `questionStats` plus quiz JSON.
- statistics page rendering flashcard summary from `flashcardStats`.
- statistics page rendering weak flashcards from `flashcardStats` plus flashcard JSON.
- add, edit, and delete date flows.
- date validation errors.

After implementation, run:

```bash
npm run test -- --run
```

