# 19: Simulation targets in the Scaling Stage

**What to build:** The Pastebin Scaling Stage is verified by simulation, not just by structure. For example: "handle 20k read QPS with p50 < 200 ms and no overloaded Node". A new "simulation target met" predicate in the Rule Engine runs `simulate` with the Stage's Load Profile and checks the targets. On the Reference Solution view, I can run the simulation to compare it with my own Design. Challenges get a default Load Profile.

**Blocked by:** 18, 15

**Status:** resolved

- [x] "Simulation target met" predicate (latency, overload and error-rate thresholds) in the Rule Engine.
- [x] The Challenge definition supports a default Load Profile and per-Stage simulation targets; Pastebin targets are authored.
- [x] Failing a target produces Hints like any other Rule.
- [x] The Reference Solution view can be simulated.
- [x] Content validation test extended: every Reference Solution meets its own simulation targets.

## Comments

**Done on `main`.**
- **`simulation` predicate** (`src/core/challenges/rules.ts`): `{ type: 'simulation', maxLatencyMs?: { read?, write? }, maxOverloadedNodes?, maxErrorRate? }`. It simulates the Design under its Stage's Load Profile and passes when every target given is met:
  - mean latency per request kind at most `maxLatencyMs`;
  - at most `maxOverloadedNodes` Nodes at ρ ≥ 1 (deferred ones count too);
  - error rate at most `maxErrorRate`, from 0 to 1.
  It also fails when a kind of request the load sends reaches no Node at all, so a Design cannot meet a target by serving nothing.
  - `RuledStage` gains an optional `loadProfile`. `evaluateDesign` simulates at most once per call however many simulation predicates there are, and throws a `RangeError` when a Stage has none.
  - It combines with `all-of`, `any-of` and `not` like the other predicates. Validation refuses a predicate with no target, latencies that are not positive or are for another kind, a non-whole overload count, and an error rate outside 0 to 1.
- **Load Profiles in the Challenge definition** (`src/core/challenges/challenge.ts`):
  - A Challenge now requires a default `loadProfile`: read QPS, write QPS and request bytes, each at least 0, sending some traffic.
  - A design Stage may set its own `loadProfile`, and otherwise takes the Challenge's. After validation, every `DesignStage` has one.
  - The existing check that a Reference Solution passes every Rule of its Stage now covers simulation targets too, so missing one fails the build.
- **Pastebin** (`content/challenges.ts`):
  - **Default Load Profile.** The primer's average: 40 reads, 4 writes a second, 1 KB each.
  - **Scaling Stage Load Profile.** A peak of 1,000 reads and 100 writes a second. That is 25 times the average with the same 10:1 mix; the factor is authored, the primer gives none.
  - **New Rule `peak-load`** (weight 3, three Hint tiers): mean read and write latency ≤ 200 ms, no overloaded Node, no errors. The Stage prompt states the target.
  - **Reference Solution.** The Object Store goes to 3 instances: with 1 it is overloaded at the peak, from the CDN's and the Read API's reads. The Reference now runs at 133 ms read and 66 ms write, its busiest Node (the Read API) at 67%. The high-level design's Reference Solution misses the target, because its single Web Server cannot take 1,100 QPS.
- **UI** (`src/ui/challenge/DesignStageView.tsx`, `src/ui/canvas/SimulationPanel.tsx`):
  - **Open Design Stage.** It gets the Trafik simulyasiyası panel under the canvas, starting from the Stage's Load Profile, with the summary below. This lets the learner find what the `peak-load` Hints point at. Under the canvas, palette drags keep working on a 1000 px tall screen.
  - **Finished Stage.** One Load panel simulates the learner's Design and the Reference Solution side by side, each with its own labelled summary ("Sizin dizaynınızın nəticəsi", "Referans həllin nəticəsi").
  - **Shared hooks.** `useLoadControls` and `useSimulation` now live in `SimulationPanel.tsx`, and the sandbox uses them too. `REQUEST_KINDS` is exported from `simulate.ts`.
- **Tests.**
  - **`rules.test.ts`** (Seam A, hand-computed on one 1,000 QPS web server): passing all targets; latency per kind; overload count; error rate (half dropped at 2,000 QPS); the same Design under two loads; no Node serving a kind sent; combinators; the `RangeError` without a Load Profile.
  - **`challenge.test.ts`:** the default and per-Stage Load Profiles; targets checked under their Stage's load; the build failing when a Reference Solution misses its target; validation problems.
  - **`tests/primer-catalog.test.ts`:**
    - Every Challenge has a default Load Profile, and every Reference Solution meets its simulation targets.
    - Pastebin's loads are as above, and the high-level Reference misses the Scaling target.
    - A scaled design with one Object Store instance misses the target and is offered its Hints like any other failing Rule.
  - **Playwright:**
    - The Scaling Stage reached with the learner's high-level design now has 8 problems, and its Web Server is flagged overloaded at the Stage's load.
    - Given up, the comparison shows the learner's Web Server at 110% overloaded and the Reference Solution with none.
- **Notes.**
  - **Mean, not p50.** Simple mode reports a mean latency per request kind, not a distribution, so targets use the mean ("orta gecikmə"). A p50 target fits the realistic mode later.
  - **Not saved.** The Load Profile typed on a Stage is not saved, like the sandbox's.
