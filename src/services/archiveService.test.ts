import { describe, expect, it, vi, afterEach } from 'vitest'
import { makeExamAttachment } from '../__tests__/factories'
import {
  createExamAttachment,
  downloadAttachment,
  removeExamAttachment,
  sortAttachmentsNewestFirst,
} from './archiveService'

describe('archiveService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createExamAttachment', () => {
    const data = new TextEncoder().encode('attachment').buffer

    const attachment = createExamAttachment({
      id: 'attachment-2',
      createdAt: '2026-06-13T12:00:00.000Z',
      name: 'summary.pdf',
      type: 'application/pdf',
      data,
    })

    expect(attachment).toEqual({
      id: 'attachment-2',
      createdAt: '2026-06-13T12:00:00.000Z',
      name: 'summary.pdf',
      type: 'application/pdf',
      data,
    })
  })

  it('sortAttachmentsNewestFirst', () => {
    const older = makeExamAttachment({
      id: 'older',
      createdAt: '2026-06-01T08:00:00.000Z',
    })
    const newer = makeExamAttachment({
      id: 'newer',
      createdAt: '2026-06-12T08:00:00.000Z',
    })
    const original = [older, newer]

    const sorted = sortAttachmentsNewestFirst(original)

    expect(sorted).toEqual([newer, older])
    expect(original).toEqual([older, newer])
  })

  it('removeExamAttachment', () => {
    const first = makeExamAttachment({ id: 'first' })
    const second = makeExamAttachment({ id: 'second' })

    const remaining = removeExamAttachment([first, second], 'first')

    expect(remaining).toEqual([second])
  })

  it('downloadAttachment creates a blob URL, sets href and download, clicks, and revokes the URL', () => {
    const attachment = makeExamAttachment({
      name: 'summary.pdf',
      type: 'application/pdf',
    })
    const createObjectURL = vi.fn(() => 'blob:attachment')
    const revokeObjectURL = vi.fn()
    const anchor = document.createElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    const remove = vi.spyOn(anchor, 'remove').mockImplementation(() => {})
    const appendChild = vi.spyOn(document.body, 'appendChild')
    const originalCreateElement = document.createElement.bind(document)
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return anchor
      }

      return originalCreateElement(tagName)
    })

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })

    downloadAttachment(attachment)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(createElement).toHaveBeenCalledWith('a')
    expect(appendChild).toHaveBeenCalledOnce()
    expect(appendChild.mock.calls[0][0]).toBe(anchor)
    expect(anchor.href).toContain('blob:attachment')
    expect(anchor.download).toBe('summary.pdf')
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:attachment')
  })
})
