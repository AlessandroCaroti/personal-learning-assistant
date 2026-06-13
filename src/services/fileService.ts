import { Capacitor } from '@capacitor/core'
import type { PickFilesOptions } from '@capawesome/capacitor-file-picker'

export interface PickedFile {
  name: string
  type: string
  data: ArrayBuffer
}

export interface FileService {
  pickFile(accept: string[]): Promise<PickedFile>
}

type FileSystemFileHandle = {
  getFile(): Promise<File>
}

type FilePickerAcceptType = {
  description: string
  accept: Record<string, string[]>
}

type FilePickerOptions = {
  types?: FilePickerAcceptType[]
  multiple: false
}

type WindowWithFilePicker = Window &
  typeof globalThis & {
    showOpenFilePicker?: (options: FilePickerOptions) => Promise<FileSystemFileHandle[]>
  }

type CapacitorPickedFile = {
  name?: string
  mimeType?: string
  data?: string
}

type CapacitorFilePickerResult = {
  files?: CapacitorPickedFile[]
}

const NATIVE_MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.htm': 'text/html',
  '.html': 'text/html',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
}

function acceptFiltersFromExtensions(accept: string[]): FilePickerAcceptType[] {
  return [
    {
      description: 'Files',
      accept: Object.fromEntries(
        accept.map((extension) => [
          `application/${extension.replace(/^\./, '')}`,
          [extension],
        ]),
      ),
    },
  ]
}

function nativeMimeTypesFromExtensions(accept: string[]): string[] {
  return [
    ...new Set(
      accept
        .map((extension) => NATIVE_MIME_TYPES_BY_EXTENSION[extension.toLowerCase()])
        .filter((mimeType): mimeType is string => Boolean(mimeType)),
    ),
  ]
}

async function pickFileBrowser(accept: string[]): Promise<PickedFile> {
  const filePickerWindow = window as WindowWithFilePicker

  if (filePickerWindow.showOpenFilePicker) {
    const options: FilePickerOptions = { multiple: false }

    if (accept.length > 0) {
      options.types = acceptFiltersFromExtensions(accept)
    }

    const [fileHandle] = await filePickerWindow.showOpenFilePicker(options)
    const file = await fileHandle.getFile()
    const data = await file.arrayBuffer()
    return { name: file.name, type: file.type, data }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')

    function cleanup() {
      input.remove()
    }

    input.type = 'file'
    input.accept = accept.join(',')
    input.style.display = 'none'

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      cleanup()

      if (!file) {
        reject(new Error('Nessun file selezionato'))
        return
      }

      file
        .arrayBuffer()
        .then((data) => resolve({ name: file.name, type: file.type, data }))
        .catch((error: unknown) => reject(error))
    })

    input.addEventListener('cancel', () => {
      cleanup()
      reject(new Error('Selezione annullata'))
    })

    document.body.appendChild(input)
    input.click()
  })
}

function base64ToArrayBuffer(data: string): ArrayBuffer {
  const base64 = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}

async function pickFileCapacitor(accept: string[]): Promise<PickedFile> {
  const { FilePicker } = await import('@capawesome/capacitor-file-picker')
  const nativeTypes = nativeMimeTypesFromExtensions(accept)
  const options: PickFilesOptions = {
    limit: 1,
    readData: true,
  }

  if (nativeTypes.length > 0) {
    options.types = nativeTypes
  }

  const result = (await FilePicker.pickFiles(options)) as CapacitorFilePickerResult
  const file = result.files?.[0]

  if (!file) {
    throw new Error('Nessun file selezionato')
  }

  if (!file.data) {
    throw new Error('Dati file mancanti')
  }

  return {
    name: file.name ?? '',
    type: file.mimeType ?? '',
    data: base64ToArrayBuffer(file.data),
  }
}

export const fileService: FileService = Capacitor.isNativePlatform()
  ? { pickFile: pickFileCapacitor }
  : { pickFile: pickFileBrowser }
