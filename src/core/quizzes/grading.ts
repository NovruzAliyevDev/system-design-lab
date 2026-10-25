import type { Question, Quiz } from './quiz'

/**
 * The learner's answer to a question: the indexes of the options chosen, or for an ordering
 * question the indexes of the authored items in the order the learner put them.
 */
export type QuestionAnswer = readonly number[]

export interface QuestionGrade {
  /** From 0 to 1. */
  score: number
  /** Whether the answer earns the full point. */
  correct: boolean
  /**
   * Per option, whether the learner judged it right (chose a correct option or left a wrong one);
   * for an ordering question, per position, whether the item there belongs there.
   */
  marks: boolean[]
}

export interface QuizGrade {
  /** The share of points earned, from 0 to 1. */
  score: number
  points: number
  maxPoints: number
  questions: QuestionGrade[]
}

/**
 * Grades one answer. A single-answer question earns its point for the correct option. A multi-select
 * question earns a share of the point per correct option chosen, less one share per wrong option
 * chosen, never below zero. An ordering question earns its point only in the authored order.
 * Throws a `RangeError` for an answer the question cannot have.
 */
export function gradeQuestion(question: Question, answer: QuestionAnswer): QuestionGrade {
  if (question.type === 'ordering') {
    const count = question.items.length
    if (answer.length !== count || !isSelection(answer, count)) throw new RangeError(`An ordering of ${count} items must list each once.`)
    const marks = answer.map((item, position) => item === position)
    const correct = marks.every(Boolean)
    return { score: correct ? 1 : 0, correct, marks }
  }

  const { options } = question
  if (!isSelection(answer, options.length)) throw new RangeError('An answer must choose existing options, each at most once.')
  if (question.type !== 'multi-select' && answer.length > 1) throw new RangeError('A single-answer question takes one option.')
  const chosen = new Set(answer)
  const marks = options.map((option, i) => chosen.has(i) === option.correct)
  const correctCount = options.filter((option) => option.correct).length
  const right = answer.filter((i) => options[i].correct).length
  const wrong = answer.length - right
  const score = Math.max(0, (right - wrong) / correctCount)
  return { score, correct: score === 1, marks }
}

/** Grades every question of a quiz; each question is worth one point. */
export function gradeQuiz(quiz: Quiz, answers: readonly QuestionAnswer[]): QuizGrade {
  if (answers.length !== quiz.questions.length) throw new RangeError(`The quiz has ${quiz.questions.length} questions.`)
  const questions = quiz.questions.map((question, i) => gradeQuestion(question, answers[i]))
  const points = questions.reduce((sum, grade) => sum + grade.score, 0)
  return { score: points / questions.length, points, maxPoints: questions.length, questions }
}

/**
 * The order an ordering question first shows its items in: a shuffle chosen by `seed` that is never
 * the authored order (unless there is only one item).
 */
export function scrambledOrder(count: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  const random = mulberry32(seed)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  // A shuffle can come out in order; moving the first item to the end keeps it a shuffle of the same seed.
  if (count > 1 && order.every((item, i) => item === i)) order.push(order.shift()!)
  return order
}

/** Distinct whole numbers from 0 to `count` − 1. */
function isSelection(answer: QuestionAnswer, count: number): boolean {
  return answer.every((i) => Number.isInteger(i) && i >= 0 && i < count) && new Set(answer).size === answer.length
}

/** A small seeded PRNG giving numbers in [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
