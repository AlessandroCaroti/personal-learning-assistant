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
| Google Drive `appDataFolder` | Cross-installation sync for study data |

## Platform boundary

- `src/services/fileService.ts` is the main file-selection adapter.
- `src/services/sync/googleDriveSyncProvider.ts` is the Google Drive sync adapter.
- Android back-button behavior is wired into the app shell and session pages.
- The app remains offline-first and does not depend on an app-owned backend service.

## Google Drive Sync

Google Drive Sync stores app-owned sync data in the user's Google Drive `appDataFolder` using the `https://www.googleapis.com/auth/drive.appdata` scope.

The app does not request broad Google Drive file access. Files in `appDataFolder` are hidden from normal My Drive browsing and are only available to the app that created them.

## Runtime configuration

| Variable | Purpose |
|---|---|
| `VITE_GOOGLE_DRIVE_CLIENT_ID` | Public OAuth client ID used by Google Identity Services. |
| `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID` | Public Desktop OAuth client ID used by the Tauri loopback sign-in flow. |
| `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET` | Desktop OAuth client secret sent by the Tauri token exchange when required by Google. |

If `VITE_GOOGLE_DRIVE_CLIENT_ID` is not configured, the runtime sync sign-in action reports a configuration error instead of using Google Drive. Unit tests can still use the fake sync provider directly.

## Synced data

- Exams
- Imported quiz files
- Imported flashcard files
- Imported summary files
- Quiz session history
- Question stats
- Flashcard stats

## Local-only data

- Paused sessions
- Theme
- Current exam selection
- Active route state
- Active quiz or flashcard session state

## Failure behavior

- File picking falls back from the modern browser API to a hidden file input when needed.
- Validation rejects malformed quiz and flashcard JSON before storage.
- Storage, native, and sync errors are handled in the UI and hook layers rather than through a central network retry system.
