# Integration reference

This page lists the external and platform-specific integrations used by the app.

## Browser and native integrations

| Integration | Purpose |
|---|---|
| IndexedDB via `idb` | Local persistence |
| Capacitor runtime | Native platform detection and Android behavior |
| `@capawesome/capacitor-file-picker` | Android file picking |
| Browser file picker / file input | Web file picking |
| `mammoth` | `.docx` summary conversion |

## Platform boundary

- `src/services/fileService.ts` is the main file-selection adapter.
- Android back-button behavior is wired into the app shell and session pages.
- The app remains local-only and does not depend on a backend service.

## Failure behavior

- File picking falls back from the modern browser API to a hidden file input when needed.
- Validation rejects malformed quiz and flashcard JSON before storage.
- Storage and native errors are handled in the UI and hook layers rather than through a central network retry system.

