import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Esame, ExamAttachment } from '../types'

const getEsame = vi.fn()
const downloadAttachment = vi.fn()
const convertToHtml = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
}))

vi.mock('../services/archiveService', () => ({
  downloadAttachment,
}))

vi.mock('mammoth', () => ({
  default: {
    convertToHtml,
  },
  convertToHtml,
}))

const { FileViewerPage } = await import('./FileViewerPage')

function encodeText(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function attachment(overrides: Partial<ExamAttachment> = {}): ExamAttachment {
  return {
    id: 'attachment-1',
    name: 'notes.txt',
    type: 'text/plain',
    data: encodeText('plain notes'),
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

function renderViewer(path = '/esame/exam-1/file/attachment-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId/archivio" element={<h1>Archivio esame</h1>} />
        <Route path="/esame/:examId/file/:fileId" element={<FileViewerPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FileViewerPage', () => {
  const createObjectURL = vi.fn(() => 'blob:preview')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeExam({ attachments: [attachment()] }))
    convertToHtml.mockResolvedValue({ value: '<p>DOCX preview</p>' })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('redirects home when the exam is missing', async () => {
    getEsame.mockResolvedValue(undefined)

    renderViewer()

    expect(await screen.findByRole('heading', { name: 'Tutti gli esami' })).not.toBeNull()
  })

  it('shows an alert when the attachment is missing', async () => {
    getEsame.mockResolvedValue(makeExam({ attachments: [] }))

    renderViewer()

    expect(await screen.findByRole('alert')).toHaveTextContent('File non trovato.')
  })

  it('renders text attachments', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        attachments: [attachment({ name: 'notes.txt', type: 'text/plain', data: encodeText('Line 1') })],
      }),
    )

    renderViewer()

    expect(await screen.findByText('Line 1')).not.toBeNull()
    expect(screen.getByText('Line 1').tagName).toBe('PRE')
  })

  it('renders markdown attachments as text', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        attachments: [attachment({ name: 'notes.md', type: 'text/markdown', data: encodeText('# Title') })],
      }),
    )

    renderViewer()

    expect(await screen.findByText('# Title')).not.toBeNull()
    expect(screen.getByText('# Title').tagName).toBe('PRE')
  })

  it('renders HTML attachments in an iframe with about:srcdoc base', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        attachments: [attachment({ name: 'notes.html', type: 'text/html', data: encodeText('<h1>Doc</h1>') })],
      }),
    )

    renderViewer()

    const iframe = await screen.findByTitle('Anteprima file')
    expect(iframe).toHaveAttribute('srcdoc', '<base href="about:srcdoc"><h1>Doc</h1>')
  })

  it('renders PDF attachments with a blob URL and revokes it on unmount', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        attachments: [attachment({ name: 'notes.pdf', type: 'application/pdf' })],
      }),
    )

    const view = renderViewer()

    const iframe = await screen.findByTitle('Anteprima PDF')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(iframe).toHaveAttribute('src', 'blob:preview')

    view.unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('converts DOCX attachments with mammoth', async () => {
    const data = encodeText('docx-binary')
    getEsame.mockResolvedValue(
      makeExam({
        attachments: [
          attachment({
            name: 'notes.docx',
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            data,
          }),
        ],
      }),
    )

    renderViewer()

    const iframe = await screen.findByTitle('Anteprima file')
    expect(convertToHtml).toHaveBeenCalledWith({ arrayBuffer: data })
    expect(iframe).toHaveAttribute('srcdoc', '<base href="about:srcdoc"><p>DOCX preview</p>')
  })

  it('keeps a download fallback when DOCX preview conversion fails', async () => {
    const item = attachment({
      name: 'broken.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      data: encodeText('broken-docx'),
    })
    getEsame.mockResolvedValue(makeExam({ attachments: [item] }))
    convertToHtml.mockRejectedValue(new Error('Conversion failed'))

    renderViewer()

    expect(await screen.findByRole('alert')).toHaveTextContent('Conversion failed')

    const downloadButton = screen.getByRole('button', { name: 'Scarica file' })
    downloadButton.click()

    await waitFor(() => {
      expect(downloadAttachment).toHaveBeenCalledWith(item)
    })
  })

  it('renders image attachments', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        attachments: [attachment({ name: 'photo.png', type: 'image/png' })],
      }),
    )

    renderViewer()

    const image = await screen.findByRole('img', { name: 'photo.png' })
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(image).toHaveAttribute('src', 'blob:preview')
  })

  it('shows a download fallback for unsupported attachments', async () => {
    const item = attachment({ name: 'bundle.zip', type: 'application/zip' })
    getEsame.mockResolvedValue(makeExam({ attachments: [item] }))

    renderViewer()

    expect(await screen.findByRole('alert')).toHaveTextContent('Anteprima non disponibile per questo file.')

    const downloadButton = screen.getByRole('button', { name: 'Scarica file' })
    downloadButton.click()

    await waitFor(() => {
      expect(downloadAttachment).toHaveBeenCalledWith(item)
    })
  })
})
