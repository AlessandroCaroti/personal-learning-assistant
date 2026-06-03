import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Esame } from '../types'

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'exam-new'),
}))

vi.mock('../services/storageService', () => ({
  getAllEsami: vi.fn(),
  getEsame: vi.fn(),
  saveEsame: vi.fn(),
  deleteEsame: vi.fn(),
}))

const storage = await import('../services/storageService')
const { useExam } = await import('./useExam')

const olderExam: Esame = {
  id: 'exam-old',
  name: 'Diritto',
  createdAt: '2026-06-01T08:00:00.000Z',
  files: {},
}

const newerExam: Esame = {
  id: 'exam-newer',
  name: 'Economia',
  createdAt: '2026-06-01T09:00:00.000Z',
  files: {},
}

describe('useExam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(storage.getAllEsami).mockResolvedValue([newerExam, olderExam])
    vi.mocked(storage.getEsame).mockResolvedValue(olderExam)
    vi.mocked(storage.saveEsame).mockResolvedValue()
    vi.mocked(storage.deleteEsame).mockResolvedValue()
  })

  it('loads exams sorted by creation date ascending', async () => {
    const { result } = renderHook(() => useExam())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.esami).toEqual([olderExam, newerExam])
  })

  it('sorts exams by createdAt ascending after reload', async () => {
    vi.mocked(storage.getAllEsami)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newerExam, olderExam])

    const { result } = renderHook(() => useExam())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.esami).toEqual([])

    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.esami).toEqual([olderExam, newerExam])
    expect(storage.getAllEsami).toHaveBeenCalledTimes(2)
  })

  it('creates a trimmed exam, saves it, reloads, and returns it', async () => {
    const { result } = renderHook(() => useExam())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let created: Esame | undefined
    await act(async () => {
      created = await result.current.createEsame('  Analisi 1  ')
    })

    expect(created).toEqual({
      id: 'exam-new',
      name: 'Analisi 1',
      createdAt: expect.any(String),
      files: {},
    })
    expect(storage.saveEsame).toHaveBeenCalledWith(created)
    expect(storage.getAllEsami).toHaveBeenCalledTimes(2)
  })

  it('does not create or rename blank exam names', async () => {
    const { result } = renderHook(() => useExam())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.createEsame('   ')).rejects.toThrow('Nome esame obbligatorio')
      await result.current.renameEsame(olderExam.id, '   ')
    })

    expect(storage.saveEsame).not.toHaveBeenCalled()
  })

  it('renames existing exams and no-ops when the exam is missing', async () => {
    const { result } = renderHook(() => useExam())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.renameEsame(olderExam.id, '  Diritto privato ')
    })

    expect(storage.saveEsame).toHaveBeenCalledWith({
      ...olderExam,
      name: 'Diritto privato',
    })

    vi.mocked(storage.getEsame).mockResolvedValueOnce(undefined)
    await act(async () => {
      await result.current.renameEsame('missing', 'Qualcosa')
    })

    expect(storage.saveEsame).toHaveBeenCalledTimes(1)
  })

  it('deletes exams and reloads the list', async () => {
    const { result } = renderHook(() => useExam())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteEsame(olderExam.id)
    })

    expect(storage.deleteEsame).toHaveBeenCalledWith(olderExam.id)
    expect(storage.getAllEsami).toHaveBeenCalledTimes(2)
  })
})
