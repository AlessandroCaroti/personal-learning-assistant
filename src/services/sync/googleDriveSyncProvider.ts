import {
  RemoteRevisionMismatchError,
  type RemoteSyncState,
  type SyncAccount,
  type SyncProvider,
} from './types'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const SYNC_FILE_NAME = 'study-app-sync-state.json'
const GOOGLE_IDENTITY_SERVICES_URL = 'https://accounts.google.com/gsi/client'
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface GoogleDriveProviderOptions {
  clientId: string
  desktopClientId?: string
  desktopClientSecret?: string
  getAccessToken?: () => Promise<string>
  isTauriRuntime?: () => boolean | Promise<boolean>
  startDesktopOAuth?: DesktopOAuthStarter
}

interface GoogleTokenResponse {
  access_token?: string
  error?: string
}

interface GoogleTokenClient {
  requestAccessToken(): void
}

interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string
        scope: string
        callback(response: GoogleTokenResponse): void
        error_callback?(error: { type?: string }): void
      }): GoogleTokenClient
    }
  }
}

interface DriveFile {
  id: string
  version: string
  etag?: string
}

interface DesktopOAuthResult {
  code: string
  redirectUri: string
}

type DesktopOAuthStarter = (request: {
  clientId: string
  scope: string
  codeChallenge: string
  state: string
}) => Promise<DesktopOAuthResult>

let googleIdentityServicesLoad: Promise<void> | null = null

function isRevisionMismatchResponse(response: Response): boolean {
  return response.status === 412 || response.status === 409
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (isRevisionMismatchResponse(response)) {
      throw new RemoteRevisionMismatchError()
    }

    throw new Error(`Google Drive request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function getGoogleIdentityServices(): GoogleIdentityServices | undefined {
  if (typeof window === 'undefined') return undefined

  return (
    window as typeof window & {
      google?: GoogleIdentityServices
    }
  ).google
}

async function loadGoogleIdentityServices(): Promise<void> {
  if (getGoogleIdentityServices()) return
  if (typeof document === 'undefined') throw new Error('Google Identity Services non disponibile')
  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SERVICES_URL}"]`)
  if (googleIdentityServicesLoad && existingScript) return googleIdentityServicesLoad
  if (googleIdentityServicesLoad && !existingScript) {
    googleIdentityServicesLoad = null
  }

  googleIdentityServicesLoad = new Promise((resolve, reject) => {
    function fail() {
      googleIdentityServicesLoad = null
      script.remove()
      reject(new Error('Google Identity Services non disponibile'))
    }

    const script = existingScript ?? document.createElement('script')
    script.src = GOOGLE_IDENTITY_SERVICES_URL
    script.async = true
    script.addEventListener(
      'load',
      () => {
        if (getGoogleIdentityServices()) {
          resolve()
          return
        }

        fail()
      },
      { once: true },
    )
    script.addEventListener('error', fail, { once: true })

    if (!existingScript) {
      document.head.appendChild(script)
    }
  })

  return googleIdentityServicesLoad
}

function createJsonBlob(value: unknown): Blob {
  return new Blob([JSON.stringify(value)], { type: 'application/json' })
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''

  for (let index = 0; index < view.length; index += 1) {
    binary += String.fromCharCode(view[index])
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return base64UrlEncode(digest)
}

function encodeRevision(file: DriveFile): string {
  return file.etag ? `${file.version}:${file.etag}` : file.version
}

function revisionVersion(revision: string): string {
  return revision.split(':', 1)[0]
}

function revisionEtag(revision: string): string | null {
  const separatorIndex = revision.indexOf(':')
  return separatorIndex === -1 ? null : revision.slice(separatorIndex + 1)
}

async function createGoogleTokenClient(clientId: string): Promise<GoogleTokenClient> {
  await loadGoogleIdentityServices()
  const google = getGoogleIdentityServices()
  if (!google) throw new Error('Google Identity Services non disponibile')

  return google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    callback(response) {
      if (response.error || !response.access_token) {
        rejectPendingTokenRequest(new Error(response.error ?? 'Accesso Google non riuscito'))
        return
      }

      resolvePendingTokenRequest(response.access_token)
    },
    error_callback(error) {
      rejectPendingTokenRequest(new Error(error.type ?? 'Accesso Google non riuscito'))
    },
  })
}

let pendingTokenRequest:
  | {
      resolve(token: string): void
      reject(error: Error): void
    }
  | null = null

function resolvePendingTokenRequest(token: string) {
  pendingTokenRequest?.resolve(token)
  pendingTokenRequest = null
}

function rejectPendingTokenRequest(error: Error) {
  pendingTokenRequest?.reject(error)
  pendingTokenRequest = null
}

function requestAccessToken(client: GoogleTokenClient): Promise<string> {
  return new Promise((resolve, reject) => {
    pendingTokenRequest = { resolve, reject }
    client.requestAccessToken()
  })
}

async function defaultIsTauriRuntime(): Promise<boolean> {
  try {
    const { isTauri } = await import('@tauri-apps/api/core')
    return isTauri()
  } catch {
    return false
  }
}

async function defaultStartDesktopOAuth(request: {
  clientId: string
  scope: string
  codeChallenge: string
  state: string
}): Promise<DesktopOAuthResult> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<DesktopOAuthResult>('start_google_drive_oauth', request)
}

export async function requestDesktopGoogleDriveToken(
  clientId: string,
  startDesktopOAuth: DesktopOAuthStarter = defaultStartDesktopOAuth,
  clientSecret?: string,
): Promise<string> {
  const codeVerifier = randomBase64Url(32)
  const state = randomBase64Url(16)
  const codeChallenge = await sha256Base64Url(codeVerifier)
  const authorization = await startDesktopOAuth({
    clientId,
    scope: DRIVE_SCOPE,
    codeChallenge,
    state,
  })
  const body = new URLSearchParams({
    client_id: clientId,
    code: authorization.code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: authorization.redirectUri,
  })

  if (clientSecret) {
    body.set('client_secret', clientSecret)
  }

  const response = await parseJsonResponse<{ access_token?: string; error?: string }>(
    await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }),
  )

  if (!response.access_token) {
    throw new Error(response.error ?? 'Accesso Google non riuscito')
  }

  return response.access_token
}

export function createGoogleDriveSyncProvider(options: GoogleDriveProviderOptions): SyncProvider {
  let account: SyncAccount | null = null
  let tokenClient: GoogleTokenClient | null = null
  let tokenClientLoad: Promise<GoogleTokenClient> | null = null
  let cachedAccessToken: string | null = null

  function startTokenClientLoad(): Promise<GoogleTokenClient> {
    if (tokenClient) return Promise.resolve(tokenClient)
    if (!tokenClientLoad) {
      tokenClientLoad = createGoogleTokenClient(options.clientId)
        .then((client) => {
          tokenClient = client
          return client
        })
        .catch((error: unknown) => {
          tokenClientLoad = null
          throw error
        })

      void tokenClientLoad.catch(() => {})
    }

    return tokenClientLoad
  }

  if (!options.getAccessToken) {
    void startTokenClientLoad()
  }

  async function getToken(): Promise<string> {
    if (options.getAccessToken) return options.getAccessToken()
    if (cachedAccessToken) return cachedAccessToken

    const isTauriRuntime = options.isTauriRuntime ?? defaultIsTauriRuntime
    if (await isTauriRuntime()) {
      if (!options.desktopClientId) {
        throw new Error('Configura VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID per usare Google Drive Sync in Tauri')
      }

      cachedAccessToken = await requestDesktopGoogleDriveToken(
        options.desktopClientId,
        options.startDesktopOAuth,
        options.desktopClientSecret,
      )
      return cachedAccessToken
    }

    if (tokenClient) {
      cachedAccessToken = await requestAccessToken(tokenClient)
      return cachedAccessToken
    }

    const client = await startTokenClientLoad()
    cachedAccessToken = await requestAccessToken(client)
    return cachedAccessToken
  }

  async function findSyncFile(token: string): Promise<DriveFile | null> {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      fields: 'files(id,name,version)',
      q: `name='${SYNC_FILE_NAME}'`,
    })
    const response = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await parseJsonResponse<{ files: DriveFile[] }>(response)
    const file = result.files[0]

    if (!file) return null

    const metadataResponse = await fetch(`${DRIVE_FILES_URL}/${file.id}?fields=id,version`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const metadata = await parseJsonResponse<DriveFile>(metadataResponse)

    return {
      ...metadata,
      etag: metadataResponse.headers.get('etag') ?? undefined,
    }
  }

  async function uploadRemoteState(
    token: string,
    state: RemoteSyncState,
    existing: DriveFile | null,
    expectedRevision: string | null,
  ) {
    const metadata = {
      name: SYNC_FILE_NAME,
      mimeType: 'application/json',
      ...(existing ? {} : { parents: ['appDataFolder'] }),
    }
    const form = new FormData()
    form.append('metadata', createJsonBlob(metadata))
    form.append('file', createJsonBlob(state))

    const params = new URLSearchParams({
      uploadType: 'multipart',
      fields: 'id,version,modifiedTime',
    })
    const url = existing
      ? `${DRIVE_UPLOAD_URL}/${existing.id}?${params.toString()}`
      : `${DRIVE_UPLOAD_URL}?${params.toString()}`
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    const expectedEtag = expectedRevision ? revisionEtag(expectedRevision) : null

    if (existing && expectedEtag) {
      headers['If-Match'] = expectedEtag
    }

    return parseJsonResponse<{ version: string; modifiedTime: string }>(
      await fetch(url, {
        method: existing ? 'PATCH' : 'POST',
        headers,
        body: form,
      }),
    )
  }

  return {
    async getAccount() {
      return account
    },
    async signIn() {
      await getToken()
      account = {
        id: 'google-drive',
        email: 'Google Drive',
        provider: 'google-drive',
      }
      return account
    },
    async signOut() {
      account = null
      cachedAccessToken = null
    },
    async readRemoteState() {
      const token = await getToken()
      const file = await findSyncFile(token)
      if (!file) return { state: null, revision: null }

      const state = await parseJsonResponse<RemoteSyncState>(
        await fetch(`${DRIVE_FILES_URL}/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )

      return { state, revision: encodeRevision(file) }
    },
    async writeRemoteState(state, expectedRevision) {
      const token = await getToken()
      const existing = await findSyncFile(token)

      if (
        (expectedRevision === null && existing) ||
        (expectedRevision !== null &&
          (!existing ||
            existing.version !== revisionVersion(expectedRevision) ||
            (revisionEtag(expectedRevision) !== null && encodeRevision(existing) !== expectedRevision)))
      ) {
        throw new RemoteRevisionMismatchError()
      }

      const response = await uploadRemoteState(token, state, existing, expectedRevision)

      return {
        revision: response.version,
        updatedAt: response.modifiedTime,
      }
    },
  }
}
