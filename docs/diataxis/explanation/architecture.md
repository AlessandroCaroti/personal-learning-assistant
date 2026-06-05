# Explanation: How the app is structured

Personal Learning Assistant is a local-first study app built as a layered React SPA.

## Why the app is organized this way

The repository is structured to keep the study experience simple for the user and predictable for the codebase:

- Pages own route-level composition and navigation.
- Hooks own session state machines and study flow behavior.
- Services own persistence, file access, and validation.
- The store holds only minimal global state.

This division keeps the route layer readable while preserving reusable logic for quiz and flashcard workflows.

## Why persistence is local-only

The app stores study data in IndexedDB on the device.

That choice fits the product goals:

- offline use
- no backend dependency
- fast local access to exams, session history, and stats
- simpler packaging for web and Android

## Why file handling is centralized

Imported content needs to work in both browser and Android contexts.

Centralizing file picking in one service reduces platform spread and keeps browser/native differences out of most of the app.

## Why session logic lives in hooks

Quiz and flashcard flows are state machines, not just visual components.

Keeping them in hooks makes it easier to:

- pause and resume sessions
- track timers
- update statistics
- keep page components focused on rendering and navigation

## Why the docs are split by Diátaxis

The repository already contains material that answers different user needs:

- getting started
- day-to-day workflows
- exact technical facts
- higher-level reasoning

Diátaxis makes those differences explicit so readers do not have to guess whether a page is a tutorial, a recipe, a reference, or a design discussion.

