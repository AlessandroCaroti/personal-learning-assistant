import { afterEach, describe, expect, it, vi } from 'vitest'

type FilePickerOptions = {
  types: string[]
  multiple: boolean
  readData: boolean
}

type FilePickerResult = {
  files: Array<{
    name?: string
    mimeType?: string
    data?: string
  }>
}

type FilePickerMock = {
  pickFiles: (options: FilePickerOptions) => Promise<FilePickerResult>
}

type WindowWithOpenFilePicker = Window &
  typeof globalThis & {
    showOpenFilePicker?: (options: unknown) => Promise<Array<{ getFile: () => Promise<File> }>>
  }

async function freshFileService(isNative: boolean, filePicker?: FilePickerMock) {
  vi.resetModules()
  vi.doMock('@capacitor/core', () => ({
    Capacitor: {
      isNativePlatform: () => isNative,
    },
  }))

  if (filePicker) {
    vi.doMock('@capawesome/capacitor-file-picker', () => ({
      FilePicker: filePicker,
    }))
  }

  return import('./fileService')
}

describe('fileService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete (window as WindowWithOpenFilePicker).showOpenFilePicker
  })

  it('uses File System Access API in browser when available', async () => {
    const file = new File(['hello'], 'notes.pdf', { type: 'application/pdf' })
    const showOpenFilePicker = vi.fn(async () => [
      {
        getFile: async () => file,
      },
    ])
    ;(window as WindowWithOpenFilePicker).showOpenFilePicker = showOpenFilePicker

    const { fileService } = await freshFileService(false)

    const picked = await fileService.pickFile(['.pdf'])

    expect(showOpenFilePicker).toHaveBeenCalledWith({
      types: [
        {
          description: 'Files',
          accept: {
            'application/pdf': ['.pdf'],
          },
        },
      ],
      multiple: false,
    })
    expect(picked.name).toBe('notes.pdf')
    expect(picked.type).toBe('application/pdf')
    expect(new TextDecoder().decode(picked.data)).toBe('hello')
  })

  it('uses Capacitor file picker in native mode and decodes base64 data', async () => {
    const pickFiles = vi.fn(async () => ({
      files: [
        {
          name: 'quiz.json',
          mimeType: 'application/json',
          data: btoa('{"ok":true}'),
        },
      ],
    }))

    const { fileService } = await freshFileService(true, { pickFiles })

    const picked = await fileService.pickFile(['.json'])

    expect(pickFiles).toHaveBeenCalledWith({
      types: ['.json'],
      multiple: false,
      limit: 1,
      readData: true,
    })
    expect(picked.name).toBe('quiz.json')
    expect(picked.type).toBe('application/json')
    expect(new TextDecoder().decode(picked.data)).toBe('{"ok":true}')
  })

  it('rejects native selections without readable data', async () => {
    const { fileService } = await freshFileService(true, {
      pickFiles: async () => ({
        files: [
          {
            name: 'empty.json',
            mimeType: 'application/json',
          },
        ],
      }),
    })

    await expect(fileService.pickFile(['.json'])).rejects.toThrow('Dati file mancanti')
  })
})
