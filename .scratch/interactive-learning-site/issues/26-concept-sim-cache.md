# 26: Concept simulation: caching

**What to build:** An interactive cache simulation embedded in the cache Lessons. A stream of reads and writes hits a cache in front of a database. I switch between cache-aside, write-through, write-behind and refresh-ahead, choose an eviction policy (LRU, LFU, FIFO) and cache size, and watch:
- hit/miss ratio;
- database load;
- stale-read windows;
- data at risk in write-behind.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Pure Core cache simulation with an injected seed and workload (uniform and skewed / hot keys).
- [ ] UI embeds in the cache Lessons with strategy, eviction and size controls, plus live metrics.
- [ ] Azerbaijani explanations per strategy, tied to what the user sees.
- [ ] Seam A tests: LRU vs FIFO on a known access sequence; write-through has no stale reads; write-behind reports unflushed writes.
