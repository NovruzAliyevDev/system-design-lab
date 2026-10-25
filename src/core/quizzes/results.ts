import { isQuizScore, type QuizProgress } from '../progress/progress'

/** Records a completed attempt of a quiz: its best score so far, and when it was last taken. */
export function recordQuizResult(quizzes: QuizProgress, quizId: string, score: number, now: Date): QuizProgress {
  if (!isQuizScore(score)) throw new RangeError(`A quiz score is from 0 to 1, not ${score}.`)
  const previous = quizzes.results[quizId]
  const bestScore = previous ? Math.max(previous.bestScore, score) : score
  return { results: { ...quizzes.results, [quizId]: { bestScore, lastAttemptAt: now.toISOString() } } }
}
