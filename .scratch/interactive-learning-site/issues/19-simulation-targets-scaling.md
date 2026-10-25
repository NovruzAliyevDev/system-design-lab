# 19: Simulation targets in the Scaling Stage

**What to build:** The Pastebin Scaling Stage is verified by simulation, not just by structure. For example: "handle 20k read QPS with p50 < 200 ms and no overloaded Node". A new "simulation target met" predicate in the Rule Engine runs `simulate` with the Stage's Load Profile and checks the targets. On the Reference Solution view, I can run the simulation to compare it with my own Design. Challenges get a default Load Profile.

**Blocked by:** 18, 15

**Status:** ready-for-agent

- [ ] "Simulation target met" predicate (latency, overload and error-rate thresholds) in the Rule Engine.
- [ ] The Challenge definition supports a default Load Profile and per-Stage simulation targets; Pastebin targets are authored.
- [ ] Failing a target produces Hints like any other Rule.
- [ ] The Reference Solution view can be simulated.
- [ ] Content validation test extended: every Reference Solution meets its own simulation targets.
