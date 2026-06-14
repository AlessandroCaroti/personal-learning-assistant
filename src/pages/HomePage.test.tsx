import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Esame } from '../types'

const createEsame = vi.fn()
const renameEsame = vi.fn()
const deleteEsame = vi.fn()
const syncSignIn = vi.fn()
const syncSignOut = vi.fn()
const syncNow = vi.fn()
const resolveConflict = vi.fn()
const reloadEsami = vi.fn()
const pickFile = vi.fn()
const restoreExamBackupArchive = vi.fn()
const saveImportedExamBackupBundle = vi.fn()
const uuidv4 = vi.fn()
let pickedBackupData: ArrayBuffer

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
    reload: reloadEsami,
  }),
}))

vi.mock('../hooks/useSync', () => ({
  useSync: () => ({
    status: {
      kind: 'signed-out',
      account: null,
      lastSyncedAt: null,
      pendingChanges: false,
      message: null,
      conflicts: [],
    },
    signIn: syncSignIn,
    signOut: syncSignOut,
    syncNow,
    resolveConflict,
  }),
}))

vi.mock('../services/fileService', () => ({
  fileService: {
    pickFile,
  },
}))

vi.mock('../services/examBackupService', () => ({
  BACKUP_ARCHIVE_EXTENSION: '.pla-exam-backup',
  restoreExamBackupArchive,
}))

vi.mock('../services/storageService', () => ({
  saveImportedExamBackupBundle,
}))

vi.mock('uuid', () => ({
  v4: uuidv4,
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
    syncSignIn.mockResolvedValue(undefined)
    syncSignOut.mockResolvedValue(undefined)
    syncNow.mockResolvedValue(undefined)
    resolveConflict.mockResolvedValue(undefined)
    reloadEsami.mockResolvedValue(undefined)
    uuidv4.mockReturnValue('restored-exam-id')
    pickedBackupData = new TextEncoder().encode('backup').buffer
    pickFile.mockResolvedValue({
      name: 'diritto.pla-exam-backup',
      type: 'application/zip',
      data: pickedBackupData,
    })
    restoreExamBackupArchive.mockResolvedValue({
      exam: {
        id: 'restored-exam-id',
        name: 'Diritto privato',
        createdAt: '2026-06-01T08:00:00.000Z',
        files: {},
        attachments: [],
      },
      quizSessions: [],
      questionStats: [],
      flashcardStats: [],
      pausedSessions: [],
    })
    saveImportedExamBackupBundle.mockResolvedValue(undefined)
  })

  it('shows loading and empty states', () => {
    hookState = { esami: [], loading: true }
    const { rerender } = renderHome()

    expect(screen.getByText('Caricamento…')).not.toBeNull()
    expect(screen.getByLabelText('Sincronizzazione')).not.toBeNull()

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

  it('reloads exams after Google Drive sign-in sync completes', async () => {
    renderHome()

    fireEvent.click(screen.getByRole('button', { name: 'Accedi a Google Drive' }))

    await waitFor(() => {
      expect(syncSignIn).toHaveBeenCalled()
    })
    expect(reloadEsami).toHaveBeenCalled()
  })

  it('imports a backup as a new exam and navigates to it', async () => {
    renderHome()

    fireEvent.click(screen.getByRole('button', { name: 'Importa backup' }))

    await waitFor(() => {
      expect(pickFile).toHaveBeenCalledWith(['.pla-exam-backup'])
    })
    const [archiveData, restoredExamId] = restoreExamBackupArchive.mock.calls[0]
    expect(archiveData).toBe(pickedBackupData)
    expect(restoredExamId).toBe('restored-exam-id')
    expect(saveImportedExamBackupBundle).toHaveBeenCalledWith({
      exam: {
        id: 'restored-exam-id',
        name: 'Diritto privato',
        createdAt: '2026-06-01T08:00:00.000Z',
        files: {},
        attachments: [],
      },
      quizSessions: [],
      questionStats: [],
      flashcardStats: [],
      pausedSessions: [],
    })
    expect(reloadEsami).toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Dashboard esame' })).not.toBeNull()
  })

  it('shows a validation error when backup import fails', async () => {
    restoreExamBackupArchive.mockRejectedValue(
      new Error('Backup non valido: manifest.json mancante'),
    )

    renderHome()

    fireEvent.click(screen.getByRole('button', { name: 'Importa backup' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Backup non valido: manifest.json mancante',
    )
    expect(saveImportedExamBackupBundle).not.toHaveBeenCalled()
    expect(reloadEsami).not.toHaveBeenCalled()
  })

  it('imports a same-name backup as a distinct new exam id', async () => {
    hookState = {
      esami: [
        exam,
        {
          id: 'existing-same-name',
          name: 'Diritto privato',
          createdAt: '2026-06-02T08:00:00.000Z',
          files: {},
        },
      ],
      loading: false,
    }

    renderHome()

    fireEvent.click(screen.getByRole('button', { name: 'Importa backup' }))

    await waitFor(() => {
      expect(restoreExamBackupArchive).toHaveBeenCalled()
    })
    const [archiveData, restoredExamId] = restoreExamBackupArchive.mock.calls[0]
    expect(archiveData).toBe(pickedBackupData)
    expect(restoredExamId).toBe('restored-exam-id')
    expect(saveImportedExamBackupBundle.mock.calls[0][0].exam).toMatchObject({
      id: 'restored-exam-id',
      name: 'Diritto privato',
    })
  })
})
