import { describe, expect, it } from 'vitest'
import { formatTime } from './formatTime'

describe('formatTime', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats 59 seconds as 0:59', () => {
    expect(formatTime(59)).toBe('0:59')
  })

  it('formats 60 seconds as 1:00', () => {
    expect(formatTime(60)).toBe('1:00')
  })

  it('formats 90 seconds as 1:30', () => {
    expect(formatTime(90)).toBe('1:30')
  })

  it('formats 3661 seconds as 61:01', () => {
    expect(formatTime(3661)).toBe('61:01')
  })
})
