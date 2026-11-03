import type { UsageOperand, UsageQuantity, UsageStep } from '../core/estimation/calculator'
import { ESTIMATION_QUANTITIES, inBestUnit, isEstimationQuantity, type EstimationQuantity, type EstimationStep, type Operand, type QuantityKind } from '../core/estimation/estimate'
import { formatInteger, formatNumber, t, type StringKey } from './i18n'

// How estimates and their worked steps read, shared by the Estimation Stage and the calculator.

const QUANTITY_NAMES: Record<EstimationQuantity | UsageQuantity, StringKey> = {
  writesPerDay: 'quantityWritesPerDay',
  readsPerDay: 'quantityReadsPerDay',
  writesPerMonth: 'quantityWritesPerMonth',
  readsPerMonth: 'quantityReadsPerMonth',
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

type NamedOperand = Exclude<Operand, { kind: 'quantity' }> | Exclude<UsageOperand, { kind: 'usage' }>

const OPERAND_NAMES: Record<NamedOperand['name'], StringKey> = {
  dailyActiveUsers: 'inputDailyActiveUsers',
  writesPerUserPerDay: 'inputWritesPerUserPerDay',
  readsPerUserPerDay: 'inputReadsPerUserPerDay',
  daysPerMonth: 'constantDaysPerMonth',
  writesPerMonth: 'inputWritesPerMonth',
  readsPerMonth: 'inputReadsPerMonth',
  bytesPerWrite: 'inputBytesPerWrite',
  bytesPerRead: 'inputBytesPerRead',
  peakFactor: 'inputPeakFactor',
  years: 'inputYears',
  secondsPerMonth: 'constantSecondsPerMonth',
  monthsPerYear: 'constantMonthsPerYear',
}

export function quantityName(quantity: EstimationQuantity | UsageQuantity): string {
  return t(QUANTITY_NAMES[quantity])
}

/** A number rounded to 4 significant digits, whole numbers grouped: "12,71", "457,6", "10 000 000". */
export function formatRounded(value: number): string {
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

/** A number as typed: a decimal comma or point, digits grouped by spaces or not. Undefined unless a finite number. */
export function parseDecimal(text: string): number | undefined {
  const compact = text.replace(/\s/g, '').replace(',', '.')
  const number = Number(compact)
  return compact !== '' && Number.isFinite(number) ? number : undefined
}

function formatOperand(operand: Operand | UsageOperand): string {
  if (operand.kind === 'quantity') return formatMeasure(operand.value, ESTIMATION_QUANTITIES[operand.name])
  if (operand.kind === 'input' && (operand.name === 'bytesPerWrite' || operand.name === 'bytesPerRead')) return formatMeasure(operand.value, 'bytes')
  return formatRounded(operand.value)
}

function operandName(operand: Operand | UsageOperand): string {
  return operand.kind === 'quantity' || operand.kind === 'usage' ? quantityName(operand.name) : t(OPERAND_NAMES[operand.name])
}

/** One worked step: `name = left × right = values = result`. */
export function StepLine({ step }: { step: EstimationStep | UsageStep }) {
  const [left, right] = step.operands
  const sign = step.operation === 'divide' ? '÷' : '×'
  // Usage steps count requests; estimation steps have a kind and a unit.
  const result = isEstimationQuantity(step.quantity) ? formatMeasure(step.value, ESTIMATION_QUANTITIES[step.quantity]) : formatRounded(step.value)
  return (
    <>
      <span className="text-text">{quantityName(step.quantity)}</span> = {operandName(left)} {sign} {operandName(right)} = {formatOperand(left)} {sign}{' '}
      {formatOperand(right)} = <span className="text-text">{result}</span>
    </>
  )
}
