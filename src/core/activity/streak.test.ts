import { describe, expect, it } from 'vitest'
import type { Activity } from './activity'
import { computeStreak, DEFAULT_STREAK_MIN_ACTIVITIES } from './streak'

const BAKU = 'Asia/Baku'

const review = (at: string): Activity => ({ kind: 'daily-review', at })
const read = (at: string, lessonId = 'cache'): Activity => ({ kind: 'lesson-read', at, lessonId })
const quiz = (at: string, quizId = 'cache-basics'): Activity => ({ kind: 'quiz', at, quizId })
const stage = (at: string, stageId = 'requirements'): Activity => ({ kind: 'challenge-stage', at, challengeId: 'pastebin', stageId })

describe('computeStreak', () => {
  it('is 0 without any activity', () => {
    expect(computeStreak([], new Date('2026-11-01T10:00:00Z'), BAKU)).toEqual({
      current: 0,
      longest: 0,
      today: { counts: false, reviewFinished: false, activities: 0 },
    })
  })

  it('counts a day when the daily review is finished', () => {
    const streak = computeStreak([review('2026-11-01T08:00:00Z')], new Date('2026-11-01T10:00:00Z'), BAKU)

    expect(streak).toEqual({ current: 1, longest: 1, today: { counts: true, reviewFinished: true, activities: 0 } })
  })

  it('counts a day once Lesson reads, quizzes and Challenge Stages reach the minimum', () => {
    const now = new Date('2026-11-01T10:00:00Z')

    expect(DEFAULT_STREAK_MIN_ACTIVITIES).toBe(2)
    expect(computeStreak([read('2026-11-01T08:00:00Z')], now, BAKU).today).toEqual({ counts: false, reviewFinished: false, activities: 1 })
    expect(computeStreak([read('2026-11-01T08:00:00Z'), quiz('2026-11-01T08:30:00Z')], now, BAKU)).toMatchObject({
      current: 1,
      today: { counts: true, activities: 2 },
    })
    expect(computeStreak([stage('2026-11-01T08:00:00Z'), stage('2026-11-01T09:00:00Z', 'estimation')], now, BAKU).current).toBe(1)
  })

  it('counts each Lesson, quiz and Challenge Stage once a day, so repeating one does not reach the minimum', () => {
    const now = new Date('2026-11-01T10:00:00Z')
    const readTwice = [read('2026-11-01T08:00:00Z'), read('2026-11-01T08:05:00Z')]
    const quizTwice = [quiz('2026-11-01T08:10:00Z'), quiz('2026-11-01T08:20:00Z')]
    const stageTwice = [stage('2026-11-01T08:30:00Z'), stage('2026-11-01T09:30:00Z')]

    expect(computeStreak(readTwice, now, BAKU)).toMatchObject({ current: 0, today: { counts: false, activities: 1 } })
    expect(computeStreak(quizTwice, now, BAKU).today.activities).toBe(1)
    expect(computeStreak(stageTwice, now, BAKU).today.activities).toBe(1)
    expect(computeStreak([...readTwice, ...quizTwice, ...stageTwice], now, BAKU, 3).today).toMatchObject({ counts: true, activities: 3 })
    // The same Lesson read again on another day counts again there.
    expect(computeStreak([read('2026-10-31T08:00:00Z'), read('2026-11-01T08:00:00Z')], now, BAKU, 1).current).toBe(2)
  })

  it('takes the minimum activity from the caller', () => {
    const log = [read('2026-11-01T08:00:00Z'), quiz('2026-11-01T08:30:00Z')]
    const now = new Date('2026-11-01T10:00:00Z')

    expect(computeStreak(log, now, BAKU, 1).current).toBe(1)
    expect(computeStreak(log, now, BAKU, 3)).toMatchObject({ current: 0, today: { counts: false, activities: 2 } })
  })

  it('counts consecutive days, and keeps the streak alive until today is over', () => {
    const log = [review('2026-10-29T08:00:00Z'), review('2026-10-30T08:00:00Z'), review('2026-10-31T08:00:00Z')]

    expect(computeStreak(log, new Date('2026-10-31T10:00:00Z'), BAKU)).toMatchObject({ current: 3, today: { counts: true } })
    // Nothing yet today: yesterday's streak still stands.
    expect(computeStreak(log, new Date('2026-11-01T10:00:00Z'), BAKU)).toMatchObject({ current: 3, longest: 3, today: { counts: false } })
  })

  it('resets after a missed day, but remembers the longest streak', () => {
    const log = [review('2026-10-27T08:00:00Z'), review('2026-10-28T08:00:00Z'), review('2026-10-29T08:00:00Z'), review('2026-10-31T08:00:00Z')]

    expect(computeStreak(log, new Date('2026-10-31T10:00:00Z'), BAKU)).toMatchObject({ current: 1, longest: 3 })
    // 31 October was the last day that counted, so missing 1 November ends the streak on 2 November.
    expect(computeStreak(log, new Date('2026-11-02T10:00:00Z'), BAKU)).toMatchObject({ current: 0, longest: 3 })
  })

  it('splits days at local midnight', () => {
    // 23:50 and 00:10 in Baku (UTC+4): the same day in UTC, two days in Baku.
    const log = [review('2026-10-31T19:50:00Z'), review('2026-10-31T20:10:00Z')]
    const now = new Date('2026-10-31T20:30:00Z')

    expect(computeStreak(log, now, BAKU).current).toBe(2)
    expect(computeStreak(log, now, 'UTC').current).toBe(1)
  })

  it('does not add up activities on either side of local midnight', () => {
    // One activity at 23:30 and one at 00:30 in Baku: neither day reaches the minimum of two.
    const log = [read('2026-10-31T19:30:00Z'), quiz('2026-10-31T20:30:00Z')]

    expect(computeStreak(log, new Date('2026-10-31T21:00:00Z'), BAKU)).toMatchObject({ current: 0, today: { activities: 1 } })
    expect(computeStreak(log, new Date('2026-10-31T21:00:00Z'), 'UTC')).toMatchObject({ current: 1, today: { counts: true } })
  })

  it('places days by the time zone, not by a fixed offset, across a daylight saving change', () => {
    // 23:30 in New York on 30 and 31 October and 1 November 2026, when it leaves daylight saving time:
    // 03:30 UTC before, 04:30 UTC after. A fixed offset of −4 hours puts the last one on 2 November.
    const newYork = 'America/New_York'
    const log = [review('2026-10-31T03:30:00Z'), review('2026-11-01T03:30:00Z'), review('2026-11-02T04:30:00Z')]

    expect(computeStreak(log, new Date('2026-11-02T04:45:00Z'), newYork)).toMatchObject({ current: 3, today: { counts: true } })
  })

  it('ignores activity dated after now', () => {
    expect(computeStreak([review('2026-11-02T08:00:00Z')], new Date('2026-11-01T10:00:00Z'), BAKU).current).toBe(0)
  })
})
