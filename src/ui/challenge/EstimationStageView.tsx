import { useId, useState } from 'react'
import type { StageWork } from '../../core/challenges/attempt'
import type { EstimationQuestion, EstimationStage } from '../../core/challenges/challenge'
import {
  BYTE_UNITS,
  ESTIMATION_QUANTITIES,
  estimate,
  fromUnit,
  gradeEstimate,
  inBestUnit,
  workedSteps,
  type ByteUnit,
  type EstimationQuantity,
  type EstimationStep,
  type Operand,
  type QuantityKind,
} from '../../core/estimation/estimate'
import { formatInteger, formatNumber, t, type StringKey } from '../i18n'
import { Verdict } from './shared'

type EstimationWork = Extract<StageWork, { type: 'estimation' }>

const QUANTITY_NAMES: Record<EstimationQuantity, StringKey> = {
  writeQps: 'quantityWriteQps',
  readQps: 'quantityReadQps',
  peakWriteQps: 'quantityPeakWriteQps',
  peakReadQps: 'quantityPeakReadQps',
  storagePerMonth: 'quantityStoragePerMonth',
  storagePerYear: 'quantityStoragePerYear',
  storageTotal: 'quantityStorageTotal',
  writeBandwidth: 'quantityWriteBandwidth',
  readBandwidth: 'quantityReadBandwidth',
}

const OPERAND_NAMES: Record<Exclude<Operand, { kind: 'quantity' }>['name'], StringKey> = {
  writesPerMonth: 'inputWritesPerMonth',
  readsPerMonth: 'inputReadsPerMonth',
  bytesPerWrite: 'inputBytesPerWrite',
  bytesPerRead: 'inputBytesPerRead',
  peakFactor: 'inputPeakFactor',
  years: 'inputYears',
  secondsPerMonth: 'constantSecondsPerMonth',
  monthsPerYear: 'constantMonthsPerYear',
}

/** A number rounded to 4 significant digits, whole numbers grouped: "12,71", "457,6", "10 000 000". */
function formatRounded(value: number): string {
  const rounded = Number(value.toPrecision(4))
  return Number.isInteger(rounded) ? formatInteger(rounded) : formatNumber(rounded)
}

/** A value of a quantity kind in its best unit, e.g. "12,71 GB", "40 sorğu/san", "50,84 KB/san". */
export function formatMeasure(value: number, kind: QuantityKind): string {
  const { value: inUnit, unit } = inBestUnit(value, kind)
  const number = formatRounded(inUnit)
  if (kind === 'requests-per-second') return `${number} ${t('estimationRequestsPerSecond')}`
  return kind === 'bytes' ? `${number} ${unit}` : `${number} ${t('estimationPerSecond', { unit: unit! })}`
}

function formatOperand(operand: Operand): string {
  if (operand.kind === 'quantity') return formatMeasure(operand.value, ESTIMATION_QUANTITIES[operand.name])
  if (operand.name === 'bytesPerWrite' || operand.name === 'bytesPerRead') return formatMeasure(operand.value, 'bytes')
  return formatRounded(operand.value)
}

function operandName(operand: Operand): string {
  return t(operand.kind === 'quantity' ? QUANTITY_NAMES[operand.name] : OPERAND_NAMES[operand.name])
}

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
      {!over && <p className="text-xs text-zinc-500">{t('estimationTolerance')}</p>}
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
    const number = Number(text.trim().replace(',', '.'))
    const valid = text.trim() !== '' && Number.isFinite(number)
    onChange(valid ? (kind === 'requests-per-second' ? number : fromUnit(number, unit)) : undefined)
  }

  return (
    <li className="rounded border border-zinc-800 px-3 py-2">
      <label htmlFor={inputId} className="block text-zinc-100">
        {question.prompt}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          inputMode="decimal"
          className="w-36 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          value={draft.text}
          disabled={disabled}
          onChange={(event) => change(event.target.value, draft.unit)}
        />
        {kind === 'requests-per-second' ? (
          <span className="text-sm text-zinc-400">{t('estimationRequestsPerSecond')}</span>
        ) : (
          <select
            aria-label={t('estimationUnit', { question: question.prompt })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
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
    <li className={`rounded border px-3 py-2 ${grade?.passed ? 'border-emerald-500/50' : 'border-rose-500/50'}`}>
      <p className="text-zinc-100">{question.prompt}</p>
      <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
        <Verdict passed={grade?.passed ?? false} label={t(grade?.passed ? 'estimationPassed' : 'estimationFailed')} />
        <span className="text-zinc-300">{value === undefined ? t('estimationNoAnswer') : t('estimationYourAnswer', { value: formatMeasure(value, kind) })}</span>
        <span className="text-zinc-300">{t('estimationReference', { value: formatMeasure(question.referenceValue, kind) })}</span>
        {grade && grade.ratio > 0 && <span className="text-zinc-500">{t('estimationRatio', { ratio: formatRounded(Number(grade.ratio.toPrecision(2))) })}</span>}
      </p>
    </li>
  )
}

/** The authored introduction, then each step that leads to the questions' quantities, in calculation order. */
function WorkedSolution({ stage }: { stage: EstimationStage }) {
  const result = estimate(stage.inputs)
  const needed = new Set(stage.questions.flatMap((question) => workedSteps(result, question.quantity)))
  return (
    <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
      <h3 className="font-semibold text-zinc-100">{t('estimationWorkedSolution')}</h3>
      <p className="mt-2 text-zinc-300">{stage.explanation}</p>
      <ol className="mt-3 space-y-1 font-mono text-xs text-zinc-300">
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

function StepLine({ step }: { step: EstimationStep }) {
  const [left, right] = step.operands
  const sign = step.operation === 'multiply' ? '×' : '÷'
  return (
    <>
      <span className="text-zinc-100">{t(QUANTITY_NAMES[step.quantity])}</span> = {operandName(left)} {sign} {operandName(right)} = {formatOperand(left)} {sign}{' '}
      {formatOperand(right)} = <span className="text-zinc-100">{formatMeasure(step.value, ESTIMATION_QUANTITIES[step.quantity])}</span>
    </>
  )
}
