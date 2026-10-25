import { describe, expect, it } from 'vitest'
import { buildDailyQueue, deckStats, nextDueAt, type DailyReviewSettings } from './queue'
import { scheduleReview, type CardState } from './scheduler'

/** 13:00 in Baku (UTC+4), where the learner's day runs from 20:00Z to 20:00Z. */
const NOW = new Date('2026-10-26T09:00:00.000Z')
const BAKU = 4 * 60
const settings: DailyReviewSettings = { newCardsPerDay: 20, utcOffsetMinutes: BAKU }

function state(phase: CardState['phase'], due: string, intervalDays = phase === 'review' ? 3 : 0): CardState {
  return { phase, step: 0, intervalDays, ease: 2.5, due, reps: 2, lapses: 0, introduced: '2026-10-01T09:00:00.000Z' }
}

const cards = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }))
const ids = (queue: { cards: { id: string }[] }) => queue.cards.map((card) => card.id)

describe('buildDailyQueue', () => {
  it('puts due cards first, most overdue first, then new cards in Deck order', () => {
    const states = {
      b: state('review', '2026-10-26T08:00:00.000Z'),
      d: state('review', '2026-10-20T08:00:00.000Z'),
      // Due after the learner's day ends at 20:00Z: not part of today's review.
      e: state('review', '2026-10-26T21:00:00.000Z'),
      f: state('learning', '2026-10-26T08:59:00.000Z'),
    }

    const queue = buildDailyQueue(cards, states, settings, NOW)

    expect(ids(queue)).toEqual(['d', 'b', 'f', 'a', 'c'])
    expect(queue.counts).toEqual({ new: 2, learning: 1, review: 2 })
  })

  it('takes in review cards that fall due later today, as Anki counts reviews by day', () => {
    const states = { a: state('review', '2026-10-26T19:59:00.000Z'), b: state('review', '2026-10-26T20:00:00.000Z') }

    expect(ids(buildDailyQueue(cards.slice(0, 2), states, settings, NOW))).toEqual(['a'])
  })

  it('shows learning cards due within the next 20 minutes last, so a session can finish them', () => {
    const states = {
      a: state('learning', '2026-10-26T09:10:00.000Z'),
      b: state('learning', '2026-10-26T09:01:00.000Z'),
      c: state('learning', '2026-10-26T09:30:00.000Z'),
      d: state('review', '2026-10-27T09:05:00.000Z'),
    }

    const queue = buildDailyQueue(cards.slice(0, 5), states, settings, NOW)

    expect(ids(queue)).toEqual(['e', 'b', 'a'])
    expect(queue.counts).toEqual({ new: 1, learning: 2, review: 0 })
  })

  it('takes only as many new cards as the daily limit allows', () => {
    expect(ids(buildDailyQueue(cards, {}, { ...settings, newCardsPerDay: 2 }, NOW))).toEqual(['a', 'b'])
    expect(ids(buildDailyQueue(cards, {}, { ...settings, newCardsPerDay: 0 }, NOW))).toEqual([])
  })

  it('counts the new cards introduced today, in any Deck, against the limit', () => {
    // Cards of another Deck, introduced this morning and yesterday evening (local time).
    const states = {
      'other/1': scheduleReview(undefined, 'easy', new Date('2026-10-26T05:00:00.000Z')),
      'other/2': scheduleReview(undefined, 'good', new Date('2026-10-26T06:00:00.000Z')),
      'other/3': scheduleReview(undefined, 'good', new Date('2026-10-25T19:00:00.000Z')),
    }

    expect(ids(buildDailyQueue(cards, states, { ...settings, newCardsPerDay: 3 }, NOW))).toEqual(['a'])
  })

  it('starts a fresh new-card allowance at local midnight', () => {
    const limit = { ...settings, newCardsPerDay: 2 }
    // 23:00 in Baku: both of the day's new cards are introduced.
    const lateEvening = new Date('2026-10-26T19:00:00.000Z')
    let states: Record<string, CardState> = {}
    for (const card of buildDailyQueue(cards, states, limit, lateEvening).cards) {
      states = { ...states, [card.id]: scheduleReview(undefined, 'easy', lateEvening) }
    }
    expect(ids(buildDailyQueue(cards, states, limit, new Date('2026-10-26T19:59:00.000Z')))).toEqual([])

    // 00:30 the next day, in Baku.
    expect(ids(buildDailyQueue(cards, states, limit, new Date('2026-10-26T20:30:00.000Z')))).toEqual(['c', 'd'])
  })

  it('does not count cards against the limit whose introduction was not recorded', () => {
    const { introduced: _, ...unrecorded } = scheduleReview(undefined, 'good', NOW)

    expect(ids(buildDailyQueue(cards.slice(0, 2), { a: unrecorded }, { ...settings, newCardsPerDay: 1 }, NOW))).toEqual(['b', 'a'])
  })
})

describe('deckStats', () => {
  it('counts new, learning, young and mature cards, and the cards due in today\'s review', () => {
    const states = {
      a: state('learning', '2026-10-26T09:05:00.000Z'),
      // Learning, but 40 minutes away: not in the review yet.
      g: state('learning', '2026-10-26T09:40:00.000Z'),
      b: state('review', '2026-10-26T15:00:00.000Z', 20),
      // Mature from a 21-day interval, as in Anki.
      c: state('review', '2026-11-10T08:00:00.000Z', 21),
      d: state('review', '2026-10-27T08:00:00.000Z', 4),
    }

    expect(deckStats([...cards, { id: 'g' }], states, settings, NOW)).toEqual({ total: 7, new: 2, learning: 2, young: 2, mature: 1, due: 2 })
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
