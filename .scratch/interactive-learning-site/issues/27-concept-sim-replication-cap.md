# 27: Concept simulation: replication and CAP

**What to build:** Two interactive Concept Simulations, embedded in their Lessons:
- **Replication:** primary-replica and primary-primary setups with adjustable replication lag. I can kill the primary and watch failover, stale reads from lagging replicas, and write conflicts in primary-primary.
- **CAP:** I cut the network between two partitions and choose CP or AP behaviour, then see which requests are rejected (CP) or which reads become inconsistent (AP).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Pure Core simulations with injected time and seed.
- [ ] Replication UI with topology switch, lag control, kill primary, and a stale-read indicator.
- [ ] CAP UI with a partition toggle and a CP/AP switch, showing a request log with outcomes.
- [ ] Azerbaijani explanations linked to the consistency and availability Lessons.
- [ ] Seam A tests: reads after a write within the lag window are stale on replicas; CP rejects writes on the minority side; AP accepts them and diverges.
