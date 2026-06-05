# Explanation: Main study workflows

The app revolves around a small set of repeated study workflows.

## Exam lifecycle

An exam is the umbrella entity for imported files, session history, and progress tracking.

Typical flow:

1. Create or open an exam.
2. Import the files needed for that exam.
3. Run quiz sessions or flashcard sessions.
4. Review results and statistics.
5. Return later and continue from stored state.

## Quiz workflow

Quiz sessions focus on answer selection, scoring, review mode, and question statistics.

The workflow includes:

- loading and validating quiz content
- building the session question set
- tracking correct and incorrect responses
- storing session results
- optionally resuming from a paused session

## Flashcard workflow

Flashcard sessions focus on spaced repetition behavior.

The workflow includes:

- loading flashcards for an exam
- stepping through review queues
- recording last seen and evaluation state
- storing the final session state

## Summary workflow

Summary files are stored with the exam and opened from the app when needed.

Supported formats are:

- HTML
- PDF
- DOCX

## Android workflow

The Android app is a Capacitor wrapper around the same web build.

The release flow is:

1. Build the web app.
2. Sync it into the Android project.
3. Open Android Studio.
4. Build the APK from the native project.

