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

**Status:** ready-for-agent

- [ ] `simulate` in Core with the simple-mode semantics above; a `scenario` parameter accepted but unused (filled by ticket 20).
- [ ] Load Profile editor and load slider; results update when the Design or the load changes.
- [ ] Node overlay (metrics plus overloaded colouring) and animated Edge flow.
- [ ] Summary panel: per-path latency, error rate, monthly cost, ranked bottlenecks.
- [ ] Node capacity, latency and cost are visible and editable in the config panel.
- [ ] Seam A tests on hand-computed graphs: single server under and over capacity; LB even split; cache hit ratio reducing DB load; replica read routing; queue deferral.
- [ ] Playwright smoke: simulate an undersized Design and see an overloaded Node flagged.
