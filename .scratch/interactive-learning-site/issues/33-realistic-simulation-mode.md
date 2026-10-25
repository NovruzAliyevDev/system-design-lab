# 33: Realistic simulation mode

**What to build:** An optional "realistic" mode for the Traffic Simulation, for going deeper once the simple model is understood. Each Node is modelled as an M/M/c queue with seeded randomness, and the results report p50/p95/p99 latency and queueing delay. It uses the same `simulate` signature (`mode = "realistic"`). A toggle in the simulation panel switches between modes, with an Azerbaijani explanation of the difference. Rules and simulation targets keep using simple mode unless a target explicitly asks for realistic.

**Blocked by:** 18

**Status:** ready-for-agent

- [ ] Realistic mode in Core `simulate`; same input and output shape, plus percentile fields.
- [ ] Seeded randomness: the same seed gives the same result.
- [ ] UI toggle and percentile display.
- [ ] Seam A tests: for a single M/M/1 node, mean latency approaches the analytic value; p99 is at least p50; ρ ≥ 1 is still reported as overloaded.
