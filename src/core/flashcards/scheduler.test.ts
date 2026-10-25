import { describe, expect, it } from 'vitest'
import { scheduleReview, type CardState, type Grade } from './scheduler'

const NOW = new Date('2026-10-26T09:00:00.000Z')
const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

/** Grades a new card in order, each review happening when the card falls due. Returns every state. */
function review(grades: Grade[], start = NOW): CardState[] {
  const states: CardState[] = []
  let state: CardState | undefined
  let now = start
  for (const grade of grades) {
    state = scheduleReview(state, grade, now)
    states.push(state)
    now = new Date(state.due)
  }
  return states
}

/** Each review's wait until the next one: minutes while learning, days once in review. */
function waits(states: CardState[], start = NOW): string[] {
  let previous = start.getTime()
  return states.map((state) => {
    const wait = Date.parse(state.due) - previous
    previous = Date.parse(state.due)
    return state.phase === 'learning' ? `${wait / MINUTE}m` : `${wait / DAY}d`
  })
}

describe('scheduleReview', () => {
  it('takes a new card through the learning steps, then grows the interval by its ease', () => {
    const states = review(['good', 'good', 'good', 'good', 'good'])

    expect(waits(states)).toEqual(['10m', '1d', '3d', '8d', '20d'])
    expect(states.map((state) => state.phase)).toEqual(['learning', 'review', 'review', 'review', 'review'])
    expect(states.at(-1)).toMatchObject({ intervalDays: 20, ease: 2.5, reps: 5, lapses: 0 })
  })

  it('graduates a new card graded easy straight to a four-day interval', () => {
    const [state] = review(['easy'])

    expect(state).toMatchObject({ phase: 'review', intervalDays: 4, ease: 2.5, reps: 1 })
    expect(waits([state])).toEqual(['4d'])
  })

  it('waits between again and good on hard at the first learning step, as Anki does', () => {
    expect(waits(review(['hard', 'hard', 'good']))).toEqual(['5.5m', '5.5m', '10m'])
  })

  it('repeats a learning step on hard and restarts the steps on again', () => {
    expect(waits(review(['good', 'hard', 'again', 'good', 'good']))).toEqual(['10m', '10m', '1m', '10m', '1d'])
  })

  it('makes a review card graded hard grow slowly and lose ease, and easy grow fast and gain ease', () => {
    // Reviews at 1d, 3d, 8d, then hard: 8 × 1.2 = 9.6 → 10 days, ease 2.5 − 0.15.
    const hard = review(['good', 'good', 'good', 'good', 'hard'])
    expect(hard.at(-1)).toMatchObject({ intervalDays: 10, ease: 2.35 })
    // 10 × 2.35 = 23.5 → 24 days.
    expect(scheduleReview(hard.at(-1), 'good', new Date(hard.at(-1)!.due))).toMatchObject({ intervalDays: 24, ease: 2.35 })

    // 8 × 2.5 × 1.3 = 26 days, ease 2.5 + 0.15.
    expect(review(['good', 'good', 'good', 'good', 'easy']).at(-1)).toMatchObject({ intervalDays: 26, ease: 2.65 })
  })

  it('resets a review card graded again to learning, with a lapse and less ease', () => {
    const states = review(['good', 'good', 'good', 'good', 'again', 'good', 'good', 'good'])
    const lapsed = states[4]

    expect(lapsed).toMatchObject({ phase: 'learning', step: 0, intervalDays: 0, ease: 2.3, lapses: 1 })
    // It relearns through the steps, then starts again from a one-day interval: 1 × 2.3 → 2 days.
    expect(waits(states).slice(4)).toEqual(['1m', '10m', '1d', '2d'])
    expect(states.at(-1)).toMatchObject({ phase: 'review', ease: 2.3, reps: 8, lapses: 1 })
  })

  it('never lets ease fall below 1.3', () => {
    let state = review(['easy']).at(-1)
    for (let lapse = 0; lapse < 8; lapse++) {
      state = scheduleReview(state, 'again', NOW)
      state = scheduleReview(state, 'easy', NOW)
    }

    expect(state).toMatchObject({ ease: 1.3, lapses: 8 })
  })

  it('always gives a review card at least one more day than before', () => {
    // At the minimum ease a one-day interval would round back to one day.
    const state: CardState = { phase: 'review', step: 0, intervalDays: 1, ease: 1.3, due: NOW.toISOString(), reps: 3, lapses: 2 }

    expect(scheduleReview(state, 'hard', NOW)).toMatchObject({ intervalDays: 2 })
  })

  it('schedules from the time of the review, not from when the card was due', () => {
    const due = review(['good', 'good']).at(-1)!
    const late = new Date(Date.parse(due.due) + 5 * DAY)

    expect(scheduleReview(due, 'good', late).due).toBe(new Date(late.getTime() + 3 * DAY).toISOString())
  })
})
