import { useId } from 'react'
import type { StageWork } from '../../core/challenges/attempt'
import type { DeepDiveStage, TradeOffQuestion } from '../../core/challenges/challenge'
import { gradeQuestion, type QuestionAnswer, type QuestionGrade } from '../../core/quizzes/grading'
import { t } from '../i18n'
import { ChoiceOptions, QUESTION_HINTS } from '../LessonQuiz'
import { percent } from './shared'

type DeepDiveWork = Extract<StageWork, { type: 'deep-dive' }>

/** Trade-off questions answered together; once the Stage is over, every option is explained. */
export function DeepDiveStageView(props: { stage: DeepDiveStage; work: DeepDiveWork; editable: boolean; onChange(work: DeepDiveWork): void }) {
  const { stage, work, editable, onChange } = props
  const over = work.outcome !== undefined
  return (
    <ol className="mt-4 max-w-4xl space-y-6">
      {stage.questions.map((question, i) => (
        <TradeOff
          key={i}
          number={i + 1}
          question={question}
          answer={work.answers[i] ?? []}
          grade={over ? gradeQuestion(question, work.answers[i] ?? []) : undefined}
          disabled={!editable || over}
          onAnswer={(answer) => onChange({ ...work, answers: stage.questions.map((_, q) => (q === i ? [...answer] : (work.answers[q] ?? []))) })}
        />
      ))}
    </ol>
  )
}

function TradeOff(props: {
  number: number
  question: TradeOffQuestion
  answer: QuestionAnswer
  grade?: QuestionGrade
  disabled: boolean
  onAnswer(answer: QuestionAnswer): void
}) {
  const { number, question, answer, grade, disabled, onAnswer } = props
  const promptId = useId()
  return (
    <li className="rounded-lg border border-border p-4">
      <fieldset aria-labelledby={promptId} disabled={disabled}>
        <p className="text-xs text-text-muted">{t('quizQuestion', { number })}</p>
        <p id={promptId} className="mt-1 text-text">
          {question.prompt}
        </p>
        <p className="mt-1 text-xs text-text-muted">{t(QUESTION_HINTS[question.type])}</p>
        <ChoiceOptions options={question.options} multiple={question.type === 'multi-select'} answer={answer} grade={grade} onAnswer={onAnswer} />
      </fieldset>
      {grade && (
        <p className={`mt-3 text-sm font-medium ${grade.correct ? 'text-success' : grade.score > 0 ? 'text-warning' : 'text-danger'}`}>
          {grade.correct ? t('quizCorrect') : grade.score > 0 ? t('quizPartlyCorrect', { score: percent(grade.score) }) : t('quizWrong')}
        </p>
      )}
    </li>
  )
}
