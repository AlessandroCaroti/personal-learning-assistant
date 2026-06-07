import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../__tests__/resetDb'
import { useSync } from './useSync'

describe('useSync', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_GOOGLE_DRIVE_CLIENT_ID', '')
    document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]').forEach((script) => {
      script.remove()
    })
    await resetDb()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]').forEach((script) => {
      script.remove()
    })
  })

  it('does not sign into the fake account when Google Drive is not configured', async () => {
    const { result } = renderHook(() => useSync())

    expect(result.current.status.kind).toBe('signed-out')

    await act(async () => {
      await result.current.signIn()
    })

    await waitFor(() => {
      expect(result.current.status.kind).toBe('failed')
    })
    expect(result.current.status.account?.email).not.toBe('student@example.com')
    expect(result.current.status.message).toBe('Configura VITE_GOOGLE_DRIVE_CLIENT_ID per usare Google Drive Sync')
    expect(result.current.status.pendingChanges).toBe(false)
  })

  it('keeps the signed-in sync status after the Home page unmounts and remounts', async () => {
    vi.stubEnv('VITE_GOOGLE_DRIVE_CLIENT_ID', 'web-client-id')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'file-1', version: '1', modifiedTime: '2026-06-01T12:00:00.000Z' }),
        } as Response),
    )
    const firstRender = renderHook(() => useSync())

    await waitFor(() => {
      expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).not.toBeNull()
    })
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: { callback(response: { access_token: string }): void }) => ({
            requestAccessToken: () => callback({ access_token: 'browser-token' }),
          }),
        },
      },
    })
    document
      .querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
      ?.dispatchEvent(new Event('load'))

    await act(async () => {
      await firstRender.result.current.signIn()
    })
    await waitFor(() => {
      expect(firstRender.result.current.status.kind).toBe('synced')
    })

    firstRender.unmount()
    const secondRender = renderHook(() => useSync())

    expect(secondRender.result.current.status.account?.provider).toBe('google-drive')
    expect(secondRender.result.current.status.kind).toBe('synced')
  })
})
