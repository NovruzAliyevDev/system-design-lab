# 18: Traffic Simulation tracer on the canvas

**What to build:** Run a Traffic Simulation on any Design in the sandbox. I set a Load Profile (read QPS, write QPS, data size), press "Simulate", and see:
- animated request flow along the Edges;
- each Node's load, utilisation, latency and cost, with overloaded Nodes in red;
- a summary of end-to-end latency per path, error rate, monthly cost and ranked bottlenecks.

A load slider (100 → 100k QPS) shows where my design breaks.

`simulate(design, loadProfile, scenario?, mode = "simple")` lives in Core and is deterministic:
- Traffic enters at clients.
- A load balancer splits traffic across downstream Nodes by its algorithm.
- A cache forwards misses (1 − hit ratio) downstream.
- Reads may go to replicas; writes go to the primary.
- A queue defers work to its consumers.
- Utilisation ρ = load / (capacity × instances). Latency = base × 1/(1 − ρ), capped. When ρ ≥ 1, the Node is overloaded and the excess load is dropped.

**Blocked by:** 12

**Status:** resolved

- [x] `simulate` in Core with the simple-mode semantics above; a `scenario` parameter accepted but unused (filled by ticket 20).
- [x] Load Profile editor and load slider; results update when the Design or the load changes.
- [x] Node overlay (metrics plus overloaded colouring) and animated Edge flow.
- [x] Summary panel: per-path latency, error rate, monthly cost, ranked bottlenecks.
- [x] Node capacity, latency and cost are visible and editable in the config panel.
- [x] Seam A tests on hand-computed graphs: single server under and over capacity; LB even split; cache hit ratio reducing DB load; replica read routing; queue deferral.
- [x] Playwright smoke: simulate an undersized Design and see an overloaded Node flagged.

## Comments

**Done on `main`.**
- **`simulate(design, load, scenario?, mode = 'simple')`** (`src/core/simulation/simulate.ts`). The `LoadProfile` is read QPS, write QPS and request bytes. Traffic is shared evenly among the clients connected to something, then pushed through the Design in topological order. An Edge closing a cycle is left out, so traffic follows a cycle once. `scenario` is typed as an empty record for ticket 20; `mode` only has `'simple'`.
  - **Routing.** Traffic goes only along Edges carrying its kind (read, write, both), never back to a client.
  - **Load balancer.** It splits evenly (round robin, hashing) or by target capacity (least connections).
  - **Fan-out.** Other Nodes call every target.
  - **Storage** (SQL, NoSQL, object store, search index, data warehouse) answers reads itself and passes on only writes.
  - **Replicas.** Reads meant for a primary go to its replicas when the caller reaches some, split evenly. A primary's replicas are those it has an Edge to; any others stand in for the primaries of their type. A replica gets writes only from its primary (replication).
  - **Caches.** A cache passes on its misses (1 − hit ratio). A cache beside a SQL or NoSQL database (cache-aside) leaves that database only the misses.
  - **Queues and asynchronous Edges** make what follows deferred. Request paths stop at the queue, and the excess of deferred work is backlog, not dropped requests. A Node reached both ways shares its excess between the two.
  - **Per Node.** ρ = load ÷ (capacity × instances), except that a primary with `replicas: N` serves reads over N + 1 copies at N + 1 times the cost (its reported capacity is for that read/write mix). Latency = base × 1/(1 − ρ), capped at 10× (`LATENCY_CAP`). At ρ ≥ 1 the Node is overloaded, serves capacity and drops the rest, and passes on only what it serves.
  - **Result.** Per Node: load, capacity, utilisation, latency, cost, overloaded, deferred, dropped, backlog and bandwidth. Per Edge: reads and writes. Request paths, at most `MAX_PATHS`, with their share, latency and error rate. Mean latency per kind: calls a request makes add up, and alternatives (load balancer targets, replicas, cache hit or miss) count by their share. Error rate: a request fails when any Node it needs drops it. Also dropped QPS, monthly cost, and bottlenecks ranked by utilisation.
- **Node simulation settings** (`src/core/design/design.ts`). A Node can set its own `capacityQps`, `baseLatencyMs`, `monthlyCostUsd` and, for a cache, `hitRatio` (default 0.8). They live in an optional `simulation` field beside `config`, so Rules do not see them. `nodeSimulation(node)` merges them over the component defaults. `setNodeSimulation` sets or clears one, and `simulationProblem` gives a typed reason for an invalid value. `readDesign` checks them.
- **UI.**
  - The sandbox has a Trafik simulyasiyası panel above the canvas: read and write QPS, request size in KB, and a log-scale slider for the total load from 100 to 100,000 QPS that keeps the read/write mix. "Simulyasiya et" turns the simulation on; from then on the results follow every change to the Design or the load.
  - Each Node shows its load against capacity with utilisation, its latency, cost and bandwidth, and any backlog. Overloaded Nodes turn red and say so; a client shows what it sends.
  - Edges carrying traffic animate, thicken with their load and show it in their label.
  - Under the canvas, a summary shows mean read and write latency, error rate, dropped QPS, monthly cost, the top 5 bottlenecks and the top 8 request paths.
  - The config panel's simulation section is now editable per Node (hit ratio in %), with each default shown and a reset button.
- **Tests.**
  - Seam A (`simulate.test.ts`, 30 cases): a single server under and over capacity, instances, Node settings, passing on only what is served, bandwidth; path latency, calls adding up with cache-aside, failure when any needed Node drops; LB even and least-connections splits; cache misses in a chain and beside a database, not beside an object store, and a set hit ratio; replicas taking reads and replicated writes, belonging to their own primary, and configured on a primary; queue deferral and backlog, mixed sync and deferred inflow, async Edges; routing by traffic, storage stopping reads, cycles, an unconnected client, no client; bottleneck ranking; determinism. `design.test.ts` covers the Node settings.
  - Playwright: an undersized sandbox Design (one web server at 1,500 QPS) is flagged overloaded with a 33.3% error rate. A second instance clears it, and the slider at 100,000 QPS breaks it again. The canvas smoke now reads the capacity from its editable field.
- **Notes.**
  - The Design model gains the Node `simulation` field; there is no CONTEXT.md or ADR yet to record it in.
  - The Reference Solution view and the Scaling Stage do not simulate yet: Load Profiles per Challenge and simulation targets are ticket 19.
  - The Load Profile and the on/off switch are not saved.
