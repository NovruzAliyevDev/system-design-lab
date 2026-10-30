import { describe, expect, it } from 'vitest'
import type { LatencyNumber } from '../content/appendix'
import { compareLatencies } from './latency'

// Rows of the primer's "Latency numbers every programmer should know".
const l1: LatencyNumber = { operation: 'L1 cache reference', nanoseconds: 0.5 }
const l2: LatencyNumber = { operation: 'L2 cache reference', nanoseconds: 7, note: '14x L1 cache' }
const memory: LatencyNumber = { operation: 'Main memory reference', nanoseconds: 100, note: '20x L2 cache, 200x L1 cache' }
const mutex: LatencyNumber = { operation: 'Mutex lock/unlock', nanoseconds: 25 }
const seek: LatencyNumber = { operation: 'HDD seek', nanoseconds: 10_000_000, note: '20x datacenter roundtrip' }
const datacenter: LatencyNumber = { operation: 'Round trip within same datacenter', nanoseconds: 500_000 }
const crossContinent: LatencyNumber = { operation: 'Send packet CA->Netherlands->CA', nanoseconds: 150_000_000 }

describe('compareLatencies', () => {
  it('fits 15 disk seeks in one cross-continent round trip', () => {
    expect(compareLatencies(crossContinent, seek)).toEqual({ faster: seek, slower: crossContinent, ratio: 15 })
  })

  it("agrees with the primer's own comparisons in the table", () => {
    expect(compareLatencies(l1, l2).ratio).toBe(14)
    expect(compareLatencies(l2, memory).ratio).toBeCloseTo(14.29, 2)
    expect(compareLatencies(l1, memory).ratio).toBe(200)
    expect(compareLatencies(datacenter, seek).ratio).toBe(20)
  })

  it('gives the same answer whichever operation comes first', () => {
    expect(compareLatencies(mutex, l2)).toEqual(compareLatencies(l2, mutex))
    expect(compareLatencies(mutex, l2)).toMatchObject({ faster: l2, slower: mutex })
    expect(compareLatencies(mutex, l2).ratio).toBeCloseTo(3.571, 3)
  })

  it('compares an operation with itself as 1 to 1', () => {
    expect(compareLatencies(seek, seek)).toEqual({ faster: seek, slower: seek, ratio: 1 })
  })
})
