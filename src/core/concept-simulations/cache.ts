import { mulberry32 } from '../random'

// The cache Concept Simulation: a stream of reads and writes reaches a cache in front of a database. The
// strategy decides how writes reach the database and how the cache learns of them; the eviction policy
// decides which entry makes room when the cache is full. Time is counted in operations: the i-th operation
// happens at time i.

/**
 * - `cache-aside`: the app reads the cache and, on a miss, loads the entry from the database into it. Writes
 *   go to the database only, so a cached copy stays stale until it expires (its TTL) or is evicted.
 * - `write-through`: every write updates the cache and the database together, so the cache is never stale.
 * - `write-behind`: writes update the cache only and reach the database in a batch every `flushInterval`
 *   operations; until then they would be lost if the cache failed.
 * - `refresh-ahead`: like cache-aside, but an entry read when it is close to expiring is reloaded from the
 *   database, so hot entries never expire.
 */
export type CacheStrategy = 'cache-aside' | 'write-through' | 'write-behind' | 'refresh-ahead'

export const CACHE_STRATEGIES: readonly CacheStrategy[] = ['cache-aside', 'write-through', 'write-behind', 'refresh-ahead']

/** Which entry a full cache evicts: least recently used, least frequently used, or the first one in. */
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo'

export const EVICTION_POLICIES: readonly EvictionPolicy[] = ['lru', 'lfu', 'fifo']

/** Whether a strategy's entries expire after the TTL; the others are kept fresh by their writes. */
export function usesTtl(strategy: CacheStrategy): boolean {
  return strategy === 'cache-aside' || strategy === 'refresh-ahead'
}

/** Refresh-ahead reloads an entry read once this share of its TTL has passed. */
export const REFRESH_AHEAD_AT = 0.75

export interface CacheOperation {
  kind: 'read' | 'write'
  key: number
}

/**
 * - `uniform`: every key is equally likely.
 * - `skewed`: a few hot keys get most operations (Zipf's law: key k is 1/(k+1) as likely as key 0).
 */
export type WorkloadDistribution = 'uniform' | 'skewed'

export interface WorkloadInput {
  distribution: WorkloadDistribution
  keyCount: number
  /** The share of operations that are writes, from 0 to 1. */
  writeShare: number
  length: number
  seed: number
}

/** A seeded stream of operations on keys 0 to `keyCount` − 1. */
export function generateWorkload(input: WorkloadInput): CacheOperation[] {
  const { distribution, keyCount, writeShare, length } = input
  const random = mulberry32(input.seed)
  const weights = Array.from({ length: keyCount }, (_, key) => (distribution === 'skewed' ? 1 / (key + 1) : 1))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let running = 0
  /** The share of operations on keys up to each key. */
  const cumulative = weights.map((weight) => (running += weight / total))

  return Array.from({ length }, () => {
    const kind = random() < writeShare ? 'write' : 'read'
    const draw = random()
    const key = cumulative.findIndex((share) => draw < share)
    return { kind, key: key === -1 ? keyCount - 1 : key }
  })
}

export interface CacheInput {
  strategy: CacheStrategy
  eviction: EvictionPolicy
  /** How many entries the cache holds. */
  capacity: number
  /** Operations an entry lives for under cache-aside and refresh-ahead. */
  ttl: number
  /** Write-behind writes the changed entries to the database after every `flushInterval` operations. */
  flushInterval: number
  operations: readonly CacheOperation[]
  /** Operations a tick of the timeline groups. */
  operationsPerTick: number
}

/** What happened during a tick. */
export interface CacheTick {
  reads: number
  writes: number
  hits: number
  misses: number
  /** Reads served from a cached copy older than the database's. */
  staleReads: number
  /** The longest a stale read's copy had been out of date, in operations: how long a stale-read window lasted. */
  longestStaleWindow: number
  /** Entries refresh-ahead reloaded before they expired; each is also a database read. */
  refreshes: number
  /** Misses and refreshes. */
  dbReads: number
  dbWrites: number
  /** Writes still only in the cache at the end of the tick (write-behind): lost if the cache failed then. */
  unflushedWrites: number
  /** The most writes only in the cache at once during the tick. */
  mostUnflushedWrites: number
}

/** A run of ticks as one: the longest stale window and the most unflushed writes of any tick, the rest summed. */
export type CacheTotals = Omit<CacheTick, 'unflushedWrites'>

export interface CacheResult {
  ticks: CacheTick[]
  totals: CacheTotals
}

interface Entry {
  insertedAt: number
  lastUsed: number
  uses: number
  /** When the entry was last loaded from the database; its TTL counts from here. */
  loadedAt: number
  /** When the database got a write the entry does not have. */
  staleSince?: number
}

export function simulateCache(input: CacheInput): CacheResult {
  const { strategy, eviction, ttl, flushInterval, operations, operationsPerTick } = input
  const capacity = Math.max(1, input.capacity)
  const entries = new Map<number, Entry>()
  /** Write-behind: writes per key that are only in the cache. */
  const unflushed = new Map<number, number>()
  const ticks: CacheTick[] = []
  let tick = emptyTick()

  const expired = (entry: Entry, time: number) => usesTtl(strategy) && time - entry.loadedAt >= ttl
  const unflushedCount = () => [...unflushed.values()].reduce((sum, count) => sum + count, 0)
  const writeToDatabase = (count: number) => {
    tick.dbWrites += count
  }

  /** Makes room for one more entry: an expired one goes first, otherwise the policy's choice. */
  const evict = (time: number) => {
    let victim: number | undefined
    let victimEntry: Entry | undefined
    for (const [key, entry] of entries) {
      if (expired(entry, time)) {
        victim = key
        break
      }
      if (!victimEntry || evictsBefore(eviction, entry, victimEntry)) {
        victim = key
        victimEntry = entry
      }
    }
    if (victim === undefined) return
    // A changed entry reaches the database before it leaves the cache, so write-behind never loses it here.
    if (unflushed.delete(victim)) writeToDatabase(1)
    entries.delete(victim)
  }

  const insert = (key: number, time: number) => {
    if (entries.size >= capacity) evict(time)
    const entry = { insertedAt: time, lastUsed: time, uses: 1, loadedAt: time }
    entries.set(key, entry)
    return entry
  }

  operations.forEach(({ kind, key }, time) => {
    let entry = entries.get(key)
    if (entry && expired(entry, time)) {
      entries.delete(key)
      entry = undefined
    }

    if (kind === 'read') {
      tick.reads++
      if (!entry) {
        tick.misses++
        tick.dbReads++
        insert(key, time)
      } else {
        // A stale read is a hit too: the cache answered, only with an outdated copy.
        tick.hits++
        entry.lastUsed = time
        entry.uses++
        if (entry.staleSince !== undefined) {
          tick.staleReads++
          tick.longestStaleWindow = Math.max(tick.longestStaleWindow, time - entry.staleSince)
        }
        if (strategy === 'refresh-ahead' && time - entry.loadedAt >= REFRESH_AHEAD_AT * ttl) {
          tick.dbReads++
          tick.refreshes++
          entry.loadedAt = time
          entry.staleSince = undefined
        }
      }
    } else {
      tick.writes++
      // The strategies whose entries expire leave the cache alone on a write; the others write through it.
      if (usesTtl(strategy)) {
        writeToDatabase(1)
        if (entry) entry.staleSince ??= time
      } else {
        if (strategy === 'write-through') writeToDatabase(1)
        else unflushed.set(key, (unflushed.get(key) ?? 0) + 1)
        const written = entry ?? insert(key, time)
        written.lastUsed = time
        if (entry) written.uses++
      }
    }

    if (strategy === 'write-behind' && (time + 1) % flushInterval === 0) {
      // Each changed key is written once, however many writes it had since the last flush.
      writeToDatabase(unflushed.size)
      unflushed.clear()
    }
    tick.mostUnflushedWrites = Math.max(tick.mostUnflushedWrites, unflushedCount())
    if ((time + 1) % operationsPerTick === 0 || time === operations.length - 1) {
      ticks.push({ ...tick, unflushedWrites: unflushedCount() })
      tick = emptyTick()
    }
  })

  return { ticks, totals: totalsOf(ticks) }
}

/** The ticks taken together, e.g. those played so far. */
export function totalsOf(ticks: readonly CacheTick[]): CacheTotals {
  const sum = (field: keyof CacheTotals) => ticks.reduce((total, tick) => total + tick[field], 0)
  const most = (field: keyof CacheTotals) => Math.max(0, ...ticks.map((tick) => tick[field]))
  return {
    reads: sum('reads'),
    writes: sum('writes'),
    hits: sum('hits'),
    misses: sum('misses'),
    staleReads: sum('staleReads'),
    longestStaleWindow: most('longestStaleWindow'),
    refreshes: sum('refreshes'),
    dbReads: sum('dbReads'),
    dbWrites: sum('dbWrites'),
    mostUnflushedWrites: most('mostUnflushedWrites'),
  }
}

/** Whether `entry` should be evicted before `other` under the policy; LFU breaks ties by recency. */
function evictsBefore(policy: EvictionPolicy, entry: Entry, other: Entry): boolean {
  if (policy === 'fifo') return entry.insertedAt < other.insertedAt
  if (policy === 'lfu' && entry.uses !== other.uses) return entry.uses < other.uses
  return entry.lastUsed < other.lastUsed
}

function emptyTick(): CacheTick {
  return { reads: 0, writes: 0, hits: 0, misses: 0, staleReads: 0, longestStaleWindow: 0, refreshes: 0, dbReads: 0, dbWrites: 0, unflushedWrites: 0, mostUnflushedWrites: 0 }
}
