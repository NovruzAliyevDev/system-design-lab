import type { LessonReference } from '../content/catalog'
import type { CodeSolution, Solution } from '../content/solutions'
import { isRecord, isText, isTextList } from '../content/validation'
import { readDesign, type Design } from '../design/design'
import { ESTIMATION_QUANTITIES, estimate, isEstimationQuantity, type EstimationInputs, type EstimationQuantity } from '../estimation/estimate'
import {
  validateList,
  validateQuestion,
  type MultipleChoiceQuestion,
  type MultiSelectQuestion,
  type QuizOption,
  type QuizOptionInput,
} from '../quizzes/quiz'
import { simulate, type LoadProfile, type SimulationResult } from '../simulation/simulate'
import { chaosScenarioOf, evaluateDesign, validateChaosTasks, validateLoadProfile, validateRules, type ChaosTask, type Rule } from './rules'

// A Challenge is a system design question solved Stage by Stage, the way an interview runs. Its
// definition is authored data, validated when the Content Pipeline builds the catalog.

/**
 * - `architecture`: a system design question, its design built on the Design Canvas.
 * - `ood`: an object-oriented design question, its classes built on the UML Class Builder.
 */
export const CHALLENGE_KINDS = ['architecture', 'ood'] as const
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number]

/** Where a Challenge comes from: a question of the primer, or one authored for the app. */
export const CHALLENGE_SOURCES = ['primer', 'authored'] as const
export type ChallengeSource = (typeof CHALLENGE_SOURCES)[number]

/** The Stage types, in the order an interview (and a Challenge) goes through them. */
export const STAGE_TYPES = ['requirements', 'estimation', 'high-level-design', 'class-design', 'deep-dive', 'scaling'] as const
export type StageType = (typeof STAGE_TYPES)[number]

/** The Stage types each kind of Challenge can have; an ood Challenge always has a class-design Stage. */
const KIND_STAGE_TYPES: Record<ChallengeKind, readonly StageType[]> = {
  architecture: ['requirements', 'estimation', 'high-level-design', 'deep-dive', 'scaling'],
  ood: ['requirements', 'class-design', 'deep-dive'],
}

interface StageBase {
  /** Unique within its Challenge; the learner's work on it is stored by it. */
  id: string
  /** The task, in Azerbaijani. */
  prompt: string
  /** The Stage's share of the Challenge score, relative to the other Stages' weights. */
  weight: number
  /** The heading of the Solution page that discusses this Stage, if any. */
  solutionAnchor?: string
}

export const REQUIREMENT_SECTIONS = ['use-case', 'constraint'] as const
export type RequirementSection = (typeof REQUIREMENT_SECTIONS)[number]

/** A candidate use case or constraint: in scope (`correct`) or a distractor, explained either way. */
export interface RequirementItem extends QuizOption {
  section: RequirementSection
}

/** Scoping: pick the use cases and constraints that belong to the question from a checklist with distractors. */
export interface RequirementsStage extends StageBase {
  type: 'requirements'
  items: RequirementItem[]
}

/** A number the learner estimates; graded against the reference value within a factor of 2. */
export interface EstimationQuestion {
  /** Unique within its Stage; the learner's answer is stored by it. */
  id: string
  quantity: EstimationQuantity
  prompt: string
  /** `estimate(stage.inputs)` of the quantity, in requests per second, bytes or bytes per second. */
  referenceValue: number
}

/** Back-of-the-envelope estimation from the question's assumptions. */
export interface EstimationStage extends StageBase {
  type: 'estimation'
  /** The assumptions the reference values are computed from. */
  inputs: EstimationInputs
  /** The introduction to the worked solution, shown with its steps once the Stage is over. */
  explanation: string
  questions: EstimationQuestion[]
}

/**
 * A Stage solved on the Design Canvas and checked by Rules, simulation targets among them, some of them
 * under its Chaos tasks. A Scaling Stage starts from the learner's high-level design.
 */
export interface DesignStage extends StageBase {
  type: 'high-level-design' | 'scaling'
  rules: Rule[]
  /** The load its simulation targets are checked under and its Traffic Simulation starts from: the Challenge's, unless the Stage sets its own. */
  loadProfile: LoadProfile
  /** Mirrors the primer's diagram for the question. Hidden until the Stage is over. */
  referenceSolution: Design
  /** Parts of the system broken on purpose that some Rules simulate under; each breaks something in the Reference Solution. */
  chaosTasks?: ChaosTask[]
}

/** An object-oriented design solved on the UML Class Builder and checked by UML Rules. */
export interface ClassDesignStage extends StageBase {
  type: 'class-design'
  rules: Rule[]
  /** The classes of the primer's Python solution. Hidden until the Stage is over, then shown beside that code. */
  referenceSolution: Design
}

export type TradeOffQuestion = MultipleChoiceQuestion | MultiSelectQuestion

/** Trade-off questions about the design, every option explained. */
export interface DeepDiveStage extends StageBase {
  type: 'deep-dive'
  questions: TradeOffQuestion[]
}

export type Stage = RequirementsStage | EstimationStage | DesignStage | ClassDesignStage | DeepDiveStage

/** Whether a Stage type is solved on the Design Canvas. */
export function isDesignStageType(type: StageType): type is DesignStage['type'] {
  return type === 'high-level-design' || type === 'scaling'
}

/** The Stage types built on a canvas, the Design Canvas or the UML Class Builder, and checked by Rules. */
export type RuledStageType = DesignStage['type'] | ClassDesignStage['type']

export function isRuledStageType(type: StageType): type is RuledStageType {
  return isDesignStageType(type) || type === 'class-design'
}

export interface Challenge {
  id: string
  /** In Azerbaijani. */
  title: string
  kind: ChallengeKind
  source: ChallengeSource
  /** The primer's Solution page of the question, if it has one. */
  solutionId?: string
  /** An ood Challenge's: the primer's Python solution, shown as code beside the reference UML. */
  codeSolutionId?: string
  /** Lessons the Challenge practises. */
  lessonIds: string[]
  /** An architecture Challenge's default Load Profile, e.g. the question's average traffic. An ood Challenge has none. */
  loadProfile?: LoadProfile
  /** In interview order, each type at most once. */
  stages: Stage[]
}

/** A Stage as it is authored: distractors need not say so, reference values are computed, config may leave out defaults. */
export type AuthoredStage =
  | (Omit<RequirementsStage, 'items'> & { items: (QuizOptionInput & { section: RequirementSection })[] })
  | (Omit<EstimationStage, 'questions'> & { questions: Omit<EstimationQuestion, 'referenceValue'>[] })
  | (Omit<DesignStage, 'referenceSolution' | 'loadProfile'> & { referenceSolution: unknown; loadProfile?: LoadProfile })
  | (Omit<ClassDesignStage, 'referenceSolution'> & { referenceSolution: unknown })
  | (Omit<DeepDiveStage, 'questions'> & { questions: (MultipleChoiceQuestion<QuizOptionInput> | MultiSelectQuestion<QuizOptionInput>)[] })

/** A Challenge as it is authored. */
export type ChallengeInput = Omit<Challenge, 'stages'> & { stages: AuthoredStage[] }

const CHALLENGE_FIELDS = new Set(['id', 'title', 'kind', 'source', 'solutionId', 'codeSolutionId', 'lessonIds', 'loadProfile', 'stages'])
const COMMON_STAGE_FIELDS = ['id', 'type', 'prompt', 'weight', 'solutionAnchor']
const STAGE_FIELDS: Record<StageType, Set<string>> = {
  requirements: new Set([...COMMON_STAGE_FIELDS, 'items']),
  estimation: new Set([...COMMON_STAGE_FIELDS, 'inputs', 'explanation', 'questions']),
  'high-level-design': new Set([...COMMON_STAGE_FIELDS, 'rules', 'referenceSolution', 'loadProfile', 'chaosTasks']),
  'class-design': new Set([...COMMON_STAGE_FIELDS, 'rules', 'referenceSolution']),
  'deep-dive': new Set([...COMMON_STAGE_FIELDS, 'questions']),
  scaling: new Set([...COMMON_STAGE_FIELDS, 'rules', 'referenceSolution', 'loadProfile', 'chaosTasks']),
}
const ITEM_FIELDS = new Set(['section', 'text', 'correct', 'explanation'])
const ESTIMATION_QUESTION_FIELDS = new Set(['id', 'quantity', 'prompt'])
const REQUIRED_INPUTS = ['writesPerMonth', 'readsPerMonth', 'bytesPerWrite'] as const
const OPTIONAL_INPUTS = ['bytesPerRead', 'peakFactor', 'years'] as const
const INPUT_FIELDS = new Set<string>([...REQUIRED_INPUTS, ...OPTIONAL_INPUTS])

/**
 * Checks authored Challenges against their schema and kind, the Lessons, Solution pages and Python
 * solutions they reference, and their own Rules: every Reference Solution must pass every Rule of its
 * Stage, simulation targets included. Returns the Challenges in authored order, or every problem found.
 */
export function validateChallenges(
  input: unknown,
  lessonIds: ReadonlySet<string>,
  solutions: readonly Solution[],
  codeSolutions: readonly CodeSolution[] = [],
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
    const kind = CHALLENGE_KINDS.find((known) => known === item.kind)
    if (!kind) problem(`"kind" must be one of ${CHALLENGE_KINDS.join(', ')}`)
    if (!CHALLENGE_SOURCES.includes(item.source as ChallengeSource)) problem(`"source" must be one of ${CHALLENGE_SOURCES.join(', ')}`)
    const solution = item.solutionId === undefined ? undefined : solutions.find((candidate) => candidate.id === item.solutionId)
    if (item.solutionId !== undefined && !solution) problem(`unknown Solution page "${String(item.solutionId)}"`)
    if (kind === 'ood') {
      if (!isText(item.codeSolutionId)) problem('"codeSolutionId" must name a Python solution of the primer')
      else if (!codeSolutions.some((candidate) => candidate.id === item.codeSolutionId)) problem(`unknown Python solution "${item.codeSolutionId}"`)
    } else if (item.codeSolutionId !== undefined) problem(`an ${String(kind ?? item.kind)} Challenge has no "codeSolutionId"`)
    if (!isTextList(item.lessonIds)) problem('"lessonIds" must be a list of Lesson ids')
    else for (const lessonId of item.lessonIds) if (!lessonIds.has(lessonId)) problem(`unknown Lesson id "${lessonId}"`)
    // An ood Challenge sends no traffic: its Stages have no simulation.
    if (kind === 'ood' && item.loadProfile !== undefined) problem('an ood Challenge has no "loadProfile"')
    const loadProfile = kind === 'ood' ? undefined : validateLoadProfile(item.loadProfile, (message) => problem(`loadProfile: ${message}`))

    if (!Array.isArray(item.stages) || item.stages.length === 0) return problem('"stages" must list at least one Stage')
    const stageIds = new Set<string>()
    /** The Stage types met so far, to check the interview order. */
    const typesSoFar: StageType[] = []
    const stages = item.stages.map((stageItem: unknown, s) => {
      const stageName = isRecord(stageItem) && isText(stageItem.id) ? `Stage "${stageItem.id}"` : `Stage #${s + 1}`
      const stageProblem = (message: string) => problems.push(`${name} ${stageName}: ${message}`)
      const type = isRecord(stageItem) ? STAGE_TYPES.find((known) => known === stageItem.type) : undefined
      if (kind && type && !KIND_STAGE_TYPES[kind].includes(type)) return void stageProblem(`an ${kind} Challenge has no ${type} Stage`)
      const stage = validateStage(stageItem, item.solutionId === undefined ? 'none' : solution, loadProfile, stageProblem)
      if (!stage) return undefined
      if (stageIds.has(stage.id)) stageProblem('its id is already used in the Challenge')
      stageIds.add(stage.id)
      const order = STAGE_TYPES.indexOf(stage.type)
      const later = typesSoFar.find((type) => STAGE_TYPES.indexOf(type) > order)
      if (typesSoFar.includes(stage.type)) stageProblem(`the Challenge already has a ${stage.type} Stage`)
      else if (later) stageProblem(`must come before the ${later} Stage`)
      if (stage.type === 'scaling' && !typesSoFar.includes('high-level-design')) {
        stageProblem('needs a high-level-design Stage before it to start from')
      }
      typesSoFar.push(stage.type)
      return stage
    })
    if (kind === 'ood' && !item.stages.some((stageItem: unknown) => isRecord(stageItem) && stageItem.type === 'class-design')) {
      problem('an ood Challenge needs a class-design Stage')
    }

    if (problems.length > before) return
    const { id, title, source, solutionId, codeSolutionId, lessonIds: lessons } = item as unknown as Challenge
    challenges.push({
      id,
      title,
      kind: kind!,
      source,
      ...(solutionId !== undefined && { solutionId }),
      ...(codeSolutionId !== undefined && { codeSolutionId }),
      lessonIds: lessons,
      ...(loadProfile && { loadProfile }),
      stages: stages as Stage[],
    })
  })
  return { challenges, problems }
}

/**
 * `solution` is `'none'` when the Challenge has no Solution page, and undefined when it names one that
 * does not exist. `defaultLoad` is the Challenge's Load Profile, undefined when it is invalid (and reported).
 */
function validateStage(
  item: unknown,
  solution: Solution | 'none' | undefined,
  defaultLoad: LoadProfile | undefined,
  problem: (message: string) => void,
): Stage | undefined {
  if (!isRecord(item)) return void problem('must be an object')
  const type = STAGE_TYPES.find((known) => known === item.type)
  if (!type) return void problem(`"type" must be one of ${STAGE_TYPES.join(', ')}`)
  let valid = true
  const fail = (message: string) => {
    valid = false
    problem(message)
  }
  for (const field of Object.keys(item)) if (!STAGE_FIELDS[type].has(field)) fail(`unknown field "${field}"`)
  if (!isText(item.id)) fail('"id" must be a non-empty string')
  if (!isText(item.prompt)) fail('"prompt" must be a non-empty string')
  if (!isPositive(item.weight)) fail('"weight" must be a positive number')
  if (item.solutionAnchor !== undefined) {
    if (solution === 'none') fail('"solutionAnchor" needs the Challenge to have a Solution page')
    // An unknown Solution page is reported for the Challenge; its anchors cannot be checked.
    else if (solution && !solution.headingAnchors.some((heading) => heading.anchor === item.solutionAnchor)) {
      fail(`Solution page "${solution.id}" has no heading "${String(item.solutionAnchor)}"`)
    }
  }
  const base = {
    id: item.id as string,
    prompt: item.prompt as string,
    weight: item.weight as number,
    ...(item.solutionAnchor !== undefined && { solutionAnchor: item.solutionAnchor as string }),
  }

  switch (type) {
    case 'requirements': {
      const items = validateRequirementItems(item.items, fail)
      return valid && items ? { type, ...base, items } : undefined
    }
    case 'estimation': {
      const inputs = validateEstimationInputs(item.inputs, (message) => fail(`inputs: ${message}`))
      if (!isText(item.explanation)) fail('"explanation" must be a non-empty string')
      const questions = validateEstimationQuestions(item.questions, fail)
      if (!valid || !inputs || !questions) return undefined
      const { values } = estimate(inputs)
      // Estimates are graded as a ratio of the reference, which a reference of 0 cannot give.
      for (const question of questions) {
        if (!(values[question.quantity] > 0)) fail(`question "${question.id}": its reference value must be positive, and the inputs make it 0`)
      }
      if (!valid) return undefined
      return {
        type,
        ...base,
        inputs,
        explanation: item.explanation as string,
        questions: questions.map((question) => ({ ...question, referenceValue: values[question.quantity] })),
      }
    }
    case 'deep-dive': {
      if (!Array.isArray(item.questions) || item.questions.length === 0) return void fail('"questions" must list at least one question')
      const questions = item.questions.map((question: unknown, q) => {
        const questionFail = (message: string) => fail(`question ${q + 1}: ${message}`)
        if (isRecord(question) && question.type !== 'multiple-choice' && question.type !== 'multi-select') {
          return void questionFail('"type" must be "multiple-choice" or "multi-select"')
        }
        return validateQuestion(question, questionFail) as TradeOffQuestion | undefined
      })
      return valid ? { type, ...base, questions: questions as TradeOffQuestion[] } : undefined
    }
    case 'class-design': {
      const rules = validateRules(item.rules, fail, new Set(), 'uml')
      const { design, problems } = readDesign(item.referenceSolution)
      for (const designProblem of problems) fail(`Reference Solution: ${designProblem}`)
      if (!valid || !rules || !design) return undefined
      const stage: ClassDesignStage = { type, ...base, rules, referenceSolution: design }
      for (const result of evaluateDesign(stage, design, {}).rules) {
        if (!result.passed) fail(`the Reference Solution fails Rule "${result.ruleId}"`)
      }
      return valid ? stage : undefined
    }
    case 'high-level-design':
    case 'scaling': {
      const chaosTasks = item.chaosTasks === undefined ? [] : validateChaosTasks(item.chaosTasks, fail)
      const rules = validateRules(item.rules, fail, new Set(chaosTasks?.map((task) => task.id)))
      const { design, problems } = readDesign(item.referenceSolution)
      for (const designProblem of problems) fail(`Reference Solution: ${designProblem}`)
      const loadProfile = item.loadProfile === undefined ? defaultLoad : validateLoadProfile(item.loadProfile, (message) => fail(`loadProfile: ${message}`))
      if (!valid || !rules || !design || !loadProfile || !chaosTasks) return undefined
      // A Chaos task breaking nothing in the Reference Solution most likely picks its Nodes wrong.
      for (const task of chaosTasks) {
        if (breaksNothing(simulate(design, loadProfile, chaosScenarioOf(task.scenario, design)))) fail(`Chaos task "${task.id}": breaks nothing in the Reference Solution`)
      }
      const stage: DesignStage = { type, ...base, rules, referenceSolution: design, loadProfile, ...(item.chaosTasks !== undefined && { chaosTasks }) }
      // A Reference Solution that fails its own Rules means a Rule (or the solution) is wrong.
      for (const result of evaluateDesign(stage, design, {}).rules) {
        if (!result.passed) fail(`the Reference Solution fails Rule "${result.ruleId}"`)
      }
      return valid ? stage : undefined
    }
  }
}

/** No Node of the simulated Design is down or cold, and no Edge is cut. */
function breaksNothing(result: SimulationResult): boolean {
  return result.cutEdgeIds.length === 0 && Object.values(result.nodes).every((metrics) => !metrics.down && !metrics.primaryDown && !metrics.cold)
}

function validateRequirementItems(value: unknown, fail: (message: string) => void): RequirementItem[] | undefined {
  // validateList checks the text, explanation and fields; the section and correct flag are checked here.
  const items = validateList(value, 'items', ITEM_FIELDS, fail) as { text: string; explanation: string; correct?: unknown; section?: unknown }[] | undefined
  if (!items) return undefined
  let valid = true
  items.forEach((item, i) => {
    const itemFail = (message: string) => {
      valid = false
      fail(`item ${i + 1}: ${message}`)
    }
    if (!REQUIREMENT_SECTIONS.includes(item.section as RequirementSection)) itemFail('"section" must be "use-case" or "constraint"')
    if (item.correct !== undefined && typeof item.correct !== 'boolean') itemFail('"correct" must be true or false')
  })
  if (!items.some((item) => item.correct === true)) fail('"items" must have a correct item')
  else if (items.every((item) => item.correct === true)) fail('"items" must have a distractor')
  else if (valid) {
    return items.map((item) => ({
      section: item.section as RequirementSection,
      text: item.text,
      correct: item.correct === true,
      explanation: item.explanation,
    }))
  }
  return undefined
}

function validateEstimationInputs(value: unknown, fail: (message: string) => void): EstimationInputs | undefined {
  if (!isRecord(value)) return void fail('must be an object')
  let valid = true
  const inputFail = (message: string) => {
    valid = false
    fail(message)
  }
  for (const field of Object.keys(value)) if (!INPUT_FIELDS.has(field)) inputFail(`unknown field "${field}"`)
  // A question without writes (or reads) sets them to 0; questions about a quantity of 0 are refused.
  for (const field of REQUIRED_INPUTS) if (!isAtLeastZero(value[field])) inputFail(`"${field}" must be a number of at least 0`)
  for (const field of OPTIONAL_INPUTS) if (value[field] !== undefined && !isPositive(value[field])) inputFail(`"${field}" must be a positive number`)
  return valid ? (value as unknown as EstimationInputs) : undefined
}

function validateEstimationQuestions(value: unknown, fail: (message: string) => void): Omit<EstimationQuestion, 'referenceValue'>[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return void fail('"questions" must list at least one question')
  let valid = true
  const ids = new Set<string>()
  value.forEach((question: unknown, q) => {
    const questionFail = (message: string) => {
      valid = false
      fail(`${isRecord(question) && isText(question.id) ? `question "${question.id}"` : `question #${q + 1}`}: ${message}`)
    }
    if (!isRecord(question)) return questionFail('must be an object')
    for (const field of Object.keys(question)) if (!ESTIMATION_QUESTION_FIELDS.has(field)) questionFail(`unknown field "${field}"`)
    if (!isText(question.id)) questionFail('"id" must be a non-empty string')
    else if (ids.has(question.id)) questionFail('its id is already used in the Stage')
    else ids.add(question.id)
    if (!isEstimationQuantity(question.quantity)) questionFail(`"quantity" must be one of ${Object.keys(ESTIMATION_QUANTITIES).join(', ')}`)
    if (!isText(question.prompt)) questionFail('"prompt" must be a non-empty string')
  })
  return valid ? value.map(({ id, quantity, prompt }) => ({ id, quantity, prompt })) : undefined
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isAtLeastZero(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
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
