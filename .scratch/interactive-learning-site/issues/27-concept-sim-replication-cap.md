# 27: Concept simulation: replication and CAP

**What to build:** Two interactive Concept Simulations, embedded in their Lessons:
- **Replication:** primary-replica and primary-primary setups with adjustable replication lag. I can kill the primary and watch failover, stale reads from lagging replicas, and write conflicts in primary-primary.
- **CAP:** I cut the network between two partitions and choose CP or AP behaviour, then see which requests are rejected (CP) or which reads become inconsistent (AP).

**Blocked by:** 02

**Status:** resolved

- [x] Pure Core simulations with injected time and seed.
- [x] Replication UI with topology switch, lag control, kill primary, and a stale-read indicator.
- [x] CAP UI with a partition toggle and a CP/AP switch, showing a request log with outcomes.
- [x] Azerbaijani explanations linked to the consistency and availability Lessons.
- [x] Seam A tests: reads after a write within the lag window are stale on replicas; CP rejects writes on the minority side; AP accepts them and diverges.

## Comments

**Done on `main`.**
- **Embeds** (`content/concept-simulations.ts`):
  - Replication at the end of the `replication` Lesson, and in the RDBMS Lesson right after "Disadvantage(s): replication".
  - CAP in `cap-theorem`, after the AP section and before the further reading.
- **Requests** (`src/core/concept-simulations/requests.ts`): `generateRequests` draws a seeded Poisson stream of reads and writes over a few keys. Time is in milliseconds. Each request carries a `route` draw, which picks the replica, the primary or the partition side, so the simulations stay deterministic.
- **Replication** (`replication.ts`). Replication is asynchronous: other nodes apply an accepted write `lag` ms later.
  - **Primary-replica** (the primer's master-slave):
    - Writes go to the primary and reads to the replicas.
    - A kill drops the writes still on their way from the primary. These are the lost writes.
    - Writes are rejected for `failoverDelay` ms while the replicas keep serving reads (read-only mode). Then a replica is promoted, and the others follow it.
    - Every replica has the same lag, so they are equally up to date and the first one is promoted.
  - **Primary-primary** (master-master):
    - Both primaries read and write.
    - Two writes of one key that were made blind on each other are a conflict. The last writer wins.
    - Requests to a killed primary fail until its failure is detected.
  - **Stale reads** answer with an older copy than the newest write that still exists. Staleness is measured from the first write the copy missed.
  - **Per tick:** stale, rejected and lost counts and conflicts. Each node's role, how many writes it is behind, and the stale reads it served. `Failover` says when the primary was killed, when the cluster recovered, and which node took over.
- **CAP** (`cap.ts`). Five nodes, split 3/2 by a partition. A request's `route` picks its client's side in proportion to the side's node count.
  - **CP:** a request needs a majority, so the minority rejects reads and writes. When the network heals, the minority catches up.
  - **AP:** every request is answered. A read is stale (inconsistent) when the other side has a newer version. At the heal, the last writer wins each key, and keys written on both sides count as conflicts.
  - **Per tick:** the counts, the divergent keys, and the version of every key on each side. There is also a log of every request with its outcome.
- **UI** (`ReplicationSimulation.tsx`, `CapSimulation.tsx`).
  - **Replication** has these controls:
    - topology;
    - replicas (1–3);
    - lag (0–1000 ms);
    - "Kill the primary".
  - **CAP** has these controls:
    - CP/AP;
    - "Cut / heal the network".
  - **Timing of the kill and the cut.** The kill and the cut happen right after the tick shown, and playback is not restarted, so you can do them mid-run. A run that has already ended puts them at a default tick. Undoing a kill or removing a cut changes the whole run.
  - **Replication views:**
    - node cards with each node's role and how many writes it is behind, plus a stale-read light;
    - metrics: stale reads, rejected requests, lost writes, conflicts;
    - reads and writes charts, with lines marking the kill and the failover.
  - **CAP views:**
    - both sides with their key versions, divergent keys highlighted;
    - metrics;
    - a requests chart and a divergence chart, each with a shaded band for the cut;
    - a request log with each outcome (ok, rejected with no quorum, or inconsistent with the newest version);
    - a table comparing CP and AP on the same requests and cut.
  - **Azerbaijani explanations.** Each control's explanation links to its Lessons: eventual and strong consistency, fail-over, availability patterns. A related-Lessons line sits under each description.
- **Shared** (`shared.tsx`):
  - `LessonLink`, `Metric` (moved from the cache simulation) and `percent`;
  - `TimelineChart` events: a line for a moment, a band for a span;
  - hints may hold links;
  - `SimulationFrame` takes the related Lessons.
- **Link checks.** `RELATED_LESSONS` (`embed.ts`) lists every Lesson the explanations link to, so the catalog test catches one the primer drops.
- **Tests (Seam A).**
  - `replication.test.ts`:
    - A replica read within the lag window is stale, and fresh once the write arrives.
    - More lag gives more stale reads, and lag 0 gives none.
    - Nodes report how many writes they are behind.
    - After a kill: writes are rejected until the promotion, reads keep being served, unreplicated writes are lost, and the promoted primary replicates to the replicas left.
    - Primary-primary: stale reads from the other primary, conflicts within the lag window only, and LWW convergence.
    - A killed primary is reachable again only once its failure is detected.
    - `totalsOf` over any prefix equals a run of that length.
  - `cap.test.ts`:
    - Without a partition, both modes answer everything consistently.
    - CP rejects minority reads and writes while serving the majority, and the minority catches up at the heal.
    - AP accepts minority writes, its reads are stale, and the sides diverge. At the heal they reconcile by LWW, with a conflict counted per key written on both sides.
    - A partition with no end lasts to the end of the run, and the prefix property holds.
  - `requests.test.ts`: the seeded stream, ordering and ranges, and the write share.
  - `primer-catalog.test.ts`: the placements, and that the related Lessons exist.
- **Not done:**
  - Only one cut per CAP run.
  - A client whose acknowledged write was lost with the primary is not flagged when it then reads the older value. The lost-writes metric shows that loss instead.
