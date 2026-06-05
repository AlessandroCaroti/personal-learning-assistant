# How-to: Build and sync the Android app

Use this guide when you need the web app changes to appear in the Android wrapper.

## Before you start

- Make sure the web app builds successfully.
- Do not edit the generated `android/` directory by hand.

## Step 1: Build the web app

Run:

```bash
npm run build
```

This produces the production web bundle that Capacitor consumes.

## Step 2: Sync to Android

Run:

```bash
npm run cap:sync
```

This copies the built web assets into the Android project and updates the native wrapper as needed.

## Step 3: Open Android Studio

Run:

```bash
npm run cap:android
```

This syncs the web assets and opens the Android project in Android Studio.

## Step 4: Build an APK

In Android Studio, build the app using the standard Gradle build flow or the IDE build actions provided by the project.

## If Android shows stale content

1. Run `npm run build` again.
2. Run `npm run cap:sync` again.
3. Rebuild the Android project in Android Studio.

## Related reference

- [Commands reference](../reference/commands.md)
- [Integration reference](../reference/integrations.md)
- [Architecture explanation](../explanation/architecture.md)

