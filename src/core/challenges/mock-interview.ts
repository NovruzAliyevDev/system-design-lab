import { isRecord } from '../content/validation'
import type { Attempt } from './attempt'
import type { Challenge, StageType } from './challenge'

// A Mock Interview runs a Challenge under interview conditions: a time limit with a suggested time box
// per Stage, no Hints, and a self-assessment at the end. Its clock comes from the timestamps the Attempt
// stores, so it carries on across reloads.

export const DEFAULT_INTERVIEW_MINUTES = 45

/** A 45-minute interview's time boxes by Stage type; other lengths and Stage sets are shared out in proportion. */
const STAGE_TYPE_MINUTES: Record<StageType, number> = {
  requirements: 5,
  estimation: 5,
  'high-level-design': 15,
  'deep-dive': 10,
  scaling: 10,
}

/** How long a Mock Interview lasts, and the time suggested for each Stage. Time boxes do not block anything. */
export interface InterviewPlan {
  minutes: number
  /** Stage id → minutes. */
  timeBoxes: Record<string, number>
}

/**
 * Time boxes for every Stage of the Challenge in whole minutes, which add up to the interview's length
 * rounded to a minute. Every Stage gets at least a minute, even when the interview is shorter than that.
 */
export function defaultInterviewPlan(challenge: Challenge, minutes = DEFAULT_INTERVIEW_MINUTES): InterviewPlan {
  const wholeMinutes = Math.round(minutes)
  const weights = challenge.stages.map((stage) => STAGE_TYPE_MINUTES[stage.type])
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const exact = weights.map((weight) => (wholeMinutes * weight) / totalWeight)
  const boxes = exact.map(Math.floor)
  // Largest remainders first, earlier Stages winning ties, until the boxes add up.
  const byRemainder = exact.map((value, i) => ({ i, remainder: value - boxes[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i)
  const missing = wholeMinutes - boxes.reduce((sum, box) => sum + box, 0)
  for (const { i } of byRemainder.slice(0, missing)) boxes[i] += 1
  return { minutes, timeBoxes: Object.fromEntries(challenge.stages.map((stage, i) => [stage.id, Math.max(1, boxes[i])])) }
}

/** A new Attempt in mock interview mode, with no work yet. Throws a `RangeError` for a plan without a positive time for the interview and each Stage. */
export function startMockInterview(challenge: Challenge, plan: InterviewPlan, now: Date): Attempt {
  if (!isMinutes(plan.minutes)) throw new RangeError('A Mock Interview needs a positive length.')
  const missing = challenge.stages.find((stage) => !isMinutes(plan.timeBoxes[stage.id]))
  if (missing) throw new RangeError(`Stage "${missing.id}" needs a positive time box.`)
  const timeBoxes = Object.fromEntries(challenge.stages.map((stage) => [stage.id, plan.timeBoxes[stage.id]]))
  return { mode: 'mock-interview', startedAt: now.toISOString(), stages: {}, interview: { minutes: plan.minutes, timeBoxes } }
}

/** Where a Stage stands against its time box. */
export interface StageClock {
  stageId: string
  state: 'over' | 'current' | 'upcoming'
  /** From the end of the Stage before (or the start) to the Stage's own end, or to now. */
  elapsedMs: number
  timeBoxMs: number
  overTimeBox: boolean
}

/** A Mock Interview's time: overall, and for each Stage against its time box. */
export interface InterviewClock {
  totalMs: number
  /** From the start to the end of the last Stage, or to now. */
  elapsedMs: number
  /** Negative in overtime. */
  remainingMs: number
  overtime: boolean
  /** False once every Stage is over: the clock has stopped. */
  running: boolean
  stages: StageClock[]
}

/** The interview's time and each Stage's against its time box. Throws a `RangeError` for an Attempt that is not a Mock Interview. */
export function interviewClock(challenge: Challenge, attempt: Attempt, now: Date): InterviewClock {
  const { interview } = attempt
  if (attempt.mode !== 'mock-interview' || !interview) throw new RangeError('Only a Mock Interview has a clock.')
  const startedAt = Date.parse(attempt.startedAt)
  const end = attempt.finishedAt === undefined ? now.getTime() : Date.parse(attempt.finishedAt)
  let stageStart = startedAt
  let currentFound = false
  const stages = challenge.stages.map((stage): StageClock => {
    const timeBoxMs = (interview.timeBoxes[stage.id] ?? 0) * 60_000
    const finishedAt = attempt.stages[stage.id]?.outcome?.finishedAt
    let state: StageClock['state'] = 'upcoming'
    let elapsedMs = 0
    if (finishedAt !== undefined) {
      state = 'over'
      elapsedMs = Date.parse(finishedAt) - stageStart
      stageStart = Date.parse(finishedAt)
    } else if (!currentFound) {
      state = 'current'
      currentFound = true
      elapsedMs = end - stageStart
    }
    return { stageId: stage.id, state, elapsedMs, timeBoxMs, overTimeBox: elapsedMs > timeBoxMs }
  })
  const totalMs = interview.minutes * 60_000
  const elapsedMs = end - startedAt
  return { totalMs, elapsedMs, remainingMs: totalMs - elapsedMs, overtime: elapsedMs > totalMs, running: attempt.finishedAt === undefined, stages }
}

/** What the learner rates themselves on after a Mock Interview. */
export const RUBRIC_CRITERIA = ['communication', 'scoping', 'estimation', 'design', 'trade-offs', 'scaling'] as const
export type RubricCriterion = (typeof RUBRIC_CRITERIA)[number]

/** Ratings run from 1 to this. */
export const RUBRIC_LEVELS = 5

/** What the learner gives: a rating per criterion and free notes. */
export interface SelfAssessmentInput {
  ratings: Record<RubricCriterion, number>
  notes: string
}

export interface SelfAssessment extends SelfAssessmentInput {
  /** ISO timestamp. */
  assessedAt: string
}

/**
 * Records the learner's self-assessment of a finished Mock Interview, replacing any before. Throws a
 * `RangeError` for another Attempt, or unless every criterion is rated with a whole number from 1 to 5.
 */
export function assessInterview(attempt: Attempt, input: SelfAssessmentInput, now: Date): Attempt {
  if (attempt.mode !== 'mock-interview' || attempt.finishedAt === undefined) throw new RangeError('Only a finished Mock Interview is self-assessed.')
  if (!isRatings(input.ratings)) throw new RangeError(`Every criterion needs a whole rating from 1 to ${RUBRIC_LEVELS}.`)
  return { ...attempt, selfAssessment: { ratings: criteriaOf(input.ratings), notes: input.notes, assessedAt: now.toISOString() } }
}

/** The mean of a self-assessment's ratings, from 1 to `RUBRIC_LEVELS`. */
export function averageRating(ratings: Record<RubricCriterion, number>): number {
  return RUBRIC_CRITERIA.reduce((sum, criterion) => sum + ratings[criterion], 0) / RUBRIC_CRITERIA.length
}

/** A stored plan checked against its schema: a time box for at least one Stage. Stage ids are not checked against a Challenge. */
export function readInterviewPlan(value: unknown): InterviewPlan | undefined {
  if (!isRecord(value) || !isMinutes(value.minutes) || !isRecord(value.timeBoxes)) return undefined
  const boxes = Object.entries(value.timeBoxes)
  if (boxes.length === 0 || !boxes.every(([, minutes]) => isMinutes(minutes))) return undefined
  return { minutes: value.minutes, timeBoxes: Object.fromEntries(boxes) as Record<string, number> }
}

/** A stored self-assessment checked against its schema. */
export function readSelfAssessment(value: unknown): SelfAssessment | undefined {
  if (!isRecord(value) || !isRatings(value.ratings) || typeof value.notes !== 'string') return undefined
  if (typeof value.assessedAt !== 'string' || Number.isNaN(Date.parse(value.assessedAt))) return undefined
  return {
    ratings: criteriaOf(value.ratings),
    notes: value.notes,
    assessedAt: value.assessedAt,
  }
}

/** Only the rubric's criteria, in its order. */
function criteriaOf(ratings: Record<RubricCriterion, number>): Record<RubricCriterion, number> {
  return Object.fromEntries(RUBRIC_CRITERIA.map((criterion) => [criterion, ratings[criterion]])) as Record<RubricCriterion, number>
}

function isRatings(value: unknown): value is Record<RubricCriterion, number> {
  return isRecord(value) && RUBRIC_CRITERIA.every((criterion) => Number.isInteger(value[criterion]) && (value[criterion] as number) >= 1 && (value[criterion] as number) <= RUBRIC_LEVELS)
}

function isMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
