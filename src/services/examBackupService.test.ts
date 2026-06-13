import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  makeEsame,
  makeExamAttachment,
  makeFlashcardFile,
  makePausedFlash,
  makePausedQuiz,
  makeQuizFile,
  makeQuizSession,
} from '../__tests__/factories'
import type { FileRecord, FlashcardStats, QuestionStats } from '../types'
import {
  BACKUP_ARCHIVE_EXTENSION,
  BACKUP_MANIFEST_PATH,
  BACKUP_SCHEMA_VERSION,
  buildExamBackupArchive,
  readExamBackupArchive,
  restoreExamBackupArchive,
  suggestedBackupFileName,
} from './examBackupService'

function encodeText(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function encodeJson(value: unknown): ArrayBuffer {
  return encodeText(JSON.stringify(value))
}

function decodeText(value: ArrayBuffer): string {
  return new TextDecoder().decode(value)
}

function fileRecord(name: string, value: string, type = 'text/plain'): FileRecord {
  return {
    name,
    type,
    data: encodeText(value),
  }
}

function questionStat(overrides: Partial<QuestionStats> = {}): QuestionStats {
  return {
    id: 'exam-1__q1',
    examId: 'exam-1',
    questionId: 'q1',
    timesShown: 4,
    timesCorrect: 3,
    ...overrides,
  }
}

function flashcardStat(overrides: Partial<FlashcardStats> = {}): FlashcardStats {
  return {
    id: 'exam-1__f1',
    examId: 'exam-1',
    cardId: 'f1',
    lastEval: 'Sì',
    lastSeen: '2026-06-13T10:00:00.000Z',
    ...overrides,
  }
}

const quizFile = makeQuizFile()
const flashcardFile = makeFlashcardFile()

const fullBundle = {
  exam: makeEsame({
    id: 'exam-1',
    name: 'Diritto privato',
    createdAt: '2026-06-01T08:00:00.000Z',
    files: {
      quiz: {
        name: 'quiz.json',
        type: 'application/json',
        data: encodeJson(quizFile),
      },
      flashcard: {
        name: 'flashcard.json',
        type: 'application/json',
        data: encodeJson(flashcardFile),
      },
      riassunto: fileRecord('summary.html', '<h1>Summary</h1>', 'text/html'),
    },
    attachments: [
      makeExamAttachment({
        id: 'attachment-1',
        name: 'slides.pdf',
        type: 'application/pdf',
        data: encodeText('slides'),
        createdAt: '2026-06-02T08:00:00.000Z',
      }),
    ],
  }),
  quizSessions: [makeQuizSession({ id: 'quiz-session-1', examId: 'exam-1' })],
  questionStats: [questionStat()],
  flashcardStats: [flashcardStat()],
  pausedSessions: [
    makePausedQuiz({ id: 'exam-1__quiz', examId: 'exam-1' }),
    makePausedFlash({ id: 'exam-1__flashcard', examId: 'exam-1' }),
  ],
}

describe('examBackupService', () => {
  it('defines the backup constants and suggested filename', () => {
    expect(BACKUP_SCHEMA_VERSION).toBe(1)
    expect(BACKUP_MANIFEST_PATH).toBe('manifest.json')
    expect(BACKUP_ARCHIVE_EXTENSION).toBe('.pla-exam-backup')
    expect(suggestedBackupFileName('Diritto privato')).toMatch(
      /^diritto-privato-\d{4}-\d{2}-\d{2}\.pla-exam-backup$/,
    )
    expect(suggestedBackupFileName('   !!!   ')).toMatch(
      /^exam-backup-\d{4}-\d{2}-\d{2}\.pla-exam-backup$/,
    )
  })

  it('builds a strict ZIP archive with manifest and referenced files only', async () => {
    const archive = await buildExamBackupArchive(fullBundle, {
      exportedAt: '2026-06-13T12:00:00.000Z',
      appVersion: '0.1.0',
    })
    const zip = await JSZip.loadAsync(archive)
    const paths = Object.keys(zip.files).sort()

    expect(paths).toEqual([
      'attachments/0-attachment-1-slides.pdf',
      'files/flashcard.json',
      'files/quiz.json',
      'files/riassunto.html',
      'manifest.json',
    ])

    const manifest = JSON.parse(
      await zip.file(BACKUP_MANIFEST_PATH)!.async('string'),
    )

    expect(manifest).toEqual({
      version: 1,
      exportedAt: '2026-06-13T12:00:00.000Z',
      source: {
        app: 'personal-learning-assistant',
        appVersion: '0.1.0',
      },
      exam: {
        originalExamId: 'exam-1',
        name: 'Diritto privato',
        createdAt: '2026-06-01T08:00:00.000Z',
        files: {
          quiz: {
            path: 'files/quiz.json',
            name: 'quiz.json',
            type: 'application/json',
          },
          flashcard: {
            path: 'files/flashcard.json',
            name: 'flashcard.json',
            type: 'application/json',
          },
          riassunto: {
            path: 'files/riassunto.html',
            name: 'summary.html',
            type: 'text/html',
          },
        },
        attachments: [
          {
            id: 'attachment-1',
            path: 'attachments/0-attachment-1-slides.pdf',
            name: 'slides.pdf',
            type: 'application/pdf',
            createdAt: '2026-06-02T08:00:00.000Z',
          },
        ],
      },
      studyState: {
        quizSessions: fullBundle.quizSessions,
        questionStats: fullBundle.questionStats,
        flashcardStats: fullBundle.flashcardStats,
        pausedSessions: fullBundle.pausedSessions,
      },
    })

    expect(await zip.file('files/quiz.json')!.async('string')).toBe(JSON.stringify(quizFile))
    expect(await zip.file('files/flashcard.json')!.async('string')).toBe(
      JSON.stringify(flashcardFile),
    )
    expect(await zip.file('files/riassunto.html')!.async('string')).toBe('<h1>Summary</h1>')
    expect(await zip.file('attachments/0-attachment-1-slides.pdf')!.async('string')).toBe('slides')
  })

  it('builds unique attachment archive paths even when sanitized names collide', async () => {
    const archive = await buildExamBackupArchive({
      ...fullBundle,
      exam: {
        ...fullBundle.exam,
        attachments: [
          makeExamAttachment({
            id: 'attachment/1',
            name: 'slides?.pdf',
            type: 'application/pdf',
            data: encodeText('first'),
            createdAt: '2026-06-02T08:00:00.000Z',
          }),
          makeExamAttachment({
            id: 'attachment:1',
            name: 'slides*.pdf',
            type: 'application/pdf',
            data: encodeText('second'),
            createdAt: '2026-06-03T08:00:00.000Z',
          }),
        ],
      },
    })
    const zip = await JSZip.loadAsync(archive)
    const manifest = JSON.parse(
      await zip.file(BACKUP_MANIFEST_PATH)!.async('string'),
    )

    expect(manifest.exam.attachments).toHaveLength(2)
    expect(manifest.exam.attachments[0].path).not.toBe(manifest.exam.attachments[1].path)
    expect(await zip.file(manifest.exam.attachments[0].path)!.async('string')).toBe('first')
    expect(await zip.file(manifest.exam.attachments[1].path)!.async('string')).toBe('second')
  })

  it('documents the temporary read stub failure contract', async () => {
    await expect(readExamBackupArchive(encodeText('stub'))).rejects.toThrow(
      'Backup archive reading is unavailable',
    )
  })

  it('documents the temporary restore stub failure contract', async () => {
    await expect(restoreExamBackupArchive(encodeText('stub'), 'new-exam-id')).rejects.toThrow(
      'Backup archive restore is unavailable',
    )
  })
})
