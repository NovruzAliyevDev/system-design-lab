import { mulberry32 } from '../random'
import { hash32 } from './hash'

// The load balancer Concept Simulation: requests arrive through each tick, the load balancer gives each
// one to a server by its algorithm, and each server works through its queue at its own speed. A tick is
// split into steps so that requests arrive while servers are busy, as they would.

/**
 * - `round-robin`: each server in turn.
 * - `least-connections`: the server with the fewest requests waiting or being served.
 * - `hashing`: the server the client's id hashes to, so a client always reaches the same server.
 */
export type BalancingAlgorithm = 'round-robin' | 'least-connections' | 'hashing'

export const BALANCING_ALGORITHMS: readonly BalancingAlgorithm[] = ['round-robin', 'least-connections', 'hashing']

export interface LoadBalancerInput {
  algorithm: BalancingAlgorithm
  /** Requests each server finishes per tick, one entry per server. */
  serverSpeeds: readonly number[]
  /** Requests arriving per tick, on average. */
  arrivalRate: number
  /** How many distinct clients send the requests, each request from one of them at random. */
  clientCount: number
  ticks: number
  seed: number
}

/** The state of the servers at the end of a tick. */
export interface LoadBalancerTick {
  /** Requests waiting or being served, per server. */
  queueLengths: number[]
  /** Requests given to each server so far. */
  assigned: number[]
}

export interface ServerSummary {
  assigned: number
  completed: number
  maxQueue: number
  /** The queue length at the end of each tick, averaged over the ticks. */
  meanQueue: number
}

export interface LoadBalancerResult {
  ticks: LoadBalancerTick[]
  servers: ServerSummary[]
}

/** Steps a tick is split into. */
const STEPS_PER_TICK = 10

export function simulateLoadBalancer(input: LoadBalancerInput): LoadBalancerResult {
  const { algorithm, serverSpeeds, arrivalRate, clientCount, ticks } = input
  const random = mulberry32(input.seed)
  const serverCount = serverSpeeds.length
  const queues = new Array<number>(serverCount).fill(0)
  /** Work left on the request each server is serving, in requests. */
  const remaining = new Array<number>(serverCount).fill(0)
  const assigned = new Array<number>(serverCount).fill(0)
  const completed = new Array<number>(serverCount).fill(0)
  const maxQueue = new Array<number>(serverCount).fill(0)
  const queueTotal = new Array<number>(serverCount).fill(0)
  /** The server round robin picks next; least connections also starts looking there, so ties rotate. */
  let next = 0
  const timeline: LoadBalancerTick[] = []

  const pick = (client: number): number => {
    if (algorithm === 'round-robin') return next
    if (algorithm === 'hashing') return hash32(`client-${client}`) % serverCount
    let best = next
    for (let offset = 1; offset < serverCount; offset++) {
      const server = (next + offset) % serverCount
      if (queues[server] < queues[best]) best = server
    }
    return best
  }

  for (let tick = 0; tick < ticks; tick++) {
    const arrivals = Array.from({ length: poisson(arrivalRate, random) }, () => ({
      step: Math.floor(random() * STEPS_PER_TICK),
      client: Math.floor(random() * clientCount),
    }))
    for (let step = 0; step < STEPS_PER_TICK; step++) {
      for (const arrival of arrivals) {
        if (arrival.step !== step || serverCount === 0) continue
        const server = pick(arrival.client)
        if (algorithm !== 'hashing') next = (server + 1) % serverCount
        if (queues[server] === 0) remaining[server] = 1
        queues[server]++
        assigned[server]++
      }
      for (let server = 0; server < serverCount; server++) {
        let budget = serverSpeeds[server] / STEPS_PER_TICK
        while (budget > 0 && queues[server] > 0) {
          const work = Math.min(budget, remaining[server])
          budget -= work
          remaining[server] -= work
          if (remaining[server] > EPSILON) continue
          queues[server]--
          completed[server]++
          remaining[server] = queues[server] > 0 ? 1 : 0
        }
      }
    }
    for (let server = 0; server < serverCount; server++) {
      maxQueue[server] = Math.max(maxQueue[server], queues[server])
      queueTotal[server] += queues[server]
    }
    timeline.push({ queueLengths: [...queues], assigned: [...assigned] })
  }

  return {
    ticks: timeline,
    servers: serverSpeeds.map((_, server) => ({
      assigned: assigned[server],
      completed: completed[server],
      maxQueue: maxQueue[server],
      meanQueue: ticks > 0 ? queueTotal[server] / ticks : 0,
    })),
  }
}

/** Work left below this counts as done, so float rounding never leaves a request unfinished. */
const EPSILON = 1e-9

/** A Poisson-distributed count with mean `mean` (Knuth's method; fine for the small means used here). */
function poisson(mean: number, random: () => number): number {
  const limit = Math.exp(-mean)
  let count = 0
  let product = random()
  while (product > limit) {
    count++
    product *= random()
  }
  return count
}
