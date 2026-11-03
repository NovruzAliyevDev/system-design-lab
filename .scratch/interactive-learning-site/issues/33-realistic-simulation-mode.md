# 33: Realistic simulation mode

**What to build:** An optional "realistic" mode for the Traffic Simulation, for going deeper once the simple model is understood. Each Node is modelled as an M/M/c queue with seeded randomness, and the results report p50/p95/p99 latency and queueing delay. It uses the same `simulate` signature (`mode = "realistic"`). A toggle in the simulation panel switches between modes, with an Azerbaijani explanation of the difference. Rules and simulation targets keep using simple mode unless a target explicitly asks for realistic.

**Blocked by:** 18

**Status:** resolved

- [x] Realistic mode in Core `simulate`; same input and output shape, plus percentile fields.
- [x] Seeded randomness: the same seed gives the same result.
- [x] UI toggle and percentile display.
- [x] Seam A tests: for a single M/M/1 node, mean latency approaches the analytic value; p99 is at least p50; ρ ≥ 1 is still reported as overloaded.

## Comments

**Done on `main`.**
- **`simulate(design, load, scenario?, mode = 'simple', seed?)`** (`src/core/simulation/simulate.ts`). `SimulationMode` is now `'simple' | 'realistic'` (`SIMULATION_MODES`). The new optional `seed` defaults to 1. Realistic mode routes traffic exactly as simple mode does: load, utilisation, errors, drops, cost, bottlenecks and path shares are unchanged. Only latency differs.
  - **Each Node is an M/M/c queue** (`src/core/simulation/queueing.ts`). It has c = its instances, its mean service time is its base latency, and its ρ is simple mode's load ÷ capacity. Capacity and base latency are set independently, so the queue keeps that ρ and takes its time scale from the base latency. For one instance the mean is simple mode's base / (1 − ρ). With more instances sharing one queue, the wait at the same ρ is shorter (Erlang C).
  - **Cap.** The queue is modelled at most as busy as makes its mean `LATENCY_CAP` (10×) the base, whatever c is. At ρ ≥ 1 the Node is still overloaded and drops its excess, as in simple mode.
  - **Sampling.** `REALISTIC_SAMPLES` (10,000) requests of each kind are drawn from the clients through the queues. Each request draws its wait (Erlang C, then exponential) and service time at each Node. A cache hit stops it there. It takes at most one alternative per group (load balancer targets, replicas) and each other call by its share, matching how simple mode weights paths. Each kind draws from its own `mulberry32` stream, seeded from `seed`, so the same seed gives the same result. Reads and writes do not disturb each other's draws.
  - **Result.** Per Node, `latencyMs` is the queue's mean and `queueingDelayMs` its mean wait. Per kind, `meanLatencyMs` is the sampled mean, `latencyPercentilesMs` gives `{ p50Ms, p95Ms, p99Ms }`, and `queueingDelayMs` is the mean total wait. As with the mean, failing requests count in the percentiles. Simple mode's result has none of the new fields.
- **Simulation targets** (`src/core/challenges/rules.ts`). A `simulation` predicate takes an optional `mode`, `'simple'` unless given, and simulates in realistic mode with the default seed only when asked. The per-evaluation cache key includes the mode. Validation refuses an unknown mode. No authored Challenge uses realistic mode yet, and targets still bound only the mean latency.
- **UI.** The Trafik simulyasiyası panel has a Model choice (Sadə / Realist) with an Azerbaijani explanation of each. The sandbox, the open Design Stage and the finished Stage's comparison all follow it. In realistic mode, the summary adds p50 / p95 / p99 and the mean queueing delay per kind, and each Node with load shows "növbədə gözləmə". The UI always uses the default seed. Like the Load Profile, the mode is not saved.
- **Tests (Seam A).**
  - `simulate.test.ts`, 14 cases:
    - M/M/1 analytic mean and wait, with the sampled mean, wait, p50, p95 and p99 near the exponential's;
    - p99 ≥ p95 ≥ p50;
    - ρ ≥ 1 still overloaded, with the cap at 10× for 1 and for 10 instances;
    - M/M/2 waiting less than M/M/1;
    - sampled means matching simple mode through a cache-aside and a load-balanced Design;
    - the same shape as simple mode;
    - seeds;
    - kinds drawn independently;
    - no new fields in simple mode.
  - Tolerances were checked to hold for 200 seeds.
  - `rules.test.ts`: simple by default, realistic only when asked.
  - `challenge.test.ts`: an unknown mode fails the build.
- **Notes.**
  - **No percentile targets yet.** A `maxP99LatencyMs` (or p50) target is the natural next use of realistic mode. Ticket 19 noted it, but it is not part of this ticket.
  - **No Playwright step.** The toggle was checked by hand in the sandbox.
