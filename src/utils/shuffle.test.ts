import { describe, expect, it } from 'vitest'
import { shuffle } from './shuffle'

describe('shuffle', () => {
  it('returns an array with the same elements', () => {
    const arr = [1, 2, 3, 4, 5]

    const result = shuffle(arr)

    expect([...result].sort()).toEqual([...arr].sort())
  })

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3]
    const copy = [...arr]

    shuffle(arr)

    expect(arr).toEqual(copy)
  })

  it('returns an empty array for an empty array', () => {
    expect(shuffle([])).toEqual([])
  })

  it('returns a single-element array unchanged', () => {
    expect(shuffle([42])).toEqual([42])
  })
})
