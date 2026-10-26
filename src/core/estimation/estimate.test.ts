import { describe, expect, it } from 'vitest'
import { BYTE_UNITS, estimate, fromUnit, gradeEstimate, inBestUnit, workedSteps } from './estimate'

// The primer's Pastebin solution, "Calculate usage": 1 KB of content plus a 7-byte shortlink, a 4-byte
// expiration, a 5-byte created_at and a 255-byte paste_path make ~1.27 KB per paste.
const PASTE_BYTES = 1_000 + 7 + 4 + 5 + 255
function expectMeasure(measure: { value: number; unit?: string }, value: number, unit: string) {
  expect(measure.unit).toBe(unit)
  expect(measure.value).toBeCloseTo(value, 9)
}

const pastebin = { writesPerMonth: 10_000_000, readsPerMonth: 100_000_000, bytesPerWrite: PASTE_BYTES, years: 3 }

describe('estimate', () => {
  it("reproduces the primer's Pastebin usage: 4 writes and 40 reads per second", () => {
    const { values } = estimate(pastebin)

    expect(values.writeQps).toBe(4)
    expect(values.readQps).toBe(40)
  })

  it("reproduces the primer's Pastebin storage: 12.7 GB a month and ~450 GB in 3 years", () => {
    const { values } = estimate(pastebin)

    expectMeasure(inBestUnit(values.storagePerMonth, 'bytes'), 12.71, 'GB')
    expectMeasure(inBestUnit(values.storageTotal, 'bytes'), 457.56, 'GB')
    expectMeasure(inBestUnit(values.storagePerYear, 'bytes'), 152.52, 'GB')
  })

  it('gives bandwidth as the bytes moved per second, reads returning what writes stored unless told otherwise', () => {
    const { values } = estimate(pastebin)

    expectMeasure(inBestUnit(values.writeBandwidth, 'bytes-per-second'), 5.084, 'KB')
    expectMeasure(inBestUnit(values.readBandwidth, 'bytes-per-second'), 50.84, 'KB')
    expect(estimate({ ...pastebin, bytesPerRead: 2_000 }).values.readBandwidth).toBe(80_000)
  })

  it('scales the average load by the peak factor, which is 1 unless given', () => {
    expect(estimate(pastebin).values.peakReadQps).toBe(40)
    expect(estimate({ ...pastebin, peakFactor: 3 }).values).toMatchObject({ peakWriteQps: 12, peakReadQps: 120 })
  })

  it('keeps one year of data unless told how many years', () => {
    const { values } = estimate({ ...pastebin, years: undefined })

    expect(values.storageTotal).toBe(values.storagePerYear)
  })

  it('shows the worked calculation of a quantity, from the inputs to the answer', () => {
    const steps = workedSteps(estimate(pastebin), 'storageTotal')

    expect(steps.map((step) => step.quantity)).toEqual(['storagePerMonth', 'storagePerYear', 'storageTotal'])
    expect(steps[0]).toEqual({
      quantity: 'storagePerMonth',
      operation: 'multiply',
      operands: [
        { kind: 'input', name: 'writesPerMonth', value: 10_000_000 },
        { kind: 'input', name: 'bytesPerWrite', value: PASTE_BYTES },
      ],
      value: 12_710_000_000,
    })
    expect(steps[1].operands[1]).toEqual({ kind: 'constant', name: 'monthsPerYear', value: 12 })
    expect(workedSteps(estimate(pastebin), 'readQps')).toEqual([
      {
        quantity: 'readQps',
        operation: 'divide',
        operands: [
          { kind: 'input', name: 'readsPerMonth', value: 100_000_000 },
          { kind: 'constant', name: 'secondsPerMonth', value: 2_500_000 },
        ],
        value: 40,
      },
    ])
  })
})

describe('byte units', () => {
  it("follow the primer's powers of two table, taking 2^10 as a thousand", () => {
    expect(BYTE_UNITS.map(({ unit, power }) => [unit, power])).toEqual([
      ['B', 0],
      ['KB', 10],
      ['MB', 20],
      ['GB', 30],
      ['TB', 40],
      ['PB', 50],
    ])
    expect(fromUnit(1.5, 'TB')).toBe(1.5e12)
  })

  it('show a value in the largest unit that keeps it at least 1', () => {
    expect(inBestUnit(999, 'bytes')).toEqual({ value: 999, unit: 'B' })
    expect(inBestUnit(1_000, 'bytes')).toEqual({ value: 1, unit: 'KB' })
    expectMeasure(inBestUnit(123_456_789, 'bytes'), 123.456789, 'MB')
    expect(inBestUnit(3e18, 'bytes')).toEqual({ value: 3000, unit: 'PB' })
    expect(inBestUnit(0.5, 'bytes')).toEqual({ value: 0.5, unit: 'B' })
  })

  it('leave request rates in requests per second', () => {
    expect(inBestUnit(38_580.25, 'requests-per-second')).toEqual({ value: 38_580.25, unit: undefined })
  })
})

describe('gradeEstimate', () => {
  it('accepts the reference value and anything within a factor of 2 of it, both edges included', () => {
    expect(gradeEstimate(40, 40)).toEqual({ passed: true, ratio: 1 })
    expect(gradeEstimate(20, 40)).toEqual({ passed: true, ratio: 0.5 })
    expect(gradeEstimate(80, 40)).toEqual({ passed: true, ratio: 2 })
  })

  it('rejects values just past a factor of 2', () => {
    expect(gradeEstimate(19.99, 40).passed).toBe(false)
    expect(gradeEstimate(80.01, 40).passed).toBe(false)
    expect(gradeEstimate(400, 40)).toEqual({ passed: false, ratio: 10 })
  })

  it('rejects zero, negative and non-finite values', () => {
    expect(gradeEstimate(0, 40).passed).toBe(false)
    expect(gradeEstimate(-40, 40).passed).toBe(false)
    expect(gradeEstimate(Number.NaN, 40).passed).toBe(false)
    expect(gradeEstimate(Number.POSITIVE_INFINITY, 40).passed).toBe(false)
  })

  it('needs a positive reference value', () => {
    expect(() => gradeEstimate(1, 0)).toThrow(RangeError)
  })
})
