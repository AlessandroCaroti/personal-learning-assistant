# Exam Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple per-exam archive for additional files, with dashboard preview, a full archive page, supported inline previews, and download/export fallback.

**Architecture:** Store archive entries as first-class `ExamAttachment` objects embedded in each `Esame` record. Keep the existing fixed `files` slots unchanged, add small archive/viewer helpers for shared behavior, and route archive UI through `/esame/:examId/archivio` plus `/esame/:examId/file/:fileId`.

**Tech Stack:** React 18, TypeScript, Vite, React Router, IndexedDB via `idb`, Vitest, React Testing Library, `mammoth` for DOCX conversion.

---

## File Structure

- Modify `src/types/index.ts`: add `ExamAttachment` and make `Esame.attachments` optional for backward compatibility.
- Modify `src/__tests__/factories.ts`: add `makeExamAttachment()` and default `makeEsame()` to `attachments: []`.
- Modify `src/services/sync/types.ts`: add encoded attachment shape to remote exam sync records.
- Modify `src/services/sync/serialization.ts`: add encode/decode helpers for attachments.
- Modify `src/services/sync/serialization.test.ts`: cover attachment round-trip behavior.
- Modify `src/services/storageService.ts`: normalize old exams, export/import attachments through sync, and keep existing DB version unchanged.
- Modify `src/services/storageService.test.ts`: cover missing attachments, persisted attachments, sync export, and sync import.
- Modify `src/services/fileService.ts`: allow unfiltered any-file selection through `pickFile([])`.
- Modify `src/services/fileService.test.ts`: cover browser/native any-file picker options.
- Create `src/services/archiveService.ts`: pure helpers for attachment creation, sorting, removal, supported-preview detection, and browser download.
- Create `src/services/archiveService.test.ts`: unit tests for archive helper behavior.
- Create `src/services/fileViewerService.ts`: pure helpers for preview-kind detection and HTML iframe preparation.
- Create `src/services/fileViewerService.test.ts`: unit tests for viewer decisions.
- Modify `src/pages/DashboardPage.tsx`: add archive dashboard card and upload flow.
- Modify `src/pages/DashboardPage.test.tsx`: cover archive card states and upload/navigation behavior.
- Create `src/pages/ArchivePage.tsx`: full archive list with add/open/download/delete actions.
- Create `src/pages/ArchivePage.test.tsx`: cover list, add, delete, supported/unsupported actions.
- Create `src/pages/FileViewerPage.tsx`: generic archive attachment viewer.
- Create `src/pages/FileViewerPage.test.tsx`: cover PDF, DOCX, HTML, text, markdown, image, unsupported, and missing attachment behavior.
- Modify `src/pages/SummaryPage.tsx`: reuse `prepareHtmlForIframe` from `fileViewerService`.
- Modify `src/App.tsx`: add archive and file viewer routes.

---

### Task 1: Types, Factories, And Serialization Helpers

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/__tests__/factories.ts`
- Modify: `src/services/sync/types.ts`
- Modify: `src/services/sync/serialization.ts`
- Test: `src/services/sync/serialization.test.ts`

- [ ] **Step 1: Write failing serialization tests for archive attachments**

Add this import update in `src/services/sync/serialization.test.ts`:

```ts
import type { ExamAttachment, FileRecord } from '../../types'
import {
  decodeExamAttachment,
  decodeFileRecord,
  encodeExamAttachment,
  encodeFileRecord,
} from './serialization'
```

Add this helper after `fileRecord()`:

```ts
function attachment(): ExamAttachment {
  const bytes = new TextEncoder().encode('attachment payload')

  return {
    id: 'attachment-1',
    name: 'slides.pdf',
    type: 'application/pdf',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    createdAt: '2026-06-13T09:00:00.000Z',
  }
}
```

Add this test inside `describe('sync serialization', () => { ... })`:

```ts
it('round-trips exam attachments through base64 payloads', () => {
  const encoded = encodeExamAttachment(attachment())
  const decoded = decodeExamAttachment(encoded)

  expect(encoded).toEqual({
    id: 'attachment-1',
    name: 'slides.pdf',
    type: 'application/pdf',
    dataBase64: 'YXR0YWNobWVudCBwYXlsb2Fk',
    createdAt: '2026-06-13T09:00:00.000Z',
  })
  expect(decoded.id).toBe('attachment-1')
  expect(decoded.name).toBe('slides.pdf')
  expect(decoded.type).toBe('application/pdf')
  expect(decoded.createdAt).toBe('2026-06-13T09:00:00.000Z')
  expect(new TextDecoder().decode(decoded.data)).toBe('attachment payload')
})
```

- [ ] **Step 2: Run the serialization test to verify it fails**

Run:

```bash
npm run test -- src/services/sync/serialization.test.ts --run
```

Expected: FAIL because `encodeExamAttachment` and `decodeExamAttachment` are not exported.

- [ ] **Step 3: Add the attachment type**

Modify `src/types/index.ts` so the top section becomes:

```ts
export interface Esame {
  id: string
  name: string
  createdAt: string
  files: {
    riassunto?: FileRecord
    quiz?: FileRecord
    flashcard?: FileRecord
  }
  attachments?: ExamAttachment[]
}

export interface FileRecord {
  name: string
  type: string
  data: ArrayBuffer
}

export interface ExamAttachment extends FileRecord {
  id: string
  createdAt: string
}
```

- [ ] **Step 4: Add test factory support**

Modify the import in `src/__tests__/factories.ts`:

```ts
import type {
  Esame,
  ExamAttachment,
  FlashCard,
  FlashcardFile,
  PausedSession,
  QuizDomanda,
  QuizFile,
  QuizSession,
} from '../types'
```

Add this helper before `makeEsame()`:

```ts
export const makeExamAttachment = (
  overrides: Partial<ExamAttachment> = {},
): ExamAttachment => {
  const bytes = new TextEncoder().encode('attachment')

  return {
    id: 'attachment-1',
    name: 'attachment.pdf',
    type: 'application/pdf',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    createdAt: DEFAULT_DATE,
    ...overrides,
  }
}
```

Update `makeEsame()`:

```ts
export const makeEsame = (overrides: Partial<Esame> = {}): Esame => ({
  id: 'exam-1',
  name: 'Esame di Test',
  createdAt: DEFAULT_DATE,
  files: {},
  attachments: [],
  ...overrides,
})
```

- [ ] **Step 5: Add sync attachment types**

Modify the import in `src/services/sync/types.ts`:

```ts
import type {
  CardEval,
  Esame,
  ExamAttachment,
  FileRecord,
  FlashcardStats,
  QuestionStats,
  QuizSession,
} from '../../types'
```

Add this interface after `EncodedFileRecord`:

```ts
export interface EncodedExamAttachment extends Omit<ExamAttachment, 'data'> {
  dataBase64: string
}
```

Update `SyncExamRecord`:

```ts
export interface SyncExamRecord extends Omit<Esame, 'files' | 'attachments'> {
  files: Partial<Record<SyncFileSlot, EncodedFileRecord>>
  attachments: EncodedExamAttachment[]
  updatedAt: string
  updatedByDeviceId: string
}
```

- [ ] **Step 6: Implement serialization helpers**

Modify the imports in `src/services/sync/serialization.ts`:

```ts
import type { ExamAttachment, FileRecord } from '../../types'
import type { EncodedExamAttachment, EncodedFileRecord } from './types'
```

Add these helpers after `decodeFileRecord()`:

```ts
export function encodeExamAttachment(attachment: ExamAttachment): EncodedExamAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    type: attachment.type,
    dataBase64: arrayBufferToBase64(attachment.data),
    createdAt: attachment.createdAt,
  }
}

export function decodeExamAttachment(attachment: EncodedExamAttachment): ExamAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    type: attachment.type,
    data: base64ToArrayBuffer(attachment.dataBase64),
    createdAt: attachment.createdAt,
  }
}
```

- [ ] **Step 7: Run the serialization test to verify it passes**

Run:

```bash
npm run test -- src/services/sync/serialization.test.ts --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/types/index.ts src/__tests__/factories.ts src/services/sync/types.ts src/services/sync/serialization.ts src/services/sync/serialization.test.ts
git commit -m "feat: add exam attachment sync types"
```

---

### Task 2: Storage And Sync Compatibility

**Files:**
- Modify: `src/services/storageService.ts`
- Test: `src/services/storageService.test.ts`

- [ ] **Step 1: Write failing storage tests for attachments**

Update the imports in `src/services/storageService.test.ts`:

```ts
import type { Esame, ExamAttachment, FileRecord, FlashcardStats, QuestionStats } from '../types'
```

Add this helper after `fileRecord()`:

```ts
function attachmentRecord(overrides: Partial<ExamAttachment> = {}): ExamAttachment {
  const bytes = new TextEncoder().encode(overrides.name ?? 'archive.pdf')

  return {
    id: 'attachment-1',
    name: 'archive.pdf',
    type: 'application/pdf',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    createdAt: '2026-06-13T09:00:00.000Z',
    ...overrides,
  }
}
```

Add this test near the basic exam CRUD tests:

```ts
it('persists exam attachments without changing study file slots', async () => {
  const attachment = attachmentRecord()
  const examWithAttachment: Esame = {
    ...exam,
    files: {
      quiz: fileRecord('quiz.json'),
    },
    attachments: [attachment],
  }

  await saveEsame(examWithAttachment)

  await expect(getEsame(exam.id)).resolves.toEqual(examWithAttachment)
})
```

Add this test near the sync export test:

```ts
it('exports exam attachments as encoded sync data', async () => {
  const attachment = attachmentRecord({
    id: 'attachment-1',
    name: 'archive.pdf',
    type: 'application/pdf',
  })
  await saveEsame({
    ...exam,
    attachments: [attachment],
  })

  const { state } = await exportLocalSyncState()

  expect(state.data.esami[0].attachments).toEqual([
    {
      id: 'attachment-1',
      name: 'archive.pdf',
      type: 'application/pdf',
      dataBase64: 'YXJjaGl2ZS5wZGY=',
      createdAt: '2026-06-13T09:00:00.000Z',
    },
  ])
})
```

Add this test after `imports merged sync state and aggregates question stat device counters`:

```ts
it('imports merged sync state with exam attachments', async () => {
  const syncedAt = '2026-06-13T10:00:00.000Z'
  const remoteState: RemoteSyncState = {
    syncVersion: SYNC_SCHEMA_VERSION,
    updatedAt: syncedAt,
    writerDeviceId: 'remote-device',
    data: {
      esami: [
        {
          id: 'exam-imported',
          name: 'Imported exam',
          createdAt: '2026-06-13T09:00:00.000Z',
          files: {},
          attachments: [
            {
              id: 'attachment-imported',
              name: 'notes.txt',
              type: 'text/plain',
              dataBase64: 'bm90ZXM=',
              createdAt: '2026-06-13T09:30:00.000Z',
            },
          ],
          updatedAt: '2026-06-13T09:45:00.000Z',
          updatedByDeviceId: 'remote-device',
        },
      ],
      quizSessions: [],
      questionStats: [],
      flashcardStats: [],
    },
    tombstones: [],
  }

  await importMergedSyncState(remoteState, 'remote-revision-archive', syncedAt)

  const importedExam = await getEsame('exam-imported')

  expect(importedExam?.attachments).toHaveLength(1)
  expect(importedExam?.attachments?.[0]).toMatchObject({
    id: 'attachment-imported',
    name: 'notes.txt',
    type: 'text/plain',
    createdAt: '2026-06-13T09:30:00.000Z',
  })
  expect(new TextDecoder().decode(importedExam?.attachments?.[0].data)).toBe('notes')
})
```

Update the existing `strips unknown remote fields from imported app records` expected exam:

```ts
await expect(getEsame('exam-imported')).resolves.toEqual({
  id: 'exam-imported',
  name: 'Imported exam',
  createdAt: '2026-06-05T09:00:00.000Z',
  files: {},
  attachments: [],
})
```

- [ ] **Step 2: Run storage tests to verify failures**

Run:

```bash
npm run test -- src/services/storageService.test.ts --run
```

Expected: FAIL because exported/imported sync exam records do not include `attachments`.

- [ ] **Step 3: Update storage sync export/import**

Modify the import in `src/services/storageService.ts`:

```ts
import { decodeExamAttachment, decodeFileRecord, encodeExamAttachment, encodeFileRecord } from './sync/serialization'
```

Add this helper near `notifySyncDirty()`:

```ts
function normalizeAttachments(esame: Esame): NonNullable<Esame['attachments']> {
  return esame.attachments ?? []
}
```

In `exportLocalSyncState()`, update the `esami.map()` return object:

```ts
return {
  ...esame,
  attachments: normalizeAttachments(esame).map((attachment) =>
    encodeExamAttachment(attachment),
  ),
  files: Object.fromEntries(
    Object.entries(esame.files).map(([slot, file]) => [slot, encodeFileRecord(file)]),
  ),
  updatedAt: recordMetadataEntry?.updatedAt ?? esame.createdAt,
  updatedByDeviceId: recordMetadataEntry?.updatedByDeviceId ?? syncMetadata.deviceId,
}
```

In `importMergedSyncState()`, update `normalizedEsami`:

```ts
const normalizedEsami: Esame[] = state.data.esami.map(
  ({ id, name, createdAt, files, attachments }) => ({
    id,
    name,
    createdAt,
    files: {
      ...(files.riassunto ? { riassunto: decodeFileRecord(files.riassunto) } : {}),
      ...(files.quiz ? { quiz: decodeFileRecord(files.quiz) } : {}),
      ...(files.flashcard ? { flashcard: decodeFileRecord(files.flashcard) } : {}),
    },
    attachments: (attachments ?? []).map((attachment) => decodeExamAttachment(attachment)),
  }),
)
```

- [ ] **Step 4: Run storage tests to verify they pass**

Run:

```bash
npm run test -- src/services/storageService.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/services/storageService.ts src/services/storageService.test.ts
git commit -m "feat: sync exam attachments"
```

---

### Task 3: Archive And Viewer Domain Helpers

**Files:**
- Modify: `src/services/fileService.ts`
- Test: `src/services/fileService.test.ts`
- Create: `src/services/archiveService.ts`
- Test: `src/services/archiveService.test.ts`
- Create: `src/services/fileViewerService.ts`
- Test: `src/services/fileViewerService.test.ts`

- [ ] **Step 1: Write failing file service tests for any-file selection**

Add this browser test in `src/services/fileService.test.ts`:

```ts
it('uses unfiltered browser file picking when accept is empty', async () => {
  const file = new File(['archive'], 'archive.custom', { type: 'application/x-custom' })
  const showOpenFilePicker = vi.fn(async () => [
    {
      getFile: async () => file,
    },
  ])
  ;(window as WindowWithOpenFilePicker).showOpenFilePicker = showOpenFilePicker

  const { fileService } = await freshFileService(false)

  const picked = await fileService.pickFile([])

  expect(showOpenFilePicker).toHaveBeenCalledWith({
    multiple: false,
  })
  expect(picked.name).toBe('archive.custom')
  expect(picked.type).toBe('application/x-custom')
  expect(new TextDecoder().decode(picked.data)).toBe('archive')
})
```

Add this fallback input expectation test:

```ts
it('leaves fallback input accept empty when accept is empty', async () => {
  const file = new File(['anything'], 'anything.bin', { type: 'application/octet-stream' })
  const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
    this: HTMLInputElement,
  ) {
    expect(this.accept).toBe('')
    Object.defineProperty(this, 'files', {
      configurable: true,
      value: [file],
    })
    this.dispatchEvent(new Event('change'))
  })

  const { fileService } = await freshFileService(false)

  await fileService.pickFile([])

  expect(click).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run file service tests to verify failures**

Run:

```bash
npm run test -- src/services/fileService.test.ts --run
```

Expected: FAIL because `showOpenFilePicker` currently receives an empty `types` array.

- [ ] **Step 3: Implement any-file picker behavior**

Modify `pickFileBrowser()` in `src/services/fileService.ts`:

```ts
async function pickFileBrowser(accept: string[]): Promise<PickedFile> {
  const filePickerWindow = window as WindowWithFilePicker

  if (filePickerWindow.showOpenFilePicker) {
    const options: FilePickerOptions | { multiple: false } =
      accept.length > 0
        ? {
            types: acceptFiltersFromExtensions(accept),
            multiple: false,
          }
        : {
            multiple: false,
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
```

No native code change is needed because `nativeMimeTypesFromExtensions([])` already returns `[]` and omits `options.types`.

- [ ] **Step 4: Add archive service tests**

Create `src/services/archiveService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { ExamAttachment } from '../types'
import {
  createExamAttachment,
  downloadAttachment,
  removeExamAttachment,
  sortAttachmentsNewestFirst,
} from './archiveService'

function attachment(overrides: Partial<ExamAttachment> = {}): ExamAttachment {
  const bytes = new TextEncoder().encode(overrides.name ?? 'notes.txt')

  return {
    id: 'attachment-1',
    name: 'notes.txt',
    type: 'text/plain',
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    createdAt: '2026-06-13T09:00:00.000Z',
    ...overrides,
  }
}

describe('archiveService', () => {
  it('creates exam attachments from picked file data', () => {
    const data = new TextEncoder().encode('payload').buffer

    const created = createExamAttachment({
      data,
      name: 'payload.bin',
      type: 'application/octet-stream',
      id: 'fixed-id',
      createdAt: '2026-06-13T10:00:00.000Z',
    })

    expect(created).toEqual({
      id: 'fixed-id',
      name: 'payload.bin',
      type: 'application/octet-stream',
      data,
      createdAt: '2026-06-13T10:00:00.000Z',
    })
  })

  it('sorts attachments newest first without mutating input', () => {
    const older = attachment({ id: 'older', createdAt: '2026-06-13T09:00:00.000Z' })
    const newer = attachment({ id: 'newer', createdAt: '2026-06-13T10:00:00.000Z' })
    const input = [older, newer]

    expect(sortAttachmentsNewestFirst(input).map((item) => item.id)).toEqual(['newer', 'older'])
    expect(input.map((item) => item.id)).toEqual(['older', 'newer'])
  })

  it('removes one attachment by id', () => {
    expect(
      removeExamAttachment([attachment({ id: 'a' }), attachment({ id: 'b' })], 'a').map(
        (item) => item.id,
      ),
    ).toEqual(['b'])
  })

  it('downloads an attachment with the original filename', () => {
    const click = vi.fn()
    const revokeObjectURL = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:attachment')
    const anchor = {
      href: '',
      download: '',
      click,
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })

    downloadAttachment(attachment({ name: 'notes.txt' }))

    expect(anchor.href).toBe('blob:attachment')
    expect(anchor.download).toBe('notes.txt')
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:attachment')

    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 5: Add viewer service tests**

Create `src/services/fileViewerService.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ExamAttachment } from '../types'
import { getPreviewKind, isPreviewSupported, prepareHtmlForIframe } from './fileViewerService'

function attachment(name: string, type = ''): ExamAttachment {
  return {
    id: name,
    name,
    type,
    data: new ArrayBuffer(0),
    createdAt: '2026-06-13T09:00:00.000Z',
  }
}

describe('fileViewerService', () => {
  it.each([
    [attachment('notes.pdf', 'application/pdf'), 'pdf'],
    [attachment('notes.docx', ''), 'docx'],
    [attachment('notes.html', 'text/html'), 'html'],
    [attachment('notes.txt', 'text/plain'), 'text'],
    [attachment('notes.md', 'text/markdown'), 'markdown'],
    [attachment('photo.png', 'image/png'), 'image'],
    [attachment('photo.jpeg', ''), 'image'],
    [attachment('archive.zip', 'application/zip'), 'unsupported'],
  ] as const)('detects preview kind for %s', (file, expected) => {
    expect(getPreviewKind(file)).toBe(expected)
    expect(isPreviewSupported(file)).toBe(expected !== 'unsupported')
  })

  it('adds an about:srcdoc base tag to HTML without a head tag', () => {
    expect(prepareHtmlForIframe('<h1>Document</h1>')).toBe(
      '<base href="about:srcdoc"><h1>Document</h1>',
    )
  })

  it('adds an about:srcdoc base tag inside an existing head tag', () => {
    expect(prepareHtmlForIframe('<html><head><title>T</title></head><body></body></html>')).toBe(
      '<html><head><base href="about:srcdoc"><title>T</title></head><body></body></html>',
    )
  })
})
```

- [ ] **Step 6: Run helper tests to verify failures**

Run:

```bash
npm run test -- src/services/fileService.test.ts src/services/archiveService.test.ts src/services/fileViewerService.test.ts --run
```

Expected: FAIL because `archiveService.ts` and `fileViewerService.ts` do not exist yet.

- [ ] **Step 7: Implement archive service**

Create `src/services/archiveService.ts`:

```ts
import { v4 as uuidv4 } from 'uuid'
import type { ExamAttachment } from '../types'

interface CreateExamAttachmentInput {
  data: ArrayBuffer
  name: string
  type: string
  id?: string
  createdAt?: string
}

export function createExamAttachment({
  data,
  name,
  type,
  id = uuidv4(),
  createdAt = new Date().toISOString(),
}: CreateExamAttachmentInput): ExamAttachment {
  return {
    id,
    name,
    type,
    data,
    createdAt,
  }
}

export function sortAttachmentsNewestFirst(
  attachments: readonly ExamAttachment[],
): ExamAttachment[] {
  return [...attachments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function removeExamAttachment(
  attachments: readonly ExamAttachment[],
  attachmentId: string,
): ExamAttachment[] {
  return attachments.filter((attachment) => attachment.id !== attachmentId)
}

export function downloadAttachment(attachment: ExamAttachment): void {
  const blob = new Blob([attachment.data], {
    type: attachment.type || 'application/octet-stream',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = attachment.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 8: Implement viewer service**

Create `src/services/fileViewerService.ts`:

```ts
import type { ExamAttachment, FileRecord } from '../types'

export type PreviewKind =
  | 'pdf'
  | 'docx'
  | 'html'
  | 'text'
  | 'markdown'
  | 'image'
  | 'unsupported'

const IMAGE_EXTENSIONS = ['.apng', '.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']

function lowerName(file: Pick<FileRecord, 'name'>): string {
  return file.name.toLowerCase()
}

function lowerType(file: Pick<FileRecord, 'type'>): string {
  return file.type.toLowerCase()
}

export function getPreviewKind(file: ExamAttachment | FileRecord): PreviewKind {
  const name = lowerName(file)
  const type = lowerType(file)

  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx')) return 'docx'
  if (type === 'text/html' || name.endsWith('.html') || name.endsWith('.htm')) return 'html'
  if (type === 'text/plain' || name.endsWith('.txt')) return 'text'
  if (type === 'text/markdown' || name.endsWith('.md')) return 'markdown'
  if (type.startsWith('image/') || IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return 'image'
  }

  return 'unsupported'
}

export function isPreviewSupported(file: ExamAttachment | FileRecord): boolean {
  return getPreviewKind(file) !== 'unsupported'
}

export function prepareHtmlForIframe(html: string): string {
  const baseTag = '<base href="about:srcdoc">'

  if (html.includes(baseTag)) return html

  const headTagMatch = html.match(/<head\b[^>]*>/i)
  if (headTagMatch) {
    return html.replace(headTagMatch[0], `${headTagMatch[0]}${baseTag}`)
  }

  const htmlTagMatch = html.match(/<html\b[^>]*>/i)
  if (htmlTagMatch) {
    return html.replace(htmlTagMatch[0], `${htmlTagMatch[0]}<head>${baseTag}</head>`)
  }

  return `${baseTag}${html}`
}
```

- [ ] **Step 9: Reuse HTML preparation in SummaryPage**

Modify `src/pages/SummaryPage.tsx`:

```ts
import { prepareHtmlForIframe } from '../services/fileViewerService'
```

Delete the local `prepareHtmlForIframe()` function from `SummaryPage.tsx`.

- [ ] **Step 10: Run helper and summary tests**

Run:

```bash
npm run test -- src/services/fileService.test.ts src/services/archiveService.test.ts src/services/fileViewerService.test.ts src/pages/SummaryPage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 11: Commit**

Run:

```bash
git add src/services/fileService.ts src/services/fileService.test.ts src/services/archiveService.ts src/services/archiveService.test.ts src/services/fileViewerService.ts src/services/fileViewerService.test.ts src/pages/SummaryPage.tsx
git commit -m "feat: add archive file helpers"
```

---

### Task 4: Dashboard Archive Card

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Test: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing dashboard tests**

Update `renderDashboard()` in `src/pages/DashboardPage.test.tsx` to include the archive route:

```tsx
function renderDashboard(path = '/esame/exam-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId" element={<DashboardPage />} />
        <Route path="/esame/:examId/archivio" element={<h1>Archivio esame</h1>} />
        <Route path="/esame/:examId/quiz/config" element={<LocationStateView />} />
        <Route path="/esame/:examId/quiz/sessione" element={<LocationStateView />} />
        <Route path="/esame/:examId/flashcard/sessione" element={<LocationStateView />} />
      </Routes>
    </MemoryRouter>,
  )
}
```

Add these tests inside `describe('DashboardPage', () => { ... })`:

```ts
it('shows an empty archive section on the dashboard', async () => {
  getEsame.mockResolvedValue(makeExam())

  renderDashboard()

  expect(await screen.findByRole('heading', { name: 'Archivio' })).not.toBeNull()
  expect(screen.getByText('Nessun file')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Aggiungi file' })).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Apri archivio' })).not.toBeNull()
})

it('adds an archive attachment from the dashboard', async () => {
  const current = makeExam()
  const pickedData = encodeText('archive')
  getEsame.mockResolvedValue(current)
  saveEsame.mockImplementation(async (updated: Esame) => {
    getEsame.mockResolvedValue(updated)
  })
  pickFile.mockResolvedValue({
    name: 'archive.custom',
    type: 'application/x-custom',
    data: pickedData,
  })

  renderDashboard()

  fireEvent.click(await screen.findByRole('button', { name: 'Aggiungi file' }))

  await waitFor(() => {
    expect(pickFile).toHaveBeenCalledWith([])
    expect(saveEsame).toHaveBeenCalledWith({
      ...current,
      attachments: [
        expect.objectContaining({
          id: expect.any(String),
          name: 'archive.custom',
          type: 'application/x-custom',
          data: pickedData,
          createdAt: expect.any(String),
        }),
      ],
    })
  })
  expect(await screen.findByText('archive.custom')).not.toBeNull()
})

it('shows recent archive attachments and navigates to the full archive', async () => {
  getEsame.mockResolvedValue(
    makeExam({
      attachments: [
        {
          id: 'old',
          name: 'old.pdf',
          type: 'application/pdf',
          data: encodeText('old'),
          createdAt: '2026-06-13T08:00:00.000Z',
        },
        {
          id: 'new',
          name: 'new.pdf',
          type: 'application/pdf',
          data: encodeText('new'),
          createdAt: '2026-06-13T09:00:00.000Z',
        },
      ],
    }),
  )

  renderDashboard()

  expect(await screen.findByText('2 file')).not.toBeNull()
  expect(screen.getByText('new.pdf')).not.toBeNull()
  expect(screen.getByText('old.pdf')).not.toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Apri archivio' }))

  expect(await screen.findByRole('heading', { name: 'Archivio esame' })).not.toBeNull()
})
```

- [ ] **Step 2: Run dashboard tests to verify failures**

Run:

```bash
npm run test -- src/pages/DashboardPage.test.tsx --run
```

Expected: FAIL because the archive card is not rendered.

- [ ] **Step 3: Implement dashboard archive upload and preview**

Modify the imports in `src/pages/DashboardPage.tsx`:

```ts
import { createExamAttachment, sortAttachmentsNewestFirst } from '../services/archiveService'
```

Add this function after `importFlashcard()`:

```ts
async function importAttachment(data: ArrayBuffer, name: string, type: string) {
  if (!examId) return

  const currentExam = await storageService.getEsame(examId)
  if (!currentExam) {
    navigate('/', { replace: true })
    return
  }

  const updatedExam: Esame = {
    ...currentExam,
    attachments: [
      ...(currentExam.attachments ?? []),
      createExamAttachment({
        data,
        name,
        type,
      }),
    ],
  }

  await storageService.saveEsame(updatedExam)
  setEsame(updatedExam)
}
```

Add these constants before `return`:

```ts
const attachments = sortAttachmentsNewestFirst(esame.attachments ?? [])
const archiveStatus = attachments.length === 0 ? 'Nessun file' : `${attachments.length} file`
const archivePreview = attachments.slice(0, 3)
```

Add this `SectionCard` after the `Riassunto` card:

```tsx
<SectionCard title="Archivio" status={archiveStatus}>
  <FileImportButton label="Aggiungi file" accept={[]} onFile={importAttachment} />
  <button
    type="button"
    onClick={() => navigate(`/esame/${esame.id}/archivio`)}
    style={secondaryButtonStyle}
  >
    Apri archivio
  </button>
  {archivePreview.length > 0 && (
    <ul style={archivePreviewListStyle}>
      {archivePreview.map((attachment) => (
        <li key={attachment.id} style={archivePreviewItemStyle}>
          {attachment.name}
        </li>
      ))}
    </ul>
  )}
</SectionCard>
```

Add styles near the other style constants:

```ts
const archivePreviewListStyle = {
  flexBasis: '100%',
  display: 'grid',
  gap: '0.35rem',
  marginTop: '0.25rem',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
  listStyle: 'none',
  padding: 0,
}

const archivePreviewItemStyle = {
  overflowWrap: 'anywhere' as const,
}
```

- [ ] **Step 4: Run dashboard tests**

Run:

```bash
npm run test -- src/pages/DashboardPage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx
git commit -m "feat: add archive dashboard card"
```

---

### Task 5: Full Archive Page And Route

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/ArchivePage.tsx`
- Test: `src/pages/ArchivePage.test.tsx`

- [ ] **Step 1: Write failing archive page tests**

Create `src/pages/ArchivePage.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Esame, ExamAttachment } from '../types'

const getEsame = vi.fn()
const saveEsame = vi.fn()
const pickFile = vi.fn()
const downloadAttachment = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
  saveEsame,
}))

vi.mock('../services/fileService', () => ({
  fileService: {
    pickFile,
  },
}))

vi.mock('../services/archiveService', async () => {
  const actual = await vi.importActual<typeof import('../services/archiveService')>(
    '../services/archiveService',
  )

  return {
    ...actual,
    downloadAttachment,
  }
})

const { ArchivePage } = await import('./ArchivePage')

function encodeText(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function attachment(overrides: Partial<ExamAttachment> = {}): ExamAttachment {
  return {
    id: 'attachment-1',
    name: 'notes.pdf',
    type: 'application/pdf',
    data: encodeText('notes'),
    createdAt: '2026-06-13T09:00:00.000Z',
    ...overrides,
  }
}

function makeExam(overrides: Partial<Esame> = {}): Esame {
  return {
    id: 'exam-1',
    name: 'Analisi 1',
    createdAt: '2026-06-01T08:00:00.000Z',
    files: {},
    attachments: [],
    ...overrides,
  }
}

function renderArchive(path = '/esame/exam-1/archivio') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId" element={<h1>Dashboard esame</h1>} />
        <Route path="/esame/:examId/archivio" element={<ArchivePage />} />
        <Route path="/esame/:examId/file/:fileId" element={<h1>Viewer file</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ArchivePage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeExam())
    saveEsame.mockResolvedValue(undefined)
  })

  it('redirects home when the exam is missing', async () => {
    getEsame.mockResolvedValue(undefined)

    renderArchive()

    expect(await screen.findByRole('heading', { name: 'Tutti gli esami' })).not.toBeNull()
  })

  it('renders the empty archive state', async () => {
    renderArchive()

    expect(await screen.findByRole('heading', { name: 'Archivio' })).not.toBeNull()
    expect(screen.getByText('Nessun file archiviato')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Aggiungi file' })).not.toBeNull()
  })

  it('renders supported and unsupported attachment actions', async () => {
    getEsame.mockResolvedValue(
      makeExam({
        attachments: [
          attachment({ id: 'pdf', name: 'slides.pdf', type: 'application/pdf' }),
          attachment({ id: 'zip', name: 'bundle.zip', type: 'application/zip' }),
        ],
      }),
    )

    renderArchive()

    expect(await screen.findByText('slides.pdf')).not.toBeNull()
    expect(screen.getByText('bundle.zip')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Apri slides.pdf' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Apri bundle.zip' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Scarica bundle.zip' })).not.toBeNull()
  })

  it('adds a new attachment', async () => {
    const current = makeExam()
    const pickedData = encodeText('custom')
    getEsame.mockResolvedValue(current)
    saveEsame.mockImplementation(async (updated: Esame) => {
      getEsame.mockResolvedValue(updated)
    })
    pickFile.mockResolvedValue({
      name: 'custom.bin',
      type: 'application/octet-stream',
      data: pickedData,
    })

    renderArchive()

    fireEvent.click(await screen.findByRole('button', { name: 'Aggiungi file' }))

    await waitFor(() => {
      expect(pickFile).toHaveBeenCalledWith([])
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        attachments: [
          expect.objectContaining({
            name: 'custom.bin',
            type: 'application/octet-stream',
            data: pickedData,
          }),
        ],
      })
    })
  })

  it('deletes an attachment', async () => {
    const current = makeExam({
      attachments: [
        attachment({ id: 'keep', name: 'keep.pdf' }),
        attachment({ id: 'delete', name: 'delete.pdf' }),
      ],
    })
    getEsame.mockResolvedValue(current)

    renderArchive()

    fireEvent.click(await screen.findByRole('button', { name: 'Elimina delete.pdf' }))

    await waitFor(() => {
      expect(saveEsame).toHaveBeenCalledWith({
        ...current,
        attachments: [current.attachments?.[0]],
      })
    })
  })

  it('downloads an attachment', async () => {
    const item = attachment({ id: 'zip', name: 'bundle.zip', type: 'application/zip' })
    getEsame.mockResolvedValue(makeExam({ attachments: [item] }))

    renderArchive()

    fireEvent.click(await screen.findByRole('button', { name: 'Scarica bundle.zip' }))

    expect(downloadAttachment).toHaveBeenCalledWith(item)
  })

  it('opens a supported attachment viewer', async () => {
    getEsame.mockResolvedValue(makeExam({ attachments: [attachment({ id: 'pdf' })] }))

    renderArchive()

    fireEvent.click(await screen.findByRole('button', { name: 'Apri notes.pdf' }))

    expect(await screen.findByRole('heading', { name: 'Viewer file' })).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run archive page tests to verify failures**

Run:

```bash
npm run test -- src/pages/ArchivePage.test.tsx --run
```

Expected: FAIL because `ArchivePage.tsx` does not exist.

- [ ] **Step 3: Implement ArchivePage**

Create `src/pages/ArchivePage.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fileService } from '../services/fileService'
import {
  createExamAttachment,
  downloadAttachment,
  removeExamAttachment,
  sortAttachmentsNewestFirst,
} from '../services/archiveService'
import { isPreviewSupported } from '../services/fileViewerService'
import * as storageService from '../services/storageService'
import type { Esame, ExamAttachment } from '../types'

export function ArchivePage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [esame, setEsame] = useState<Esame | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadArchive = useCallback(async () => {
    if (!examId) {
      navigate('/', { replace: true })
      return
    }

    const currentExam = await storageService.getEsame(examId)
    if (!currentExam) {
      navigate('/', { replace: true })
      return
    }

    setEsame(currentExam)
    setLoading(false)
  }, [examId, navigate])

  useEffect(() => {
    void loadArchive()
  }, [loadArchive])

  async function addAttachment() {
    if (!examId || busy) return

    setBusy(true)
    setError(null)

    try {
      const picked = await fileService.pickFile([])
      const currentExam = await storageService.getEsame(examId)
      if (!currentExam) {
        navigate('/', { replace: true })
        return
      }

      const updatedExam: Esame = {
        ...currentExam,
        attachments: [
          ...(currentExam.attachments ?? []),
          createExamAttachment({
            data: picked.data,
            name: picked.name,
            type: picked.type,
          }),
        ],
      }

      await storageService.saveEsame(updatedExam)
      setEsame(updatedExam)
    } catch (caughtError) {
      const message = errorMessage(caughtError)
      if (message !== 'Selezione annullata') setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!esame || busy) return

    setBusy(true)
    setError(null)

    try {
      const updatedExam: Esame = {
        ...esame,
        attachments: removeExamAttachment(esame.attachments ?? [], attachmentId),
      }

      await storageService.saveEsame(updatedExam)
      setEsame(updatedExam)
    } catch (caughtError) {
      setError(errorMessage(caughtError))
    } finally {
      setBusy(false)
    }
  }

  if (loading || !esame) {
    return <p style={messageStyle}>Caricamento...</p>
  }

  const attachments = sortAttachmentsNewestFirst(esame.attachments ?? [])

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <button
          type="button"
          onClick={() => navigate(`/esame/${esame.id}`)}
          aria-label="Torna alla dashboard esame"
          style={backButtonStyle}
        >
          ← Dashboard
        </button>
        <div>
          <h1 style={titleStyle}>Archivio</h1>
          <p style={mutedTextStyle}>{esame.name}</p>
        </div>
      </header>

      <div style={toolbarStyle}>
        <button type="button" onClick={() => void addAttachment()} disabled={busy} style={primaryButtonStyle}>
          {busy ? 'Operazione...' : 'Aggiungi file'}
        </button>
      </div>

      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}

      {attachments.length === 0 ? (
        <p style={emptyStyle}>Nessun file archiviato</p>
      ) : (
        <ul style={listStyle}>
          {attachments.map((attachment) => (
            <ArchiveItem
              key={attachment.id}
              attachment={attachment}
              examId={esame.id}
              busy={busy}
              onOpen={() => navigate(`/esame/${esame.id}/file/${attachment.id}`)}
              onDownload={() => downloadAttachment(attachment)}
              onDelete={() => void deleteAttachment(attachment.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ArchiveItem({
  attachment,
  busy,
  onOpen,
  onDownload,
  onDelete,
}: {
  attachment: ExamAttachment
  examId: string
  busy: boolean
  onOpen: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const canPreview = isPreviewSupported(attachment)

  return (
    <li style={itemStyle}>
      <div style={itemMetaStyle}>
        <strong style={fileNameStyle}>{attachment.name}</strong>
        <span style={mutedTextStyle}>{formatDate(attachment.createdAt)}</span>
      </div>
      <div style={itemActionsStyle}>
        {canPreview && (
          <button type="button" onClick={onOpen} disabled={busy} style={secondaryButtonStyle}>
            Apri {attachment.name}
          </button>
        )}
        <button type="button" onClick={onDownload} disabled={busy} style={secondaryButtonStyle}>
          Scarica {attachment.name}
        </button>
        <button type="button" onClick={onDelete} disabled={busy} style={dangerButtonStyle}>
          Elimina {attachment.name}
        </button>
      </div>
    </li>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Errore sconosciuto'
}

const pageStyle = { maxWidth: '860px', margin: '0 auto' }
const headerStyle = { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }
const backButtonStyle = { color: 'var(--text-muted)', minHeight: '40px' }
const titleStyle = { fontSize: '1.6rem', fontWeight: 700 }
const mutedTextStyle = { color: 'var(--text-muted)', fontSize: '0.95rem' }
const toolbarStyle = { display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }
const primaryButtonStyle = {
  minHeight: '48px',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
}
const secondaryButtonStyle = {
  minHeight: '44px',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
}
const dangerButtonStyle = { ...secondaryButtonStyle, color: 'var(--danger)' }
const messageStyle = { color: 'var(--text-muted)', textAlign: 'center' as const }
const errorStyle = { color: 'var(--danger)', marginBottom: '1rem' }
const emptyStyle = {
  padding: '1.5rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
  color: 'var(--text-muted)',
}
const listStyle = { display: 'grid', gap: '0.75rem', listStyle: 'none', padding: 0 }
const itemStyle = {
  display: 'grid',
  gap: '0.75rem',
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
}
const itemMetaStyle = { display: 'grid', gap: '0.25rem' }
const fileNameStyle = { overflowWrap: 'anywhere' as const }
const itemActionsStyle = { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' }
```

- [ ] **Step 4: Add routes**

Modify imports in `src/App.tsx`:

```ts
import { ArchivePage } from './pages/ArchivePage'
```

Add route after the summary route:

```tsx
<Route path="/esame/:examId/archivio" element={<ArchivePage />} />
```

- [ ] **Step 5: Run archive page tests**

Run:

```bash
npm run test -- src/pages/ArchivePage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/App.tsx src/pages/ArchivePage.tsx src/pages/ArchivePage.test.tsx
git commit -m "feat: add exam archive page"
```

---

### Task 6: File Viewer Page And Final Verification

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/FileViewerPage.tsx`
- Test: `src/pages/FileViewerPage.test.tsx`

- [ ] **Step 1: Write failing file viewer tests**

Create `src/pages/FileViewerPage.test.tsx`:

```tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Esame, ExamAttachment } from '../types'

const getEsame = vi.fn()
const convertToHtml = vi.fn()
const downloadAttachment = vi.fn()

vi.mock('../services/storageService', () => ({
  getEsame,
}))

vi.mock('mammoth', () => ({
  convertToHtml,
}))

vi.mock('../services/archiveService', async () => {
  const actual = await vi.importActual<typeof import('../services/archiveService')>(
    '../services/archiveService',
  )

  return {
    ...actual,
    downloadAttachment,
  }
})

const { FileViewerPage } = await import('./FileViewerPage')

function encodeText(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function attachment(overrides: Partial<ExamAttachment> = {}): ExamAttachment {
  return {
    id: 'attachment-1',
    name: 'notes.txt',
    type: 'text/plain',
    data: encodeText('Plain text notes'),
    createdAt: '2026-06-13T09:00:00.000Z',
    ...overrides,
  }
}

function makeExam(item = attachment()): Esame {
  return {
    id: 'exam-1',
    name: 'Analisi 1',
    createdAt: '2026-06-01T08:00:00.000Z',
    files: {},
    attachments: [item],
  }
}

function renderViewer(path = '/esame/exam-1/file/attachment-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Tutti gli esami</h1>} />
        <Route path="/esame/:examId/archivio" element={<h1>Archivio</h1>} />
        <Route path="/esame/:examId/file/:fileId" element={<FileViewerPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FileViewerPage', () => {
  const createObjectURL = vi.fn()
  const revokeObjectURL = vi.fn()

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getEsame.mockResolvedValue(makeExam())
    convertToHtml.mockResolvedValue({ value: '<p>DOCX content</p>' })
    createObjectURL.mockReturnValue('blob:file')
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects home when the exam is missing', async () => {
    getEsame.mockResolvedValue(undefined)

    renderViewer()

    expect(await screen.findByRole('heading', { name: 'Tutti gli esami' })).not.toBeNull()
  })

  it('shows a missing attachment message', async () => {
    getEsame.mockResolvedValue(makeExam(attachment({ id: 'different' })))

    renderViewer()

    expect((await screen.findByRole('alert')).textContent).toMatch(/file non trovato/i)
  })

  it('renders text attachments', async () => {
    getEsame.mockResolvedValue(makeExam(attachment({ name: 'notes.txt', type: 'text/plain' })))

    renderViewer()

    expect(await screen.findByText('Plain text notes')).not.toBeNull()
  })

  it('renders markdown attachments as text', async () => {
    getEsame.mockResolvedValue(
      makeExam(attachment({ name: 'notes.md', type: 'text/markdown', data: encodeText('# Titolo') })),
    )

    renderViewer()

    expect(await screen.findByText('# Titolo')).not.toBeNull()
  })

  it('renders HTML attachments in an iframe', async () => {
    getEsame.mockResolvedValue(
      makeExam(attachment({ name: 'page.html', type: 'text/html', data: encodeText('<h1>HTML</h1>') })),
    )

    renderViewer()

    const iframe = await screen.findByTitle('page.html')
    expect(iframe.getAttribute('srcdoc')).toContain('<base href="about:srcdoc">')
    expect(iframe.getAttribute('srcdoc')).toContain('<h1>HTML</h1>')
  })

  it('renders PDF attachments with a blob URL and revokes it on cleanup', async () => {
    getEsame.mockResolvedValue(
      makeExam(attachment({ name: 'slides.pdf', type: 'application/pdf', data: encodeText('%PDF') })),
    )

    const { unmount } = renderViewer()

    const iframe = await screen.findByTitle('slides.pdf')
    expect(iframe.getAttribute('src')).toBe('blob:file')

    unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:file')
  })

  it('converts DOCX attachments with mammoth', async () => {
    const data = encodeText('docx')
    getEsame.mockResolvedValue(makeExam(attachment({ name: 'notes.docx', type: '', data })))

    renderViewer()

    await waitFor(() => {
      expect(convertToHtml).toHaveBeenCalledWith({ arrayBuffer: data })
    })
    expect((await screen.findByTitle('notes.docx')).getAttribute('srcdoc')).toContain(
      '<p>DOCX content</p>',
    )
  })

  it('renders image attachments', async () => {
    getEsame.mockResolvedValue(makeExam(attachment({ name: 'photo.png', type: 'image/png' })))

    renderViewer()

    expect(await screen.findByRole('img', { name: 'photo.png' })).not.toBeNull()
  })

  it('shows download fallback for unsupported attachments', async () => {
    const item = attachment({ name: 'bundle.zip', type: 'application/zip' })
    getEsame.mockResolvedValue(makeExam(item))

    renderViewer()

    expect((await screen.findByRole('alert')).textContent).toMatch(/anteprima non disponibile/i)
    screen.getByRole('button', { name: 'Scarica file' }).click()
    expect(downloadAttachment).toHaveBeenCalledWith(item)
  })
})
```

- [ ] **Step 2: Run file viewer tests to verify failures**

Run:

```bash
npm run test -- src/pages/FileViewerPage.test.tsx --run
```

Expected: FAIL because `FileViewerPage.tsx` does not exist.

- [ ] **Step 3: Implement FileViewerPage**

Create `src/pages/FileViewerPage.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { downloadAttachment } from '../services/archiveService'
import { getPreviewKind, prepareHtmlForIframe } from '../services/fileViewerService'
import * as storageService from '../services/storageService'
import type { ExamAttachment } from '../types'

export function FileViewerPage() {
  const { examId, fileId } = useParams<{ examId: string; fileId: string }>()
  const navigate = useNavigate()
  const [attachment, setAttachment] = useState<ExamAttachment | null>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    function revokeObjectUrl() {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }

    async function loadAttachment() {
      if (!examId || !fileId) {
        navigate('/', { replace: true })
        return
      }

      try {
        const esame = await storageService.getEsame(examId)
        if (!esame) {
          navigate('/', { replace: true })
          return
        }

        const selected = (esame.attachments ?? []).find((item) => item.id === fileId)
        if (!selected) {
          if (mounted) setError('File non trovato.')
          return
        }

        if (!mounted) return

        setAttachment(selected)
        setHtmlContent(null)
        setTextContent(null)
        setObjectUrl(null)
        setError(null)
        revokeObjectUrl()

        const kind = getPreviewKind(selected)

        if (kind === 'html') {
          setHtmlContent(prepareHtmlForIframe(new TextDecoder().decode(selected.data)))
          return
        }

        if (kind === 'text' || kind === 'markdown') {
          setTextContent(new TextDecoder().decode(selected.data))
          return
        }

        if (kind === 'docx') {
          const mammoth = await import('mammoth')
          const result = await mammoth.convertToHtml({ arrayBuffer: selected.data })
          if (mounted) setHtmlContent(prepareHtmlForIframe(result.value))
          return
        }

        if (kind === 'pdf' || kind === 'image') {
          const url = URL.createObjectURL(
            new Blob([selected.data], {
              type: selected.type || (kind === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
            }),
          )
          if (!mounted) {
            URL.revokeObjectURL(url)
            return
          }

          objectUrlRef.current = url
          setObjectUrl(url)
          return
        }

        setError('Anteprima non disponibile per questo file.')
      } catch (caughtError) {
        if (mounted) setError(errorMessage(caughtError))
      }
    }

    void loadAttachment()

    return () => {
      mounted = false
      revokeObjectUrl()
    }
  }, [examId, fileId, navigate])

  const kind = attachment ? getPreviewKind(attachment) : 'unsupported'
  const isLoading = !error && !htmlContent && !textContent && !objectUrl

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <button
          type="button"
          onClick={() => navigate(examId ? `/esame/${examId}/archivio` : '/')}
          aria-label="Torna all'archivio"
          style={backButtonStyle}
        >
          ← Archivio
        </button>
        <h1 style={titleStyle}>{attachment?.name ?? 'File'}</h1>
      </header>

      <main style={viewerStyle}>
        {htmlContent !== null && (
          <iframe srcDoc={htmlContent} title={attachment?.name ?? 'File HTML'} sandbox="" style={iframeStyle} />
        )}
        {textContent !== null && <pre style={textStyle}>{textContent}</pre>}
        {objectUrl && kind === 'pdf' && (
          <iframe src={objectUrl} title={attachment?.name ?? 'File PDF'} sandbox="" style={iframeStyle} />
        )}
        {objectUrl && kind === 'image' && (
          <div style={imageWrapStyle}>
            <img src={objectUrl} alt={attachment?.name ?? 'Immagine'} style={imageStyle} />
          </div>
        )}
        {isLoading && <p style={messageStyle}>Caricamento...</p>}
        {error && (
          <div role="alert" style={messageStyle}>
            <p style={errorStyle}>{error}</p>
            {attachment && (
              <button type="button" onClick={() => downloadAttachment(attachment)} style={primaryButtonStyle}>
                Scarica file
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Impossibile aprire il file.'
}

const pageStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  height: 'calc(100dvh - 3rem)',
  minHeight: '520px',
}
const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  marginBottom: '1rem',
}
const backButtonStyle = { color: 'var(--text-muted)', minHeight: '40px' }
const titleStyle = {
  minWidth: 0,
  overflowWrap: 'anywhere' as const,
  fontSize: '1.1rem',
  fontWeight: 700,
}
const viewerStyle = {
  flex: 1,
  overflow: 'hidden',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg-surface)',
}
const iframeStyle = { width: '100%', height: '100%', border: 'none' }
const textStyle = {
  height: '100%',
  margin: 0,
  padding: '1rem',
  overflow: 'auto',
  whiteSpace: 'pre-wrap' as const,
  overflowWrap: 'anywhere' as const,
  fontFamily: 'inherit',
}
const imageWrapStyle = {
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  overflow: 'auto',
  padding: '1rem',
}
const imageStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const }
const messageStyle = {
  padding: '2rem',
  color: 'var(--text-muted)',
  textAlign: 'center' as const,
}
const errorStyle = { color: 'var(--danger)' }
const primaryButtonStyle = {
  minHeight: '44px',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
}
```

- [ ] **Step 4: Add file viewer route**

Modify imports in `src/App.tsx`:

```ts
import { FileViewerPage } from './pages/FileViewerPage'
```

Add route after the archive route:

```tsx
<Route path="/esame/:examId/file/:fileId" element={<FileViewerPage />} />
```

- [ ] **Step 5: Run file viewer tests**

Run:

```bash
npm run test -- src/pages/FileViewerPage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 6: Run focused feature tests**

Run:

```bash
npm run test -- src/services/sync/serialization.test.ts src/services/storageService.test.ts src/services/fileService.test.ts src/services/archiveService.test.ts src/services/fileViewerService.test.ts src/pages/DashboardPage.test.tsx src/pages/ArchivePage.test.tsx src/pages/FileViewerPage.test.tsx src/pages/SummaryPage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Run full test suite**

Run:

```bash
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/App.tsx src/pages/FileViewerPage.tsx src/pages/FileViewerPage.test.tsx
git commit -m "feat: add archive file viewer"
```

---

## Self-Review

Spec coverage:

- Per-exam attachments are covered in Tasks 1 and 2.
- Any-file import is covered in Tasks 3, 4, and 5.
- Dashboard preview is covered in Task 4.
- Full archive page is covered in Task 5.
- Supported inline previews are covered in Tasks 3 and 6.
- Unsupported export/download fallback is covered in Tasks 3, 5, and 6.
- Existing fixed study file slots remain unchanged in all tasks.
- No new IndexedDB store or DB version bump is introduced.
- Native export is explicitly limited to the existing web-style path by keeping export in the browser `Blob` helper.

Placeholder scan:

- The plan contains no forbidden placeholder markers or unspecified implementation steps.
- Every code-changing step includes concrete code or exact replacement snippets.
- Every test step includes exact commands and expected outcomes.

Type consistency:

- `ExamAttachment` extends `FileRecord` and is used consistently in sync, archive helpers, and page tests.
- Sync encoded attachments use `dataBase64`, matching existing `EncodedFileRecord`.
- Route names are consistent: `/esame/:examId/archivio` and `/esame/:examId/file/:fileId`.
