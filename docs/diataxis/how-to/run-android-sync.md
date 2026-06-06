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

## Step 4: Build a debug APK

Use a debug APK for quick local testing on your own phone.

### Option A: Build from Android Studio

In Android Studio, use:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

### Option B: Build from Gradle

From the `android/` folder, run:

```bash
gradlew.bat assembleDebug
```

The debug APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it by copying the file to your phone and opening it, or by using `adb install -r` if you have ADB set up.

## Step 5: Build a release APK

Use a release APK when you want to share the app with other people or install a cleaner, signed build.

### Release signing prerequisite

The project needs a release signing configuration before a proper release APK can be generated. Create a keystore, wire it into `android/app/build.gradle`, and keep the keystore and passwords out of version control.

Android Studio can also guide you through this with:

```text
Build > Generate Signed Bundle / APK...
```

### Build the signed release APK

After signing is configured, run this from the `android/` folder:

```bash
gradlew.bat assembleRelease
```

The release APK is written to:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Install the signed release APK by copying it to the target phone and opening it, or by using `adb install -r`.

If the target device already has a debug build of the app installed, uninstall it first if the signatures differ.

## If Android shows stale content

1. Run `npm run build` again.
2. Run `npm run cap:sync` again.
3. Rebuild the Android project in Android Studio.

## Related reference

- [Commands reference](../reference/commands.md)
- [Integration reference](../reference/integrations.md)
- [Architecture explanation](../explanation/architecture.md)
