// Back-of-the-envelope estimation, done the primer's way: rounded conversions that keep the maths
// mental. Every quantity comes with the steps that compute it, so the worked calculation can be shown.

/**
 * The byte units of the primer's powers of two table. A unit is 2^power bytes, which the table (and
 * back-of-the-envelope maths) takes as a thousand, a million, …: 2^10 ≈ 10^3.
 */
export const BYTE_UNITS = [
  { unit: 'B', power: 0, bytes: 1 },
  { unit: 'KB', power: 10, bytes: 1e3 },
  { unit: 'MB', power: 20, bytes: 1e6 },
  { unit: 'GB', power: 30, bytes: 1e9 },
  { unit: 'TB', power: 40, bytes: 1e12 },
  { unit: 'PB', power: 50, bytes: 1e15 },
] as const

export type ByteUnit = (typeof BYTE_UNITS)[number]['unit']

/** The primer's handy conversion guide: 2.5 million seconds per month, so 1 request per second is 2.5 million a month. */
export const SECONDS_PER_MONTH = 2_500_000

export const MONTHS_PER_YEAR = 12

export interface EstimationInputs {
  writesPerMonth: number
  readsPerMonth: number
  /** What each write stores. */
  bytesPerWrite: number
  /** What each read returns; the bytes of a write when left out. */
  bytesPerRead?: number
  /** How many times the average load the busiest moments see; 1 when left out. */
  peakFactor?: number
  /** How long data is kept, for the total storage; 1 when left out. */
  years?: number
}

/** What a quantity counts: requests per second, bytes, or bytes per second. */
export type QuantityKind = 'requests-per-second' | 'bytes' | 'bytes-per-second'

/** Every quantity `estimate` computes, with its kind, in the order the worked calculation reaches them. */
export const ESTIMATION_QUANTITIES = {
  writeQps: 'requests-per-second',
  readQps: 'requests-per-second',
  peakWriteQps: 'requests-per-second',
  peakReadQps: 'requests-per-second',
  storagePerMonth: 'bytes',
  storagePerYear: 'bytes',
  storageTotal: 'bytes',
  writeBandwidth: 'bytes-per-second',
  readBandwidth: 'bytes-per-second',
} as const satisfies Record<string, QuantityKind>

export type EstimationQuantity = keyof typeof ESTIMATION_QUANTITIES

export function isEstimationQuantity(value: unknown): value is EstimationQuantity {
  return typeof value === 'string' && Object.hasOwn(ESTIMATION_QUANTITIES, value)
}

/** A number a step works with: an input (defaults filled in), a fixed conversion, or a quantity computed before. */
export type Operand =
  | { kind: 'input'; name: keyof EstimationInputs; value: number }
  | { kind: 'constant'; name: 'secondsPerMonth' | 'monthsPerYear'; value: number }
  | { kind: 'quantity'; name: EstimationQuantity; value: number }

/** One line of the worked calculation: `quantity = left × right` or `left ÷ right`. */
export interface EstimationStep {
  quantity: EstimationQuantity
  operation: 'multiply' | 'divide'
  operands: [Operand, Operand]
  value: number
}

export interface EstimationResult {
  /** In requests per second, bytes or bytes per second, as `ESTIMATION_QUANTITIES` says. */
  values: Record<EstimationQuantity, number>
  /** One per quantity, in the order of `ESTIMATION_QUANTITIES`. */
  steps: EstimationStep[]
}

export function estimate(inputs: EstimationInputs): EstimationResult {
  const filled = {
    ...inputs,
    bytesPerRead: inputs.bytesPerRead ?? inputs.bytesPerWrite,
    peakFactor: inputs.peakFactor ?? 1,
    years: inputs.years ?? 1,
  }
  const values = {} as Record<EstimationQuantity, number>
  const steps: EstimationStep[] = []
  const input = (name: keyof EstimationInputs): Operand => ({ kind: 'input', name, value: filled[name] })
  const constant = (name: 'secondsPerMonth' | 'monthsPerYear'): Operand => ({
    kind: 'constant',
    name,
    value: name === 'secondsPerMonth' ? SECONDS_PER_MONTH : MONTHS_PER_YEAR,
  })
  const quantity = (name: EstimationQuantity): Operand => ({ kind: 'quantity', name, value: values[name] })
  const step = (name: EstimationQuantity, operation: EstimationStep['operation'], left: Operand, right: Operand) => {
    const value = operation === 'multiply' ? left.value * right.value : left.value / right.value
    values[name] = value
    steps.push({ quantity: name, operation, operands: [left, right], value })
  }

  step('writeQps', 'divide', input('writesPerMonth'), constant('secondsPerMonth'))
  step('readQps', 'divide', input('readsPerMonth'), constant('secondsPerMonth'))
  step('peakWriteQps', 'multiply', quantity('writeQps'), input('peakFactor'))
  step('peakReadQps', 'multiply', quantity('readQps'), input('peakFactor'))
  step('storagePerMonth', 'multiply', input('writesPerMonth'), input('bytesPerWrite'))
  step('storagePerYear', 'multiply', quantity('storagePerMonth'), constant('monthsPerYear'))
  step('storageTotal', 'multiply', quantity('storagePerYear'), input('years'))
  step('writeBandwidth', 'multiply', quantity('writeQps'), input('bytesPerWrite'))
  step('readBandwidth', 'multiply', quantity('readQps'), input('bytesPerRead'))
  return { values, steps }
}

/** The steps that lead to a quantity, in the order they are worked out, ending with its own. */
export function workedSteps(result: EstimationResult, quantity: EstimationQuantity): EstimationStep[] {
  const needed = new Set<EstimationQuantity>([quantity])
  // Steps come after the quantities they use, so one pass from the end collects the whole chain.
  for (const step of [...result.steps].reverse()) {
    if (!needed.has(step.quantity)) continue
    for (const operand of step.operands) if (operand.kind === 'quantity') needed.add(operand.name)
  }
  return result.steps.filter((step) => needed.has(step.quantity))
}

/** A value in a unit: bytes (and bytes per second) in a byte unit; request rates have none. */
export interface Measure {
  value: number
  unit?: ByteUnit
}

/** A value of a kind in the largest byte unit that keeps it at least 1 (bytes when none does). */
export function inBestUnit(value: number, kind: QuantityKind): Measure {
  if (kind === 'requests-per-second') return { value, unit: undefined }
  const best = [...BYTE_UNITS].reverse().find(({ bytes }) => Math.abs(value) >= bytes) ?? BYTE_UNITS[0]
  return { value: value / best.bytes, unit: best.unit }
}

/** A value given in a byte unit, in bytes. */
export function fromUnit(value: number, unit: ByteUnit): number {
  return value * BYTE_UNITS.find((candidate) => candidate.unit === unit)!.bytes
}

/** How far an estimate is from the reference: accepted within a factor of 2, both ways. */
export interface EstimateGrade {
  passed: boolean
  /** The estimate divided by the reference. */
  ratio: number
}

/** Accepts an estimate from half to twice the reference value. Throws a `RangeError` for a reference that is not positive. */
export function gradeEstimate(userValue: number, referenceValue: number): EstimateGrade {
  if (!(referenceValue > 0) || !Number.isFinite(referenceValue)) throw new RangeError('A reference value must be a positive number.')
  const ratio = userValue / referenceValue
  return { passed: Number.isFinite(ratio) && ratio >= 0.5 && ratio <= 2, ratio }
}
