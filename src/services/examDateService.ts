import type { ExamDate } from '../types'

export interface ExamDateInput {
  date: string
  label: string
  notes: string
}

export type ExamDateValidationResult =
  | { valid: true; value: Pick<ExamDate, 'date' | 'label' | 'notes'> }
  | { valid: false; error: string }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseLocalDate(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) {
    return null
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(year, month - 1, day)

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

function localStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function cleanOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}

function expirationInstant(date: string): Date | null {
  const parsed = parseLocalDate(date)
  if (!parsed) {
    return null
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + 2)
}

export function sortExamDates(dates: ExamDate[]): ExamDate[] {
  return [...dates].sort((left, right) => {
    const byDate = left.date.localeCompare(right.date)
    if (byDate !== 0) {
      return byDate
    }

    return left.createdAt.localeCompare(right.createdAt)
  })
}

export function normalizeExamDates(value: unknown): ExamDate[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized = value.flatMap((item): ExamDate[] => {
    if (typeof item !== 'object' || item === null) {
      return []
    }

    const record = item as Partial<ExamDate>
    if (
      typeof record.id !== 'string' ||
      typeof record.date !== 'string' ||
      typeof record.createdAt !== 'string' ||
      !parseLocalDate(record.date)
    ) {
      return []
    }

    const label = cleanOptionalText(record.label)
    const notes = cleanOptionalText(record.notes)

    return [
      {
        id: record.id,
        date: record.date,
        ...(label ? { label } : {}),
        ...(notes ? { notes } : {}),
        createdAt: record.createdAt,
      },
    ]
  })

  return sortExamDates(normalized)
}

export function validateExamDateInput(input: ExamDateInput): ExamDateValidationResult {
  if (!parseLocalDate(input.date)) {
    return { valid: false, error: 'Inserisci una data valida.' }
  }

  const label = cleanOptionalText(input.label)
  const notes = cleanOptionalText(input.notes)

  return {
    valid: true,
    value: {
      date: input.date,
      ...(label ? { label } : {}),
      ...(notes ? { notes } : {}),
    },
  }
}

export function pruneExpiredExamDates(
  dates: ExamDate[],
  now = new Date(),
): { dates: ExamDate[]; pruned: boolean } {
  const current = localStartOfDay(now).getTime()
  const active = dates.filter((examDate) => {
    const expiresAt = expirationInstant(examDate.date)
    return expiresAt !== null && current < expiresAt.getTime()
  })

  return {
    dates: sortExamDates(active),
    pruned: active.length !== dates.length,
  }
}

export function countdownLabel(date: string, now = new Date()): string {
  const target = parseLocalDate(date)
  if (!target) {
    return date
  }

  const diffDays = Math.round(
    (localStartOfDay(target).getTime() - localStartOfDay(now).getTime()) / MS_PER_DAY,
  )

  if (diffDays === -1) {
    return 'ieri'
  }

  if (diffDays === 0) {
    return 'oggi'
  }

  if (diffDays === 1) {
    return '1 giorno'
  }

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} giorni fa`
  }

  return `${diffDays} giorni`
}
