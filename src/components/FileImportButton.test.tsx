import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileService } from '../services/fileService'
import { FileImportButton } from './FileImportButton'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

vi.mock('../services/fileService', () => ({
  fileService: {
    pickFile: vi.fn(),
  },
}))

describe('FileImportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('imports a picked file', async () => {
    vi.mocked(fileService.pickFile).mockResolvedValue({
      data: new ArrayBuffer(1),
      name: 'quiz.json',
      type: 'application/json',
    })
    const onFile = vi.fn().mockResolvedValue(undefined)

    render(<FileImportButton label="Importa" accept={['.json']} onFile={onFile} />)
    fireEvent.click(screen.getByRole('button', { name: 'Importa' }))

    await waitFor(() => {
      expect(onFile).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'quiz.json', 'application/json')
    })
  })

  it('suppresses cancelled selection errors', async () => {
    vi.mocked(fileService.pickFile).mockRejectedValue(new Error('Selezione annullata'))

    render(<FileImportButton label="Importa" accept={['.json']} onFile={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Importa' }))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  it('shows an inline error when file picking fails', async () => {
    vi.mocked(fileService.pickFile).mockRejectedValue(new Error('schema mancante'))

    render(<FileImportButton label="Importa" accept={['.json']} onFile={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Importa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('File non valido: schema mancante')
  })

  it('shows validation errors from import handling', async () => {
    vi.mocked(fileService.pickFile).mockResolvedValue({
      data: new ArrayBuffer(1),
      name: 'quiz.json',
      type: 'application/json',
    })

    render(
      <FileImportButton
        label="Importa"
        accept={['.json']}
        onFile={() => Promise.reject(new Error('schema mancante'))}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Importa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('File non valido: schema mancante')
  })
})
