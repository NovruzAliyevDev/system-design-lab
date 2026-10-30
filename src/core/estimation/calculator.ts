// The back-of-the-envelope calculator: from how many people use a system to the requests, storage and
// bandwidth it needs. Usage becomes requests per month, then `estimate` does the rest.
import { estimate, MONTHS_PER_YEAR, SECONDS_PER_MONTH, type EstimationInputs, type EstimationResult } from './estimate'

/** The primer's month: "15 billion tweets per month" are 500 million a day for 30 days. */
export const DAYS_PER_MONTH = 30

export interface UsageInputs {
  dailyActiveUsers: number
  writesPerUserPerDay: number
  readsPerUserPerDay: number
  /** What each write stores. */
  bytesPerWrite: number
  /** What each read returns; the bytes of a write when left out. */
  bytesPerRead?: number
  /** How many times the average load the busiest moments see; 1 when left out. */
  peakFactor?: number
  /** How long data is kept, for the total storage; 1 when left out. */
  years?: number
}

/** The request counts usage comes to, before `estimate` takes over. */
export type UsageQuantity = 'writesPerDay' | 'readsPerDay' | 'writesPerMonth' | 'readsPerMonth'

/** A number a usage step works with: an input, the days of a month, or a count computed before. */
export type UsageOperand =
  | { kind: 'input'; name: 'dailyActiveUsers' | 'writesPerUserPerDay' | 'readsPerUserPerDay'; value: number }
  | { kind: 'constant'; name: 'daysPerMonth'; value: number }
  | { kind: 'usage'; name: UsageQuantity; value: number }

/** One line of the usage calculation: `quantity = left × right`. */
export interface UsageStep {
  quantity: UsageQuantity
  operation: 'multiply'
  operands: [UsageOperand, UsageOperand]
  value: number
}

export interface UsageEstimate {
  /** Users to requests a day, then a month, in the order they are worked out. */
  usageSteps: UsageStep[]
  /** What the usage comes to, as `estimate` takes it. */
  inputs: EstimationInputs
  /** `estimate` of those inputs: rates, storage and bandwidth, with their steps. */
  result: EstimationResult
}

export function estimateFromUsage(usage: UsageInputs): UsageEstimate {
  const values = {} as Record<UsageQuantity, number>
  const usageSteps: UsageStep[] = []
  const input = (name: Extract<UsageOperand, { kind: 'input' }>['name']): UsageOperand => ({ kind: 'input', name, value: usage[name] })
  const daysPerMonth: UsageOperand = { kind: 'constant', name: 'daysPerMonth', value: DAYS_PER_MONTH }
  const counted = (name: UsageQuantity): UsageOperand => ({ kind: 'usage', name, value: values[name] })
  const step = (quantity: UsageQuantity, left: UsageOperand, right: UsageOperand) => {
    values[quantity] = left.value * right.value
    usageSteps.push({ quantity, operation: 'multiply', operands: [left, right], value: values[quantity] })
  }

  step('writesPerDay', input('dailyActiveUsers'), input('writesPerUserPerDay'))
  step('readsPerDay', input('dailyActiveUsers'), input('readsPerUserPerDay'))
  step('writesPerMonth', counted('writesPerDay'), daysPerMonth)
  step('readsPerMonth', counted('readsPerDay'), daysPerMonth)

  const { bytesPerWrite, bytesPerRead, peakFactor, years } = usage
  const inputs: EstimationInputs = {
    writesPerMonth: values.writesPerMonth,
    readsPerMonth: values.readsPerMonth,
    bytesPerWrite,
    ...(bytesPerRead !== undefined && { bytesPerRead }),
    ...(peakFactor !== undefined && { peakFactor }),
    ...(years !== undefined && { years }),
  }
  return { usageSteps, inputs, result: estimate(inputs) }
}

/** A span a rate can be given per. */
export type Period = 'second' | 'day' | 'month' | 'year'

export const PERIODS: Period[] = ['second', 'day', 'month', 'year']

/** A rate per second, per another period, with the primer's 2.5 million seconds a month. */
export function perPeriod(perSecond: number, period: Period): number {
  switch (period) {
    case 'second':
      return perSecond
    case 'day':
      return (perSecond * SECONDS_PER_MONTH) / DAYS_PER_MONTH
    case 'month':
      return perSecond * SECONDS_PER_MONTH
    case 'year':
      return perSecond * SECONDS_PER_MONTH * MONTHS_PER_YEAR
  }
}
