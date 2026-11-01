import type { Attempt } from '../challenges/attempt'
import { isRecord, isText, isTimestamp } from '../content/validation'

/**
 * Something the learner did that counts toward the streak, with when it was done (ISO timestamp):
 * finishing the daily review, reading a Lesson, completing a quiz, or ending a Challenge Stage.
 */
export type Activity =
  | { kind: 'daily-review'; at: string }
  | { kind: 'lesson-read'; at: string; lessonId: string }
  | { kind: 'quiz'; at: string; quizId: string }
  | { kind: 'challenge-stage'; at: string; challengeId: string; stageId: string }

/** The Lesson or Challenge the learner opened last. */
export type OpenedItem = { kind: 'lesson'; lessonId: string } | { kind: 'challenge'; challengeId: string }

/**
 * The Stages an update of a Challenge's current Attempt ended: those over in `after` but not in
 * `before`, the Attempt as it was stored. Dated when each ended.
 */
export function stageActivities(challengeId: string, before: Attempt | undefined, after: Attempt): Activity[] {
  return Object.entries(after.stages).flatMap(([stageId, work]): Activity[] =>
    work.outcome && !before?.stages[stageId]?.outcome ? [{ kind: 'challenge-stage', at: work.outcome.finishedAt, challengeId, stageId }] : [],
  )
}

/** A stored activity in the current format; undefined when it is not one. */
export function readActivity(value: unknown): Activity | undefined {
  if (!isRecord(value) || !isTimestamp(value.at)) return undefined
  const { at } = value
  switch (value.kind) {
    case 'daily-review':
      return { kind: value.kind, at }
    case 'lesson-read':
      return isText(value.lessonId) ? { kind: value.kind, at, lessonId: value.lessonId } : undefined
    case 'quiz':
      return isText(value.quizId) ? { kind: value.kind, at, quizId: value.quizId } : undefined
    case 'challenge-stage':
      return isText(value.challengeId) && isText(value.stageId)
        ? { kind: value.kind, at, challengeId: value.challengeId, stageId: value.stageId }
        : undefined
    default:
      return undefined
  }
}

/** A stored item opened last; undefined when it is not one. */
export function readOpenedItem(value: unknown): OpenedItem | undefined {
  if (!isRecord(value)) return undefined
  if (value.kind === 'lesson' && isText(value.lessonId)) return { kind: value.kind, lessonId: value.lessonId }
  if (value.kind === 'challenge' && isText(value.challengeId)) return { kind: value.kind, challengeId: value.challengeId }
  return undefined
}
