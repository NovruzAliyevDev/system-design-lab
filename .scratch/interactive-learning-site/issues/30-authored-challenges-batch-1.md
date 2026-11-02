# 30: Authored Challenges, batch 1: URL shortener, rate limiter, distributed ID generator

**What to build:** Three practice Challenges beyond the primer, in the full Challenge format: five Stages, Rules, Hints, Reference Solution, Load Profile, simulation targets, and a Chaos task where it fits. They are clearly marked "not from the primer". New components or predicates needed (e.g. a rate limiter component) are added with tests.

**Blocked by:** 20

**Status:** resolved

- [x] Three Challenge definitions with source = authored; the UI shows a "not from the primer" badge.
- [x] Reference explanations written in Azerbaijani, with English technical terms (no primer Solution page exists for these).
- [x] Content validation tests pass for all three.
- [x] Any new component type or predicate has Seam A tests.

## Comments

**Done on `main`.**

- **Two new palette components** (`components.ts`). No new predicate was needed.
  - **Rate limiter** (`rate-limiter`, tag RL).
    - Config: `algorithm` (token bucket, leaking bucket, fixed window, sliding window log, sliding window counter), `limitQps` (default 1,000), `failMode` (`closed` by default, or `open`) and `instances`.
    - An instance handles 20,000 requests a second in 0.5 ms.
    - Simulation (`simulate.ts`):
      - The limit is one total for all clients together. The limiter checks every request it serves against its counter store (a cache or NoSQL store it has an edge to), rejected ones included, and passes on only what is under the limit.
      - Rejected requests fail (they count toward the error rate) but are not "dropped": they get their own `throttledQps` on the Node and on the result.
      - When every counter store is down or cut off, a fail-closed limiter rejects everything. A fail-open limiter skips the stores and lets everything through unchecked.
      - A limiter without a counter store counts in its own memory.
      - `algorithm` changes nothing in the simulation, like the load balancer's; the deep dive weighs the algorithms.
    - UI: the Node card shows the throttled requests; the Traffic Simulation summary adds a "rejected by limit (429)" line.
    - The spec's Simulation Engine section now describes this.
  - **Coordination service** (`coordination-service`, ZooKeeper, tag ZK).
    - No special simulation semantics. Requests reach it only along an edge into it, so the ID generator draws it handing worker ids to the generators.
    - Its capacity grows with instances like every component's, though quorum writes don't really scale that way. This is a known simplification, and it doesn't matter while it stays off the request path.
  - Glossary Terms "Rate limiter" and "Coordination service" for the palette tooltips.
- **Badge.** `SourceBadge` (`challenge/shared.tsx`) shows authored Challenges' existing "Primer-dən deyil" label as a sky-bordered badge on the list and on the Challenge page; primer ones stay plain text.
- **Three Challenges** (`content/authored-challenges/`, after the primer questions).
  - Each has five Stages, no Solution page and no `solutionAnchor`.
  - `authored-challenges/shared.ts` re-words the load balancer and scale-out Hints without pointing at a primer diagram.
  - **URL shortener** (`url-shortener.ts`):
    - 100M links a day, 10:1 reads, 100 bytes a record, 10 years: 1,200 writes and 12,000 reads a second, 3.6 TB a year, 36 TB.
    - High-level design: separate Shortening and Redirect services, a Key Generation Service, and a key-value URL store.
    - Scaling at a 2× peak: a redirect cache and replicas or shards. Chaos task: a cold cache, so the store must take every redirect.
    - Deep dive: 301 vs 302, key length, hashing vs KGS, KGS redundancy, eviction, and repeated URLs.
  - **Rate limiter** (`rate-limiter.ts`):
    - 4B reads and 1B writes a month, a 5× peak.
    - High-level design: every request goes through the limiter, counters live in an in-memory store (not SQL), and a rules worker loads the rules store into the cache.
    - Scaling:
      - the peak passes with nothing rejected, so the limit sits above it;
      - a 4× abusive burst overloads nothing, so the limit sits below the API servers' capacity and the limiter and LB take 3+ instances;
      - Chaos task: the counters go down, so the limiter must fail open;
      - plus limiter scale-out behind a load balancer and shared counters.
    - Deep dive: algorithms, race conditions (INCR / Lua), fail-open vs fail-closed, limit keys, and placement.
  - **ID generator** (`id-generator.ts`):
    - 10,000 IDs a second, a 3× peak, 8 bytes each (2.4 TB a year).
    - High-level design: a generator service with no database, cache or coordination service in the ID path, worker ids from ZooKeeper, and several generators.
    - Scaling: a 10 ms target at 30,000 a second. Chaos task: ZooKeeper down. The ensemble must be an odd size of 3 or more.
    - Generator nodes in the Reference raise their simulation capacity to 10,000 (they do no I/O); adding instances passes too.
    - Deep dive: approaches, Snowflake bit layout, sequence overflow, clock going backwards, ZooKeeper outage, and quorum size.
- **Tests.**
  - `simulate.test.ts`:
    - rate limiter: under the limit, over it, a limit set on the Node, overloaded while rejecting, counters checked for every request, fail-closed, fail-open, and a partition;
    - coordination service: off the request path, and on it.
  - `primer-catalog.test.ts`:
    - the primer architecture list is now filtered by source;
    - authored Challenges are last, five Stages, no Solution page;
    - every explanation and Hint is Azerbaijani;
    - Scaling targets miss the high-level References;
    - each Estimation's numbers;
    - key mistakes fail their Rule: a store without replicas under a cold cache, no KGS, a limit too low or too high, too few limiter instances, fail-closed, SQL counters, a way around the limiter, a ticket server, ZooKeeper per ID, and an even ensemble.
- **Review.** /code-review (Standards + Spec) findings are fixed:
  - rejected requests now reach the counter store;
  - the ID generator's capacity is now honest;
  - the counter-store definition is aligned between the Rule and the simulation;
  - the burst Rule's description now matches its check;
  - duplicated Rules and checks are removed and the label keys renamed.
  - Kept as is: the ZooKeeper edge direction and the generic coordination-service capacity (see above).
