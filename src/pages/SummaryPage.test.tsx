import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Esame, FileRecord } from '../types'

const getEsame = vi.fn()
const convertToHtml = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
}))

vi.mock('mammoth', () => ({
  convertToHtml,
}))

const { SummaryPage } = await import('./SummaryPage')

function encodeText(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function makeFile(name: string, type: string, data = encodeText('content')): FileRecord {
  return { name, type, data }
}

function makeExam(summary?: FileRecord): Esame {
  return {
    id: 'exam-1',
    name: 'Analisi 1',
    createdAt: '2026-06-01T08:00:00.000Z',
    files: summary ? { riassunto: summary } : {},
  }
}

function renderSummary(path = '/esame/exam-1/riassunto') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
        <Route path="/esame/:examId/riassunto" element={<SummaryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SummaryPage', () => {
  const createObjectURL = vi.fn()
  const revokeObjectURL = vi.fn()

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeExam(makeFile('summary.html', 'text/html')))
    convertToHtml.mockResolvedValue({ value: '<h1>DOCX summary</h1>' })
    createObjectURL.mockReturnValue('blob:summary-pdf')
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects to the exam dashboard when the summary is missing', async () => {
    getEsame.mockResolvedValue(makeExam())

    renderSummary()

    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('renders HTML summaries in an iframe srcDoc', async () => {
    const html = '<h1>Riassunto HTML</h1>'
    getEsame.mockResolvedValue(makeExam(makeFile('summary.html', 'text/html', encodeText(html))))

    renderSummary()

    const iframe = await screen.findByTitle('Riassunto')
    expect(iframe.getAttribute('srcdoc')).toContain('<base href="about:srcdoc">')
    expect(iframe.getAttribute('srcdoc')).toContain(html)
    expect(iframe.getAttribute('sandbox')).toBe('')
    expect(screen.getByRole('heading', { name: 'summary.html' })).not.toBeNull()
  })

  it('adds an about:srcdoc base tag so table-of-contents anchors stay inside the summary', async () => {
    const html =
      '<!DOCTYPE html><html><head><title>Riassunto</title></head><body><nav><a href="#section-1">Indice</a></nav><h2 id="section-1">Sezione</h2></body></html>'
    getEsame.mockResolvedValue(makeExam(makeFile('summary.html', 'text/html', encodeText(html))))

    renderSummary()

    const iframe = await screen.findByTitle('Riassunto')
    expect(iframe.getAttribute('srcdoc')).toContain('<base href="about:srcdoc">')
    expect(iframe.getAttribute('srcdoc')).toContain('<a href="#section-1">Indice</a>')
  })

  it('renders empty HTML summaries without staying on loading', async () => {
    getEsame.mockResolvedValue(makeExam(makeFile('empty.html', 'text/html', encodeText(''))))

    renderSummary()

    const iframe = await screen.findByTitle('Riassunto')
    expect(iframe.getAttribute('srcdoc')).toBe('<base href="about:srcdoc">')
    expect(screen.queryByText('Caricamento...')).toBeNull()
  })

  it('renders PDF summaries with a blob URL and revokes it on cleanup', async () => {
    getEsame.mockResolvedValue(
      makeExam(makeFile('summary.pdf', 'application/pdf', encodeText('%PDF-1.7'))),
    )

    const { unmount } = renderSummary()

    const iframe = await screen.findByTitle('Riassunto PDF')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(iframe.getAttribute('src')).toBe('blob:summary-pdf')
    expect(iframe.getAttribute('sandbox')).toBe('')

    unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:summary-pdf')
  })

  it('converts DOCX summaries with mammoth and renders the HTML result', async () => {
    const data = encodeText('docx-bytes')
    getEsame.mockResolvedValue(makeExam(makeFile('summary.docx', '', data)))
    convertToHtml.mockResolvedValue({ value: '<p>DOCX convertito</p>' })

    renderSummary()

    await waitFor(() => {
      expect(convertToHtml).toHaveBeenCalledWith({ arrayBuffer: data })
    })
    expect((await screen.findByTitle('Riassunto')).getAttribute('srcdoc')).toBe(
      '<base href="about:srcdoc"><p>DOCX convertito</p>',
    )
  })

  it('renders empty DOCX conversion results without staying on loading', async () => {
    const data = encodeText('docx-bytes')
    getEsame.mockResolvedValue(makeExam(makeFile('summary.docx', '', data)))
    convertToHtml.mockResolvedValue({ value: '' })

    renderSummary()

    await waitFor(() => {
      expect(convertToHtml).toHaveBeenCalledWith({ arrayBuffer: data })
    })

    const iframe = await screen.findByTitle('Riassunto')
    expect(iframe.getAttribute('srcdoc')).toBe('<base href="about:srcdoc">')
    expect(screen.queryByText('Caricamento...')).toBeNull()
  })

  it('shows an error for unsupported summary formats', async () => {
    getEsame.mockResolvedValue(makeExam(makeFile('summary.txt', 'text/plain')))

    renderSummary()

    expect((await screen.findByRole('alert')).textContent).toMatch(/non supportato/i)
  })

  it('shows an error when DOCX conversion fails', async () => {
    getEsame.mockResolvedValue(makeExam(makeFile('summary.docx', '')))
    convertToHtml.mockRejectedValue(new Error('conversion failed'))

    renderSummary()

    expect((await screen.findByRole('alert')).textContent).toMatch(/conversion failed/i)
  })
})
