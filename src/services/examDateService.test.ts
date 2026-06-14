import { describe, expect, it } from 'vitest'
import type { ExamDate } from '../types'
import {
  countdownLabel,
  normalizeExamDates,
  pruneExpiredExamDates,
  sortExamDates,
  validateExamDateInput,
} from './examDateService'

const now = new Date('2026-07-12T00:00:00')

function examDate(overrides: Partial<ExamDate> = {}): ExamDate {
  return {
    id: 'date-1',
    date: '2026-07-15',
    createdAt: '2026-06-14T10:00:00.000Z',
    ...overrides,
  }
}

describe('examDateService', () => {
  it('normalizes, trims, and sorts exam dates', () => {
    expect(
      normalizeExamDates([
        examDate({
          id: 'b',
          date: '2026-09-01',
          label: '  Orale  ',
          notes: '  Aula 2  ',
        }),
        examDate({
          id: 'a',
          date: '2026-07-15',
          label: '   ',
          notes: '',
        }),
      ]),
    ).toEqual([
      {
        id: 'a',
        date: '2026-07-15',
        createdAt: '2026-06-14T10:00:00.000Z',
      },
      {
        id: 'b',
        date: '2026-09-01',
        label: 'Orale',
        notes: 'Aula 2',
        createdAt: '2026-06-14T10:00:00.000Z',
      },
    ])
  })

  it('rejects invalid date input', () => {
    expect(validateExamDateInput({ date: '', label: '', notes: '' })).toEqual({
      valid: false,
      error: 'Inserisci una data valida.',
    })
    expect(validateExamDateInput({ date: '2026-02-31', label: '', notes: '' })).toEqual({
      valid: false,
      error: 'Inserisci una data valida.',
    })
  })

  it('accepts valid date input and omits empty label and notes', () => {
    expect(validateExamDateInput({ date: '2026-07-15', label: '  Scritto ', notes: '  ' })).toEqual({
      valid: true,
      value: {
        date: '2026-07-15',
        label: 'Scritto',
      },
    })
  })

  it('sorts by date and then creation time', () => {
    expect(
      sortExamDates([
        examDate({ id: 'later-created', date: '2026-07-15', createdAt: '2026-06-15T10:00:00.000Z' }),
        examDate({ id: 'earlier-date', date: '2026-07-01', createdAt: '2026-06-16T10:00:00.000Z' }),
        examDate({ id: 'earlier-created', date: '2026-07-15', createdAt: '2026-06-14T10:00:00.000Z' }),
      ]).map((date) => date.id),
    ).toEqual(['earlier-date', 'earlier-created', 'later-created'])
  })

  it('keeps dates through the 24-hour grace period and prunes them at the next midnight', () => {
    expect(
      pruneExpiredExamDates(
        [
          examDate({ id: 'expired', date: '2026-07-10' }),
          examDate({ id: 'grace', date: '2026-07-11' }),
          examDate({ id: 'future', date: '2026-07-15' }),
        ],
        now,
      ),
    ).toEqual({
      dates: [
        examDate({ id: 'grace', date: '2026-07-11' }),
        examDate({ id: 'future', date: '2026-07-15' }),
      ],
      pruned: true,
    })
  })

  it('formats countdown labels for yesterday, today, tomorrow, and future days', () => {
    const reference = new Date('2026-07-12T12:00:00')

    expect(countdownLabel('2026-07-11', reference)).toBe('ieri')
    expect(countdownLabel('2026-07-12', reference)).toBe('oggi')
    expect(countdownLabel('2026-07-13', reference)).toBe('1 giorno')
    expect(countdownLabel('2026-07-20', reference)).toBe('8 giorni')
  })
})
