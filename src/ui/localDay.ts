import type { DailyReviewSettings } from '../core/flashcards/queue'

/** The learner's day starts at their local midnight (by the offset in force now). */
export function dailyReviewSettings(newCardsPerDay: number, now: Date): DailyReviewSettings {
  return { newCardsPerDay, utcOffsetMinutes: -now.getTimezoneOffset() }
}

/** The learner's time zone (an IANA name), in which streak days run. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
