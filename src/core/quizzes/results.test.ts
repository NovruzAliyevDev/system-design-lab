import { describe, expect, it } from 'vitest'
import { recordQuizResult } from './results'

const MONDAY = new Date('2026-10-26T09:00:00.000Z')
const TUESDAY = new Date('2026-10-27T09:00:00.000Z')

describe('recordQuizResult', () => {
  it('records the first attempt of a quiz as its best score', () => {
    expect(recordQuizResult({ results: {} }, 'cache-basics', 0.5, MONDAY)).toEqual({
      results: { 'cache-basics': { bestScore: 0.5, lastAttemptAt: MONDAY.toISOString() } },
    })
  })

  it('keeps the best score across attempts, and the time of the latest attempt', () => {
    const afterMonday = recordQuizResult({ results: {} }, 'cache-basics', 0.75, MONDAY)

    expect(recordQuizResult(afterMonday, 'cache-basics', 0.25, TUESDAY).results['cache-basics']).toEqual({
      bestScore: 0.75,
      lastAttemptAt: TUESDAY.toISOString(),
    })
    expect(recordQuizResult(afterMonday, 'cache-basics', 1, TUESDAY).results['cache-basics']).toEqual({
      bestScore: 1,
      lastAttemptAt: TUESDAY.toISOString(),
    })
  })

  it('leaves the results of other quizzes alone', () => {
    const progress = { results: { 'write-through': { bestScore: 1, lastAttemptAt: MONDAY.toISOString() } } }

    expect(recordQuizResult(progress, 'cache-basics', 0.5, TUESDAY).results).toEqual({
      'write-through': { bestScore: 1, lastAttemptAt: MONDAY.toISOString() },
      'cache-basics': { bestScore: 0.5, lastAttemptAt: TUESDAY.toISOString() },
    })
  })

  it('rejects a score outside 0 to 1', () => {
    expect(() => recordQuizResult({ results: {} }, 'cache-basics', 1.25, MONDAY)).toThrow(RangeError)
    expect(() => recordQuizResult({ results: {} }, 'cache-basics', Number.NaN, MONDAY)).toThrow(RangeError)
  })
})
