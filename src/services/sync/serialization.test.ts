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
})
