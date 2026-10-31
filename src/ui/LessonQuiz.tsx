import { useEffect, useId, useRef, useState } from 'react'
import { gradeQuestion, gradeQuiz, scrambledOrder, type QuestionAnswer, type QuestionGrade } from '../core/quizzes/grading'
import { COMPONENT_BLANK, type ComponentFitQuestion, type OrderingQuestion, type Question, type Quiz, type QuizOption } from '../core/quizzes/quiz'
import { formatDate, formatDecimal, t, type StringKey } from './i18n'
import { useProgress } from './progress/store'
import { LESSON_QUIZ_ANCHOR } from './routes'

export const QUESTION_HINTS: Record<Question['type'], StringKey> = {
  'multiple-choice': 'quizMultipleChoiceHint',
  'multi-select': 'quizMultiSelectHint',
  ordering: 'quizOrderingHint',
  'component-fit': 'quizComponentFitHint',
}

const buttonClass = 'rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50 disabled:hover:border-zinc-700'

const percent = (score: number) => Math.round(score * 100)

/**
 * The Lesson's quiz: questions checked one by one, then a score that is saved as the quiz's result.
 * Shown once progress has loaded, so that the result can be saved.
 */
export function LessonQuiz({ quiz }: { quiz: Quiz }) {
  const result = useProgress((state) => state.progress?.quizzes.results[quiz.id])
  // Each attempt starts with no answers and newly scrambled ordering questions.
  const [attempt, setAttempt] = useState(0)
  const headingId = useId()

  return (
    <section id={LESSON_QUIZ_ANCHOR} aria-labelledby={headingId} className="mt-12 border-t border-zinc-800 pt-6">
      <h2 id={headingId} className="text-2xl font-semibold text-zinc-50">
        {t('quizTitle')}
      </h2>
      <p className="mt-1 text-sm text-zinc-400">{t('quizDescription', { count: quiz.questions.length })}</p>
      {result && (
        <p className="mt-2 text-sm text-zinc-300">
          {t('quizBestScore', { score: percent(result.bestScore), date: formatDate(new Date(result.lastAttemptAt)) })}
        </p>
      )}
      <QuizAttempt key={attempt} quiz={quiz} onRetry={() => setAttempt((count) => count + 1)} />
    </section>
  )
}

function QuizAttempt({ quiz, onRetry }: { quiz: Quiz; onRetry(): void }) {
  const recordQuiz = useProgress((state) => state.recordQuiz)
  const [answers, setAnswers] = useState<QuestionAnswer[]>(() => {
    const seed = Math.floor(Math.random() * 2 ** 32)
    return quiz.questions.map((question, i) => (question.type === 'ordering' ? scrambledOrder(question.items.length, seed + i) : []))
  })
  const [checked, setChecked] = useState<boolean[]>(() => quiz.questions.map(() => false))
  const complete = checked.every(Boolean)
  const grade = complete ? gradeQuiz(quiz, answers) : undefined
  const score = grade?.score
  const recorded = useRef(false)
  const [saved, setSaved] = useState(false)

  // The attempt is recorded once, when its last question is checked.
  useEffect(() => {
    if (score === undefined || recorded.current) return
    recorded.current = true
    void recordQuiz(quiz.id, score).then(() => setSaved(true))
  }, [score, quiz.id, recordQuiz])

  return (
    <>
      <ol className="mt-6 space-y-6">
        {quiz.questions.map((question, i) => (
          <QuestionCard
            key={i}
            number={i + 1}
            question={question}
            answer={answers[i]}
            grade={checked[i] ? gradeQuestion(question, answers[i]) : undefined}
            onAnswer={(answer) => setAnswers((current) => current.map((value, q) => (q === i ? answer : value)))}
            onCheck={() => setChecked((current) => current.map((value, q) => value || q === i))}
          />
        ))}
      </ol>
      {grade && (
        <div role="status" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-700 p-4">
          <p className="font-medium text-zinc-100">
            {t('quizResult', { points: formatDecimal(grade.points), max: grade.maxPoints, score: percent(grade.score) })}
          </p>
          {saved && <p className="text-sm text-zinc-400">{t('quizResultSaved')}</p>}
          <button type="button" className={`${buttonClass} ml-auto`} onClick={onRetry}>
            {t('quizRetry')}
          </button>
        </div>
      )}
    </>
  )
}

interface QuestionCardProps {
  number: number
  question: Question
  answer: QuestionAnswer
  /** Present once the answer is checked; the answer can no longer change. */
  grade?: QuestionGrade
  onAnswer(answer: QuestionAnswer): void
  onCheck(): void
}

function QuestionCard({ number, question, answer, grade, onAnswer, onCheck }: QuestionCardProps) {
  const promptId = useId()
  const canCheck = question.type === 'ordering' || answer.length > 0
  return (
    <li className="rounded-lg border border-zinc-800 p-4">
      <fieldset aria-labelledby={promptId} disabled={!!grade}>
        <p className="text-xs text-zinc-500">{t('quizQuestion', { number })}</p>
        <p id={promptId} className="mt-1 text-zinc-100">
          {question.prompt}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{t(QUESTION_HINTS[question.type])}</p>
        {question.type === 'component-fit' && <ComponentFlow question={question} answer={answer} />}
        {question.type === 'ordering' ? (
          <OrderingItems question={question} answer={answer} grade={grade} onAnswer={onAnswer} />
        ) : (
          <ChoiceOptions
            options={question.options}
            multiple={question.type === 'multi-select'}
            answer={answer}
            grade={grade}
            onAnswer={onAnswer}
          />
        )}
      </fieldset>
      {grade ? (
        <QuestionVerdict grade={grade} />
      ) : (
        <button type="button" className={`${buttonClass} mt-4`} disabled={!canCheck} onClick={onCheck}>
          {t('quizCheck')}
        </button>
      )}
    </li>
  )
}

function QuestionVerdict({ grade }: { grade: QuestionGrade }) {
  const [text, color] = grade.correct
    ? [t('quizCorrect'), 'text-emerald-400']
    : grade.score > 0
      ? [t('quizPartlyCorrect', { score: percent(grade.score) }), 'text-amber-400']
      : [t('quizWrong'), 'text-red-400']
  return (
    <p role="status" className={`mt-4 font-medium ${color}`}>
      {text}
    </p>
  )
}

export function ChoiceOptions(props: {
  options: QuizOption[]
  multiple: boolean
  answer: QuestionAnswer
  grade?: QuestionGrade
  onAnswer(answer: QuestionAnswer): void
}) {
  const { options, multiple, answer, grade, onAnswer } = props
  const name = useId()
  return (
    <ul className="mt-3 space-y-2">
      {options.map((option, i) => {
        const chosen = answer.includes(i)
        const border = !grade ? 'border-zinc-800' : option.correct ? 'border-emerald-500/60' : chosen ? 'border-red-500/60' : 'border-zinc-800'
        return (
          <li key={i} className={`rounded border ${border} px-3 py-2`}>
            <label className="flex cursor-pointer items-start gap-2 text-zinc-200">
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                className="mt-1"
                checked={chosen}
                onChange={() => onAnswer(multiple ? toggle(answer, i) : [i])}
              />
              <span>{option.text}</span>
            </label>
            {grade && (
              <div className="mt-1 pl-6 text-sm">
                {option.correct && <p className="text-emerald-400">✓ {t('quizCorrectOption')}</p>}
                {!option.correct && chosen && <p className="text-red-400">✗ {t('quizWrongChoice')}</p>}
                <p className="text-zinc-400">{option.explanation}</p>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function OrderingItems(props: { question: OrderingQuestion; answer: QuestionAnswer; grade?: QuestionGrade; onAnswer(answer: QuestionAnswer): void }) {
  const { question, answer, grade, onAnswer } = props
  const move = (from: number, to: number) => {
    const order = [...answer]
    ;[order[from], order[to]] = [order[to], order[from]]
    onAnswer(order)
  }
  return (
    <ol className="mt-3 space-y-2">
      {answer.map((itemIndex, position) => {
        const item = question.items[itemIndex]
        const right = grade?.marks[position]
        const border = right === undefined ? 'border-zinc-800' : right ? 'border-emerald-500/60' : 'border-red-500/60'
        return (
          <li key={itemIndex} className={`rounded border ${border} px-3 py-2`}>
            <div className="flex items-center gap-2 text-zinc-200">
              <span className="w-5 shrink-0 text-sm text-zinc-500">{position + 1}.</span>
              <span className="flex-1">{item.text}</span>
              {!grade && (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className={buttonClass}
                    aria-label={t('quizMoveUp', { item: item.text })}
                    disabled={position === 0}
                    onClick={() => move(position, position - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    aria-label={t('quizMoveDown', { item: item.text })}
                    disabled={position === answer.length - 1}
                    onClick={() => move(position, position + 1)}
                  >
                    ↓
                  </button>
                </span>
              )}
            </div>
            {grade && (
              <div className="mt-1 pl-7 text-sm">
                {right ? (
                  <p className="text-emerald-400">✓ {t('quizRightPosition')}</p>
                ) : (
                  <p className="text-red-400">✗ {t('quizWrongPosition', { position: itemIndex + 1 })}</p>
                )}
                <p className="text-zinc-400">{item.explanation}</p>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** The flow of components, with the chosen option (or an empty box) in the blank. */
function ComponentFlow({ question, answer }: { question: ComponentFitQuestion; answer: QuestionAnswer }) {
  const chosen = answer.length > 0 ? question.options[answer[0]].text : undefined
  return (
    <ol aria-label={t('quizComponentFlow')} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      {question.flow.map((step, i) => (
        <li key={i} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className="text-zinc-500">
              →
            </span>
          )}
          {step === COMPONENT_BLANK ? (
            <span className="rounded border border-dashed border-sky-500/70 px-2 py-1 text-sky-300">
              {chosen ?? <span aria-label={t('quizBlank')}>?</span>}
            </span>
          ) : (
            <span lang="en" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200">
              {step}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

function toggle(answer: QuestionAnswer, option: number): number[] {
  return answer.includes(option) ? answer.filter((chosen) => chosen !== option) : [...answer, option].sort((a, b) => a - b)
}
