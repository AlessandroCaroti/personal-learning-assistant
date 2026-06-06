# Command reference

This page records the repository's documented commands and what they do.

## Development

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Type-check and build the production web app |
| `npm run preview` | Serve the production build locally |

## Testing

| Command | Description |
|---|---|
| `npm run test` | Start Vitest in watch mode |
| `npm run test -- --run` | Run Vitest once and exit |

## Android

| Command | Description |
|---|---|
| `npm run cap:sync` | Build the web app and sync it into Android |
| `npm run cap:android` | Sync and open Android Studio |
| `gradlew.bat assembleDebug` | Build a debug APK from the `android/` folder on Windows |
| `gradlew.bat assembleRelease` | Build a signed release APK from the `android/` folder on Windows after release signing is configured |

## Windows packaging

| Command | Description |
|---|---|
| `npm run tauri:dev` | Run the app through the Tauri desktop shell |
| `npm run build:win` | Build the Windows NSIS installer through Tauri |

## Notes

- Run `npm run test -- --run` after code changes.
- Build before Android sync.
- Do not edit generated Android files manually.
