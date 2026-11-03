// An M/M/c queue, for the Traffic Simulation's realistic mode: requests arrive at random (Poisson) and each
// of `c` servers takes an exponentially distributed time to serve one, `serviceMs` on average.

export interface Queue {
  servers: number
  /** ρ: the share of the time each server is busy, below 1. */
  utilisation: number
  /** The mean time a server takes to serve a request. */
  serviceMs: number
  /** Erlang C: the chance that a request finds every server busy and waits. */
  waitProbability: number
  /** The mean time a request that waits does: serviceMs / (c × (1 − ρ)). */
  meanWaitWhenWaitingMs: number
  /** The mean time a request waits before a server takes it, the requests that do not wait included. */
  meanWaitMs: number
}

/** The M/M/c queue of `servers` servers at utilisation ρ < 1. */
export function mmcQueue(servers: number, utilisation: number, serviceMs: number): Queue {
  const waitProbability = erlangC(servers, utilisation)
  const meanWaitWhenWaitingMs = serviceMs / (servers * (1 - utilisation))
  return { servers, utilisation, serviceMs, waitProbability, meanWaitWhenWaitingMs, meanWaitMs: waitProbability * meanWaitWhenWaitingMs }
}

/** The mean time a request spends in the queue: waiting, then served. */
export function meanSojournMs(queue: Queue): number {
  return queue.meanWaitMs + queue.serviceMs
}

/**
 * The utilisation at which a request spends `factor` times the service time in an M/M/c queue of `servers`
 * servers on average: 1 − 1/factor for one server, closer to 1 the more servers share the queue.
 */
export function utilisationAtMeanFactor(servers: number, factor: number): number {
  const key = `${servers}:${factor}`
  const known = utilisationsAtMeanFactor.get(key)
  if (known !== undefined) return known
  const meanFactor = (utilisation: number) => meanSojournMs(mmcQueue(servers, utilisation, 1))
  // The mean grows with the utilisation, so halving the interval finds it.
  let [low, high] = [0, 1]
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2
    if (meanFactor(middle) < factor) low = middle
    else high = middle
  }
  utilisationsAtMeanFactor.set(key, low)
  return low
}

/** Servers and factor → `utilisationAtMeanFactor`, found once. */
const utilisationsAtMeanFactor = new Map<string, number>()

/**
 * One request's time in the queue, drawn with `random`: a request finding every server busy waits an
 * exponential time, `meanWaitWhenWaitingMs` on average; then it is served for an exponential time.
 */
export function sampleSojourn(queue: Queue, random: () => number): { waitMs: number; latencyMs: number } {
  const waitMs = random() < queue.waitProbability ? exponential(queue.meanWaitWhenWaitingMs, random) : 0
  return { waitMs, latencyMs: waitMs + exponential(queue.serviceMs, random) }
}

/** An exponentially distributed time with the given mean. */
function exponential(mean: number, random: () => number): number {
  return -mean * Math.log(1 - random())
}

/** Erlang C, from the Erlang B recursion, which stays finite however many servers there are. */
function erlangC(servers: number, utilisation: number): number {
  const offered = servers * utilisation
  let blocking = 1
  for (let k = 1; k <= servers; k++) blocking = (offered * blocking) / (k + offered * blocking)
  return blocking / (1 - utilisation * (1 - blocking))
}
