# 15: Stage-by-stage Challenge flow for Pastebin

**What to build:** Solve Pastebin the way an interview runs, in five Stages:
1. **Requirements:** a checklist of candidate use cases and constraints, including distractors, plus free-text notes.
2. **Estimation:** I enter QPS, storage per year and bandwidth. `estimate` / `gradeEstimate` in Core accept answers within a factor of 2 of the reference, then show the worked calculation.
3. **High-level design:** the canvas, from ticket 13.
4. **Deep dive:** trade-off questions with explanations.
5. **Scaling:** I continue from my own high-level Design and evolve it against Scaling Rules. Simulation targets come in ticket 19.

The Reference Solution of each Stage stays hidden until I finish or give up on that Stage. The Stage scores combine into a Challenge score using per-Stage weights from the Challenge definition. Every run is saved as an Attempt, and I can see the history and retry from scratch or from my last Attempt. Challenges get a list page, and are added to search.

**Blocked by:** 13

**Status:** ready-for-agent

- [ ] The Challenge definition format covers all five Stages; the Pastebin definition is completed.
- [ ] Requirements checklist with distractors is graded; notes are saved.
- [ ] `estimate` (unit-aware, powers of two) and `gradeEstimate` live in Core; the worked solution is revealed after the Stage.
- [ ] Deep-dive trade-off questions with explanations.
- [ ] The Scaling Stage starts from my high-level Design and is checked against Scaling Rules.
- [ ] The Challenge score uses the per-Stage weights.
- [ ] Attempts are persisted (per-Stage inputs, Evaluations, Hint usage, timestamps); there is a history view and retry (fresh or from last).
- [ ] Challenge list page; Challenges are added to global search.
- [ ] Seam A tests: `estimate` against worked numbers from the primer's Pastebin solution; `gradeEstimate` tolerance edges; Challenge score weighting.
