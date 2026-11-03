import { useId, useState } from 'react'
import type { StageWork } from '../../core/challenges/attempt'
import type { EstimationQuestion, EstimationStage } from '../../core/challenges/challenge'
import { BYTE_UNITS, ESTIMATION_QUANTITIES, estimate, fromUnit, gradeEstimate, inBestUnit, workedSteps, type ByteUnit } from '../../core/estimation/estimate'
import { CalculatorLinks } from '../CalculatorsPage'
import { formatMeasure, formatRounded, parseDecimal, StepLine } from '../EstimationSteps'
import { formatNumber, t } from '../i18n'
import { Verdict } from './shared'

type EstimationWork = Extract<StageWork, { type: 'estimation' }>

/** The learner's estimates, each a number and a unit; once the Stage is over, each is graded and the worked solution shows. */
export function EstimationStageView(props: { stage: EstimationStage; work: EstimationWork; editable: boolean; onChange(work: EstimationWork): void }) {
  const { stage, work, editable, onChange } = props
  const over = work.outcome !== undefined

  function answer(questionId: string, value: number | undefined) {
    const { [questionId]: _, ...others } = work.answers
    onChange({ ...work, answers: value === undefined ? others : { ...others, [questionId]: value } })
  }

  return (
    <div className="mt-4 max-w-4xl">
      {!over && <p className="text-xs text-text-muted">{t('estimationTolerance')}</p>}
      {/* A new tab keeps the Stage in view; the Attempt is saved either way. */}
      <CalculatorLinks calculators={['back-of-the-envelope', 'latency']} newTab />
      <ol className="mt-2 space-y-3">
        {stage.questions.map((question) =>
          over ? (
            <GradedEstimate key={question.id} question={question} value={work.answers[question.id]} />
          ) : (
            <EstimateInput
              key={question.id}
              question={question}
              value={work.answers[question.id]}
              disabled={!editable}
              onChange={(value) => answer(question.id, value)}
            />
          ),
        )}
      </ol>
      {over && <WorkedSolution stage={stage} />}
    </div>
  )
}

function EstimateInput(props: { question: EstimationQuestion; value?: number; disabled: boolean; onChange(value: number | undefined): void }) {
  const { question, value, disabled, onChange } = props
  const kind = ESTIMATION_QUANTITIES[question.quantity]
  const inputId = useId()
  // The text and unit are kept as typed: rewriting them from the stored value would jump units mid-typing.
  const [draft, setDraft] = useState(() => {
    const shown = value === undefined ? undefined : inBestUnit(value, kind)
    return { text: shown ? formatNumber(Number(shown.value.toPrecision(10))) : '', unit: shown?.unit ?? 'B' }
  })

  function change(text: string, unit: ByteUnit) {
    setDraft({ text, unit })
    const number = parseDecimal(text)
    onChange(number === undefined ? undefined : kind === 'requests-per-second' ? number : fromUnit(number, unit))
  }

  return (
    <li className="rounded border border-border px-3 py-2">
      <label htmlFor={inputId} className="block text-text">
        {question.prompt}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          inputMode="decimal"
          className="min-h-11 w-36 rounded border border-border bg-surface-raised px-2 text-text sm:min-h-8"
          value={draft.text}
          disabled={disabled}
          onChange={(event) => change(event.target.value, draft.unit)}
        />
        {kind === 'requests-per-second' ? (
          <span className="text-sm text-text-muted">{t('estimationRequestsPerSecond')}</span>
        ) : (
          <select
            aria-label={t('estimationUnit', { question: question.prompt })}
            className="min-h-11 rounded border border-border bg-surface-raised px-2 text-sm text-text sm:min-h-8"
            value={draft.unit}
            disabled={disabled}
            onChange={(event) => change(draft.text, event.target.value as ByteUnit)}
          >
            {BYTE_UNITS.map(({ unit }) => (
              <option key={unit} value={unit}>
                {kind === 'bytes' ? unit : t('estimationPerSecond', { unit })}
              </option>
            ))}
          </select>
        )}
      </div>
    </li>
  )
}

function GradedEstimate({ question, value }: { question: EstimationQuestion; value?: number }) {
  const kind = ESTIMATION_QUANTITIES[question.quantity]
  const grade = value === undefined ? undefined : gradeEstimate(value, question.referenceValue)
  return (
    <li className={`rounded border px-3 py-2 ${grade?.passed ? 'border-success/60' : 'border-danger/60'}`}>
      <p className="text-text">{question.prompt}</p>
      <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
        <Verdict passed={grade?.passed ?? false} label={t(grade?.passed ? 'estimationPassed' : 'estimationFailed')} />
        <span className="text-text">{value === undefined ? t('estimationNoAnswer') : t('estimationYourAnswer', { value: formatMeasure(value, kind) })}</span>
        <span className="text-text">{t('estimationReference', { value: formatMeasure(question.referenceValue, kind) })}</span>
        {grade && grade.ratio > 0 && <span className="text-text-muted">{t('estimationRatio', { ratio: formatRounded(Number(grade.ratio.toPrecision(2))) })}</span>}
      </p>
    </li>
  )
}

/** The authored introduction, then each step that leads to the questions' quantities, in calculation order. */
function WorkedSolution({ stage }: { stage: EstimationStage }) {
  const result = estimate(stage.inputs)
  const needed = new Set(stage.questions.flatMap((question) => workedSteps(result, question.quantity)))
  return (
    <section className="mt-6 rounded border border-border bg-surface-raised/50 p-3 text-sm">
      <h3 className="font-semibold text-text">{t('estimationWorkedSolution')}</h3>
      <p className="mt-2 text-text">{stage.explanation}</p>
      <ol className="mt-3 space-y-1 font-mono text-xs text-text-muted">
        {result.steps
          .filter((step) => needed.has(step))
          .map((step) => (
            <li key={step.quantity}>
              <StepLine step={step} />
            </li>
          ))}
      </ol>
    </section>
  )
}
