import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'
import { DotNav } from './DotNav'
import { FileImportButton } from './FileImportButton'
import { ProgressBar } from './ProgressBar'
import { Timer } from './Timer'

vi.mock('../services/fileService', () => ({
  fileService: {
    pickFile: vi.fn(),
  },
}))

describe('base components', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('ConfirmDialog renders actions only when open', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { rerender } = render(
      <ConfirmDialog
        open={false}
        title="Elimina"
        message="Confermi?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(screen.queryByText('Elimina')).toBeNull()

    rerender(
      <ConfirmDialog
        open
        title="Elimina"
        message="Confermi?"
        confirmLabel="Sì"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sì' }))
    fireEvent.click(screen.getByRole('button', { name: 'No' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ConfirmDialog focuses the confirm action when opened', () => {
    render(
      <ConfirmDialog
        open
        title="Elimina"
        message="Confermi?"
        confirmLabel="Sì"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sì' }))
  })

  it('ConfirmDialog calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn()

    render(
      <ConfirmDialog
        open
        title="Elimina"
        message="Confermi?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ConfirmDialog traps Tab and Shift+Tab inside the dialog', () => {
    render(
      <ConfirmDialog
        open
        title="Elimina"
        message="Confermi?"
        confirmLabel="Sì"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const confirmButton = screen.getByRole('button', { name: 'Sì' })
    const cancelButton = screen.getByRole('button', { name: 'No' })

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(cancelButton)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmButton)
  })

  it('Timer shows remaining time and warns under one minute', () => {
    render(<Timer elapsed={30} remaining={59} />)

    const timer = screen.getByText('0:59')

    expect(timer.style.color).toBe('var(--danger)')
    expect(timer.style.fontWeight).toBe('700')
  })

  it('Timer falls back to elapsed time when remaining is null', () => {
    render(<Timer elapsed={90} remaining={null} />)

    expect(screen.getByText('1:30')).not.toBeNull()
  })

  it('ProgressBar exposes the expected percentage', () => {
    render(<ProgressBar current={2} total={4} />)

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')
  })

  it('ProgressBar clamps unexpected percentages to the 0 to 100 range', () => {
    const { rerender } = render(<ProgressBar current={6} total={4} />)

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')

    rerender(<ProgressBar current={-1} total={4} />)

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  it('DotNav renders selectable question dots', () => {
    const onSelect = vi.fn()

    render(
      <DotNav
        total={3}
        current={1}
        states={['unanswered', 'correct', 'wrong']}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Domanda 3, risposta errata' }))

    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('DotNav exposes status, current state, and a larger hit target', () => {
    render(
      <DotNav
        total={4}
        current={1}
        states={['unanswered', 'selected', 'correct', 'wrong']}
        onSelect={vi.fn()}
      />,
    )

    const unanswered = screen.getByRole('button', {
      name: 'Domanda 1, non risposta',
    })
    const selectedCurrent = screen.getByRole('button', {
      name: 'Domanda 2, corrente, risposta selezionata',
    })
    const correct = screen.getByRole('button', {
      name: 'Domanda 3, risposta corretta',
    })
    const wrong = screen.getByRole('button', {
      name: 'Domanda 4, risposta errata',
    })

    expect(selectedCurrent.getAttribute('aria-current')).toBe('step')
    expect(unanswered.style.width).toBe('44px')
    expect(unanswered.style.height).toBe('44px')
    expect(correct).not.toBeNull()
    expect(wrong).not.toBeNull()
  })

  it('ThemeToggle toggles the store theme', async () => {
    vi.resetModules()
    const { ThemeToggle: FreshThemeToggle } = await import('./ThemeToggle')

    render(<FreshThemeToggle />)

    fireEvent.click(screen.getByTitle('Cambia tema'))

    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('FileImportButton imports a picked file', async () => {
    const { fileService } = await import('../services/fileService')
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

  it('FileImportButton suppresses cancelled selection errors', async () => {
    const { fileService } = await import('../services/fileService')
    vi.mocked(fileService.pickFile).mockRejectedValue(new Error('Selezione annullata'))

    render(<FileImportButton label="Importa" accept={['.json']} onFile={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Importa' }))

    await waitFor(() => {
      expect(screen.queryByText(/File non valido/)).toBeNull()
    })
  })

  it('FileImportButton shows validation errors from import handling', async () => {
    const { fileService } = await import('../services/fileService')
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

    expect(await screen.findByText('File non valido: schema mancante')).not.toBeNull()
  })
})
