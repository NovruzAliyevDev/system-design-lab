import type { LatencyNumber } from '../content/appendix'

/** Two operations of the latency numbers table, side by side. */
export interface LatencyComparison {
  faster: LatencyNumber
  slower: LatencyNumber
  /** How many of the faster operation fit in one of the slower: the slower's latency ÷ the faster's. */
  ratio: number
}

/** Compares two operations in either order, e.g. 15 HDD seeks fit in one cross-continent round trip. */
export function compareLatencies(a: LatencyNumber, b: LatencyNumber): LatencyComparison {
  const [faster, slower] = a.nanoseconds <= b.nanoseconds ? [a, b] : [b, a]
  return { faster, slower, ratio: slower.nanoseconds / faster.nanoseconds }
}
