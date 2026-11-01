import type { Activity } from './activity'

/** How many Lesson reads, quizzes and Challenge Stages a day needs to count without the daily review. */
export const DEFAULT_STREAK_MIN_ACTIVITIES = 2
export const MAX_STREAK_MIN_ACTIVITIES = 20

/** What the learner did on one day, and whether that keeps the streak. */
export interface StreakDay {
  /** The daily review was finished, or enough learning activity was done. */
  counts: boolean
  reviewFinished: boolean
  /** Lessons read, quizzes and Challenge Stages done that day, each one once. */
  activities: number
}

export interface Streak {
  /** Days in a row that count, up to today. Until today is over, a streak that ended yesterday still stands. */
  current: number
  longest: number
  today: StreakDay
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The learner's streak at `now`. Days run from midnight to midnight in `timeZone` (an IANA name such
 * as "Asia/Baku"), so each one follows the clock the learner lives by, daylight saving time included.
 * A day counts when the daily review was finished or `minActivities` learning activities were done. Each
 * Lesson, quiz and Challenge Stage counts once a day, so reading or retaking the same one again adds nothing.
 * Activity dated after `now` is left out.
 */
export function computeStreak(log: readonly Activity[], now: Date, timeZone: string, minActivities = DEFAULT_STREAK_MIN_ACTIVITIES): Streak {
  const dayOf = dayNumbers(timeZone)
  const done = new Map<number, { reviewFinished: boolean; items: Set<string> }>()
  for (const activity of log) {
    const at = new Date(activity.at)
    if (at.getTime() > now.getTime()) continue
    const day = dayOf(at)
    const entry = done.get(day) ?? { reviewFinished: false, items: new Set<string>() }
    if (activity.kind === 'daily-review') entry.reviewFinished = true
    else entry.items.add(itemKey(activity))
    done.set(day, entry)
  }
  const days = new Map(
    [...done].map(([day, { reviewFinished, items }]): [number, StreakDay] => [
      day,
      { counts: reviewFinished || items.size >= minActivities, reviewFinished, activities: items.size },
    ]),
  )

  const counted = [...days].filter(([, entry]) => entry.counts).map(([day]) => day)
  const countedDays = new Set(counted)
  let longest = 0
  for (const day of counted) {
    // Only the first day of a run starts counting it.
    if (countedDays.has(day - 1)) continue
    let length = 1
    while (countedDays.has(day + length)) length++
    longest = Math.max(longest, length)
  }

  const today = dayOf(now)
  let current = 0
  for (let day = countedDays.has(today) ? today : today - 1; countedDays.has(day); day--) current++
  return { current, longest, today: days.get(today) ?? { counts: false, reviewFinished: false, activities: 0 } }
}

/** What a learning activity was done on, the same each time it is done again. */
function itemKey(activity: Exclude<Activity, { kind: 'daily-review' }>): string {
  switch (activity.kind) {
    case 'lesson-read':
      return `lesson:${activity.lessonId}`
    case 'quiz':
      return `quiz:${activity.quizId}`
    case 'challenge-stage':
      return `stage:${activity.challengeId}/${activity.stageId}`
  }
}

/** A function giving the calendar day of a moment in `timeZone`, as a number of days since 1 January 1970. */
function dayNumbers(timeZone: string): (date: Date) => number {
  const format = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
  return (date) => {
    const parts = Object.fromEntries(format.formatToParts(date).map(({ type, value }) => [type, value]))
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY_MS
  }
}
