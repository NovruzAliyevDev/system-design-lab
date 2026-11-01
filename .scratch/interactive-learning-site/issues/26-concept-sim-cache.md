# 26: Concept simulation: caching

**What to build:** An interactive cache simulation embedded in the cache Lessons. A stream of reads and writes hits a cache in front of a database. I switch between cache-aside, write-through, write-behind and refresh-ahead, choose an eviction policy (LRU, LFU, FIFO) and cache size, and watch:
- hit/miss ratio;
- database load;
- stale-read windows;
- data at risk in write-behind.

**Blocked by:** 02

**Status:** resolved

- [x] Pure Core cache simulation with an injected seed and workload (uniform and skewed / hot keys).
- [x] UI embeds in the cache Lessons with strategy, eviction and size controls, plus live metrics.
- [x] Azerbaijani explanations per strategy, tied to what the user sees.
- [x] Seam A tests: LRU vs FIFO on a known access sequence; write-through has no stale reads; write-behind reports unflushed writes.

## Comments

**Done on `main`.**
- **Embeds** (`content/concept-simulations.ts`): at the end of the `cache` Lesson (hit/miss, eviction, size) and of `when-to-update-the-cache`, the Lesson that compares the four strategies.
- **Core** (`src/core/concept-simulations/cache.ts`).
  - `generateWorkload` draws a seeded stream of reads and writes. Keys are uniform, or skewed by Zipf's law, so a few hot keys get most operations. The write share is a parameter.
  - `simulateCache` runs any operation stream through the cache. Time is counted in operations, grouped into ticks.
  - It returns per-tick counts plus `totalsOf(ticks)`, which totals any run of ticks. The UI uses it for "so far" during playback.
- **Strategies**, following the primer:
  - **Cache-aside:** loads on a miss. Writes go to the database only, so a cached copy stays stale until its TTL ends or it is evicted.
  - **Write-through:** writes update the cache and the database, so it is never stale. A miss reads through the cache, since the primer has the cache read from the database.
  - **Write-behind:** writes stay in the cache until a batched flush every `flushInterval` operations. Several writes to one key coalesce into one database write. An evicted changed entry is written first. The writes not yet flushed are the data at risk.
  - **Refresh-ahead:** cache-aside, plus a reload when an entry is read after 75% of its TTL. The reload counts as a database read.
- **Eviction:**
  - LRU, LFU (ties go to the least recently used) and FIFO.
  - An expired entry is evicted first.
- **Stale reads** are hits served from a copy older than the database. The stale-read window is how long that copy had been out of date, and the longest window is reported.
- **UI** (`CacheSimulation.tsx`).
  - Controls: strategy, eviction and cache size (1–50 of 100 keys), workload and write share. A TTL slider appears for cache-aside and refresh-ahead, and a flush interval for write-behind.
  - Each control has an Azerbaijani explanation tied to the metric it moves.
  - Metric cards: hit ratio, database load against no cache, stale reads with the longest window, and writes at risk now and at most. They count up to the playback tick.
  - Charts per tick: reads (hits, misses, stale), and the database (reads, writes, and the most writes at risk during the tick).
  - A table compares all four strategies on the same workload.
- **Shared with the load balancer** (`shared.tsx`): `usePlayback`, `PlaybackBar`, `TimelineChart` (the old queue chart, now generic) and `Choice` (radio group), with shared `conceptSimulationTick*` strings.
- `LessonText` keys parts by Lesson, so a simulation starts fresh in the next Lesson instead of keeping the last one's settings.
- **Tests (Seam A).**
  - `cache.test.ts`:
    - On known sequences: LRU vs FIFO, and LFU vs LRU.
    - Write-through has no stale reads where cache-aside does; a shorter TTL shortens stale windows.
    - Write-behind reports unflushed writes, coalesces them at the flush, and flushes on eviction.
    - Refresh-ahead hits more than cache-aside.
    - Skewed workloads hit more than uniform ones; workloads are seeded.
    - `totalsOf` over any prefix equals a run of that length.
  - Also: a `primer-catalog.test.ts` placement check, and the `embed.test.ts` unknown-simulation case.
