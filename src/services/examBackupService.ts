import JSZip from 'jszip'
import type {
  Esame,
  ExamAttachment,
  FileRecord,
  FlashcardStats,
  PausedSession,
  QuestionStats,
  QuizSession,
} from '../types'
import { validateFlashcardFile, validateQuizFile } from './quizService'

export const BACKUP_SCHEMA_VERSION = 1
export const BACKUP_MANIFEST_PATH = 'manifest.json'
export const BACKUP_ARCHIVE_EXTENSION = '.pla-exam-backup'

export interface ExamBackupSourceBundle {
  exam: Esame
  quizSessions: QuizSession[]
  questionStats: QuestionStats[]
  flashcardStats: FlashcardStats[]
  pausedSessions: PausedSession[]
}

export interface ImportedExamBackupBundle extends ExamBackupSourceBundle {
  exam: Esame
}

interface BuildArchiveOptions {
  exportedAt?: string
  appVersion?: string
}

interface BackupFileEntry {
  path: string
  name: string
  type: string
}

interface BackupAttachmentEntry extends BackupFileEntry {
  id: string
  createdAt: string
}

interface BackupManifest {
  version: number
  exportedAt: string
  source: {
    app: string
    appVersion?: string
  }
  exam: {
    originalExamId: string
    name: string
    createdAt: string
    files: {
      quiz?: BackupFileEntry
      flashcard?: BackupFileEntry
      riassunto?: BackupFileEntry
    }
    attachments: BackupAttachmentEntry[]
  }
  studyState: {
    quizSessions: QuizSession[]
    questionStats: QuestionStats[]
    flashcardStats: FlashcardStats[]
    pausedSessions: PausedSession[]
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function suggestedBackupFileName(examName: string): string {
  const slug = slugify(examName) || 'exam-backup'
  return `${slug}-${todayIsoDate()}${BACKUP_ARCHIVE_EXTENSION}`
}

function fileExtension(fileName: string, fallback: string): string {
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1].toLowerCase() : fallback
}

function safePathSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
}

function addFile(zip: JSZip, path: string, file: FileRecord): void {
  zip.file(path, new Uint8Array(file.data), { createFolders: false })
}

function fixedFileEntry(
  zip: JSZip,
  path: string,
  file: FileRecord | undefined,
): BackupFileEntry | undefined {
  if (!file) return undefined

  addFile(zip, path, file)
  return {
    path,
    name: file.name,
    type: file.type,
  }
}

function attachmentEntry(
  zip: JSZip,
  attachment: ExamAttachment,
  index: number,
): BackupAttachmentEntry {
  const path = `attachments/${index}-${safePathSegment(attachment.id)}-${safePathSegment(attachment.name)}`
  addFile(zip, path, attachment)

  return {
    id: attachment.id,
    path,
    name: attachment.name,
    type: attachment.type,
    createdAt: attachment.createdAt,
  }
}

export async function buildExamBackupArchive(
  bundle: ExamBackupSourceBundle,
  options: BuildArchiveOptions = {},
): Promise<ArrayBuffer> {
  const zip = new JSZip()
  const files = bundle.exam.files
  const manifest: BackupManifest = {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    source: {
      app: 'personal-learning-assistant',
      ...(options.appVersion ? { appVersion: options.appVersion } : {}),
    },
    exam: {
      originalExamId: bundle.exam.id,
      name: bundle.exam.name,
      createdAt: bundle.exam.createdAt,
      files: {
        ...(files.quiz
          ? { quiz: fixedFileEntry(zip, 'files/quiz.json', files.quiz) }
          : {}),
        ...(files.flashcard
          ? { flashcard: fixedFileEntry(zip, 'files/flashcard.json', files.flashcard) }
          : {}),
        ...(files.riassunto
          ? {
              riassunto: fixedFileEntry(
                zip,
                `files/riassunto.${fileExtension(files.riassunto.name, 'bin')}`,
                files.riassunto,
              ),
            }
          : {}),
      },
      attachments: (bundle.exam.attachments ?? []).map((attachment, index) =>
        attachmentEntry(zip, attachment, index),
      ),
    },
    studyState: {
      quizSessions: bundle.quizSessions,
      questionStats: bundle.questionStats,
      flashcardStats: bundle.flashcardStats,
      pausedSessions: bundle.pausedSessions,
    },
  }

  zip.file(BACKUP_MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  return zip.generateAsync({ type: 'arraybuffer' })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseJson(value: string, message: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(message)
  }
}

function requireStringField(
  record: Record<string, unknown>,
  field: string,
  message: string,
): string {
  const value = record[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message)
  }
  return value
}

function requireArrayField<T>(
  record: Record<string, unknown>,
  field: string,
  message: string,
): T[] {
  const value = record[field]
  if (!Array.isArray(value)) {
    throw new Error(message)
  }
  return value as T[]
}

function assertSafeArchivePath(path: string): void {
  if (
    path.startsWith('/') ||
    path.startsWith('\\') ||
    path.includes('..') ||
    path.includes('\\')
  ) {
    throw new Error(`Backup non valido: percorso file non sicuro ${path}`)
  }
}

function collectManifestPaths(manifest: BackupManifest): Set<string> {
  const paths = new Set<string>([BACKUP_MANIFEST_PATH])
  for (const file of Object.values(manifest.exam.files)) {
    if (file) paths.add(file.path)
  }
  for (const attachment of manifest.exam.attachments) {
    paths.add(attachment.path)
  }
  return paths
}

function validateRecordExamIds(manifest: BackupManifest): void {
  const examId = manifest.exam.originalExamId
  const state = manifest.studyState

  if (state.quizSessions.some((record) => record.examId !== examId)) {
    throw new Error('Backup non valido: quizSessions contiene record per altro esame')
  }
  if (state.questionStats.some((record) => record.examId !== examId)) {
    throw new Error('Backup non valido: questionStats contiene record per altro esame')
  }
  if (state.flashcardStats.some((record) => record.examId !== examId)) {
    throw new Error('Backup non valido: flashcardStats contiene record per altro esame')
  }
  if (state.pausedSessions.some((record) => record.examId !== examId)) {
    throw new Error('Backup non valido: pausedSessions contiene record per altro esame')
  }
  if (
    state.pausedSessions.some(
      (record) => record.mode !== 'quiz' && record.mode !== 'flashcard',
    )
  ) {
    throw new Error('Backup non valido: pausedSessions contiene mode non supportato')
  }
}

function normalizeFileEntry(value: unknown): BackupFileEntry | undefined {
  if (!isRecord(value)) return undefined

  const entry = {
    path: requireStringField(value, 'path', 'Backup non valido: path mancante'),
    name: requireStringField(value, 'name', 'Backup non valido: name file mancante'),
    type: requireStringField(value, 'type', 'Backup non valido: type file mancante'),
  }
  assertSafeArchivePath(entry.path)
  return entry
}

function normalizeAttachmentEntry(value: unknown): BackupAttachmentEntry {
  if (!isRecord(value)) {
    throw new Error('Backup non valido: allegato malformato')
  }

  const entry = {
    id: requireStringField(value, 'id', 'Backup non valido: id allegato mancante'),
    path: requireStringField(value, 'path', 'Backup non valido: path allegato mancante'),
    name: requireStringField(value, 'name', 'Backup non valido: name allegato mancante'),
    type: requireStringField(value, 'type', 'Backup non valido: type allegato mancante'),
    createdAt: requireStringField(
      value,
      'createdAt',
      'Backup non valido: createdAt allegato mancante',
    ),
  }
  assertSafeArchivePath(entry.path)
  return entry
}

function normalizeManifest(value: unknown): BackupManifest {
  if (!isRecord(value)) {
    throw new Error('Backup non valido: manifest.json malformato')
  }

  if (value.version !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Backup non supportato: versione ${String(value.version)}`)
  }

  if (!isRecord(value.exam)) {
    throw new Error('Backup non valido: exam mancante')
  }
  if (!isRecord(value.studyState)) {
    throw new Error('Backup non valido: studyState mancante')
  }

  const files = isRecord(value.exam.files) ? value.exam.files : {}
  const quiz = normalizeFileEntry(files.quiz)
  const flashcard = normalizeFileEntry(files.flashcard)
  const riassunto = normalizeFileEntry(files.riassunto)
  const attachments = requireArrayField<unknown>(
    value.exam,
    'attachments',
    'Backup non valido: attachments mancante',
  )
  const manifest: BackupManifest = {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: requireStringField(value, 'exportedAt', 'Backup non valido: exportedAt mancante'),
    source: isRecord(value.source)
      ? {
          app: typeof value.source.app === 'string' ? value.source.app : 'unknown',
          ...(typeof value.source.appVersion === 'string'
            ? { appVersion: value.source.appVersion }
            : {}),
        }
      : { app: 'unknown' },
    exam: {
      originalExamId: requireStringField(
        value.exam,
        'originalExamId',
        'Backup non valido: originalExamId mancante',
      ),
      name: requireStringField(value.exam, 'name', 'Backup non valido: name mancante'),
      createdAt: requireStringField(
        value.exam,
        'createdAt',
        'Backup non valido: createdAt mancante',
      ),
      files: {
        ...(quiz ? { quiz } : {}),
        ...(flashcard ? { flashcard } : {}),
        ...(riassunto ? { riassunto } : {}),
      },
      attachments: attachments.map((attachment) => normalizeAttachmentEntry(attachment)),
    },
    studyState: {
      quizSessions: requireArrayField<QuizSession>(
        value.studyState,
        'quizSessions',
        'Backup non valido: quizSessions mancante',
      ),
      questionStats: requireArrayField<QuestionStats>(
        value.studyState,
        'questionStats',
        'Backup non valido: questionStats mancante',
      ),
      flashcardStats: requireArrayField<FlashcardStats>(
        value.studyState,
        'flashcardStats',
        'Backup non valido: flashcardStats mancante',
      ),
      pausedSessions: requireArrayField<PausedSession>(
        value.studyState,
        'pausedSessions',
        'Backup non valido: pausedSessions mancante',
      ),
    },
  }

  validateRecordExamIds(manifest)
  return manifest
}

async function readZip(archive: ArrayBuffer): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(archive)
  } catch {
    throw new Error('Backup non valido: archivio ZIP non leggibile')
  }
}

async function readFileRecord(zip: JSZip, entry: BackupFileEntry): Promise<FileRecord> {
  const file = zip.file(entry.path)
  if (!file) {
    throw new Error(`Backup non valido: file referenziato mancante ${entry.path}`)
  }
  const bytes = await file.async('uint8array')
  return {
    name: entry.name,
    type: entry.type,
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}

async function readAttachment(zip: JSZip, entry: BackupAttachmentEntry): Promise<ExamAttachment> {
  const file = await readFileRecord(zip, entry)
  return {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    data: file.data,
    createdAt: entry.createdAt,
  }
}

function assertNoUnreferencedFiles(zip: JSZip, manifest: BackupManifest): void {
  const referenced = collectManifestPaths(manifest)
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    if (!referenced.has(path)) {
      throw new Error(`Backup non valido: file non dichiarato ${path}`)
    }
  }
}

export async function readExamBackupArchive(archive: ArrayBuffer): Promise<ExamBackupSourceBundle> {
  const zip = await readZip(archive)
  const manifestFile = zip.file(BACKUP_MANIFEST_PATH)

  if (!manifestFile) {
    throw new Error('Backup non valido: manifest.json mancante')
  }

  const manifest = normalizeManifest(
    parseJson(
      await manifestFile.async('string'),
      'Backup non valido: manifest.json malformato',
    ),
  )
  assertNoUnreferencedFiles(zip, manifest)

  const quiz = manifest.exam.files.quiz
    ? await readFileRecord(zip, manifest.exam.files.quiz)
    : undefined
  const flashcard = manifest.exam.files.flashcard
    ? await readFileRecord(zip, manifest.exam.files.flashcard)
    : undefined
  const riassunto = manifest.exam.files.riassunto
    ? await readFileRecord(zip, manifest.exam.files.riassunto)
    : undefined
  const attachments = await Promise.all(
    manifest.exam.attachments.map((attachment) => readAttachment(zip, attachment)),
  )

  if (quiz) {
    validateQuizFile(parseJson(new TextDecoder().decode(quiz.data), 'JSON non valido'))
  }
  if (flashcard) {
    validateFlashcardFile(parseJson(new TextDecoder().decode(flashcard.data), 'JSON non valido'))
  }

  return {
    exam: {
      id: manifest.exam.originalExamId,
      name: manifest.exam.name,
      createdAt: manifest.exam.createdAt,
      files: {
        ...(quiz ? { quiz } : {}),
        ...(flashcard ? { flashcard } : {}),
        ...(riassunto ? { riassunto } : {}),
      },
      attachments,
    },
    quizSessions: manifest.studyState.quizSessions,
    questionStats: manifest.studyState.questionStats,
    flashcardStats: manifest.studyState.flashcardStats,
    pausedSessions: manifest.studyState.pausedSessions,
  }
}

export async function restoreExamBackupArchive(
  _archive: ArrayBuffer,
  _newExamId: string,
): Promise<ImportedExamBackupBundle> {
  throw new Error('Backup archive restore is unavailable')
}
