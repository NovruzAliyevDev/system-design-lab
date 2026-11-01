import { mulberry32 } from '../random'
import { hash32 } from './hash'

// The consistent hashing Concept Simulation: keys and nodes hashed onto a ring of 2^32 positions, each
// key stored on the first node clockwise from it, compared with naive modulo hashing (hash mod n).

/** One of a node's points on the ring; a node has one per virtual node. */
export interface RingPoint {
  position: number
  nodeId: string
}

/** Positions on the ring run from 0 to 2^32 − 1, then wrap. */
export const RING_SIZE = 2 ** 32

/** The points of the nodes, `virtualNodes` per node, in clockwise order. */
function buildHashRing(nodeIds: readonly string[], virtualNodes: number): RingPoint[] {
  return nodeIds
    .flatMap((nodeId) => Array.from({ length: virtualNodes }, (_, replica) => ({ position: hash32(`${nodeId}#${replica}`), nodeId })))
    .sort((a, b) => a.position - b.position || a.nodeId.localeCompare(b.nodeId))
}

/** Where a key sits on the ring. */
function keyPosition(key: string): number {
  return hash32(key)
}

/** The node storing the key: the first point at or clockwise after it, wrapping past the top. */
function ringOwner(ring: readonly RingPoint[], key: string): string | undefined {
  if (ring.length === 0) return undefined
  const position = keyPosition(key)
  // Binary search for the first point at or after the key.
  let low = 0
  let high = ring.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (ring[middle].position < position) low = middle + 1
    else high = middle
  }
  return ring[low % ring.length].nodeId
}

/** The node naive hashing stores the key on: hash mod the number of nodes. */
function moduloOwner(nodeIds: readonly string[], key: string): string | undefined {
  return nodeIds.length === 0 ? undefined : nodeIds[keyPosition(key) % nodeIds.length]
}

/** `count` distinct keys chosen by `seed`, e.g. `user:3f9a1c`. */
export function generateKeys(count: number, seed: number): string[] {
  const random = mulberry32(seed)
  const keys = new Set<string>()
  while (keys.size < count) keys.add(`user:${Math.floor(random() * RING_SIZE).toString(16).padStart(8, '0')}`)
  return [...keys]
}

/** A key's node before and after a change of nodes, and whether the change moved it to another node. */
export interface Placement {
  before?: string
  after?: string
  moved: boolean
}

/** Where a key is stored before and after a change of nodes, on the ring and under modulo hashing. */
export interface KeyPlacement {
  key: string
  /** Where the key sits on the ring. */
  position: number
  ring: Placement
  modulo: Placement
}

export interface Rebalance {
  /** The ring after the change. */
  ring: RingPoint[]
  keys: KeyPlacement[]
  /** How many keys each node holds on the ring after the change, every node listed. */
  keysPerNode: Record<string, number>
  /** Keys whose node the change moved them off, on the ring. */
  ringMoved: number
  /** Keys whose node the change moved them off, under modulo hashing. */
  moduloMoved: number
  /**
   * The share of the keys an ideal scheme moves: those of the nodes that came or went, each node holding
   * an equal share of the keys while it is there.
   */
  idealShare: number
}

/** Where the keys go when the nodes change from `before` to `after` (nodes added, removed or both). */
export function rebalance(input: { keys: readonly string[]; before: readonly string[]; after: readonly string[]; virtualNodes: number }): Rebalance {
  const { keys, before, after, virtualNodes } = input
  const ringBefore = buildHashRing(before, virtualNodes)
  const ringAfter = buildHashRing(after, virtualNodes)
  const placement = (nodeBefore: string | undefined, nodeAfter: string | undefined): Placement => ({
    before: nodeBefore,
    after: nodeAfter,
    moved: nodeBefore !== nodeAfter,
  })
  const placements = keys.map((key) => ({
    key,
    position: keyPosition(key),
    ring: placement(ringOwner(ringBefore, key), ringOwner(ringAfter, key)),
    modulo: placement(moduloOwner(before, key), moduloOwner(after, key)),
  }))
  const added = after.filter((nodeId) => !before.includes(nodeId)).length
  const removed = before.filter((nodeId) => !after.includes(nodeId)).length
  const keysPerNode = Object.fromEntries(after.map((nodeId) => [nodeId, 0]))
  for (const { ring } of placements) if (ring.after !== undefined) keysPerNode[ring.after]++
  return {
    ring: ringAfter,
    keys: placements,
    keysPerNode,
    ringMoved: placements.filter(({ ring }) => ring.moved).length,
    moduloMoved: placements.filter(({ modulo }) => modulo.moved).length,
    idealShare: Math.min(1, removed / Math.max(1, before.length) + added / Math.max(1, after.length)),
  }
}
