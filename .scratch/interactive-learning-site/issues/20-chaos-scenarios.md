# 20: Chaos Scenarios

**What to build:** Break my design on purpose and see what survives. A Chaos Scenario is data: a Node goes down, a whole zone goes down, the cache is cold or flushed, or the network is partitioned between two sets of Nodes. It is applied in `simulate` before routing. In the sandbox, I pick a scenario and see which requests fail. Challenges can include Chaos tasks (e.g. "the primary database failed — keep the read path working"), which are checked by simulation-target Rules under that scenario. Pastebin gets one Chaos task.

**Blocked by:** 19

**Status:** ready-for-agent

- [ ] Chaos Scenario types: node down, zone down, cache cold, partition. Supported by `simulate`.
- [ ] Sandbox scenario picker; failed paths and dropped requests are visualised.
- [ ] The Challenge definition supports Chaos tasks; one is authored for Pastebin.
- [ ] Seam A tests: each scenario type on small graphs (replica failover keeps reads alive; a single-instance service down drops all traffic; a cold cache shifts load to the DB).
