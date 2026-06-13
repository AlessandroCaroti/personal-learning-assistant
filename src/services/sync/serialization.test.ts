import { describe, expect, it } from 'vitest'
import type { ExamAttachment, FileRecord } from '../../types'
import {
  decodeExamAttachment,
  decodeFileRecord,
  encodeExamAttachment,
  encodeFileRecord,
} from './serialization'

function fileRecord(): FileRecord {
  const bytes = new TextEncoder().encode('quiz payload')
  return {
    name: 'quiz.json',
    type: 'application/json',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}

function attachment(): ExamAttachment {
  const bytes = new TextEncoder().encode('attachment payload')
  return {
    id: 'attachment-1',
    name: 'slides.pdf',
    type: 'application/pdf',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    createdAt: '2026-06-13T09:00:00.000Z',
  }
}

describe('sync serialization', () => {
  it('round-trips file records through base64 payloads', () => {
    const encoded = encodeFileRecord(fileRecord())
    const decoded = decodeFileRecord(encoded)

    expect(encoded).toEqual({
      name: 'quiz.json',
      type: 'application/json',
      dataBase64: 'cXVpeiBwYXlsb2Fk',
    })
    expect(decoded.name).toBe('quiz.json')
    expect(decoded.type).toBe('application/json')
    expect(new TextDecoder().decode(decoded.data)).toBe('quiz payload')
  })

  it('round-trips exam attachments through base64 payloads', () => {
    const encoded = encodeExamAttachment(attachment())
    const decoded = decodeExamAttachment(encoded)

    expect(encoded).toEqual({
      id: 'attachment-1',
      name: 'slides.pdf',
      type: 'application/pdf',
      dataBase64: 'YXR0YWNobWVudCBwYXlsb2Fk',
      createdAt: '2026-06-13T09:00:00.000Z',
    })
    expect(decoded.id).toBe('attachment-1')
    expect(decoded.name).toBe('slides.pdf')
    expect(decoded.type).toBe('application/pdf')
    expect(decoded.createdAt).toBe('2026-06-13T09:00:00.000Z')
    expect(new TextDecoder().decode(decoded.data)).toBe('attachment payload')
  })

  it('round-trips empty file records', () => {
    const encoded = encodeFileRecord({
      name: 'empty.bin',
      type: 'application/octet-stream',
      data: new ArrayBuffer(0),
    })
    const decoded = decodeFileRecord(encoded)

    expect(encoded).toEqual({
      name: 'empty.bin',
      type: 'application/octet-stream',
      dataBase64: '',
    })
    expect(decoded.name).toBe('empty.bin')
    expect(decoded.type).toBe('application/octet-stream')
    expect(decoded.data.byteLength).toBe(0)
  })

  it('round-trips arbitrary binary bytes', () => {
    const bytes = new Uint8Array([0x00, 0x80, 0xff, 0x41])
    const encoded = encodeFileRecord({
      name: 'binary.dat',
      type: 'application/octet-stream',
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    })
    const decoded = decodeFileRecord(encoded)

    expect(encoded).toEqual({
      name: 'binary.dat',
      type: 'application/octet-stream',
      dataBase64: 'AID/QQ==',
    })
    expect(Array.from(new Uint8Array(decoded.data))).toEqual([0x00, 0x80, 0xff, 0x41])
  })
})
