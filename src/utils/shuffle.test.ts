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

  it('produces both permutations of a two-element array across repeated shuffles', () => {
    const seen = new Set<string>()

    for (let i = 0; i < 100; i += 1) {
      seen.add(shuffle([1, 2]).join(','))
    }

    expect(seen).toEqual(new Set(['1,2', '2,1']))
  })

  it('does not keep any element in its original index for every repeated shuffle', () => {
    const arr = [1, 2, 3, 4, 5]
    const stayedInOriginalIndexEveryTime = arr.map(() => true)

    for (let i = 0; i < 100; i += 1) {
      const result = shuffle(arr)

      result.forEach((value, index) => {
        if (value !== arr[index]) {
          stayedInOriginalIndexEveryTime[index] = false
        }
      })
    }

    expect(stayedInOriginalIndexEveryTime).toEqual([false, false, false, false, false])
  })
})
