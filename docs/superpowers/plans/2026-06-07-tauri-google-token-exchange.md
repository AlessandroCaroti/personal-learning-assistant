# Tauri Google Token Exchange Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Tauri desktop Google OAuth token exchange from frontend TypeScript `fetch` to a Rust Tauri command so the desktop client secret is not exposed in the JS bundle or WebView network logs.

**Architecture:** Keep the existing `start_google_drive_oauth` Rust command for browser launch and loopback callback. Add a second Rust command, `exchange_google_drive_oauth_code`, that receives the authorization code, PKCE verifier, client ID, and redirect URI, then posts to Google's token endpoint with the build-time desktop secret. Browser/web Google Identity Services stays unchanged.

**Tech Stack:** React 18, TypeScript, Vitest, Tauri 2, Rust 2021, `reqwest` with rustls TLS, Google OAuth 2.0 authorization-code flow with PKCE.

---

## File Structure

- Modify `src/services/sync/googleDriveSyncProvider.ts`: remove frontend desktop token `fetch`, remove `desktopClientSecret`, add a desktop code-exchange invoker, keep browser GIS flow unchanged.
- Modify `src/services/sync/googleDriveSyncProvider.test.ts`: replace tests that expect frontend `client_secret` with tests proving Rust command exchange is used and the Google token endpoint is not called by the WebView.
- Modify `src/hooks/useSync.ts`: stop reading `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET` and remove it from the sync-service singleton key.
- Modify `src-tauri/Cargo.toml`: add `reqwest` with `json` and `rustls-tls` features.
- Modify `src-tauri/build.rs`: emit `cargo:rerun-if-env-changed=GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET`.
- Modify `src-tauri/src/lib.rs`: add token exchange request/response helpers, tests, and the `exchange_google_drive_oauth_code` command.
- Modify `.env.example`: remove `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET`.
- Modify `docs/diataxis/how-to/configure-google-drive-sync.md`: document build-time `GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET`.
- Modify `docs/diataxis/reference/integrations.md`: clarify Rust consumes the desktop secret.

---

### Task 1: Frontend Regression Tests For Rust Token Exchange

**Files:**
- Modify: `src/services/sync/googleDriveSyncProvider.test.ts`
- Modify later in Task 2: `src/services/sync/googleDriveSyncProvider.ts`

- [ ] **Step 1: Replace the frontend secret-body test with a Rust-exchange test**

In `src/services/sync/googleDriveSyncProvider.test.ts`, remove the test named `includes the desktop client secret when exchanging a Tauri authorization code`.

Add this test in the same position:

```ts
  it('exchanges a Tauri authorization code through Rust instead of the WebView token endpoint', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(1)
        return bytes
      },
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array([2, 3, 4]).buffer),
      },
    })
    const exchangeDesktopOAuthCode = vi.fn().mockResolvedValue({ accessToken: 'desktop-token' })

    const token = await requestDesktopGoogleDriveToken(
      'client-id',
      async () => ({
        code: 'auth-code',
        redirectUri: 'http://127.0.0.1:3210/',
      }),
      exchangeDesktopOAuthCode,
    )

    expect(token).toBe('desktop-token')
    expect(exchangeDesktopOAuthCode).toHaveBeenCalledWith({
      clientId: 'client-id',
      code: 'auth-code',
      codeVerifier: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',
      redirectUri: 'http://127.0.0.1:3210/',
    })
    expect(fetch).not.toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.anything(),
    )
  })
```

- [ ] **Step 2: Update the provider sign-in test to assert Rust exchange arguments**

In the test named `uses the desktop client id for Tauri sign-in`, replace the provider setup with:

```ts
    vi.mocked(fetch).mockReset()
    const exchangeDesktopOAuthCode = vi.fn().mockResolvedValue({ accessToken: 'desktop-token' })
    const provider = createGoogleDriveSyncProvider({
      clientId: 'web-client-id',
      desktopClientId: 'desktop-client-id',
      isTauriRuntime: () => true,
      startDesktopOAuth: async (request) => {
        expect(request.clientId).toBe('desktop-client-id')
        return {
          code: 'auth-code',
          redirectUri: 'http://127.0.0.1:3210/',
        }
      },
      exchangeDesktopOAuthCode,
    })
```

Keep the existing `await expect(provider.signIn()).resolves.toEqual(...)` assertion.

Replace the existing final `client_secret` expectation with:

```ts
    expect(exchangeDesktopOAuthCode).toHaveBeenCalledWith({
      clientId: 'desktop-client-id',
      code: 'auth-code',
      codeVerifier: expect.any(String),
      redirectUri: 'http://127.0.0.1:3210/',
    })
    expect(fetch).not.toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.anything(),
    )
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npm run test -- src/services/sync/googleDriveSyncProvider.test.ts --run
```

Expected: FAIL. The failure should mention that `requestDesktopGoogleDriveToken` does not accept the new exchange function or that the old frontend `fetch` still calls `https://oauth2.googleapis.com/token`.

- [ ] **Step 4: Commit the failing tests**

```bash
git add src/services/sync/googleDriveSyncProvider.test.ts
git commit -m "test: cover tauri rust token exchange"
```

---

### Task 2: Frontend Desktop OAuth Wiring

**Files:**
- Modify: `src/services/sync/googleDriveSyncProvider.ts`
- Modify: `src/services/sync/googleDriveSyncProvider.test.ts`
- Modify: `src/hooks/useSync.ts`

- [ ] **Step 1: Update the desktop OAuth types**

In `src/services/sync/googleDriveSyncProvider.ts`, remove `desktopClientSecret?: string` from `GoogleDriveProviderOptions`.

Add these types near `DesktopOAuthResult`:

```ts
interface DesktopTokenResult {
  accessToken: string
}

type DesktopOAuthCodeExchanger = (request: {
  clientId: string
  code: string
  codeVerifier: string
  redirectUri: string
}) => Promise<DesktopTokenResult>
```

Add the injectable exchanger to `GoogleDriveProviderOptions`:

```ts
  exchangeDesktopOAuthCode?: DesktopOAuthCodeExchanger
```

- [ ] **Step 2: Add the default Rust exchange invoker**

Below `defaultStartDesktopOAuth`, add:

```ts
async function defaultExchangeDesktopOAuthCode(request: {
  clientId: string
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<DesktopTokenResult> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<DesktopTokenResult>('exchange_google_drive_oauth_code', request)
}
```

- [ ] **Step 3: Replace frontend token fetch with Rust command invocation**

Change `requestDesktopGoogleDriveToken` to this signature:

```ts
export async function requestDesktopGoogleDriveToken(
  clientId: string,
  startDesktopOAuth: DesktopOAuthStarter = defaultStartDesktopOAuth,
  exchangeDesktopOAuthCode: DesktopOAuthCodeExchanger = defaultExchangeDesktopOAuthCode,
): Promise<string> {
```

Inside the function, keep PKCE generation and `startDesktopOAuth`. Delete the `URLSearchParams`, `fetch(GOOGLE_TOKEN_URL, ...)`, and `clientSecret` logic.

Replace it with:

```ts
  const response = await exchangeDesktopOAuthCode({
    clientId,
    code: authorization.code,
    codeVerifier,
    redirectUri: authorization.redirectUri,
  })

  if (!response.accessToken) {
    throw new Error('Accesso Google non riuscito')
  }

  return response.accessToken
```

- [ ] **Step 4: Wire the provider option through Tauri sign-in**

In `getToken()`, replace the current Tauri call with:

```ts
      cachedAccessToken = await requestDesktopGoogleDriveToken(
        options.desktopClientId,
        options.startDesktopOAuth,
        options.exchangeDesktopOAuthCode,
      )
```

- [ ] **Step 5: Remove the desktop secret from `useSync`**

In `src/hooks/useSync.ts`, remove this entry from the singleton key:

```ts
    import.meta.env.VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET ?? '',
```

Remove this provider option:

```ts
          desktopClientSecret: import.meta.env.VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET,
```

- [ ] **Step 6: Update remaining frontend tests after the API change**

In `src/services/sync/googleDriveSyncProvider.test.ts`, update `exchanges a Tauri desktop authorization code for an access token` so it injects a Rust exchange mock:

```ts
    const token = await requestDesktopGoogleDriveToken(
      'client-id',
      async () => ({
        code: 'auth-code',
        redirectUri: 'http://127.0.0.1:3210/',
      }),
      async () => ({ accessToken: 'desktop-token' }),
    )
```

Replace the old `fetch` assertions in that test with:

```ts
    expect(token).toBe('desktop-token')
    expect(fetch).not.toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.anything(),
    )
```

In `reuses the desktop access token after sign-in for the first sync request`, add:

```ts
    const exchangeDesktopOAuthCode = vi.fn().mockResolvedValue({ accessToken: 'desktop-token' })
```

Pass it into provider options:

```ts
      exchangeDesktopOAuthCode,
```

Remove the first mocked `fetch` response that used to represent the token endpoint. Keep only the Drive files response:

```ts
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] }),
    } as Response)
```

Add this assertion after `await provider.readRemoteState()`:

```ts
    expect(exchangeDesktopOAuthCode).toHaveBeenCalledTimes(1)
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npm run test -- src/services/sync/googleDriveSyncProvider.test.ts src/hooks/useSync.test.ts --run
```

Expected: PASS. The provider suite should pass and no test should assert a frontend `client_secret` token body.

- [ ] **Step 8: Commit frontend wiring**

```bash
git add src/services/sync/googleDriveSyncProvider.ts src/services/sync/googleDriveSyncProvider.test.ts src/hooks/useSync.ts
git commit -m "feat: route tauri token exchange through rust"
```

---

### Task 3: Rust Token Exchange Helpers And Tests

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add Rust HTTP dependency**

In `src-tauri/Cargo.toml`, add this line under `[dependencies]`:

```toml
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
```

- [ ] **Step 2: Write failing Rust helper tests**

At the bottom of `src-tauri/src/lib.rs`, before `run()` or after it, add this test module:

```rust
#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn build_google_token_request_body_includes_required_fields() {
    let body = build_google_token_request_body(
      "client-id",
      "desktop-secret",
      "auth-code",
      "verifier",
      "http://127.0.0.1:3210/",
    );

    assert!(body.contains("client_id=client-id"));
    assert!(body.contains("client_secret=desktop-secret"));
    assert!(body.contains("code=auth-code"));
    assert!(body.contains("code_verifier=verifier"));
    assert!(body.contains("grant_type=authorization_code"));
    assert!(body.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A3210%2F"));
  }

  #[test]
  fn build_google_token_request_body_percent_encodes_special_characters() {
    let body = build_google_token_request_body(
      "client+id",
      "secret/value",
      "code with spaces",
      "verifier+slash/value",
      "http://127.0.0.1:3210/callback?x=1&y=2",
    );

    assert!(body.contains("client_id=client%2Bid"));
    assert!(body.contains("client_secret=secret%2Fvalue"));
    assert!(body.contains("code=code%20with%20spaces"));
    assert!(body.contains("code_verifier=verifier%2Bslash%2Fvalue"));
    assert!(body.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A3210%2Fcallback%3Fx%3D1%26y%3D2"));
  }

  #[test]
  fn parse_google_token_response_returns_access_token() {
    let token = parse_google_token_response(200, r#"{"access_token":"desktop-token"}"#)
      .expect("token response should parse");

    assert_eq!(token, "desktop-token");
  }

  #[test]
  fn parse_google_token_response_prefers_google_error_description() {
    let error = parse_google_token_response(
      400,
      r#"{"error":"invalid_request","error_description":"client_secret is missing."}"#,
    )
    .expect_err("error response should fail");

    assert_eq!(error, "client_secret is missing.");
  }

  #[test]
  fn parse_google_token_response_reports_status_when_error_body_has_no_description() {
    let error = parse_google_token_response(500, "not json")
      .expect_err("unparseable error body should fail with status");

    assert_eq!(error, "Google Drive request failed: 500");
  }

  #[test]
  fn parse_google_token_response_reports_missing_access_token() {
    let error = parse_google_token_response(200, r#"{"token_type":"Bearer"}"#)
      .expect_err("missing access token should fail");

    assert_eq!(error, "Accesso Google non riuscito");
  }
}
```

- [ ] **Step 3: Run Rust tests and verify RED**

Run:

```bash
cargo test google_token
```

from `src-tauri`.

Expected: FAIL with missing functions `build_google_token_request_body` and `parse_google_token_response`.

- [ ] **Step 4: Add token response types and helper implementations**

In `src-tauri/src/lib.rs`, update the serde import:

```rust
use serde::{Deserialize, Serialize};
```

Add this response struct near `GoogleDriveOAuthResult`:

```rust
#[derive(Deserialize)]
struct GoogleTokenResponse {
  access_token: Option<String>,
  error: Option<String>,
  error_description: Option<String>,
}
```

Add these helper functions near `percent_encode`:

```rust
fn form_pair(key: &str, value: &str) -> String {
  format!("{}={}", percent_encode(key), percent_encode(value))
}

fn build_google_token_request_body(
  client_id: &str,
  client_secret: &str,
  code: &str,
  code_verifier: &str,
  redirect_uri: &str,
) -> String {
  [
    form_pair("client_id", client_id),
    form_pair("client_secret", client_secret),
    form_pair("code", code),
    form_pair("code_verifier", code_verifier),
    form_pair("grant_type", "authorization_code"),
    form_pair("redirect_uri", redirect_uri),
  ]
  .join("&")
}

fn parse_google_token_response(status: u16, body: &str) -> Result<String, String> {
  if status >= 400 {
    let parsed = serde_json::from_str::<GoogleTokenResponse>(body).ok();

    return Err(parsed
      .and_then(|response| response.error_description.or(response.error))
      .unwrap_or_else(|| format!("Google Drive request failed: {status}")));
  }

  let parsed: GoogleTokenResponse = serde_json::from_str(body).map_err(|error| error.to_string())?;

  parsed
    .access_token
    .ok_or_else(|| "Accesso Google non riuscito".to_string())
}
```

- [ ] **Step 5: Run Rust helper tests and verify GREEN**

Run:

```bash
cargo test google_token
```

from `src-tauri`.

Expected: PASS. All six helper tests pass.

- [ ] **Step 6: Commit Rust helper tests and helpers**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs
git commit -m "test: cover google token exchange helpers"
```

---

### Task 4: Rust Tauri Token Exchange Command

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add token command result type**

Near `GoogleDriveOAuthResult`, add:

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GoogleDriveTokenResult {
  access_token: String,
}
```

- [ ] **Step 2: Add the token exchange command**

Add this command below `start_google_drive_oauth`:

```rust
#[tauri::command]
async fn exchange_google_drive_oauth_code(
  client_id: String,
  code: String,
  code_verifier: String,
  redirect_uri: String,
) -> Result<GoogleDriveTokenResult, String> {
  let client_secret = option_env!("GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET")
    .ok_or("Configura GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET per usare Google Drive Sync in Tauri")?;

  let body = build_google_token_request_body(
    &client_id,
    client_secret,
    &code,
    &code_verifier,
    &redirect_uri,
  );

  let response = reqwest::Client::new()
    .post("https://oauth2.googleapis.com/token")
    .header("Content-Type", "application/x-www-form-urlencoded")
    .body(body)
    .send()
    .await
    .map_err(|error| error.to_string())?;

  let status = response.status().as_u16();
  let body = response.text().await.map_err(|error| error.to_string())?;
  let access_token = parse_google_token_response(status, &body)?;

  Ok(GoogleDriveTokenResult { access_token })
}
```

- [ ] **Step 3: Register the command with Tauri**

Replace:

```rust
    .invoke_handler(tauri::generate_handler![start_google_drive_oauth])
```

with:

```rust
    .invoke_handler(tauri::generate_handler![
      start_google_drive_oauth,
      exchange_google_drive_oauth_code
    ])
```

- [ ] **Step 4: Run Rust compile check**

Run:

```bash
cargo check
```

from `src-tauri`.

Expected: PASS. If `reqwest` downloads dependencies, `Cargo.lock` changes.

- [ ] **Step 5: Run Rust tests**

Run:

```bash
cargo test
```

from `src-tauri`.

Expected: PASS. The helper tests from Task 3 pass.

- [ ] **Step 6: Commit Rust command**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs
git commit -m "feat: exchange google oauth code in tauri"
```

---

### Task 5: Build-Time Secret Rebuild Hook

**Files:**
- Modify: `src-tauri/build.rs`

- [ ] **Step 1: Update build script**

Replace `src-tauri/build.rs` with:

```rust
fn main() {
  println!("cargo:rerun-if-env-changed=GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET");
  tauri_build::build()
}
```

- [ ] **Step 2: Run compile check**

Run:

```bash
cargo check
```

from `src-tauri`.

Expected: PASS.

- [ ] **Step 3: Commit build script change**

```bash
git add src-tauri/build.rs
git commit -m "chore: rebuild tauri when google secret changes"
```

---

### Task 6: Configuration And Documentation Cleanup

**Files:**
- Modify: `.env.example`
- Modify: `docs/diataxis/how-to/configure-google-drive-sync.md`
- Modify: `docs/diataxis/reference/integrations.md`

- [ ] **Step 1: Update `.env.example`**

Ensure `.env.example` contains only Vite-exposed Google values:

```env
VITE_GOOGLE_DRIVE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID=your-google-desktop-oauth-client-id.apps.googleusercontent.com
```

- [ ] **Step 2: Update the Google Drive sync how-to**

In `docs/diataxis/how-to/configure-google-drive-sync.md`, keep the `.env` block as:

```env
VITE_GOOGLE_DRIVE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID=your-google-desktop-oauth-client-id.apps.googleusercontent.com
```

Replace the desktop secret paragraph with:

```markdown
`GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET` is used only by the Tauri Rust token exchange. Do not add it to `.env` with a `VITE_` prefix.
```

Add this local Tauri command section:

````markdown
For Tauri desktop development, set the build-time secret in the same shell before starting Tauri:

```powershell
$env:GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET="your-google-desktop-oauth-client-secret"
npm run tauri:dev
```

For Windows packaging, set it before the build:

```powershell
$env:GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET="your-google-desktop-oauth-client-secret"
npm run build:win
```
````

Update the failure checklist item to:

```markdown
- For Tauri, confirm `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID` and build-time `GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET` come from the same Desktop OAuth client.
```

- [ ] **Step 3: Update integration reference**

In `docs/diataxis/reference/integrations.md`, update the runtime configuration table row for the desktop secret to:

```markdown
| `GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET` | Build-time Desktop OAuth client secret consumed by the Tauri Rust token exchange. It must not use the `VITE_` prefix. |
```

If the table still contains `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET`, remove that row.

- [ ] **Step 4: Commit documentation cleanup**

```bash
git add .env.example docs/diataxis/how-to/configure-google-drive-sync.md docs/diataxis/reference/integrations.md
git commit -m "docs: document tauri google secret configuration"
```

---

### Task 7: Full Verification

**Files:**
- Verify all modified files from Tasks 1-6.

- [ ] **Step 1: Run full frontend test suite**

Run:

```bash
npm run test -- --run
```

Expected: PASS. All Vitest files pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS. Existing Vite chunk-size warnings are acceptable if there are no TypeScript or build errors.

- [ ] **Step 3: Run Rust tests**

Run:

```bash
cargo test
```

from `src-tauri`.

Expected: PASS.

- [ ] **Step 4: Run Rust compile check**

Run:

```bash
cargo check
```

from `src-tauri`.

Expected: PASS.

- [ ] **Step 5: Verify no frontend secret references remain**

Run:

```bash
rg -n "VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET|client_secret" src .env.example docs/diataxis
```

Expected: no matches in `src` or `.env.example`. Documentation may contain `client_secret` only when explaining OAuth behavior, not as a `VITE_` variable.

- [ ] **Step 6: Verify the Tauri command is registered**

Run:

```bash
rg -n "exchange_google_drive_oauth_code|generate_handler" src-tauri/src/lib.rs
```

Expected: `exchange_google_drive_oauth_code` appears in the command definition and in `tauri::generate_handler!`.

- [ ] **Step 7: Commit any final verification-only fixes**

If verification required small fixes, commit them:

```bash
git add src src-tauri .env.example docs
git commit -m "fix: complete tauri google token exchange"
```

If no files changed during verification, do not create an empty commit.

---

## Manual Smoke Test

Run from PowerShell:

```powershell
$env:GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET="your-google-desktop-oauth-client-secret"
npm run tauri:dev
```

Then:

1. Click `Accedi a Google Drive`.
2. Complete Google login in the browser.
3. Confirm the app returns to `Google Drive - Sincronizzato`.
4. Open WebView DevTools network monitoring.
5. Confirm there is no WebView request to `https://oauth2.googleapis.com/token`.
6. Confirm Drive API requests still use `Authorization: Bearer ...` and sync succeeds.

---

## Notes For Implementers

- Do not log `GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET`, token request bodies, or access tokens.
- Do not move browser Google Identity Services login to Rust.
- Do not add refresh token support.
- Do not edit unrelated Android generated files.
- The working tree may contain unrelated sync feature changes. Do not revert them.
