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

export async function readExamBackupArchive(_archive: ArrayBuffer): Promise<ExamBackupSourceBundle> {
  throw new Error('Backup archive reading is unavailable')
}

export async function restoreExamBackupArchive(
  _archive: ArrayBuffer,
  _newExamId: string,
): Promise<ImportedExamBackupBundle> {
  throw new Error('Backup archive restore is unavailable')
}
