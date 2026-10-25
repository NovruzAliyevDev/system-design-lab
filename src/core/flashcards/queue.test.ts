import { describe, expect, it } from 'vitest'
import { nextDueAt, reviewCounts, reviewQueue } from './queue'
import type { CardState } from './scheduler'

const NOW = new Date('2026-10-26T09:00:00.000Z')

function state(phase: CardState['phase'], due: string): CardState {
  return { phase, step: 0, intervalDays: phase === 'review' ? 3 : 0, ease: 2.5, due, reps: 2, lapses: 0 }
}

const cards = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }))

describe('reviewQueue', () => {
  it('puts due cards first, most overdue first, then new cards in deck order', () => {
    const states = {
      b: state('review', '2026-10-26T08:00:00.000Z'),
      d: state('review', '2026-10-20T08:00:00.000Z'),
      // Due in a few days: not part of today's review.
      e: state('review', '2026-10-29T08:00:00.000Z'),
      f: state('learning', '2026-10-26T08:59:00.000Z'),
    }

    expect(reviewQueue(cards, states, NOW).map((card) => card.id)).toEqual(['d', 'b', 'f', 'a', 'c'])
  })

  it('counts a card due exactly now as due', () => {
    expect(reviewQueue([{ id: 'a' }], { a: state('review', NOW.toISOString()) }, NOW)).toEqual([{ id: 'a' }])
  })

  it('shows learning cards due within the next 20 minutes last, so a session can finish them', () => {
    const states = {
      a: state('learning', '2026-10-26T09:10:00.000Z'),
      b: state('learning', '2026-10-26T09:01:00.000Z'),
      c: state('learning', '2026-10-26T09:30:00.000Z'),
      d: state('review', '2026-10-26T09:05:00.000Z'),
    }

    expect(reviewQueue(cards.slice(0, 5), states, NOW).map((card) => card.id)).toEqual(['e', 'b', 'a'])
  })
})

describe('reviewCounts', () => {
  it('counts new cards and cards due now', () => {
    const states = { b: state('review', '2026-10-25T08:00:00.000Z'), c: state('review', '2026-10-30T08:00:00.000Z') }

    expect(reviewCounts(cards.slice(0, 3), states, NOW)).toEqual({ due: 1, new: 1 })
  })
})

describe('nextDueAt', () => {
  it('is when the first reviewed card falls due, new cards aside', () => {
    const states = { b: state('review', '2026-10-28T08:00:00.000Z'), c: state('learning', '2026-10-26T09:30:00.000Z') }

    expect(nextDueAt(cards.slice(0, 3), states)).toEqual(new Date('2026-10-26T09:30:00.000Z'))
  })

  it('is undefined while no card has been reviewed', () => {
    expect(nextDueAt(cards, {})).toBeUndefined()
  })
})
