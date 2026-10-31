# 20: Chaos Scenarios

**What to build:** Break my design on purpose and see what survives. A Chaos Scenario is data: a Node goes down, a whole zone goes down, the cache is cold or flushed, or the network is partitioned between two sets of Nodes. It is applied in `simulate` before routing. In the sandbox, I pick a scenario and see which requests fail. Challenges can include Chaos tasks (e.g. "the primary database failed — keep the read path working"), which are checked by simulation-target Rules under that scenario. Pastebin gets one Chaos task.

**Blocked by:** 19

**Status:** resolved

- [x] Chaos Scenario types: node down, zone down, cache cold, partition. Supported by `simulate`.
- [x] Sandbox scenario picker; failed paths and dropped requests are visualised.
- [x] The Challenge definition supports Chaos tasks; one is authored for Pastebin.
- [x] Seam A tests: each scenario type on small graphs (replica failover keeps reads alive; a single-instance service down drops all traffic; a cold cache shifts load to the DB).

## Comments

**Done on `main`.**
- **`ChaosScenario`** (`src/core/simulation/simulate.ts`) addresses the Design by id. The four types are `node-down` (`nodeIds`), `zone-down` (`zoneIds`), `cache-cold` (`nodeIds`) and `partition` (`sides`, two lists of Node ids). `simulate` applies the scenario before routing, as follows.
  - **Ignored.** Ids the Design does not have, and clients: they stand for the users and never go down.
  - **A Node down** serves nothing, and it still costs. Requests needing it fail. Deferred work for it waits as backlog.
  - **A primary with `replicas` configured** loses only its primary copy (`primaryDown`). It drops every write; its replicas serve the reads, over N copies.
  - **A zone down** takes down every Node in it, and in any zone wholly inside it.
  - **A cold cache (or CDN)** answers no reads itself. Every read goes on to what is behind it, or to the database beside it.
  - **A partition** cuts every Edge between the two sides, either way. Requests along a cut Edge fail. Deferred work along one waits as the target's backlog.
  - **Failover:**
    - A load balancer routes around targets that are down or cut off, while some target is left.
    - So does a reader of replicas. When none of a primary's replicas is left, the reads go back to the primary.
    - A cache-aside cache that is down or cut off is skipped, and the database answers instead.
    - A primary does not replicate to a replica it cannot reach, so no write fails for that.
- **The result** now has:
  - per Node: `down`, `primaryDown` and `cold`;
  - `errorRateByKind`;
  - `cutEdgeIds`;
  - in `droppedQps`, the requests sent along cut Edges.
- **Chaos tasks** (`src/core/challenges/rules.ts`):
  - **`ChaosTask`.** A design Stage may list `chaosTasks`: `{ id, prompt, scenario }`.
  - **Selectors.** The scenario picks its Nodes by Node selectors, so a task applies to any Design the learner builds. `zone-down` takes `zonesOf`, the zones holding the Nodes the selectors pick. `chaosScenarioOf(scenario, design)` resolves the selectors to ids.
  - **The `simulation` predicate** gains `chaos: '<task id>'`. `maxErrorRate` may now also be given per request kind: `{ read?, write? }`.
  - **Simulation count.** An evaluation simulates at most once per Chaos task.
  - **"Reaches some Node".** That check now counts only Nodes that are up. Writes to a primary whose primary copy is down do not count either.
  - **Validation** checks:
    - task ids, prompts, scenario fields and selectors;
    - that every `chaos` names a task of the Stage;
    - that each task breaks something in the Reference Solution;
    - that the Reference Solution passes every Rule under it, as for any Rule.
- **Pastebin** (`content/challenges.ts`):
  - **Chaos task `primary-db-down`.** The Scaling Stage takes down the primary of the shortlink table (the SQL primary, or a key-value store's primary).
  - **Rule `primary-db-down`** (weight 2, three Hint tiers): `{ type: 'simulation', chaos: 'primary-db-down', maxErrorRate: { read: 0 } }`. The Stage prompt states the task.
  - **Reference Solution.** It survives: reads 0% errors, writes 100%. A design reading the shortlinks from the primary fails. Replicas configured on the primary pass.
- **UI:**
  - **The Xaos ssenarisi panel** (`src/ui/canvas/ChaosPanel.tsx`) sits under the Load panel.
    - In the sandbox it offers the four types. Each is picked by hand: Node checkboxes, caches only, a zone, or A/B sides.
    - An open design Stage also lists its Chaos tasks.
    - The finished-Stage comparison lists only the tasks, simulated in each Design alike.
  - **On the canvas:**
    - Nodes that are down are greyed, with a dashed red border, and say "Sıradan çıxıb" with what they drop.
    - A primary that lost its primary copy and a cold cache say so.
    - Cut Edges, and Edges whose requests a down Node refuses, turn red and broken and stop animating.
  - **The summary** adds read and write error rates, "Sınan hissələr" (what the scenario broke) and "Xəta verən yollar" (the failing paths, worst first).
- **Tests:**
  - **Seam A.**
    - `simulate.test.ts` has 19 new cases:
      - node down on a single-instance service, behind a load balancer, on the primary (replica failover), on every replica, on a primary with replicas configured, behind a queue and as a cache-aside cache;
      - clients and unknown ids;
      - a zone nested in a zone;
      - a cold cache beside and in front of a database;
      - a partition: requests failing, an async Edge, load-balancer failover, a replica.
    - `rules.test.ts` covers per-kind error rates, targets under a Chaos task and `chaosScenarioOf` for each type.
    - `challenge.test.ts` covers Chaos tasks in the definition and their validation problems.
  - **Content.** `tests/primer-catalog.test.ts` checks:
    - every Reference Solution meets its targets under its Chaos tasks;
    - the Pastebin task picks the SQL Write Master;
    - reading from the primary fails it.
  - **Playwright.**
    - New sandbox smoke: a load balancer fails over from a down web server, both down fail every request, and a partition cuts one target off.
    - The Pastebin smoke's Scaling Stage now has 9 problems. It shows the Chaos task taking down the learner's SQL database (100% read errors), and the Reference surviving it in the comparison.
- **Notes.**
  - **Whole-Node down.** Only a down primary with configured replicas fails partly; any other Node goes down whole, all its instances with it.
  - **A down zone** takes a primary with configured replicas down whole, replicas included.
  - **Not saved.** The scenario picked is not saved, like the Load Profile.
