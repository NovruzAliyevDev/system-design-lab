export const GRADES = ['again', 'hard', 'good', 'easy'] as const

export type Grade = (typeof GRADES)[number]

/**
 * Where a Flashcard is in the learner's memory, as the Review Scheduler left it. A card that has
 * never been reviewed has no state: it is new.
 */
export interface CardState {
  /** `learning` while the card goes through the short learning steps, `review` once it has graduated. */
  phase: 'learning' | 'review'
  /** Index of the learning step the card is on; 0 in review. */
  step: number
  /** Days from the last review to the next; 0 while learning. */
  intervalDays: number
  /** How much each successful review multiplies the interval. */
  ease: number
  /** When the card is next due (ISO timestamp). */
  due: string
  reps: number
  /** Times the card was forgotten (graded again) after graduating. */
  lapses: number
}

/** Delays of the learning steps a new or forgotten card goes through before it graduates. */
const LEARNING_STEPS_MINUTES = [1, 10]
const GRADUATING_INTERVAL_DAYS = 1
const EASY_INTERVAL_DAYS = 4
const STARTING_EASE = 2.5
const MINIMUM_EASE = 1.3
const HARD_INTERVAL_FACTOR = 1.2
const EASY_BONUS = 1.3
const EASE_CHANGE: Record<Grade, number> = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 }

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

/**
 * SM-2-style scheduling, as in Anki. A new or forgotten card goes through the learning steps (again
 * restarts them, hard repeats one, good moves to the next, easy graduates at once). On the first
 * step, hard waits halfway between again and good. A graduated card's
 * interval grows by its ease on good, a little on hard and most on easy; again sends it back to
 * learning. `state` is undefined for a new card.
 */
export function scheduleReview(state: CardState | undefined, grade: Grade, now: Date): CardState {
  const card = state ?? { phase: 'learning', step: 0, intervalDays: 0, ease: STARTING_EASE, due: now.toISOString(), reps: 0, lapses: 0 }
  const reps = card.reps + 1
  return card.phase === 'learning' ? learn(card, grade, now, reps) : reviewGraduated(card, grade, now, reps)
}

function learn(card: CardState, grade: Grade, now: Date, reps: number): CardState {
  const step = grade === 'again' ? 0 : grade === 'hard' ? card.step : card.step + 1
  if (grade === 'easy' || step >= LEARNING_STEPS_MINUTES.length) {
    // A card that lapsed relearns its steps, then starts over from the graduating interval.
    const intervalDays = grade === 'easy' ? EASY_INTERVAL_DAYS : GRADUATING_INTERVAL_DAYS
    return { ...card, phase: 'review', step: 0, intervalDays, due: addDays(now, intervalDays), reps }
  }
  const delayMinutes =
    grade === 'hard' && step === 0 ? (LEARNING_STEPS_MINUTES[0] + LEARNING_STEPS_MINUTES[1]) / 2 : LEARNING_STEPS_MINUTES[step]
  return { ...card, step, due: new Date(now.getTime() + delayMinutes * MINUTE_MS).toISOString(), reps }
}

function reviewGraduated(card: CardState, grade: Grade, now: Date, reps: number): CardState {
  const ease = Math.max(MINIMUM_EASE, round2(card.ease + EASE_CHANGE[grade]))
  if (grade === 'again') {
    const lapsed = { ...card, phase: 'learning', step: 0, intervalDays: 0, ease, lapses: card.lapses + 1 } as const
    return learn(lapsed, 'again', now, reps)
  }
  const factor = grade === 'hard' ? HARD_INTERVAL_FACTOR : grade === 'good' ? card.ease : card.ease * EASY_BONUS
  // Every successful review waits at least a day longer than the last.
  const intervalDays = Math.max(card.intervalDays + 1, Math.round(card.intervalDays * factor))
  return { ...card, intervalDays, ease, due: addDays(now, intervalDays), reps }
}

function addDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString()
}

/** Rounds to two decimals, so repeated ease changes do not drift (2.5 − 0.15 is 2.35, not 2.3499…). */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** A card state read from stored or imported progress, with only the known fields; undefined if it is not one. */
export function readCardState(value: unknown): CardState | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { phase, step, intervalDays, ease, due, reps, lapses } = value as Record<string, unknown>
  const counts = [step, intervalDays, reps, lapses]
  const valid =
    (phase === 'learning' || phase === 'review') &&
    counts.every((count) => Number.isInteger(count) && (count as number) >= 0) &&
    typeof ease === 'number' &&
    ease >= MINIMUM_EASE &&
    typeof due === 'string' &&
    !Number.isNaN(Date.parse(due))
  return valid ? { phase, step, intervalDays, ease, due, reps, lapses } as CardState : undefined
}
