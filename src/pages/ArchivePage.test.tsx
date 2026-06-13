import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Esame, ExamAttachment } from '../types'

const getEsame = vi.fn()
const saveEsame = vi.fn()
const pickFile = vi.fn()
const downloadAttachment = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
  saveEsame,
}))

vi.mock('../services/fileService', () => ({
  fileService: {
    pickFile,
  },
}))

vi.mock('../services/archiveService', async () => {
  const actual = await vi.importActual<typeof import('../services/archiveService')>(
    '../services/archiveService',
  )

  return {
    ...actual,
    downloadAttachment,
  }
})

const { ArchivePage } = await import('./ArchivePage')

function encodeText(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function attachment(overrides: Partial<ExamAttachment> = {}): ExamAttachment {
  return {
    id: 'attachment-1',
    name: 'notes.pdf',
    type: 'application/pdf',
    data: encodeText('notes'),
    createdAt: '2026-06-13T09:00:00.000Z',
    ...overrides,
  }
}

function makeExam(overrides: Partial<Esame> = {}): Esame {
  return {
    id: 'exam-1',
    name: 'Analisi 1',
    createdAt: '2026-06-01T08:00:00.000Z',
    files: {},
    attachments: [],
    ...overrides,
  }
}

function renderArchive(path = '/esame/exam-1/archivio') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
        <Route path="/esame/:examId/archivio" element={<ArchivePage />} />
        <Route path="/esame/:examId/file/:fileId" element={<h1>Viewer file</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ArchivePage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeExam())
    saveEsame.mockResolvedValue(undefined)
  })

  it('redirects home when the exam is missing', async () => {
    getEsame.mockResolvedValue(undefined)

    renderArchive()

    expect(await screen.findByRole('heading', { name: 'Tutti gli esami' })).not.toBeNull()
  })

  it('renders the empty archive state', async () => {
    renderArchive()

    expect(await screen.findByRole('heading', { name: 'Archivio' })).not.toBeNull()
    expect(screen.getByText('Nessun file archiviato')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Aggiungi file' })).not.toBeNull()
  })

  it('renders supported and unsupported attachment actions', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        attachments: [
          attachment({ id: 'pdf', name: 'slides.pdf', type: 'application/pdf' }),
          attachment({ id: 'zip', name: 'bundle.zip', type: 'application/zip' }),
        ],
      }),
    )

    renderArchive()

    expect(await screen.findByText('slides.pdf')).not.toBeNull()
    expect(screen.getByText('bundle.zip')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Apri slides.pdf' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Apri bundle.zip' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Scarica bundle.zip' })).not.toBeNull()
  })

  it('adds a new attachment', async () => {
    const current = makeExam()
    const pickedData = encodeText('custom')
    getEsame.mockResolvedValue(current)
    saveEsame.mockImplementation(async (updated: Esame) => {
      getEsame.mockResolvedValue(updated)
    })
    pickFile.mockResolvedValue({
      name: 'custom.bin',
      type: 'application/octet-stream',
      data: pickedData,
    })

    renderArchive()

    fireEvent.click(await screen.findByRole('button', { name: 'Aggiungi file' }))

    await waitFor(() => {
      expect(pickFile).toHaveBeenCalledWith([])
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        attachments: [
          expect.objectContaining({
            name: 'custom.bin',
            type: 'application/octet-stream',
            data: pickedData,
          }),
        ],
      })
    })
  })

  it('deletes an attachment', async () => {
    const current = makeExam({
      attachments: [
        attachment({ id: 'keep', name: 'keep.pdf' }),
        attachment({ id: 'delete', name: 'delete.pdf' }),
      ],
    })
    getEsame.mockResolvedValue(current)

    renderArchive()

    fireEvent.click(await screen.findByRole('button', { name: 'Elimina delete.pdf' }))

    await waitFor(() => {
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        attachments: [current.attachments?.[0]],
      })
    })
  })

  it('downloads an attachment', async () => {
    const item = attachment({ id: 'zip', name: 'bundle.zip', type: 'application/zip' })
    getEsame.mockResolvedValue(makeExam({ attachments: [item] }))

    renderArchive()

    fireEvent.click(await screen.findByRole('button', { name: 'Scarica bundle.zip' }))

    expect(downloadAttachment).toHaveBeenCalledWith(item)
  })

  it('opens a supported attachment viewer', async () => {
    getEsame.mockResolvedValue(makeExam({ attachments: [attachment({ id: 'pdf' })] }))

    renderArchive()

    fireEvent.click(await screen.findByRole('button', { name: 'Apri notes.pdf' }))

    expect(await screen.findByRole('heading', { name: 'Viewer file' })).not.toBeNull()
  })
})
