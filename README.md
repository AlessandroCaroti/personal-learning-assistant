# Personal Learning Assistant

Local study app built with React, Vite, TypeScript, and Capacitor.

## Run locally

- Web dev server: `npm run dev`
- Web production build: `npm run build`
- Web preview of the build: `npm run preview`
- Windows EXE build: `npm run build:win`
- Capacitor sync: `npm run cap:sync`
- Open Android project in Android Studio: `npm run cap:android`

## VS Code debug

Use the **Run and Debug** panel and pick one of these configs from [`.vscode/launch.json`](./.vscode/launch.json):

- `Web: Debug Vite` starts the app in the browser against the Vite dev server.
- `Web: Preview` runs the built app through `vite preview`.
- `Android: Open Studio` syncs Capacitor and opens the Android project.
- `Android: Sync Only` updates the Android project without opening Android Studio.
- `Build: Web App` runs the web production build.

The reusable commands live in [`.vscode/tasks.json`](./.vscode/tasks.json).

## Android APK

To create an APK:

1. Run `npm run build`
2. Run `npm run cap:sync`
3. Open `android/` in Android Studio or use `npm run cap:android`
4. Build the APK from Android Studio, or run the Gradle debug/release tasks from VS Code

Useful Gradle tasks in VS Code:

- `Android: assembleDebug`
- `Android: assembleRelease`
- `Android: installDebug`
- `Android: clean`

## Windows EXE

The `npm run build:win` command creates a portable Windows `.exe` in `release/`.
It uses Electron to wrap the Vite build output, so the generated executable runs the same app without depending on a browser shell.
