import type { ClientRequest } from './requests'

// The CAP Concept Simulation: a cluster of five nodes keeps a few keys, and clients on either side of the
// network read and write them. While the network is whole, every accepted write reaches every node at
// once. A partition cuts it into a side of three nodes (the majority) and a side of two (the minority), and
// the mode decides what each side does with the requests it can no longer share.

/**
 * - `cp`: consistency over availability. A request needs a majority of the nodes, so the minority side
 *   rejects every read and write (the primer's timeout) while the majority side carries on.
 * - `ap`: availability over consistency. Both sides keep answering from what they have, so a read can miss
 *   a write made on the other side; when the partition heals, the last write of each key wins.
 */
export type CapMode = 'cp' | 'ap'

export const CAP_MODES: readonly CapMode[] = ['cp', 'ap']

export type Side = 'majority' | 'minority'

/** Nodes on each side of the partition. */
export const SIDE_NODES: Record<Side, number> = { majority: 3, minority: 2 }

/** When the network is cut, in milliseconds; without an end it stays cut to the end of the run. */
export interface Partition {
  start: number
  end?: number
}

export interface CapInput {
  mode: CapMode
  /** In time order; a request's `route` picks its client's side, in proportion to the side's nodes. */
  requests: readonly ClientRequest[]
  partition?: Partition
  /** The keys are 0 to `keyCount` − 1. */
  keyCount: number
  tickMs: number
  ticks: number
}

/** `stale`: a read answered, but with an older version than the newest write of the key on either side. */
export type RequestOutcome = 'ok' | 'rejected' | 'stale'

/** A request and what became of it. Versions count writes from 1; a key never written is at version 0. */
export interface CapLogEntry {
  time: number
  side: Side
  kind: 'read' | 'write'
  key: number
  outcome: RequestOutcome
  /** The version a write made, or the one a read returned; none for a rejected request. */
  version?: number
  /** For a stale read, the newest version, which it missed. */
  latest?: number
}

/** What happened during a tick. */
export interface CapTick {
  /** Every read and write request, rejected ones included. */
  reads: number
  writes: number
  rejectedReads: number
  rejectedWrites: number
  staleReads: number
  /** Keys written on both sides during the partition, reconciled when it healed. */
  conflicts: number
  /** Keys at a different version on the two sides at the end of the tick. */
  divergentKeys: number
  /** The version of each key on each side at the end of the tick. */
  versions: Record<Side, number[]>
}

/** A run of ticks as one: the most divergent keys at the end of any tick, the rest summed. */
export type CapTotals = Omit<CapTick, 'divergentKeys' | 'versions'> & { mostDivergentKeys: number }

export interface CapResult {
  ticks: CapTick[]
  totals: CapTotals
  log: CapLogEntry[]
}

const SIDES: readonly Side[] = ['majority', 'minority']

export function simulateCap(input: CapInput): CapResult {
  const { mode, requests, partition, keyCount, tickMs } = input
  /** The version of each key on each side. */
  const versions: Record<Side, Map<number, number>> = { majority: new Map(), minority: new Map() }
  /** The keys each side wrote while cut off. */
  const writtenApart: Record<Side, Set<number>> = { majority: new Set(), minority: new Set() }
  const majorityShare = SIDE_NODES.majority / (SIDE_NODES.majority + SIDE_NODES.minority)
  const ticks: CapTick[] = []
  const log: CapLogEntry[] = []
  let writeCount = 0
  let healed = false
  let tick = emptyTick()

  const versionOf = (side: Side, key: number) => versions[side].get(key) ?? 0
  const apartAt = (time: number) => partition !== undefined && partition.start <= time && (partition.end === undefined || time < partition.end)

  /** Heals the partition once its end has come: the minority catches up (CP) or the last writer wins (AP). */
  const healBy = (time: number, inclusive: boolean) => {
    const end = partition?.end
    if (healed || end === undefined || (inclusive ? end > time : end >= time)) return
    healed = true
    tick.conflicts += [...writtenApart.majority].filter((key) => writtenApart.minority.has(key)).length
    for (const key of new Set([...versions.majority.keys(), ...versions.minority.keys()])) {
      const winner = Math.max(versionOf('majority', key), versionOf('minority', key))
      for (const side of SIDES) versions[side].set(key, winner)
    }
  }

  let next = 0
  for (let index = 0; index < input.ticks; index++) {
    const tickEnd = (index + 1) * tickMs
    for (; next < requests.length && requests[next].time < tickEnd; next++) {
      const { time, kind, key, route } = requests[next]
      healBy(time, true)
      const side: Side = route < majorityShare ? 'majority' : 'minority'
      const apart = apartAt(time)
      const entry: CapLogEntry = { time, side, kind, key, outcome: 'ok' }
      if (kind === 'read') tick.reads++
      else tick.writes++

      if (apart && mode === 'cp' && side === 'minority') {
        entry.outcome = 'rejected'
        if (kind === 'read') tick.rejectedReads++
        else tick.rejectedWrites++
      } else if (kind === 'write') {
        entry.version = ++writeCount
        // A write reaches the nodes the client's side can reach: all of them while the network is whole.
        for (const reached of apart ? [side] : SIDES) versions[reached].set(key, entry.version)
        if (apart) writtenApart[side].add(key)
      } else {
        entry.version = versionOf(side, key)
        const latest = Math.max(versionOf('majority', key), versionOf('minority', key))
        if (entry.version !== latest) {
          entry.outcome = 'stale'
          entry.latest = latest
          tick.staleReads++
        }
      }
      log.push(entry)
    }
    healBy(tickEnd, false)
    const keys = Array.from({ length: keyCount }, (_, key) => key)
    const sideVersions = (side: Side) => keys.map((key) => versionOf(side, key))
    tick.divergentKeys = keys.filter((key) => versionOf('majority', key) !== versionOf('minority', key)).length
    ticks.push({ ...tick, versions: { majority: sideVersions('majority'), minority: sideVersions('minority') } })
    tick = emptyTick()
  }

  return { ticks, totals: totalsOf(ticks), log }
}

/** The ticks taken together, e.g. those played so far. */
export function totalsOf(ticks: readonly CapTick[]): CapTotals {
  const sum = (field: keyof CapTotals & keyof CapTick) => ticks.reduce((total, tick) => total + tick[field], 0)
  return {
    reads: sum('reads'),
    writes: sum('writes'),
    rejectedReads: sum('rejectedReads'),
    rejectedWrites: sum('rejectedWrites'),
    staleReads: sum('staleReads'),
    conflicts: sum('conflicts'),
    mostDivergentKeys: Math.max(0, ...ticks.map((tick) => tick.divergentKeys)),
  }
}

function emptyTick(): Omit<CapTick, 'versions'> {
  return { reads: 0, writes: 0, rejectedReads: 0, rejectedWrites: 0, staleReads: 0, conflicts: 0, divergentKeys: 0 }
}
