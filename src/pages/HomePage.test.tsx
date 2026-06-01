import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Esame } from '../types'

const createEsame = vi.fn()
const renameEsame = vi.fn()
const deleteEsame = vi.fn()

let hookState: {
  esami: Esame[]
  loading: boolean
}

vi.mock('../hooks/useExam', () => ({
  useExam: () => ({
    ...hookState,
    createEsame,
    renameEsame,
    deleteEsame,
    reload: vi.fn(),
  }),
}))

const { HomePage } = await import('./HomePage')

const exam: Esame = {
  id: 'exam-1',
  name: 'Diritto privato',
  createdAt: '2026-06-01T08:00:00.000Z',
  files: {},
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    hookState = {
      esami: [exam],
      loading: false,
    }
    createEsame.mockResolvedValue({
      id: 'exam-new',
      name: 'Analisi',
      createdAt: '2026-06-01T09:00:00.000Z',
      files: {},
    })
    renameEsame.mockResolvedValue(undefined)
    deleteEsame.mockResolvedValue(undefined)
  })

  it('shows loading and empty states', () => {
    hookState = { esami: [], loading: true }
    const { rerender } = renderHome()

    expect(screen.getByText('Caricamento…')).not.toBeNull()

    hookState = { esami: [], loading: false }
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Nessun esame ancora. Creane uno per iniziare!')).not.toBeNull()
  })

  it('creates a non-blank exam with Enter and navigates to it', async () => {
    renderHome()

    fireEvent.click(screen.getByRole('button', { name: '+ Nuovo esame' }))
    const input = screen.getByPlaceholderText('Nome esame…')
    const createButton = screen.getByRole('button', { name: 'Crea esame' })

    expect(createButton).toHaveProperty('disabled', true)

    fireEvent.change(input, { target: { value: '  Analisi  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(createEsame).toHaveBeenCalledWith('  Analisi  ')
    })
    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('navigates when clicking an exam', async () => {
    renderHome()

    fireEvent.click(screen.getByRole('button', { name: 'Apri esame Diritto privato' }))

    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('renames inline with Enter and cancels with Escape', async () => {
    renderHome()

    fireEvent.click(screen.getByRole('button', { name: 'Azioni per Diritto privato' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rinomina' }))

    const input = screen.getByDisplayValue('Diritto privato')
    fireEvent.change(input, { target: { value: 'Diritto commerciale' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(renameEsame).toHaveBeenCalledWith('exam-1', 'Diritto commerciale')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Azioni per Diritto privato' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rinomina' }))
    fireEvent.keyDown(screen.getByDisplayValue('Diritto privato'), { key: 'Escape' })

    expect(screen.queryByDisplayValue('Diritto privato')).toBeNull()
  })

  it('confirms dangerous delete before deleting an exam', async () => {
    renderHome()

    fireEvent.click(screen.getByRole('button', { name: 'Azioni per Diritto privato' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Elimina' }))

    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(
      screen.getByText(/sessioni e statistiche associate verranno eliminate/i),
    ).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Elimina esame' }))

    await waitFor(() => {
      expect(deleteEsame).toHaveBeenCalledWith('exam-1')
    })
  })
})
