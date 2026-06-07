import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGoogleDriveSyncProvider, requestDesktopGoogleDriveToken } from './googleDriveSyncProvider'
import { RemoteRevisionMismatchError, type RemoteSyncState } from './types'

function emptyState(): RemoteSyncState {
  return {
    syncVersion: 1,
    updatedAt: '2026-06-01T12:00:00.000Z',
    writerDeviceId: 'device',
    data: { esami: [], quizSessions: [], questionStats: [], flashcardStats: [] },
    tombstones: [],
  }
}

describe('googleDriveSyncProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]').forEach((script) => {
      script.remove()
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]').forEach((script) => {
      script.remove()
    })
  })

  it('reads missing remote state as null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] }),
    } as Response)

    const provider = createGoogleDriveSyncProvider({
      clientId: 'client-id',
      getAccessToken: async () => 'token',
    })

    await expect(provider.readRemoteState()).resolves.toEqual({ state: null, revision: null })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('spaces=appDataFolder'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
      }),
    )
  })

  it('writes remote state with appDataFolder parent', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-1', version: '7', modifiedTime: '2026-06-01T12:00:00.000Z' }),
      } as Response)

    const provider = createGoogleDriveSyncProvider({
      clientId: 'client-id',
      getAccessToken: async () => 'token',
    })

    const result = await provider.writeRemoteState(emptyState(), null)

    expect(result.revision).toBe('7')
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/upload/drive/v3/files'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    )

    const fetchCalls = vi.mocked(fetch).mock.calls
    const uploadRequest = fetchCalls[fetchCalls.length - 1]?.[1]
    const form = uploadRequest?.body as FormData
    const metadata = form.get('metadata')
    expect(metadata).toBeInstanceOf(Blob)
    await expect((metadata as Blob).text()).resolves.toBe(
      JSON.stringify({
        name: 'study-app-sync-state.json',
        mimeType: 'application/json',
        parents: ['appDataFolder'],
      }),
    )
  })

  it('throws a revision mismatch when the expected revision is stale', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 'file-1', name: 'study-app-sync-state.json', version: '8' }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ id: 'file-1', version: '8' }),
      } as Response)

    const provider = createGoogleDriveSyncProvider({
      clientId: 'client-id',
      getAccessToken: async () => 'token',
    })

    await expect(provider.writeRemoteState(emptyState(), '7')).rejects.toBeInstanceOf(RemoteRevisionMismatchError)
  })

  it('throws a revision mismatch when creating but a remote file already exists', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 'file-1', name: 'study-app-sync-state.json', version: '8' }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ id: 'file-1', version: '8' }),
      } as Response)

    const provider = createGoogleDriveSyncProvider({
      clientId: 'client-id',
      getAccessToken: async () => 'token',
    })

    await expect(provider.writeRemoteState(emptyState(), null)).rejects.toBeInstanceOf(RemoteRevisionMismatchError)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('sends an If-Match header when updating an etag-backed revision', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 'file-1', name: 'study-app-sync-state.json', version: '7' }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ etag: 'etag-7' }),
        json: async () => ({ id: 'file-1', version: '7' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-1', version: '8', modifiedTime: '2026-06-01T12:00:00.000Z' }),
      } as Response)

    const provider = createGoogleDriveSyncProvider({
      clientId: 'client-id',
      getAccessToken: async () => 'token',
    })

    await provider.writeRemoteState(emptyState(), '7:etag-7')

    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/upload/drive/v3/files/file-1'),
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer token', 'If-Match': 'etag-7' }),
      }),
    )
  })

  it('retries Google Identity Services script loading after a transient failure', async () => {
    const provider = createGoogleDriveSyncProvider({ clientId: 'client-id', isTauriRuntime: () => false })
    const firstSignIn = provider.signIn()
    const firstScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    )

    expect(firstScript).not.toBeNull()
    firstScript?.dispatchEvent(new Event('error'))
    await expect(firstSignIn).rejects.toThrow('Google Identity Services non disponibile')
    expect(document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')).toHaveLength(0)

    const secondSignIn = provider.signIn()

    await waitFor(() => {
      expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).not.toBeNull()
    })
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: { callback(response: { access_token: string }): void }) => ({
            requestAccessToken: () => callback({ access_token: 'token' }),
          }),
        },
      },
    })
    const secondScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    secondScript?.dispatchEvent(new Event('load'))

    await expect(secondSignIn).resolves.toEqual({
      id: 'google-drive',
      email: 'Google Drive',
      provider: 'google-drive',
    })
  })

  it('starts loading Google Identity Services before the sign-in click', () => {
    createGoogleDriveSyncProvider({ clientId: 'client-id', isTauriRuntime: () => false })

    expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).not.toBeNull()
  })

  it('rejects sign-in when the Google popup fails to open', async () => {
    const provider = createGoogleDriveSyncProvider({ clientId: 'client-id', isTauriRuntime: () => false })
    const script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    let errorCallback: ((error: { type: string }) => void) | null = null

    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            callback(response: { access_token?: string }): void
            error_callback(error: { type: string }): void
          }) => {
            errorCallback = config.error_callback
            return {
              requestAccessToken: () => errorCallback?.({ type: 'popup_failed_to_open' }),
            }
          },
        },
      },
    })
    script?.dispatchEvent(new Event('load'))

    await expect(provider.signIn()).rejects.toThrow('popup_failed_to_open')
  })

  it('reuses the browser access token after sign-in for the first sync request', async () => {
    const requestAccessToken = vi.fn()
    const provider = createGoogleDriveSyncProvider({ clientId: 'client-id', isTauriRuntime: () => false })
    const script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')

    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: { callback(response: { access_token: string }): void }) => ({
            requestAccessToken: () => {
              requestAccessToken()
              callback({ access_token: 'browser-token' })
            },
          }),
        },
      },
    })
    script?.dispatchEvent(new Event('load'))
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] }),
    } as Response)

    await provider.signIn()
    await provider.readRemoteState()

    expect(requestAccessToken).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('spaces=appDataFolder'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer browser-token' },
      }),
    )
  })

  it('exchanges a Tauri desktop authorization code for an access token', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(1)
        return bytes
      },
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array([2, 3, 4]).buffer),
      },
    })
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'desktop-token' }),
    } as Response)

    const token = await requestDesktopGoogleDriveToken('client-id', async () => ({
      code: 'auth-code',
      redirectUri: 'http://127.0.0.1:3210/',
    }))

    expect(token).toBe('desktop-token')
    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    )
    expect(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)).toContain('grant_type=authorization_code')
  })

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

  it('uses the desktop client id for Tauri sign-in', async () => {
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

    await expect(provider.signIn()).resolves.toEqual({
      id: 'google-drive',
      email: 'Google Drive',
      provider: 'google-drive',
    })
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
  })

  it('reuses the desktop access token after sign-in for the first sync request', async () => {
    const startDesktopOAuth = vi.fn().mockResolvedValue({
      code: 'auth-code',
      redirectUri: 'http://127.0.0.1:3210/',
    })
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'desktop-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      } as Response)
    const provider = createGoogleDriveSyncProvider({
      clientId: 'web-client-id',
      desktopClientId: 'desktop-client-id',
      isTauriRuntime: () => true,
      startDesktopOAuth,
    })

    await provider.signIn()
    await provider.readRemoteState()

    expect(startDesktopOAuth).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('spaces=appDataFolder'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer desktop-token' },
      }),
    )
  })
})
