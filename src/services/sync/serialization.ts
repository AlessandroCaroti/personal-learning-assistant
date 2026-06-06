import type { FileRecord } from '../../types'
import type { EncodedFileRecord } from './types'

const BASE64_CHUNK_SIZE = 0x8000

export function arrayBufferToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  const binaryChunks: string[] = []

  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binaryChunks.push(String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK_SIZE)))
  }

  return btoa(binaryChunks.join(''))
}

export function base64ToArrayBuffer(dataBase64: string): ArrayBuffer {
  const binary = atob(dataBase64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

export function encodeFileRecord(file: FileRecord): EncodedFileRecord {
  return {
    name: file.name,
    type: file.type,
    dataBase64: arrayBufferToBase64(file.data),
  }
}

export function decodeFileRecord(file: EncodedFileRecord): FileRecord {
  return {
    name: file.name,
    type: file.type,
    data: base64ToArrayBuffer(file.dataBase64),
  }
}
