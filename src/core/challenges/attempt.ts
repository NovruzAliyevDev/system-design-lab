import { isRecord } from '../content/validation'
import { emptyDesign, readDesign, type Design } from '../design/design'
import { gradeEstimate } from '../estimation/estimate'
import { gradeQuestion } from '../quizzes/grading'
import type { Challenge, DesignStage, Stage } from './challenge'
import { readInterviewPlan, readSelfAssessment, type InterviewPlan, type SelfAssessment } from './mock-interview'
import { evaluateDesign, HINT_TIERS, type Evaluation, type HintUsage } from './rules'

// An Attempt is one run through a Challenge: the learner's input on each Stage, and each Stage's
// outcome once it is over. Stages open one at a time, in the Challenge's order.

/** How an Attempt is run: at the learner's pace with Hints, or as a timed Mock Interview without them. */
export const ATTEMPT_MODES = ['practice', 'mock-interview'] as const
export type AttemptMode = (typeof ATTEMPT_MODES)[number]

/** What the learner entered on a Stage, by the Stage's type. */
export type StageInput =
  | {
      type: 'requirements'
      /** Indexes of the items checked. */
      chosen: number[]
      notes: string
    }
  | {
      type: 'estimation'
      /** Question id → the learner's estimate, in the question quantity's base unit. */
      answers: Record<string, number>
    }
  | {
      type: 'high-level-design' | 'scaling'
      /** Auto-saved as it changes. */
      design: Design
      /** The Hint tiers opened, which cap the Stage's score. */
      hintUsage: HintUsage
    }
  | {
      type: 'deep-dive'
      /** Per question, the indexes of the options chosen; empty while unanswered. */
      answers: number[][]
    }

/** How a Stage ended. Its results and Reference Solution show from then on, and its input no longer changes. */
export interface StageOutcome {
  /** When the Stage was finished or given up (ISO timestamp). */
  finishedAt: string
  gaveUp: boolean
  /** The share of the Stage's points earned, from 0 to 1; 0 when given up. */
  score: number
  /** For a design Stage, the Evaluation of the Design as it was then. */
  evaluation?: Evaluation
}

export type StageWork = StageInput & { outcome?: StageOutcome }

export interface Attempt {
  mode: AttemptMode
  /** ISO timestamp. */
  startedAt: string
  /** Stage id → the work on it; a Stage with no work yet has none. */
  stages: Record<string, StageWork>
  /** When the last Stage was over (ISO timestamp); the Challenge score is recorded then. */
  finishedAt?: string
  /** The Challenge score, from 0 to 1, once the Attempt is finished. */
  score?: number
  /** A Mock Interview's length and Stage time boxes. */
  interview?: InterviewPlan
  /** A finished Mock Interview's self-assessment, once the learner gives it. */
  selfAssessment?: SelfAssessment
}

/**
 * A new practice Attempt. Retrying from an earlier Attempt starts from its inputs with every Stage open again.
 * The Hints opened stay opened: a Design built with their help keeps their score caps.
 */
export function newAttempt(now: Date, from?: Attempt): Attempt {
  const stages = Object.fromEntries(Object.entries(from?.stages ?? {}).map(([stageId, { outcome: _, ...input }]): [string, StageWork] => [stageId, input]))
  return { mode: 'practice', startedAt: now.toISOString(), stages }
}

/** The work on a Stage: what is stored, or the input a Stage starts with. A Scaling Stage starts from the high-level Design. */
export function stageWork(challenge: Challenge, attempt: Attempt, stageId: string): StageWork {
  const stage = stageOf(challenge, stageId)
  const stored = attempt.stages[stageId]
  if (stored?.type === stage.type) return stored
  switch (stage.type) {
    case 'requirements':
      return { type: stage.type, chosen: [], notes: '' }
    case 'estimation':
      return { type: stage.type, answers: {} }
    case 'deep-dive':
      return { type: stage.type, answers: stage.questions.map(() => []) }
    case 'high-level-design':
      return { type: stage.type, design: emptyDesign(), hintUsage: {} }
    case 'scaling': {
      const highLevel = challenge.stages.find((candidate) => candidate.type === 'high-level-design')
      const start = highLevel && stageWork(challenge, attempt, highLevel.id)
      return { type: stage.type, design: start && 'design' in start ? start.design : emptyDesign(), hintUsage: {} }
    }
  }
}

/** How many Stages, from the first, are open: every Stage that is over, and the one after them. */
export function openStageCount(challenge: Challenge, attempt: Attempt): number {
  const over = challenge.stages.findIndex((stage) => !attempt.stages[stage.id]?.outcome)
  return over === -1 ? challenge.stages.length : over + 1
}

/** Stores the learner's input on an open Stage. Throws for a Stage that is not open or already over, and for Hints in a Mock Interview. */
export function updateStage(challenge: Challenge, attempt: Attempt, stageId: string, input: StageInput): Attempt {
  const stage = openStage(challenge, attempt, stageId)
  checkInputType(stage, input)
  if (attempt.mode === 'mock-interview' && 'hintUsage' in input && Object.values(input.hintUsage).some((tiers) => tiers > 0)) {
    throw new RangeError('A Mock Interview has no Hints.')
  }
  return { ...attempt, stages: { ...attempt.stages, [stageId]: input } }
}

/**
 * Ends an open Stage, recording its score: the score of its input, or 0 when the learner gives up.
 * Ending the last Stage finishes the Attempt with its Challenge score.
 */
export function finishStage(challenge: Challenge, attempt: Attempt, stageId: string, now: Date, { gaveUp = false } = {}): Attempt {
  const stage = openStage(challenge, attempt, stageId)
  const work = stageWork(challenge, attempt, stageId)
  const { score, evaluation } = stageScore(stage, work)
  const outcome: StageOutcome = { finishedAt: now.toISOString(), gaveUp, score: gaveUp ? 0 : score, ...(evaluation && { evaluation }) }
  const finished: Attempt = { ...attempt, stages: { ...attempt.stages, [stageId]: { ...work, outcome } } }
  if (challenge.stages.some((each) => !finished.stages[each.id]?.outcome)) return finished
  return { ...finished, finishedAt: outcome.finishedAt, score: attemptScore(challenge, finished) }
}

/** The share of a Stage's points an input earns, from 0 to 1, with the Evaluation it comes from for a design Stage. */
export function stageScore(stage: Stage, input: StageInput): { score: number; evaluation?: Evaluation } {
  checkInputType(stage, input)
  switch (stage.type) {
    case 'requirements': {
      const { chosen } = input as Extract<StageInput, { type: 'requirements' }>
      // The checklist is graded like a multi-select question: each distractor checked cancels a right pick.
      return { score: gradeQuestion({ type: 'multi-select', prompt: stage.prompt, options: stage.items }, chosen).score }
    }
    case 'estimation': {
      const { answers } = input as Extract<StageInput, { type: 'estimation' }>
      const passed = stage.questions.filter(
        (question) => answers[question.id] !== undefined && gradeEstimate(answers[question.id], question.referenceValue).passed,
      )
      return { score: passed.length / stage.questions.length }
    }
    case 'deep-dive': {
      const { answers } = input as Extract<StageInput, { type: 'deep-dive' }>
      const scores = stage.questions.map((question, i) => gradeQuestion(question, answers[i] ?? []).score)
      return { score: scores.reduce((sum, score) => sum + score, 0) / scores.length }
    }
    case 'high-level-design':
    case 'scaling': {
      const { design, hintUsage } = input as Extract<StageInput, { type: DesignStage['type'] }>
      const evaluation = evaluateDesign(stage, design, hintUsage)
      return { score: evaluation.score / evaluation.totalWeight, evaluation }
    }
  }
}

/** Combines Stage scores (Stage id → 0 to 1) by the Stages' weights; a Stage without a score counts as 0. */
export function challengeScore(challenge: Challenge, stageScores: Readonly<Record<string, number>>): number {
  const totalWeight = challenge.stages.reduce((sum, stage) => sum + stage.weight, 0)
  const earned = challenge.stages.reduce((sum, stage) => sum + stage.weight * (stageScores[stage.id] ?? 0), 0)
  return earned / totalWeight
}

/** The Challenge score of an Attempt's Stages that are over so far. */
export function attemptScore(challenge: Challenge, attempt: Attempt): number {
  const scores = Object.entries(attempt.stages).flatMap(([stageId, work]) => (work.outcome ? [[stageId, work.outcome.score] as const] : []))
  return challengeScore(challenge, Object.fromEntries(scores))
}

/** The best Challenge score of the finished Attempts; undefined while none is finished. */
export function bestAttemptScore(attempts: readonly Attempt[]): number | undefined {
  const scores = attempts.flatMap((attempt) => (attempt.score === undefined ? [] : [attempt.score]))
  return scores.length > 0 ? Math.max(...scores) : undefined
}

/** A stored Attempt checked against its schema, or undefined when it does not fit. Stage ids are not checked against a Challenge. */
export function readAttempt(value: unknown): Attempt | undefined {
  if (!isRecord(value) || !ATTEMPT_MODES.includes(value.mode as AttemptMode) || !isTimestamp(value.startedAt) || !isRecord(value.stages)) return undefined
  if (value.finishedAt !== undefined && !isTimestamp(value.finishedAt)) return undefined
  if (value.score !== undefined && !isShare(value.score)) return undefined
  // A Mock Interview has a plan and may have a self-assessment; a practice Attempt has neither.
  const isInterview = value.mode === 'mock-interview'
  const interview = isInterview ? readInterviewPlan(value.interview) : undefined
  if (isInterview && !interview) return undefined
  const selfAssessment = value.selfAssessment === undefined ? undefined : readSelfAssessment(value.selfAssessment)
  if (value.selfAssessment !== undefined && (!selfAssessment || !isInterview)) return undefined
  const stages: [string, StageWork][] = []
  for (const [stageId, stored] of Object.entries(value.stages)) {
    const work = readStageWork(stored)
    if (!work) return undefined
    if (isInterview && 'hintUsage' in work && Object.values(work.hintUsage).some((tiers) => tiers > 0)) return undefined
    stages.push([stageId, work])
  }
  return {
    mode: value.mode as AttemptMode,
    startedAt: value.startedAt,
    // Object.fromEntries defines keys as own properties, so an id such as `__proto__` stays data.
    stages: Object.fromEntries(stages),
    ...(value.finishedAt !== undefined && { finishedAt: value.finishedAt }),
    ...(value.score !== undefined && { score: value.score }),
    ...(interview && { interview }),
    ...(selfAssessment && { selfAssessment }),
  }
}

function readStageWork(value: unknown): StageWork | undefined {
  if (!isRecord(value)) return undefined
  const outcome = value.outcome === undefined ? undefined : readOutcome(value.outcome)
  if (value.outcome !== undefined && !outcome) return undefined
  const input = readStageInput(value)
  return input && { ...input, ...(outcome && { outcome }) }
}

function readStageInput(value: Record<string, unknown>): StageInput | undefined {
  switch (value.type) {
    case 'requirements':
      if (!isIndexList(value.chosen) || typeof value.notes !== 'string') return undefined
      return { type: value.type, chosen: value.chosen, notes: value.notes }
    case 'estimation': {
      if (!isRecord(value.answers)) return undefined
      const answers = Object.entries(value.answers)
      if (!answers.every(([, answer]) => typeof answer === 'number' && Number.isFinite(answer))) return undefined
      return { type: value.type, answers: Object.fromEntries(answers) as Record<string, number> }
    }
    case 'deep-dive':
      if (!Array.isArray(value.answers) || !value.answers.every(isIndexList)) return undefined
      return { type: value.type, answers: value.answers }
    case 'high-level-design':
    case 'scaling': {
      const { design } = readDesign(value.design)
      const hintUsage = readHintUsage(value.hintUsage)
      return design && hintUsage && { type: value.type, design, hintUsage }
    }
    default:
      return undefined
  }
}

function readOutcome(value: unknown): StageOutcome | undefined {
  if (!isRecord(value) || !isTimestamp(value.finishedAt) || typeof value.gaveUp !== 'boolean' || !isShare(value.score)) return undefined
  if (value.evaluation !== undefined && !isEvaluation(value.evaluation)) return undefined
  return {
    finishedAt: value.finishedAt,
    gaveUp: value.gaveUp,
    score: value.score,
    ...(value.evaluation !== undefined && { evaluation: value.evaluation }),
  }
}

/** Rule id → Hint tiers opened, each from 0 to `HINT_TIERS`. */
function readHintUsage(value: unknown): HintUsage | undefined {
  if (!isRecord(value)) return undefined
  const hints = Object.entries(value)
  if (!hints.every(([, tiers]) => Number.isInteger(tiers) && (tiers as number) >= 0 && (tiers as number) <= HINT_TIERS)) return undefined
  return Object.fromEntries(hints) as HintUsage
}

function isEvaluation(value: unknown): value is Evaluation {
  const numbers = (record: Record<string, unknown>, keys: string[]) => keys.every((key) => typeof record[key] === 'number')
  return (
    isRecord(value) &&
    numbers(value, ['score', 'maxScore', 'totalWeight', 'failingCount']) &&
    Array.isArray(value.rules) &&
    value.rules.every(
      (rule) =>
        isRecord(rule) &&
        typeof rule.ruleId === 'string' &&
        typeof rule.passed === 'boolean' &&
        numbers(rule, ['weight', 'hintsOpened', 'hintsAvailable', 'maxPoints', 'points']),
    )
  )
}

function checkInputType(stage: Stage, input: StageInput): void {
  if (input.type !== stage.type) throw new RangeError(`Stage "${stage.id}" is a ${stage.type} Stage, not ${input.type}.`)
}

function stageOf(challenge: Challenge, stageId: string): Stage {
  const stage = challenge.stages.find((candidate) => candidate.id === stageId)
  if (!stage) throw new RangeError(`Challenge "${challenge.id}" has no Stage "${stageId}".`)
  return stage
}

function openStage(challenge: Challenge, attempt: Attempt, stageId: string): Stage {
  const stage = stageOf(challenge, stageId)
  if (attempt.stages[stageId]?.outcome) throw new RangeError(`Stage "${stageId}" is over.`)
  if (challenge.stages.indexOf(stage) >= openStageCount(challenge, attempt)) throw new RangeError(`Stage "${stageId}" is not open yet.`)
  return stage
}

function isIndexList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((index) => Number.isInteger(index) && index >= 0)
}

function isShare(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
