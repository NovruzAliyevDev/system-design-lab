import { describe, expect, it } from 'vitest'
import { simulateReplication, totalsOf, type ReplicationInput } from './replication'
import { generateRequests, type ClientRequest } from './requests'

const write = (time: number, key = 1, route = 0): ClientRequest => ({ time, kind: 'write', key, route })
const read = (time: number, key = 1, route = 0): ClientRequest => ({ time, kind: 'read', key, route })

const base: Omit<ReplicationInput, 'requests'> = {
  topology: 'primary-replica',
  replicas: 2,
  lag: 100,
  failoverDelay: 300,
  tickMs: 100,
  ticks: 10,
}

const workload = generateRequests({ rate: 40, writeShare: 0.3, keyCount: 10, duration: 4000, seed: 3 })

describe('replication simulation', () => {
  it('a replica read within the lag window after a write is stale, and fresh once the write has arrived', () => {
    const requests = [write(0), read(50), read(99, 1, 0.9), read(100), read(250)]
    const { totals, ticks } = simulateReplication({ ...base, requests })

    expect(totals).toMatchObject({ writes: 1, reads: 4, staleReads: 2, longestStaleness: 99 })
    // One from each replica.
    expect(ticks[0].nodes.map((node) => node.staleReads)).toEqual([0, 1, 1])
  })

  it('reads a key no write has touched yet, or another key, as fresh', () => {
    const { totals } = simulateReplication({ ...base, requests: [read(0), write(10, 1), read(20, 2)] })

    expect(totals.staleReads).toBe(0)
  })

  it('never serves a stale read without lag, and serves more of them the longer the lag', () => {
    const run = (lag: number) => simulateReplication({ ...base, ticks: 40, lag, requests: workload }).totals.staleReads

    expect(run(0)).toBe(0)
    expect(run(100)).toBeGreaterThan(0)
    expect(run(800)).toBeGreaterThan(run(100))
  })

  it('reports the writes still on their way to each replica at the end of a tick', () => {
    const { ticks } = simulateReplication({ ...base, lag: 150, requests: [write(20), write(60, 2)] })

    expect(ticks[0].nodes).toEqual([
      { role: 'primary', behind: 0, staleReads: 0 },
      { role: 'replica', behind: 2, staleReads: 0 },
      { role: 'replica', behind: 2, staleReads: 0 },
    ])
    expect(ticks[1].nodes.map((node) => node.behind)).toEqual([0, 1, 1])
    expect(ticks[2].nodes.map((node) => node.behind)).toEqual([0, 0, 0])
  })

  describe('when the primary is killed', () => {
    const killed = { ...base, killPrimaryAt: 500 }

    it('rejects writes until a replica is promoted, while the replicas keep serving reads', () => {
      const requests = [write(450), write(500), read(600), write(799), write(800), read(900)]
      const { totals, ticks, failover } = simulateReplication({ ...killed, requests })

      expect(failover).toEqual({ killedAt: 500, recoveredAt: 800, takenOverBy: 1 })
      expect(totals).toMatchObject({ writes: 4, rejectedWrites: 2, reads: 2, rejectedReads: 0 })
      expect(ticks[5].nodes.map((node) => node.role)).toEqual(['down', 'replica', 'replica'])
      expect(ticks[8].nodes.map((node) => node.role)).toEqual(['down', 'primary', 'replica'])
    })

    it('loses the writes the primary acknowledged but had not yet replicated', () => {
      // The write at 380 reached the replicas at 480; the one at 450 would have at 550.
      const requests = [write(380, 1), write(450, 2), read(600, 2), read(650, 1)]
      const { totals, ticks } = simulateReplication({ ...killed, requests })

      expect(totals.lostWrites).toBe(1)
      expect(ticks[5].lostWrites).toBe(1)
      // The lost write is gone everywhere, so reading its key returns the last copy there is, not a stale one.
      expect(totals.staleReads).toBe(0)
    })

    it('the promoted replica replicates its writes to the replicas left', () => {
      const requests = [write(850), read(900, 1, 0), read(960, 1, 0)]
      const { totals } = simulateReplication({ ...killed, requests })

      expect(totals).toMatchObject({ rejectedWrites: 0, staleReads: 1 })
    })

    it('with a single replica, the promoted primary serves the reads too', () => {
      const requests = [write(850), read(860)]
      const { totals } = simulateReplication({ ...killed, replicas: 1, requests })

      expect(totals).toMatchObject({ reads: 1, rejectedReads: 0, staleReads: 0 })
    })
  })

  describe('primary-primary', () => {
    const multi = { ...base, topology: 'primary-primary' as const }
    /** Route to the first or the second primary. */
    const first = 0
    const second = 0.9

    it('reads from the other primary are stale within the lag window', () => {
      const requests = [write(0, 1, first), read(50, 1, second), read(50, 1, first), read(150, 1, second)]
      const { totals } = simulateReplication({ ...multi, requests })

      expect(totals).toMatchObject({ reads: 3, staleReads: 1 })
    })

    it('writes to one key on both primaries within the lag window conflict, and the last writer wins', () => {
      const requests = [write(0, 1, first), write(60, 1, second), read(300, 1, first), read(300, 1, second)]
      const { totals } = simulateReplication({ ...multi, requests })

      expect(totals.conflicts).toBe(1)
      // Both primaries settle on the write at 60, so neither read is stale.
      expect(totals.staleReads).toBe(0)
    })

    it('does not count writes as conflicting once one primary has seen the other one\'s write', () => {
      const requests = [write(0, 1, first), write(150, 1, second), write(300, 1, first), write(310, 2, second)]
      const { totals } = simulateReplication({ ...multi, requests })

      expect(totals.conflicts).toBe(0)
    })

    it('a killed primary stops answering until its failure is detected, then the other takes all requests', () => {
      const requests = [write(100, 1, first), write(450, 2, first), write(600, 1, first), read(700, 1, second), write(800, 1, first)]
      const { totals, failover, ticks } = simulateReplication({ ...multi, killPrimaryAt: 500, requests })

      expect(failover).toEqual({ killedAt: 500, recoveredAt: 800, takenOverBy: 1 })
      expect(totals).toMatchObject({ writes: 4, rejectedWrites: 1, lostWrites: 1, reads: 1, staleReads: 0 })
      expect(ticks[9].nodes).toEqual([
        { role: 'down', behind: 0, staleReads: 0 },
        { role: 'primary', behind: 0, staleReads: 0 },
      ])
    })
  })

  it('totals any first ticks as a shorter run of the same requests would', () => {
    const input = { ...base, ticks: 40, lag: 400, topology: 'primary-primary' as const, killPrimaryAt: 2000, requests: workload }
    const whole = simulateReplication(input)
    const shorter = simulateReplication({ ...input, ticks: 15 })

    expect(totalsOf(whole.ticks.slice(0, 15))).toEqual(shorter.totals)
  })

})
