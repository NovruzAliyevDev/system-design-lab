import { mulberry32 } from '../random'

// Client requests for the replication and CAP Concept Simulations: reads and writes of a few keys,
// arriving at random times. Time is in milliseconds from the start of the run.

export interface ClientRequest {
  time: number
  kind: 'read' | 'write'
  key: number
  /**
   * A draw in [0, 1) that picks where the request goes among the nodes that can take it, e.g. which
   * replica serves a read or which side of a partition the client is on. Drawn here so that the
   * simulations stay deterministic.
   */
  route: number
}

export interface RequestsInput {
  /** Requests per second, on average. */
  rate: number
  /** The share of requests that are writes, from 0 to 1. */
  writeShare: number
  keyCount: number
  /** How long the requests keep coming, in milliseconds. */
  duration: number
  seed: number
}

/** A seeded Poisson stream of requests, in time order, on keys 0 to `keyCount` − 1 equally. */
export function generateRequests(input: RequestsInput): ClientRequest[] {
  const { rate, writeShare, keyCount, duration } = input
  const random = mulberry32(input.seed)
  const requests: ClientRequest[] = []
  // Exponential gaps between arrivals make a Poisson stream.
  for (let time = gap(random(), rate); time < duration; time += gap(random(), rate)) {
    requests.push({
      time: Math.floor(time),
      kind: random() < writeShare ? 'write' : 'read',
      key: Math.floor(random() * keyCount),
      route: random(),
    })
  }
  return requests
}

/** Milliseconds to the next arrival, for a uniform draw in [0, 1). */
function gap(draw: number, rate: number): number {
  return (-Math.log(1 - draw) / rate) * 1000
}
