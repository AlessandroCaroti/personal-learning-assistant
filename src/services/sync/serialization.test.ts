import { describe, expect, it } from 'vitest'
import type { FileRecord } from '../../types'
import { decodeFileRecord, encodeFileRecord } from './serialization'

function fileRecord(): FileRecord {
  const bytes = new TextEncoder().encode('quiz payload')
  return {
    name: 'quiz.json',
    type: 'application/json',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
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
