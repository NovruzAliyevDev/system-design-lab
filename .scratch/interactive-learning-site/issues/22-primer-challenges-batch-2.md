# 22: Primer Challenges, batch 2: query cache, sales rank, scaling AWS

**What to build:** The remaining three primer questions become full Challenges in the same format as Pastebin:
- key-value store for a search engine (query cache);
- Amazon sales rank by category;
- scaling a system to millions of users on AWS.

For scaling AWS, the Scaling Stage is the heart of the Challenge. It is broken into progressive load targets (e.g. 1 user → 10k → 100k → millions), each checked by simulation.

**Blocked by:** 19

**Status:** resolved

- [x] Three Challenge definitions authored, with Azerbaijani Hints and explanations.
- [x] Scaling AWS uses multiple successive simulation targets.
- [x] Content validation tests pass for all three.
- [x] Any new custom predicate has Seam A tests.

## Comments

**Done on `main`.**
- **Three Challenges** (`content/primer-challenges/{query-cache,sales-rank,scaling-aws}.ts`), listed after the social graph, so the catalog has all eight primer questions. Each has all five Stages (weights 1, 1, 3, 2, 3), Azerbaijani prompts, Hints and explanations with English technical terms, a Solution page, and Lessons led by its primer question.
  - **Estimation:** the primer's numbers. Query cache: 4,000 queries/s, and 2.7 TB a month if every query were stored. Sales rank: 400 sales/s, 40,000 reads/s, 40 GB a month, 1.44 TB in 3 years (the 42 bytes of a sale rounded to 40, as the primer does). AWS: 400 writes/s, 40,000 reads/s, 1 TB a month, 36 TB in 3 years.
  - **Reference Solutions:**
    - Query cache: mirrors both diagrams. The Reverse Index Service is a search index, as in the web crawler.
    - Sales rank: mirrors both diagrams. The Sales Rank Service reads the logs from the Object Store and writes `sales_rank` to the SQL master; an Analytics (MapReduce) Node is accepted in its place.
    - AWS: the high-level Reference is Step 3's single box (DNS, Web Server, MySQL). The scaled Reference is `scaling_aws_5.png` (Users++++) plus the Queue, Worker Service and sharded SQL of `scaling_aws.png`.
- **Successive simulation targets.** The `simulation` predicate takes an optional `load`, a Load Profile it is checked under in place of its Stage's. One Stage can now hold several targets at different loads.
  - AWS is checked per user count, at the primer's rate of a read every 250 s and a write every 25,000 s per user, 1 KB each:
    - high-level design: 10k users (40 reads, 0.4 writes);
    - Scaling: 100k users (400 reads, 4 writes), 1M users (4,000, 40) and 10M users (40,000, 400).
  - Each target: mean latency ≤ 200 ms, no overloaded Node, no errors. The single box meets 100k and misses 1M; the scaled Reference with 6 Web Servers meets 1M and misses 10M.
  - Each design Stage's Traffic Simulation starts at its first target.
- **Validation.** `validateLoadProfile` moved from `challenge.ts` to `rules.ts`, which checks the predicate's `load` with it. Simulations are cached per evaluation, by load and Chaos task.
- **Shared:** Mint's queue-and-worker check is now `queuedJobs` in `shared.ts`, which AWS's `async-workers` Rule uses too.
- **Tests.**
  - **Seam A (`rules.test.ts`, `challenge.test.ts`):** a target's own load, with or without a Stage Load Profile; successive targets met up to the load a Design is scaled for; a Chaos task under a target's load; validation of the target load; the build failing when a Reference misses a target at its own load.
  - **`tests/primer-catalog.test.ts`:**
    - the eight Challenges in order;
    - each new Challenge's estimation answers and Load Profile;
    - the AWS targets, their loads and the progression above;
    - the query cache on one cache instance refused;
    - the sales rank accepting a MapReduce job, and refusing one that never reads the logs.
  - "The high-level Reference misses the Scaling target" is now "misses some Scaling target", since AWS's single box meets 100k.
- **Notes.**
  - **A cache beside services is not credited.** Simple mode takes reads off only a database beside a cache. The query cache's Reverse Index and Document Services therefore get every query, and its Reference sizes them for 4,000/s. The `average-load` Hint says so. The cache write on a miss is not drawn.
  - **The ranking is not simulated.** Only Clients send traffic, so the Sales Rank Service is checked by structure.
  - **AWS follows Users++, not the last diagram.** `scaling_aws.png` has the Web Server talk straight to the stores. The Rules require the Read and Write APIs the primer introduces at Users++. The NoSQL store, which the primer only suggests considering, is left out.
  - **Write-scaling Hints** list all the primer's SQL patterns, NoSQL among them. As for Twitter and Mint, the check accepts sharding or federation only.
  - **No UI change.** Each target's load is typed into the Traffic Simulation by hand; the Scaling prompt lists them.
