# 21: Primer Challenges, batch 1: Twitter, web crawler, Mint, social graph

**What to build:** Four more primer questions become full Challenges in the same format as Pastebin:
- Twitter timeline and search;
- web crawler;
- Mint.com;
- social network data structures.

Each has all five Stages, Rules with three Hint tiers, Reference Solution Designs mirroring the primer's diagrams, a default Load Profile with Scaling simulation targets, and links to its Solution page and Lessons. This is mostly authored content. If a Rule needs a predicate the DSL lacks, add it as a named custom predicate with tests.

**Blocked by:** 19

**Status:** resolved

- [x] Four Challenge definitions authored, with Azerbaijani Hints and explanations; English technical terms kept.
- [x] Estimation reference values and worked solutions taken from the primer's solution write-ups.
- [x] Content validation tests pass for all four: Reference Solutions score 100% and meet their simulation targets.
- [x] Any new custom predicate has Seam A tests.

## Comments

**Done on `main`.**
- **Four Challenges** (`content/primer-challenges/{twitter,web-crawler,mint,social-graph}.ts`), listed after Pastebin. Each has all five Stages (weights 1, 1, 3, 2, 3), Azerbaijani prompts, Hints and explanations with English technical terms, a Solution page, and Lessons led by its primer question.
  - **Requirements:** 12 to 19 items each, from the primer's use cases, out-of-scope list and assumptions, plus distractors.
  - **Estimation:** the primer's numbers. Twitter: 6,000 tweets/s, 100,000 reads/s, 150 TB a month, 5.4 PB in 3 years. Crawler: 1,600 crawls/s, 40,000 searches/s, 2 PB, 72 PB. Mint: 2,000 transactions/s, 200 reads/s, 250 GB, 9 TB. Social graph: 400 searches/s, plus an authored peak of 10 times (4,000/s), which the primer does not give. The 5 billion friendships are explained in the worked solution, since `estimate` has no such quantity.
  - **Deep dive:** 5 or 6 trade-off questions each, from the primer's core-component sections.
  - **Design Stages:** 6 to 9 Rules each, three Hint tiers per Rule. Reference Solutions mirror `<name>_basic.png` and `<name>.png`; services are app-services named as in the diagrams. Twitter's Search Service and the crawler's Reverse Index Service are search indexes. A Person Server is a key-value store sharded by `person_id`. Twitter's notifications go through the queue the primer mentions but does not draw.
  - **Load Profiles and targets:**
    - Twitter: 100,000 reads and 6,000 writes, 10 KB.
    - Crawler: 40,000 searches and no writes.
    - Mint: 200 reads and 2,000 writes.
    - Social graph: 400 searches.
    - Scaling is checked at the primer's average for the first three, and at the 4,000/s peak for the social graph: mean latency ≤ 200 ms, no overloaded Node, no errors.
- **Custom predicate `sharded-database`** (`src/core/challenges/rules.ts`): some SQL or NoSQL database has a shard key and more than one instance. It is used by Twitter and Mint `write-scaling` (sharding, or federation over 2+ SQL primaries) and by the social graph `sharded-people`. The crawler's `sharded-index` is built from node predicates.
- **Estimation inputs may be 0** (`src/core/challenges/challenge.ts`), for questions without writes such as the social graph. A question whose reference value the inputs make 0 fails the build, since grading divides by it.
- **Shared building blocks** (`content/primer-challenges/shared.ts`): selectors, path predicates, `scaledOut`, `writesSpread`, `readReplicas()`, and the common load-balancer, scale-out, DNS and all-connected Rules. Pastebin now takes its checks from there; its texts are unchanged.
- **Tests.**
  - **Seam A:** `sharded-database` passes and fails (no key, one instance, a search index, any one database); estimation inputs of 0 and the 0-reference problem.
  - **`tests/primer-catalog.test.ts`:**
    - the five Challenges in order, each with five Stages, its Solution page and Lesson;
    - every Scaling target missed by its high-level Reference;
    - each Challenge's estimation answers and Load Profiles;
    - federation accepted and an unsharded master beside NoSQL refused;
    - a graph database refused;
    - the crawler indexing through a queue;
    - `sharded-index` needing more than one instance.
  - The existing content tests cover all four Challenges: Reference Solutions score 100% and meet their targets.
- **Notes.**
  - **Every read takes every read Edge.** In simple mode a Node calls all its targets. Twitter's Search API, Search Index and timeline services therefore get all 100,000 reads, not the primer's 4,000 searches, and its Reference runs them on hundreds of instances. The `average-load` Hint says so.
  - **The crawling is not simulated.** Only Clients send traffic, so the crawler's 1,600 writes/s are checked by structure (queues, store, paths), and its Crawler Service is not load-tested.
  - **Structural limits.** The social graph's `lookup-service` counts three app-services rather than checking who calls whom. A Person Server drawn as an app-service misses `person-data` and `sharded-people`; the Hints point to a key-value store.
  - **No Chaos tasks yet.** The ticket did not ask for them; Pastebin has the only one.
