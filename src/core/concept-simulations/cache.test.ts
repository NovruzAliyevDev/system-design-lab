import { describe, expect, it } from 'vitest'
import { generateWorkload, simulateCache, totalsOf, type CacheInput, type CacheOperation } from './cache'

/** Reads of the keys named by the letters, in order. */
const reads = (keys: string): CacheOperation[] => [...keys].map((key) => ({ kind: 'read', key: key.charCodeAt(0) }))
const write = (key: string): CacheOperation => ({ kind: 'write', key: key.charCodeAt(0) })

const base: Omit<CacheInput, 'operations'> = {
  strategy: 'cache-aside',
  eviction: 'lru',
  capacity: 2,
  ttl: 1000,
  flushInterval: 10,
  operationsPerTick: 5,
}

const skewed = generateWorkload({ distribution: 'skewed', keyCount: 100, writeShare: 0.3, length: 4000, seed: 5 })

describe('cache simulation', () => {
  it('LRU keeps the key just used, where FIFO evicts the oldest entry even though it was just read', () => {
    // A and B fill the cache; A is read again; C evicts one; then A.
    const operations = reads('ABACA')
    const lru = simulateCache({ ...base, eviction: 'lru', operations })
    const fifo = simulateCache({ ...base, eviction: 'fifo', operations })

    // LRU evicts B (least recently used), so the last A hits.
    expect(lru.totals).toMatchObject({ reads: 5, hits: 2, misses: 3 })
    // FIFO evicts A (inserted first), so the last A misses.
    expect(fifo.totals).toMatchObject({ reads: 5, hits: 1, misses: 4 })
  })

  it('LFU keeps the key read most often, where LRU evicts it for being used longest ago', () => {
    const operations = reads('AABCA')
    const lfu = simulateCache({ ...base, eviction: 'lfu', operations })
    const lru = simulateCache({ ...base, eviction: 'lru', operations })

    expect(lfu.totals.hits).toBe(2)
    expect(lru.totals.hits).toBe(1)
  })

  it('counts every miss as a database read', () => {
    const { totals } = simulateCache({ ...base, operations: reads('ABACA') })

    expect(totals.dbReads).toBe(totals.misses)
    expect(totals.dbWrites).toBe(0)
  })

  it('write-through never serves a stale read, where cache-aside does on the same workload', () => {
    const input = { ...base, capacity: 20, ttl: 400, operations: skewed }
    const writeThrough = simulateCache({ ...input, strategy: 'write-through' })
    const cacheAside = simulateCache({ ...input, strategy: 'cache-aside' })

    expect(writeThrough.totals.staleReads).toBe(0)
    expect(writeThrough.totals.dbWrites).toBe(writeThrough.totals.writes)
    expect(cacheAside.totals.staleReads).toBeGreaterThan(0)
    expect(cacheAside.totals.longestStaleWindow).toBeGreaterThan(0)
  })

  it('a shorter TTL shortens the stale-read windows of cache-aside', () => {
    const input = { ...base, capacity: 20, operations: skewed }
    const long = simulateCache({ ...input, ttl: 400 })
    const short = simulateCache({ ...input, ttl: 40 })

    expect(short.totals.longestStaleWindow).toBeLessThan(40)
    expect(short.totals.longestStaleWindow).toBeLessThan(long.totals.longestStaleWindow)
  })

  it('write-behind reports writes not yet flushed, and flushes them in a batch', () => {
    // Three writes, two to A, then reads until the flush after the 10th operation.
    const operations = [write('A'), write('B'), write('A'), ...reads('ABABABA')]
    const { ticks, totals } = simulateCache({ ...base, strategy: 'write-behind', operations })

    // After the first tick (5 operations) the three writes are only in the cache.
    expect(ticks[0]).toMatchObject({ unflushedWrites: 3, dbWrites: 0 })
    // The flush writes each changed key once: the two writes to A are coalesced.
    expect(ticks[1]).toMatchObject({ unflushedWrites: 0, mostUnflushedWrites: 3, dbWrites: 2 })
    expect(totals).toMatchObject({ writes: 3, dbWrites: 2, mostUnflushedWrites: 3, staleReads: 0 })
  })

  it('write-behind writes a changed entry to the database before evicting it', () => {
    const operations = [write('A'), ...reads('BC')]
    const { ticks, totals } = simulateCache({ ...base, strategy: 'write-behind', capacity: 1, operations })

    expect(ticks[0].unflushedWrites).toBe(0)
    expect(totals.dbWrites).toBe(1)
  })

  it('refresh-ahead reloads hot entries before they expire, so they miss less than under cache-aside', () => {
    const readHeavy = generateWorkload({ distribution: 'skewed', keyCount: 100, writeShare: 0, length: 4000, seed: 5 })
    const input = { ...base, capacity: 20, ttl: 60, operations: readHeavy }
    const refreshAhead = simulateCache({ ...input, strategy: 'refresh-ahead' })
    const cacheAside = simulateCache({ ...input, strategy: 'cache-aside' })

    expect(refreshAhead.totals.hits).toBeGreaterThan(cacheAside.totals.hits)
    expect(refreshAhead.totals.refreshes).toBeGreaterThan(0)
    expect(refreshAhead.totals.dbReads).toBe(refreshAhead.totals.misses + refreshAhead.totals.refreshes)
    expect(cacheAside.totals.refreshes).toBe(0)
  })

  it('hits more often when a few hot keys get most reads than when every key is equally likely', () => {
    const workload = (distribution: 'uniform' | 'skewed') =>
      generateWorkload({ distribution, keyCount: 100, writeShare: 0, length: 4000, seed: 5 })
    const input = { ...base, capacity: 20 }
    const hitRatio = (operations: CacheOperation[]) => {
      const { totals } = simulateCache({ ...input, operations })
      return totals.hits / totals.reads
    }

    expect(hitRatio(workload('uniform'))).toBeLessThan(0.3)
    expect(hitRatio(workload('skewed'))).toBeGreaterThan(0.5)
  })

  it('generates the same workload for the same seed, with about the asked share of writes', () => {
    const input = { distribution: 'uniform', keyCount: 50, writeShare: 0.25, length: 2000, seed: 9 } as const
    const workload = generateWorkload(input)
    const writes = workload.filter((operation) => operation.kind === 'write').length

    expect(generateWorkload(input)).toEqual(workload)
    expect(generateWorkload({ ...input, seed: 10 })).not.toEqual(workload)
    expect(writes / workload.length).toBeGreaterThan(0.2)
    expect(writes / workload.length).toBeLessThan(0.3)
    expect(workload.every((operation) => operation.key >= 0 && operation.key < 50)).toBe(true)
  })

  it('records every tick, and totals any run of ticks: counts add up, the longest and most are the largest', () => {
    const input = { ...base, strategy: 'write-behind', capacity: 20, operations: skewed } as const
    const { ticks, totals } = simulateCache(input)
    const firstTen = totalsOf(ticks.slice(0, 10))
    const shortRun = simulateCache({ ...input, operations: skewed.slice(0, 10 * base.operationsPerTick) })

    expect(ticks).toHaveLength(skewed.length / base.operationsPerTick)
    expect(totalsOf(ticks)).toEqual(totals)
    // The first ten ticks of a run are a run of their own: nothing later reaches back into them.
    expect(firstTen).toEqual(shortRun.totals)
    expect(firstTen.mostUnflushedWrites).toBe(Math.max(...ticks.slice(0, 10).map((tick) => tick.mostUnflushedWrites)))
    expect(totalsOf([])).toMatchObject({ reads: 0, longestStaleWindow: 0, mostUnflushedWrites: 0 })
  })
})
