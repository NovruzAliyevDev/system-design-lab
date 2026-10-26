import type { LessonReference } from '../content/catalog'
import type { Solution } from '../content/solutions'
import { isRecord, isText, isTextList } from '../content/validation'
import { readDesign, type Design } from '../design/design'
import { evaluateDesign, validateRules, type Rule } from './rules'

// A Challenge is a system design question solved Stage by Stage. Its definition is authored data,
// validated when the Content Pipeline builds the catalog.

export const CHALLENGE_KINDS = ['architecture'] as const
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number]

/** Where a Challenge comes from: a question of the primer, or one authored for the app. */
export const CHALLENGE_SOURCES = ['primer', 'authored'] as const
export type ChallengeSource = (typeof CHALLENGE_SOURCES)[number]

/** A Stage solved on the Design Canvas and checked by Rules. */
export interface DesignStage {
  /** Unique within its Challenge; the learner's work on it is stored by it. */
  id: string
  type: 'high-level-design'
  /** The task, in Azerbaijani. */
  prompt: string
  rules: Rule[]
  /** Mirrors the primer's diagram for the question. Hidden until the Stage is finished. */
  referenceSolution: Design
  /** The heading of the Solution page that discusses this Stage, if any. */
  solutionAnchor?: string
}

export interface Challenge {
  id: string
  /** In Azerbaijani. */
  title: string
  kind: ChallengeKind
  source: ChallengeSource
  /** The primer's Solution page of the question, if it has one. */
  solutionId?: string
  /** Lessons the Challenge practises. */
  lessonIds: string[]
  stages: DesignStage[]
}

/** A Challenge as it is authored: the same shape, with Reference Solutions whose config may leave out defaults. */
export type ChallengeInput = Omit<Challenge, 'stages'> & { stages: (Omit<DesignStage, 'referenceSolution'> & { referenceSolution: unknown })[] }

const CHALLENGE_FIELDS = new Set(['id', 'title', 'kind', 'source', 'solutionId', 'lessonIds', 'stages'])
const STAGE_FIELDS = new Set(['id', 'type', 'prompt', 'rules', 'referenceSolution', 'solutionAnchor'])

/**
 * Checks authored Challenges against their schema, the Lessons and Solution pages they reference, and
 * their own Rules: every Reference Solution must pass every Rule of its Stage. Returns the Challenges
 * in authored order, or every problem found.
 */
export function validateChallenges(
  input: unknown,
  lessonIds: ReadonlySet<string>,
  solutions: readonly Solution[],
): { challenges: Challenge[]; problems: string[] } {
  if (!Array.isArray(input)) return { challenges: [], problems: ['Challenges: must be a list of Challenges'] }

  const challenges: Challenge[] = []
  const problems: string[] = []
  const ids = new Set<string>()
  input.forEach((item: unknown, i) => {
    const name = challengeName(item, i)
    const problem = (message: string) => problems.push(`${name}: ${message}`)
    if (!isRecord(item)) return problem('must be an object')
    const before = problems.length

    for (const field of Object.keys(item)) if (!CHALLENGE_FIELDS.has(field)) problem(`unknown field "${field}"`)
    if (!isText(item.id)) problem('"id" must be a non-empty string')
    else if (ids.has(item.id)) problem('its id is already used by another Challenge')
    else ids.add(item.id)
    if (!isText(item.title)) problem('"title" must be a non-empty string')
    if (!CHALLENGE_KINDS.includes(item.kind as ChallengeKind)) problem(`"kind" must be one of ${CHALLENGE_KINDS.join(', ')}`)
    if (!CHALLENGE_SOURCES.includes(item.source as ChallengeSource)) problem(`"source" must be one of ${CHALLENGE_SOURCES.join(', ')}`)
    const solution = item.solutionId === undefined ? undefined : solutions.find((candidate) => candidate.id === item.solutionId)
    if (item.solutionId !== undefined && !solution) problem(`unknown Solution page "${String(item.solutionId)}"`)
    if (!isTextList(item.lessonIds)) problem('"lessonIds" must be a list of Lesson ids')
    else for (const lessonId of item.lessonIds) if (!lessonIds.has(lessonId)) problem(`unknown Lesson id "${lessonId}"`)

    if (!Array.isArray(item.stages) || item.stages.length === 0) return problem('"stages" must list at least one Stage')
    const stageIds = new Set<string>()
    const stages = item.stages.map((stageItem: unknown, s) => {
      const stageName = isRecord(stageItem) && isText(stageItem.id) ? `Stage "${stageItem.id}"` : `Stage #${s + 1}`
      const stageProblem = (message: string) => problems.push(`${name} ${stageName}: ${message}`)
      const stage = validateStage(stageItem, item.solutionId === undefined ? 'none' : solution, stageProblem)
      if (stage && stageIds.has(stage.id)) stageProblem('its id is already used in the Challenge')
      if (stage) stageIds.add(stage.id)
      return stage
    })

    if (problems.length > before) return
    const { id, title, kind, source, solutionId, lessonIds: lessons } = item as unknown as Challenge
    challenges.push({ id, title, kind, source, ...(solutionId !== undefined && { solutionId }), lessonIds: lessons, stages: stages as DesignStage[] })
  })
  return { challenges, problems }
}

/** `solution` is `'none'` when the Challenge has no Solution page, and undefined when it names one that does not exist. */
function validateStage(item: unknown, solution: Solution | 'none' | undefined, problem: (message: string) => void): DesignStage | undefined {
  if (!isRecord(item)) return void problem('must be an object')
  let valid = true
  const fail = (message: string) => {
    valid = false
    problem(message)
  }
  for (const field of Object.keys(item)) if (!STAGE_FIELDS.has(field)) fail(`unknown field "${field}"`)
  if (!isText(item.id)) fail('"id" must be a non-empty string')
  if (item.type !== 'high-level-design') fail('"type" must be "high-level-design"')
  if (!isText(item.prompt)) fail('"prompt" must be a non-empty string')
  if (item.solutionAnchor !== undefined) {
    if (solution === 'none') fail('"solutionAnchor" needs the Challenge to have a Solution page')
    // An unknown Solution page is reported for the Challenge; its anchors cannot be checked.
    else if (solution && !solution.headingAnchors.some((heading) => heading.anchor === item.solutionAnchor)) {
      fail(`Solution page "${solution.id}" has no heading "${String(item.solutionAnchor)}"`)
    }
  }
  const rules = validateRules(item.rules, fail)
  const { design, problems } = readDesign(item.referenceSolution)
  for (const designProblem of problems) fail(`Reference Solution: ${designProblem}`)
  if (!valid || !rules || !design) return undefined

  const stage: DesignStage = {
    id: item.id as string,
    type: 'high-level-design',
    prompt: item.prompt as string,
    rules,
    referenceSolution: design,
    ...(item.solutionAnchor !== undefined && { solutionAnchor: item.solutionAnchor as string }),
  }
  // A Reference Solution that fails its own Rules means a Rule (or the solution) is wrong.
  for (const result of evaluateDesign(stage, design, {}).rules) {
    if (!result.passed) fail(`the Reference Solution fails Rule "${result.ruleId}"`)
  }
  return valid ? stage : undefined
}

/**
 * The Lesson ids authored Challenges reference. Malformed Challenges contribute what they can:
 * reporting them is `validateChallenges`'s job.
 */
export function challengeLessonReferences(input: unknown): LessonReference[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item: unknown, i) =>
    isRecord(item) && Array.isArray(item.lessonIds)
      ? item.lessonIds.filter(isText).map((lessonId) => ({ referrer: challengeName(item, i), lessonId }))
      : [],
  )
}

export function findChallenge(challenges: readonly Challenge[], challengeId: string): Challenge | undefined {
  return challenges.find((challenge) => challenge.id === challengeId)
}

/** How problems and references name an authored Challenge: by its id, or by its position when it has none. */
function challengeName(item: unknown, index: number): string {
  return isRecord(item) && isText(item.id) ? `Challenge "${item.id}"` : `Challenge #${index + 1}`
}
