# How-to: Configure Google Drive Sync

Use this guide when you need a browser, Android, or Windows build to sync study data through Google Drive.

## Before you start

- You need access to a Google Cloud project.
- The Google Drive API must be enabled for that project.
- The OAuth consent screen must be configured.
- You need OAuth client IDs for the platforms you are testing.

## Step 1: Enable the Google Drive API

In Google Cloud Console, enable the Google Drive API for the project that owns the OAuth client.

## Step 2: Configure the OAuth consent screen

Add the Google Drive app data scope:

```text
https://www.googleapis.com/auth/drive.appdata
```

This scope lets the app read and write its own hidden `appDataFolder` data. It does not grant broad access to the user's visible Drive files.

## Step 3: Create an OAuth client ID

Create the OAuth client ID for the platform you are testing:

- Web client for local browser development.
- Desktop client for the Tauri Windows shell.
- Android client for the Capacitor Android app.

For browser development, include the local Vite origin in the authorized JavaScript origins:

```text
http://localhost:5173
```

## Step 4: Set the client ID

Create or update `.env` in the repository root:

```env
VITE_GOOGLE_DRIVE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID=your-google-desktop-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET=your-google-desktop-oauth-client-secret
```

`VITE_GOOGLE_DRIVE_CLIENT_ID` is the Web client ID used by browser dev and preview builds.
`VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID` is the Desktop client ID used by Tauri, which opens Google sign-in in the system browser and returns through a local loopback callback.
`VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET` is the Desktop client secret used by Tauri when Google requires it during the authorization-code exchange.

The desktop values are bundled into the installed app, so only use the OAuth credentials created for a Desktop app. Do not use a Web application client secret in the Vite app.

## Step 5: Start the app

Run:

```bash
npm run dev
```

Open the app on the Home page.

## Step 6: Sign in

Choose the Google Drive sign-in action from the sync status area.

After sign-in, confirm that the sync status changes to `Sincronizzato` after the first successful sync.

## If sign-in fails

- Confirm the OAuth client ID matches the platform you are testing.
- For Tauri, confirm `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID` and `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET` are set from the same Desktop OAuth client.
- Confirm the local origin is allowed for browser testing.
- Confirm the Drive API is enabled.
- Confirm the consent screen includes the `drive.appdata` scope.

## Related reference

- [Integration reference](../reference/integrations.md)
- [Command reference](../reference/commands.md)
