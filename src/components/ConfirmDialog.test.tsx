import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

describe('ConfirmDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders nothing when open is false', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Elimina"
        message="Confermi?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.queryByText('Elimina')).toBeNull()
  })

  it('renders actions when open and calls their handlers', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <ConfirmDialog
        open
        title="Elimina"
        message="Confermi?"
        confirmLabel="Si"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Si' }))
    fireEvent.click(screen.getByRole('button', { name: 'No' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('focuses the confirm action when opened', () => {
    render(
      <ConfirmDialog
        open
        title="Elimina"
        message="Confermi?"
        confirmLabel="Si"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Si' }))
  })

  it('calls onCancel when Escape is pressed', () => {
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

  it('traps Tab and Shift+Tab inside the dialog', () => {
    render(
      <ConfirmDialog
        open
        title="Elimina"
        message="Confermi?"
        confirmLabel="Si"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const confirmButton = screen.getByRole('button', { name: 'Si' })
    const cancelButton = screen.getByRole('button', { name: 'No' })

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(cancelButton)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmButton)
  })
})
