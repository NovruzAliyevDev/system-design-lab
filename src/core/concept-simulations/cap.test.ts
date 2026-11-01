import { describe, expect, it } from 'vitest'
import { simulateCap, totalsOf, type CapInput } from './cap'
import { generateRequests, type ClientRequest } from './requests'

/** Clients on the side of three nodes or of two. */
const MAJORITY = 0
const MINORITY = 0.9

const write = (time: number, route: number, key = 1): ClientRequest => ({ time, kind: 'write', key, route })
const read = (time: number, route: number, key = 1): ClientRequest => ({ time, kind: 'read', key, route })

const base: Omit<CapInput, 'requests'> = { mode: 'cp', keyCount: 3, tickMs: 100, ticks: 10 }
const partition = { start: 200, end: 600 }

describe('CAP simulation', () => {
  it('without a partition, both modes accept every request and every read sees the last write', () => {
    const requests = [write(10, MAJORITY), read(20, MINORITY), write(30, MINORITY), read(40, MAJORITY)]
    for (const mode of ['cp', 'ap'] as const) {
      const { totals, log } = simulateCap({ ...base, mode, requests })

      expect(totals).toMatchObject({ reads: 2, writes: 2, rejectedReads: 0, rejectedWrites: 0, staleReads: 0, mostDivergentKeys: 0 })
      expect(log.map((entry) => [entry.side, entry.outcome, entry.version])).toEqual([
        ['majority', 'ok', 1],
        ['minority', 'ok', 1],
        ['minority', 'ok', 2],
        ['majority', 'ok', 2],
      ])
    }
  })

  describe('CP', () => {
    it('rejects reads and writes on the minority side of a partition, and serves the majority side', () => {
      const requests = [write(300, MINORITY), read(310, MINORITY), write(320, MAJORITY), read(330, MAJORITY)]
      const { totals, log } = simulateCap({ ...base, partition, requests })

      expect(totals).toMatchObject({ writes: 2, rejectedWrites: 1, reads: 2, rejectedReads: 1, staleReads: 0 })
      expect(log.map((entry) => entry.outcome)).toEqual(['rejected', 'rejected', 'ok', 'ok'])
    })

    it('the minority side catches up once the partition heals, without conflicts', () => {
      const requests = [write(300, MAJORITY), read(500, MINORITY), read(700, MINORITY)]
      const { totals, ticks, log } = simulateCap({ ...base, partition, requests })

      // The minority is behind during the partition, but answers no one.
      expect(ticks[3].divergentKeys).toBe(1)
      expect(ticks[6].divergentKeys).toBe(0)
      expect(totals.conflicts).toBe(0)
      expect(log.at(-1)).toMatchObject({ outcome: 'ok', version: 1 })
    })
  })

  describe('AP', () => {
    const ap = { ...base, mode: 'ap' as const, partition }

    it('accepts writes on both sides of a partition, and the sides diverge', () => {
      const requests = [write(300, MINORITY), read(310, MAJORITY), read(320, MINORITY), write(330, MAJORITY, 2)]
      const { totals, ticks, log } = simulateCap({ ...ap, requests })

      expect(totals).toMatchObject({ writes: 2, rejectedWrites: 0, reads: 2, rejectedReads: 0, staleReads: 1 })
      expect(ticks[3]).toMatchObject({ divergentKeys: 2, versions: { majority: [0, 0, 2], minority: [0, 1, 0] } })
      // The majority side has not heard of the minority's write.
      expect(log[1]).toMatchObject({ side: 'majority', outcome: 'stale', version: 0, latest: 1 })
      expect(log[2]).toMatchObject({ side: 'minority', outcome: 'ok', version: 1 })
    })

    it('reconciles the sides when the partition heals: the last writer wins each key written on both', () => {
      const requests = [write(300, MAJORITY), write(400, MINORITY), write(450, MINORITY, 2), read(700, MAJORITY), read(710, MAJORITY, 2)]
      const { totals, ticks, log } = simulateCap({ ...ap, requests })

      expect(ticks[5].divergentKeys).toBe(2)
      expect(ticks[6]).toMatchObject({ conflicts: 1, divergentKeys: 0 })
      expect(totals.mostDivergentKeys).toBe(2)
      expect(log.slice(-2)).toMatchObject([
        { outcome: 'ok', version: 2 },
        { outcome: 'ok', version: 3 },
      ])
    })
  })

  it('a partition without an end lasts to the end of the run', () => {
    const { totals } = simulateCap({ ...base, partition: { start: 200 }, requests: [write(900, MINORITY)] })

    expect(totals.rejectedWrites).toBe(1)
  })

  it('totals any first ticks as a shorter run of the same requests would', () => {
    const requests = generateRequests({ rate: 30, writeShare: 0.4, keyCount: 4, duration: 4000, seed: 9 })
    const input = { ...base, mode: 'ap' as const, keyCount: 4, ticks: 40, partition: { start: 800, end: 2500 }, requests }
    const whole = simulateCap(input)
    const shorter = simulateCap({ ...input, ticks: 20 })

    expect(whole.totals.staleReads).toBeGreaterThan(0)
    expect(totalsOf(whole.ticks.slice(0, 20))).toEqual(shorter.totals)
    expect(whole.log.slice(0, shorter.log.length)).toEqual(shorter.log)
  })
})
