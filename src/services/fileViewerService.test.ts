import { describe, expect, it } from 'vitest'
import type { ExamAttachment } from '../types'
import { getPreviewKind, isPreviewSupported, prepareHtmlForIframe } from './fileViewerService'

function attachment(name: string, type = ''): ExamAttachment {
  return {
    id: name,
    name,
    type,
    data: new ArrayBuffer(0),
    createdAt: '2026-06-13T09:00:00.000Z',
  }
}

describe('fileViewerService', () => {
  it.each([
    [attachment('notes.pdf', 'application/pdf'), 'pdf'],
    [attachment('notes.docx', ''), 'docx'],
    [attachment('notes.html', 'text/html'), 'html'],
    [attachment('notes.txt', 'text/plain'), 'text'],
    [attachment('notes.md', 'text/markdown'), 'markdown'],
    [attachment('photo.png', 'image/png'), 'image'],
    [attachment('photo.jpeg', ''), 'image'],
    [attachment('archive.zip', 'application/zip'), 'unsupported'],
  ] as const)('detects preview kind for %s', (file, expected) => {
    expect(getPreviewKind(file)).toBe(expected)
    expect(isPreviewSupported(file)).toBe(expected !== 'unsupported')
  })

  it('adds an about:srcdoc base tag to HTML without a head tag', () => {
    expect(prepareHtmlForIframe('<h1>Document</h1>')).toBe(
      '<base href="about:srcdoc"><h1>Document</h1>',
    )
  })

  it('adds an about:srcdoc base tag inside an existing head tag', () => {
    expect(prepareHtmlForIframe('<html><head><title>T</title></head><body></body></html>')).toBe(
      '<html><head><base href="about:srcdoc"><title>T</title></head><body></body></html>',
    )
  })
})
