import type { LessonReference } from '../content/catalog'
import { isRecord, isText, isTextList } from '../content/validation'

/** A choice the learner can make, with the Azerbaijani explanation shown once the question is checked. */
export interface QuizOptionInput {
  text: string
  /** Whether choosing it is right; options are wrong unless marked. */
  correct?: boolean
  explanation: string
}

export type QuizOption = Required<QuizOptionInput>

/** One right option among the rest. */
export interface MultipleChoiceQuestion<O = QuizOption> {
  type: 'multiple-choice'
  prompt: string
  options: O[]
}

/** Any number of right options, at least one; partly right answers earn part of the point. */
export interface MultiSelectQuestion<O = QuizOption> {
  type: 'multi-select'
  prompt: string
  options: O[]
}

/** Items to put in order; they are authored in the right order and shown scrambled. */
export interface OrderingQuestion {
  type: 'ordering'
  prompt: string
  items: { text: string; explanation: string }[]
}

/** Which component fills the blank in a flow of components; one right option, like multiple choice. */
export interface ComponentFitQuestion<O = QuizOption> {
  type: 'component-fit'
  prompt: string
  /** The components in the order requests pass them, with `COMPONENT_BLANK` where the answer goes. */
  flow: string[]
  options: O[]
}

export type QuestionInput =
  | MultipleChoiceQuestion<QuizOptionInput>
  | MultiSelectQuestion<QuizOptionInput>
  | OrderingQuestion
  | ComponentFitQuestion<QuizOptionInput>

export type Question = MultipleChoiceQuestion | MultiSelectQuestion | OrderingQuestion | ComponentFitQuestion

export type QuestionType = Question['type']

/** A Quiz as it is authored. */
export interface QuizInput {
  /** Stable across Lesson renames: quiz results are stored by it. */
  id: string
  /** The Lesson the quiz is shown at the end of. */
  lessonId: string
  questions: QuestionInput[]
}

export interface Quiz {
  id: string
  lessonId: string
  questions: Question[]
}

/** The blank in a "which component fits" flow. */
export const COMPONENT_BLANK = '?'

const QUIZ_FIELDS = new Set<string>(['id', 'lessonId', 'questions'])
const OPTION_FIELDS = new Set<string>(['text', 'correct', 'explanation'])
const ITEM_FIELDS = new Set<string>(['text', 'explanation'])
const QUESTION_FIELDS: Record<QuestionType, Set<string>> = {
  'multiple-choice': new Set(['type', 'prompt', 'options']),
  'multi-select': new Set(['type', 'prompt', 'options']),
  ordering: new Set(['type', 'prompt', 'items']),
  'component-fit': new Set(['type', 'prompt', 'flow', 'options']),
}
const QUESTION_TYPES = Object.keys(QUESTION_FIELDS) as QuestionType[]

/**
 * Checks authored Quizzes against their schema and the Lessons they are shown in. A Lesson has at
 * most one Quiz. Returns the Quizzes in authored order, or every problem found.
 */
export function validateQuizzes(input: unknown, lessonIds: ReadonlySet<string>): { quizzes: Quiz[]; problems: string[] } {
  if (!Array.isArray(input)) return { quizzes: [], problems: ['Quizzes: must be a list of Quizzes'] }

  const quizzes: Quiz[] = []
  const problems: string[] = []
  const ids = new Set<string>()
  /** Lesson id → the Quiz shown in it. */
  const lessonQuizzes = new Map<string, string>()
  input.forEach((item: unknown, i) => {
    const name = quizName(item, i)
    const problem = (message: string) => problems.push(`${name}: ${message}`)
    if (!isRecord(item)) return problem('must be an object')
    const before = problems.length

    const { id, lessonId, questions } = item
    for (const field of Object.keys(item)) if (!QUIZ_FIELDS.has(field)) problem(`unknown field "${field}"`)
    if (!isText(id)) problem('"id" must be a non-empty string')
    else if (ids.has(id)) problem('its id is already used by another Quiz')
    else ids.add(id)
    if (!isText(lessonId)) problem('"lessonId" must be a Lesson id')
    else if (!lessonIds.has(lessonId)) problem(`unknown Lesson id "${lessonId}"`)
    else if (lessonQuizzes.has(lessonId)) problem(`Lesson "${lessonId}" already has Quiz "${lessonQuizzes.get(lessonId)}"`)
    else lessonQuizzes.set(lessonId, String(id))
    if (!Array.isArray(questions) || questions.length === 0) {
      problem('"questions" must list at least one question')
      return
    }
    const checked = questions.map((question: unknown, q) =>
      validateQuestion(question, (message) => problem(`question ${q + 1}: ${message}`)),
    )

    if (problems.length > before) return
    quizzes.push({ id: id as string, lessonId: lessonId as string, questions: checked as Question[] })
  })
  return { quizzes, problems }
}

/** The question with its defaults filled in, or undefined after reporting why it is invalid. */
function validateQuestion(item: unknown, problem: (message: string) => void): Question | undefined {
  if (!isRecord(item)) return void problem('must be an object')
  const type = QUESTION_TYPES.find((known) => known === item.type)
  if (!type) return void problem(`"type" must be one of ${QUESTION_TYPES.map((known) => `"${known}"`).join(', ')}`)
  let valid = true
  const fail = (message: string) => {
    valid = false
    problem(message)
  }

  for (const field of Object.keys(item)) if (!QUESTION_FIELDS[type].has(field)) fail(`unknown field "${field}"`)
  if (!isText(item.prompt)) fail('"prompt" must be a non-empty string')
  const prompt = item.prompt as string

  if (type === 'ordering') {
    const items = validateList(item.items, 'items', ITEM_FIELDS, fail)
    if (!valid || !items) return undefined
    return { type, prompt, items: items.map(({ text, explanation }) => ({ text, explanation })) }
  }

  const options = validateList(item.options, 'options', OPTION_FIELDS, fail)
  if (options) {
    options.forEach((option, o) => {
      if (option.correct !== undefined && typeof option.correct !== 'boolean') fail(`option ${o + 1}: "correct" must be true or false`)
    })
    const correctCount = options.filter((option) => option.correct === true).length
    if (type === 'multi-select') {
      if (correctCount === 0) fail('must have at least one correct option')
      else if (correctCount === options.length) fail('must have at least one wrong option, or choosing everything would be right')
    } else if (correctCount !== 1) fail(`must have exactly one correct option, not ${correctCount}`)
  }
  if (type === 'component-fit') {
    if (!isTextList(item.flow)) fail('"flow" must be a list of component names')
    else if (item.flow.filter((step) => step === COMPONENT_BLANK).length !== 1) fail(`"flow" must have exactly one blank ("${COMPONENT_BLANK}")`)
    else if (item.flow.length < 2) fail('"flow" must have a component besides the blank')
  }
  if (!valid || !options) return undefined

  const filled = options.map(({ text, correct, explanation }) => ({ text, correct: correct === true, explanation }))
  return type === 'component-fit' ? { type, prompt, flow: item.flow as string[], options: filled } : { type, prompt, options: filled }
}

/** Options or ordering items: at least two, each with a distinct text and an explanation. */
function validateList(
  value: unknown,
  field: 'options' | 'items',
  fields: ReadonlySet<string>,
  fail: (message: string) => void,
): { text: string; explanation: string; correct?: unknown }[] | undefined {
  const singular = field === 'options' ? 'option' : 'item'
  if (!Array.isArray(value) || value.length < 2) return void fail(`"${field}" must list at least two ${field}`)
  let valid = true
  const texts = new Set<string>()
  value.forEach((entry: unknown, i) => {
    const entryFail = (message: string) => {
      valid = false
      fail(`${singular} ${i + 1}: ${message}`)
    }
    if (!isRecord(entry)) return entryFail('must be an object')
    for (const key of Object.keys(entry)) if (!fields.has(key)) entryFail(`unknown field "${key}"`)
    if (!isText(entry.text)) entryFail('"text" must be a non-empty string')
    else if (texts.has(entry.text)) entryFail(`"${entry.text}" is listed twice`)
    else texts.add(entry.text)
    if (!isText(entry.explanation)) entryFail(`"explanation" must be a non-empty string; every ${singular} is explained`)
  })
  return valid ? (value as { text: string; explanation: string; correct?: unknown }[]) : undefined
}

/**
 * The Lesson ids authored Quizzes reference. Malformed Quizzes contribute what they can: reporting
 * them is `validateQuizzes`'s job.
 */
export function quizLessonReferences(input: unknown): LessonReference[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item: unknown, i) =>
    isRecord(item) && isText(item.lessonId) ? [{ referrer: quizName(item, i), lessonId: item.lessonId }] : [],
  )
}

export function findLessonQuiz(quizzes: readonly Quiz[], lessonId: string): Quiz | undefined {
  return quizzes.find((quiz) => quiz.lessonId === lessonId)
}

/** How problems and references name an authored Quiz: by its id, or by its position when it has none. */
function quizName(item: unknown, index: number): string {
  return isRecord(item) && isText(item.id) ? `Quiz "${item.id}"` : `Quiz #${index + 1}`
}
