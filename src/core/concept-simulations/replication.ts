import type { ClientRequest } from './requests'

// The replication Concept Simulation: clients read and write keys on a small cluster, and each node sends
// the writes it accepts to the others, which apply them `lag` milliseconds later (asynchronous
// replication). A read from a node that has not yet applied the newest write of its key is stale. Killing
// the primary drops the writes still on their way from it, and clients reach the cluster again only once
// the failure is detected `failoverDelay` milliseconds later.

/**
 * - `primary-replica`: one primary takes every write and replicates it to the replicas, which serve the
 *   reads (the primer's master-slave). When the primary dies, writes are rejected until a replica is
 *   promoted; the replicas keep serving reads meanwhile.
 * - `primary-primary`: two primaries both take reads and writes and replicate to each other (the primer's
 *   master-master). Writes of one key on both within the lag window conflict; the last writer wins.
 */
export type ReplicationTopology = 'primary-replica' | 'primary-primary'

export const REPLICATION_TOPOLOGIES: readonly ReplicationTopology[] = ['primary-replica', 'primary-primary']

export interface ReplicationInput {
  topology: ReplicationTopology
  /** How many replicas follow the primary under primary-replica, at least one; primary-primary has none. */
  replicas: number
  /** Milliseconds from a write being accepted to the other nodes applying it. */
  lag: number
  /** Milliseconds from the primary dying to clients reaching the cluster again. */
  failoverDelay: number
  /** When the primary (the first one, under primary-primary) dies, if it does. */
  killPrimaryAt?: number
  /** In time order; those after the last tick are left out. */
  requests: readonly ClientRequest[]
  tickMs: number
  ticks: number
}

export type NodeRole = 'primary' | 'replica' | 'down'

/** A node at the end of a tick. */
export interface NodeState {
  role: NodeRole
  /** Writes on their way to the node: what it has not applied yet. */
  behind: number
  /** Stale reads the node served during the tick. */
  staleReads: number
}

/** What happened during a tick. */
export interface ReplicationTick {
  /** Every read and write request, rejected ones included. */
  reads: number
  writes: number
  /** Reads answered with an older copy than the newest write of the key. */
  staleReads: number
  /** The longest a stale read's copy had been out of date, in milliseconds. */
  longestStaleness: number
  /** Requests no node could take: there was no live node to serve the read, or none to take the write. */
  rejectedReads: number
  rejectedWrites: number
  /** Pairs of writes of one key made on different nodes, neither having seen the other. */
  conflicts: number
  /** Accepted writes gone with a dead node before reaching any other. */
  lostWrites: number
  /** The nodes, the primary first. */
  nodes: NodeState[]
}

/** A run of ticks as one: the longest staleness of any tick, the rest summed. */
export type ReplicationTotals = Omit<ReplicationTick, 'nodes'>

export interface Failover {
  killedAt: number
  /** When clients reach the cluster again: the promotion under primary-replica. */
  recoveredAt: number
  /** The node that takes the writes from then on: the promoted replica, or the other primary. */
  takenOverBy: number
}

export interface ReplicationResult {
  ticks: ReplicationTick[]
  totals: ReplicationTotals
  /** Set when the primary dies during the run. */
  failover?: Failover
}

/** No write: a key's value before it is first written. */
const NONE = 0

interface Write {
  /** Counted from 1 in time order, so a higher id is a later write; the last writer wins by it. */
  id: number
  key: number
  time: number
  origin: number
  /** The write of the key its node had when it accepted this one. */
  basedOn: number
  lost: boolean
}

interface Node {
  alive: boolean
  primary: boolean
  /** The id of the write each key has here. */
  values: Map<number, number>
  /** Every write applied here. */
  seen: Set<number>
}

interface Delivery {
  write: Write
  to: number
  at: number
}

export function simulateReplication(input: ReplicationInput): ReplicationResult {
  const { topology, lag, failoverDelay, requests, tickMs } = input
  const end = input.ticks * tickMs
  const nodeCount = topology === 'primary-replica' ? 1 + Math.max(1, input.replicas) : 2
  const nodes: Node[] = Array.from({ length: nodeCount }, (_, i) => ({
    alive: true,
    primary: i === 0 || topology === 'primary-primary',
    values: new Map(),
    seen: new Set(),
  }))
  const writesByKey = new Map<number, Write[]>()
  const writes: Write[] = []
  /** In arrival order: the lag is the same for every write, and writes are made in time order. */
  let deliveries: Delivery[] = []
  /** `<id> <id>` of each pair of conflicting writes, counted once although both nodes see it. */
  const conflicting = new Set<string>()
  const ticks: ReplicationTick[] = []
  let tick = emptyTick()
  let staleByNode = nodes.map(() => 0)

  const killAt = input.killPrimaryAt !== undefined && input.killPrimaryAt < end ? input.killPrimaryAt : undefined
  // Every replica applies the writes after the same lag, so they are all as up to date as each other and the
  // first one is promoted; under primary-primary the other primary carries on.
  const failover: Failover | undefined = killAt === undefined ? undefined : { killedAt: killAt, recoveredAt: killAt + failoverDelay, takenOverBy: 1 }
  let pendingKill = killAt
  let pendingRecovery: number | undefined
  let recovered = false

  /** The newest write of the key that still exists somewhere. */
  const newest = (key: number) => writesByKey.get(key)?.findLast((write) => !write.lost)

  const apply = (node: Node, write: Write) => {
    node.seen.add(write.id)
    const current = node.values.get(write.key) ?? NONE
    if (current !== write.basedOn) {
      // The node changed the key since the write's node last heard of it: both were written blind.
      const pair = `${Math.min(current, write.id)} ${Math.max(current, write.id)}`
      if (!conflicting.has(pair)) tick.conflicts++
      conflicting.add(pair)
    }
    if (write.id > current) node.values.set(write.key, write.id)
  }

  const killPrimary = () => {
    const dead = nodes[0]
    dead.alive = false
    deliveries = deliveries.filter((delivery) => delivery.write.origin !== 0 && delivery.to !== 0)
    for (const write of writes) {
      if (write.lost || nodes.some((node) => node.alive && node.seen.has(write.id))) continue
      write.lost = true
      tick.lostWrites++
    }
    pendingRecovery = failover!.recoveredAt
  }

  const recover = () => {
    recovered = true
    nodes[0].primary = false
    nodes[failover!.takenOverBy].primary = true
  }

  /** Processes what happens up to `until`: a kill and a recovery before writes arriving at the same time. */
  const advance = (until: number, inclusive: boolean) => {
    for (;;) {
      const next = Math.min(pendingKill ?? Infinity, pendingRecovery ?? Infinity, deliveries[0]?.at ?? Infinity)
      if (inclusive ? next > until : next >= until) return
      if (next === pendingKill) {
        pendingKill = undefined
        killPrimary()
      } else if (next === pendingRecovery) {
        pendingRecovery = undefined
        recover()
      } else {
        const delivery = deliveries.shift()!
        apply(nodes[delivery.to], delivery.write)
      }
    }
  }

  /** The node a request goes to: a dead one too until its failure is detected. */
  const route = (request: ClientRequest): Node | undefined => {
    const reachable = (node: Node) => node.alive || !recovered
    let candidates = nodes.filter((node) => node.primary && reachable(node))
    if (topology === 'primary-replica' && request.kind === 'read') {
      const replicas = nodes.filter((node) => node.alive && !node.primary)
      if (replicas.length > 0) candidates = replicas
    }
    return candidates[Math.floor(request.route * candidates.length)]
  }

  const write = (request: ClientRequest, node: Node) => {
    const origin = nodes.indexOf(node)
    const accepted: Write = { id: writes.length + 1, key: request.key, time: request.time, origin, basedOn: node.values.get(request.key) ?? NONE, lost: false }
    writes.push(accepted)
    writesByKey.set(request.key, [...(writesByKey.get(request.key) ?? []), accepted])
    apply(node, accepted)
    nodes.forEach((other, to) => {
      if (other !== node && other.alive) deliveries.push({ write: accepted, to, at: request.time + lag })
    })
  }

  const read = (request: ClientRequest, node: Node) => {
    const value = node.values.get(request.key) ?? NONE
    const latest = newest(request.key)
    if (!latest || latest.id === value) return
    tick.staleReads++
    staleByNode[nodes.indexOf(node)]++
    // Out of date since the first write the copy misses.
    const missedSince = writesByKey.get(request.key)!.find((other) => !other.lost && other.id > value)!.time
    tick.longestStaleness = Math.max(tick.longestStaleness, request.time - missedSince)
  }

  let next = 0
  for (let index = 0; index < input.ticks; index++) {
    const tickEnd = (index + 1) * tickMs
    for (; next < requests.length && requests[next].time < tickEnd; next++) {
      const request = requests[next]
      advance(request.time, true)
      const node = route(request)
      if (request.kind === 'read') tick.reads++
      else tick.writes++
      if (!node?.alive) {
        if (request.kind === 'read') tick.rejectedReads++
        else tick.rejectedWrites++
      } else if (request.kind === 'read') read(request, node)
      else write(request, node)
    }
    advance(tickEnd, false)
    ticks.push({
      ...tick,
      nodes: nodes.map((node, i) => ({
        role: !node.alive ? 'down' : node.primary ? 'primary' : 'replica',
        behind: deliveries.filter((delivery) => delivery.to === i).length,
        staleReads: staleByNode[i],
      })),
    })
    tick = emptyTick()
    staleByNode = nodes.map(() => 0)
  }

  return { ticks, totals: totalsOf(ticks), ...(failover && { failover }) }
}

/** The ticks taken together, e.g. those played so far. */
export function totalsOf(ticks: readonly ReplicationTick[]): ReplicationTotals {
  const sum = (field: keyof ReplicationTotals) => ticks.reduce((total, tick) => total + tick[field], 0)
  return {
    reads: sum('reads'),
    writes: sum('writes'),
    staleReads: sum('staleReads'),
    longestStaleness: Math.max(0, ...ticks.map((tick) => tick.longestStaleness)),
    rejectedReads: sum('rejectedReads'),
    rejectedWrites: sum('rejectedWrites'),
    conflicts: sum('conflicts'),
    lostWrites: sum('lostWrites'),
  }
}

function emptyTick(): ReplicationTotals {
  return { reads: 0, writes: 0, staleReads: 0, longestStaleness: 0, rejectedReads: 0, rejectedWrites: 0, conflicts: 0, lostWrites: 0 }
}
