# Tauri Google Drive Token Exchange Design

## Purpose

Move the Google OAuth token exchange for the Tauri desktop app from frontend TypeScript to Rust, while keeping the existing Rust loopback browser flow. This keeps the desktop client secret out of the JavaScript bundle and out of WebView DevTools network logs.

This does not make the client secret truly confidential. A distributed desktop binary can still be inspected. The goal is to reduce accidental exposure and keep browser-visible code from handling the secret.

## Current Behavior

The desktop sign-in path currently works like this:

1. TypeScript generates `state`, `code_verifier`, and `code_challenge`.
2. TypeScript invokes Rust command `start_google_drive_oauth`.
3. Rust opens the system browser, listens on a loopback URL, validates the callback state, and returns `{ code, redirectUri }`.
4. TypeScript posts to `https://oauth2.googleapis.com/token`.
5. The token request includes `client_id`, `code`, `code_verifier`, `grant_type`, `redirect_uri`, and, when configured, `client_secret`.

The problem is step 4: the token request is visible from the WebView network panel, and the desktop secret is also exposed through `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET`.

## Chosen Approach

Keep `start_google_drive_oauth` as the browser and loopback command. Add a second Tauri command, `exchange_google_drive_oauth_code`, that performs only the token exchange.

TypeScript will continue to own PKCE generation and state creation. This is a smaller change than moving the full OAuth flow into Rust and preserves the existing tested callback flow.

## Frontend Design

`src/services/sync/googleDriveSyncProvider.ts` keeps the browser Google Identity Services flow unchanged.

For Tauri, `requestDesktopGoogleDriveToken()` will:

1. Generate `codeVerifier`, `state`, and `codeChallenge`.
2. Invoke `start_google_drive_oauth` with `clientId`, `scope`, `codeChallenge`, and `state`.
3. Invoke `exchange_google_drive_oauth_code` with `clientId`, `code`, `codeVerifier`, and `redirectUri`.
4. Return the `accessToken` from Rust.

The frontend will no longer:

- Read `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET`.
- Send `client_secret` in a browser-visible `fetch`.
- Call `https://oauth2.googleapis.com/token` for the Tauri path.

`VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID` remains in frontend config because the client ID is public and is still needed for the authorization URL.

## Rust Design

`src-tauri/src/lib.rs` will add:

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GoogleDriveTokenResult {
  access_token: String,
}

#[tauri::command]
async fn exchange_google_drive_oauth_code(
  client_id: String,
  code: String,
  code_verifier: String,
  redirect_uri: String,
) -> Result<GoogleDriveTokenResult, String>
```

The command will:

1. Read the desktop client secret at build time using `option_env!("GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET")`.
2. Return a clear configuration error if the secret is absent.
3. POST form-encoded data to `https://oauth2.googleapis.com/token`.
4. Include `client_id`, `client_secret`, `code`, `code_verifier`, `grant_type=authorization_code`, and `redirect_uri`.
5. Parse Google's JSON response.
6. Return `{ accessToken }` to TypeScript, using `#[serde(rename_all = "camelCase")]`, or an error containing Google's OAuth error description when available.

The command must not log the secret or full token request body.

## Build-Time Configuration

The desktop secret moves from Vite config to Rust build configuration:

```env
GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET=your-google-desktop-oauth-client-secret
```

It should not use the `VITE_` prefix. Vite exposes `VITE_` values to frontend code, which is exactly what this change avoids.

`src-tauri/build.rs` should emit `cargo:rerun-if-env-changed=GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET` before `tauri_build::build()` so Cargo rebuilds the Rust crate when the configured secret changes.

Local development on PowerShell:

```powershell
$env:GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET="your-google-desktop-oauth-client-secret"
npm run tauri:dev
```

Windows packaging:

```powershell
$env:GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET="your-google-desktop-oauth-client-secret"
npm run build:win
```

## Error Handling

Frontend user-facing errors continue to flow through the existing sync status UI.

Rust should normalize token exchange failures into useful messages:

- Missing build-time secret: `Configura GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET per usare Google Drive Sync in Tauri`.
- Google token endpoint failure with `error_description`: return that description.
- Google token endpoint failure without a description: return `Google Drive request failed: <status>`.
- Missing `access_token` in a successful response: return `Accesso Google non riuscito`.

## Documentation Changes

Update:

- `.env.example`: remove `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET`.
- `docs/diataxis/how-to/configure-google-drive-sync.md`: document `GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET` for Tauri dev/build commands.
- `docs/diataxis/reference/integrations.md`: clarify that the desktop secret is consumed by Rust, not Vite.

## Testing Strategy

TypeScript tests:

- Add or update a Tauri-path test proving `requestDesktopGoogleDriveToken()` calls `exchange_google_drive_oauth_code`.
- Assert the frontend no longer calls `https://oauth2.googleapis.com/token` for Tauri sign-in.
- Remove tests that expect `client_secret` in a frontend token request body.

Rust tests:

- Extract token request body construction into a pure helper and test that it includes all required OAuth fields.
- Test that the helper percent-encodes form fields correctly.
- Test token response parsing for success, `error_description`, and missing `access_token`.

Verification commands:

```bash
npm run test -- --run
npm run build
cargo check
```

## Non-Goals

- Do not change the browser Google Identity Services flow.
- Do not introduce a backend token broker.
- Do not store refresh tokens.
- Do not move Drive API read/write calls into Rust.
- Do not claim the desktop secret is fully protected from reverse engineering.
