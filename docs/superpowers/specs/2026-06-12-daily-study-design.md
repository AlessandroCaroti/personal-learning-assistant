# Daily Study Design

## Context

The app is an offline study assistant for university exams. It stores exam files, quiz history, question statistics, flashcard statistics, and paused sessions in IndexedDB. The first daily-study cycle should make the app more useful every day without changing the storage architecture more than necessary.

This design focuses only on quiz-based daily study. Flashcards, personal notes, bookmarks, global search, full backup import/export, and difficulty filtering are intentionally out of scope for this cycle.

## Goals

- Add a cumulative "Review" queue for quiz questions answered incorrectly or skipped.
- Prioritize recently missed or skipped questions, then questions with lower historical accuracy.
- Add a compact daily-study summary to the exam dashboard.
- Add a dedicated study page for queue management, filters, and study statistics.
- Reuse the existing quiz review session flow where possible.
- Avoid new IndexedDB stores and sync schema changes in this cycle.

## Non-Goals

- No flashcard review queue changes.
- No manually persisted "mark as resolved" or "hide from review" state.
- No difficulty field or difficulty filter.
- No note or bookmark data model.
- No global search.
- No full backup import/export.
- No changes to imported quiz JSON schema.

## Architecture

The feature derives all daily-study data from existing records:

- `quizSessions`: session history, missed question ids, skipped question ids, session dates, total time, total questions, macroargomenti, and `isReview`.
- `questionStats`: per-question `timesShown` and `timesCorrect`.
- current `quiz.json`: question text, answer, explanation, and macroargomenti.

A new pure domain module should hold the main logic:

- `src/services/studyService.ts`

It should expose functions such as:

- `buildReviewQueue(quiz, sessions, stats)`
- `buildStudyStats(quiz, sessions, stats)`
- `filterReviewQueue(queue, filters)`
- `sortReviewQueue(queue)`

React components should call these functions instead of duplicating queue or statistics logic inline. This keeps the UI thin and makes the business rules easy to unit test.

No new IndexedDB object stores are added. Because the queue is derived from current quiz content and historical quiz records, replacing a quiz file naturally removes queue items whose ids no longer exist in the current file.

## Routes And Navigation

Add a dedicated route:

- `/esame/:examId/studio`

The dashboard should show a compact "Daily study" area with:

- number of questions in the review queue;
- total accuracy;
- quiz progress;
- average time per question;
- "Open study" action;
- "Review now" action when the queue is not empty.

The dedicated study page should contain:

- summary statistics;
- recent session trend;
- review queue list with filters and review actions.

## Review Queue Rules

A question enters the review queue when its id appears in `errors` or `unanswered` in at least one quiz session. Both normal sessions and review sessions are included, so later review performance can affect priority through `questionStats`.

Each review item should include:

- question id;
- question text;
- macroargomenti;
- last review-relevant result, either `error` or `unanswered`;
- date of the latest session that placed it in the queue;
- historical accuracy when stats are available;
- correct answer and explanation for the detail view.

Queue priority:

1. Latest missed or skipped date first.
2. For equal dates, lower historical accuracy first.
3. For remaining ties, stable ascending question id.

Question ids present in historical sessions but missing from the current quiz file are ignored in visible queue output.

## Filters

The first cycle supports these filters:

- macroargomento;
- result type: all, incorrect only, skipped only;
- recent scope: last 1 session, last 3 sessions, last 7 sessions, or all history.

The recent-scope filter applies to sessions ordered by date descending. For example, "last 3 sessions" means the queue is built from review-relevant events found in the three most recent quiz sessions for that exam.

When no queue item matches the active filters, the page should show an empty state and disable or hide "Review filtered".

## Study Statistics

The study page and dashboard use the same derived statistics.

Definitions:

- Total accuracy: `sum(timesCorrect) / sum(timesShown)` from `questionStats`. If no questions were shown, accuracy is unavailable rather than `0%`.
- Quiz progress: questions with `timesShown > 0` divided by the total number of questions in the current quiz.
- Average time per question: `sum(totalTime) / sum(total)` over completed quiz sessions where `total > 0`.
- Completed sessions: number of quiz sessions for the exam.
- Recent trend: latest sessions ordered by `date` descending, showing percentage score, average time per question, and whether the session was a review.

The first trend view can be a compact list of the latest 5 to 10 sessions. It does not need charts in this cycle.

## Review Session Behavior

The existing quiz session route should be reused:

- `/esame/:examId/quiz/sessione`

The navigation state should support a generalized review contract:

- `reviewQuestionIds: string[]`
- `isReview: true`

The current result page review flow should be adapted from separate `reviewErrors` and `reviewUnanswered` arrays to the same unified id list. The hook API can be simplified to:

- `startReviewSession(questionIds, allDomande)`

Review sessions are saved with `isReview: true`. They still update `questionStats`, so correct answers during review improve historical accuracy and can reduce future priority.

## Error Handling

- If the exam is missing, navigate back to the home page as existing pages do.
- If no quiz file exists, the study page should explain that a quiz must be imported first.
- If the quiz file cannot be parsed or validated, show an alert and do not compute queue or statistics from invalid content.
- If historical records reference missing question ids, ignore those ids in visible queue and stats that require current question content.
- If there are no sessions yet, show empty states for trend, queue, and statistics that require history.

## Testing Plan

Add focused tests for the pure service first:

- queue includes questions from cumulative `errors` and `unanswered`;
- queue sorts by recency, then lower accuracy, then id;
- queue ignores ids missing from the current quiz;
- macroargomento, result-type, and recent-scope filters work;
- statistics calculate accuracy, progress, average time, completed sessions, and trend;
- unavailable statistics are represented clearly when there is no data.

Add UI tests:

- `DashboardPage.test.tsx`: daily-study summary empty state and populated state.
- `StudyPage.test.tsx`: statistics rendering, filter behavior, empty states, and review CTA navigation.
- Existing quiz result/session tests: unified `reviewQuestionIds` navigation state and review session start behavior.

Run `npm run test -- --run` after implementation changes.

## Implementation Boundaries

This design should be implemented without changing the IndexedDB version. If implementation reveals that a persistent queue is necessary, stop and revise the design instead of silently adding a store.

The UI should follow the existing style constraints:

- use the single `src/index.css` stylesheet or existing inline style pattern where already established;
- use existing CSS variables;
- keep mobile-first layout and 48px touch targets for primary actions;
- avoid adding Tailwind or component libraries.

## Open Decisions Resolved

- Scope is quiz-only for the first iteration.
- The review queue is cumulative.
- Priority is simple and transparent: recent misses first, then lower accuracy.
- Difficulty filtering is excluded from this cycle.
- Dashboard and a dedicated study page are both included.
- Statistics are the "study base" set: accuracy, progress, average time, and recent trend.
