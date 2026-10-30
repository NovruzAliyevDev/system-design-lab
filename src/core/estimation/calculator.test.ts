import { describe, expect, it } from 'vitest'
import { estimateFromUsage, perPeriod } from './calculator'
import { inBestUnit } from './estimate'

// The primer's Twitter solution, "Calculate usage": 100 million active users post 500 million tweets a
// day (15 billion a month, 30 days a month) of 10 KB each, and make 250 billion read requests a month.
const twitter = {
  dailyActiveUsers: 100_000_000,
  writesPerUserPerDay: 5,
  readsPerUserPerDay: 250_000_000_000 / 30 / 100_000_000,
  bytesPerWrite: 10_000,
}

describe('estimateFromUsage', () => {
  it("reproduces the primer's Twitter usage: 500 million tweets a day, 15 billion a month", () => {
    const { inputs } = estimateFromUsage(twitter)

    expect(inputs.writesPerMonth).toBe(15_000_000_000)
    expect(inputs.readsPerMonth).toBeCloseTo(250_000_000_000, 0)
  })

  it("reproduces the primer's Twitter rates: 6,000 tweets and 100 thousand reads a second", () => {
    const { result } = estimateFromUsage(twitter)

    expect(result.values.writeQps).toBe(6_000)
    expect(result.values.readQps).toBeCloseTo(100_000, 6)
  })

  it("reproduces the primer's Twitter storage: 150 TB of new tweets a month", () => {
    const { result } = estimateFromUsage(twitter)

    expect(inBestUnit(result.values.storagePerMonth, 'bytes')).toEqual({ value: 150, unit: 'TB' })
  })

  it('shows how users become requests a day, then a month, before the steps of `estimate`', () => {
    const { usageSteps } = estimateFromUsage(twitter)

    expect(usageSteps.map((step) => step.quantity)).toEqual(['writesPerDay', 'readsPerDay', 'writesPerMonth', 'readsPerMonth'])
    expect(usageSteps[0]).toEqual({
      quantity: 'writesPerDay',
      operation: 'multiply',
      operands: [
        { kind: 'input', name: 'dailyActiveUsers', value: 100_000_000 },
        { kind: 'input', name: 'writesPerUserPerDay', value: 5 },
      ],
      value: 500_000_000,
    })
    expect(usageSteps[2]).toEqual({
      quantity: 'writesPerMonth',
      operation: 'multiply',
      operands: [
        { kind: 'usage', name: 'writesPerDay', value: 500_000_000 },
        { kind: 'constant', name: 'daysPerMonth', value: 30 },
      ],
      value: 15_000_000_000,
    })
  })

  it('passes object sizes, the peak factor and the years on to `estimate`', () => {
    const { inputs, result } = estimateFromUsage({ ...twitter, bytesPerRead: 2_000, peakFactor: 3, years: 5 })

    expect(inputs).toMatchObject({ bytesPerWrite: 10_000, bytesPerRead: 2_000, peakFactor: 3, years: 5 })
    expect(result.values.peakWriteQps).toBe(18_000)
    expect(inBestUnit(result.values.storageTotal, 'bytes')).toEqual({ value: 9, unit: 'PB' })
  })
})

describe('perPeriod', () => {
  it("follows the primer's handy conversion guide: 2.5 million seconds a month", () => {
    expect(perPeriod(1, 'month')).toBe(2_500_000)
    expect(perPeriod(40, 'month')).toBe(100_000_000)
    expect(perPeriod(400, 'month')).toBe(1_000_000_000)
  })

  it('takes a year as 12 months and a day as a 30th of a month', () => {
    expect(perPeriod(400, 'year')).toBe(12_000_000_000)
    expect(perPeriod(6_000, 'day')).toBe(500_000_000)
    expect(perPeriod(6_000, 'second')).toBe(6_000)
  })
})
