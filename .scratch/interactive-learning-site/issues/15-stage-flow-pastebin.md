# 15: Stage-by-stage Challenge flow for Pastebin

**What to build:** Solve Pastebin the way an interview runs, in five Stages:
1. **Requirements:** a checklist of candidate use cases and constraints, including distractors, plus free-text notes.
2. **Estimation:** I enter QPS, storage per year and bandwidth. `estimate` / `gradeEstimate` in Core accept answers within a factor of 2 of the reference, then show the worked calculation.
3. **High-level design:** the canvas, from ticket 13.
4. **Deep dive:** trade-off questions with explanations.
5. **Scaling:** I continue from my own high-level Design and evolve it against Scaling Rules. Simulation targets come in ticket 19.

The Reference Solution of each Stage stays hidden until I finish or give up on that Stage. The Stage scores combine into a Challenge score using per-Stage weights from the Challenge definition. Every run is saved as an Attempt, and I can see the history and retry from scratch or from my last Attempt. Challenges get a list page, and are added to search.

**Blocked by:** 13

**Status:** resolved

- [x] The Challenge definition format covers all five Stages; the Pastebin definition is completed.
- [x] Requirements checklist with distractors is graded; notes are saved.
- [x] `estimate` (unit-aware, powers of two) and `gradeEstimate` live in Core; the worked solution is revealed after the Stage.
- [x] Deep-dive trade-off questions with explanations.
- [x] The Scaling Stage starts from my high-level Design and is checked against Scaling Rules.
- [x] The Challenge score uses the per-Stage weights.
- [x] Attempts are persisted (per-Stage inputs, Evaluations, Hint usage, timestamps); there is a history view and retry (fresh or from last).
- [x] Challenge list page; Challenges are added to global search.
- [x] Seam A tests: `estimate` against worked numbers from the primer's Pastebin solution; `gradeEstimate` tolerance edges; Challenge score weighting.

## Comments

**Done on `main`.**
- **Challenge format** (`src/core/challenges/challenge.ts`). A Challenge lists its Stages in interview order, each type at most once: `requirements`, `estimation`, `high-level-design`, `deep-dive`, `scaling`. A Scaling Stage needs a high-level design before it. Every Stage has a prompt, a `weight` and an optional `solutionAnchor`.
  - Requirements: items with a section (`use-case` / `constraint`), `correct` (a distractor unless marked) and an explanation. At least one of each kind.
  - Estimation: the primer's assumptions as `inputs`, an authored `explanation`, and questions naming a quantity. The catalog computes each question's `referenceValue` with `estimate`, so a reference and its worked solution can never disagree.
  - Deep dive: multiple-choice or multi-select quiz questions (the quiz validator is reused), every option explained.
  - Scaling: Rules and a Reference Solution, validated like the high-level design.
- **Estimation** (`src/core/estimation/estimate.ts`). `estimate(inputs)` gives write/read QPS (and at peak), storage per month/year/total and write/read bandwidth, each with the step that computes it. `workedSteps` gives the chain behind one quantity.
  - Units follow the primer's powers of two table, taking 2^10 as a thousand as the primer does; a content test checks them against the table. A month is the primer's 2.5 million seconds.
  - `gradeEstimate(user, reference)` passes from half to twice the reference, both edges included; zero, negative and non-finite values fail.
- **Attempts** (`src/core/challenges/attempt.ts`). An Attempt stores its mode (`practice`), start time, per-Stage input (checklist picks and notes, estimates in base units, Designs with Hint usage, deep-dive answers) and, once a Stage is over, its outcome: finish time, whether the learner gave up, the score (0 when given up) and, for a design Stage, the Evaluation.
  - Stages open one at a time. The Scaling Stage starts from the Attempt's high-level Design.
  - The last Stage over finishes the Attempt with its Challenge score: the Stage scores weighted by the Stage weights.
  - A retry starts fresh, or from the last Attempt's inputs and opened Hints, with every Stage open again.
- **Persistence.** The `challenges` area is `{ attempts: { [challengeId]: Attempt[] } }`, oldest first, the last one current. Export moves to schemaVersion 8. A v7 high-level design becomes an Attempt in progress, unfinished again because Stages now come before it; this happens on import, and for work the browser stored before, when it is read.
- **Pastebin content.**
  - 19 requirement items, from the primer's use cases, out-of-scope list and constraints, plus distractors.
  - 5 estimation questions: 4 writes/s, 40 reads/s, 152.5 GB a year, ~457.6 GB in 3 years, 40 KB/s read bandwidth.
  - 7 deep-dive questions: SQL or key-value, where contents live, shortlink generation, 62^7, analytics, expiry, cache strategy.
  - 9 Scaling Rules (load balancer, scale-out, memory cache, read replicas, paths through the APIs, CDN, DNS, analytics warehouse, all connected), with a Reference Solution mirroring `pastebin.png`. Weights: 1, 1, 3, 2, 3.
- **UI.**
  - `/challenges` lists Challenges with Attempt count and best score (linked from the header).
  - `/challenges/:id` has a Stage stepper, one view per Stage type, finish and give-up buttons with confirmation, each Stage's results once it is over, the Attempt summary, and the history of Attempts. Earlier Attempts open read-only (`?attempt=N`).
  - The Solution page link shows once the Attempt is finished, since that page gives every Stage away.
  - Search finds Challenges by title and Stage tasks.
- **Tests.**
  - Seam A: `estimate` against the primer's Pastebin numbers; `gradeEstimate` at its edges; Challenge score weighting; Stage scoring; the Attempt lifecycle and retries; `readAttempt`; validation of every Stage type; v7 migration of files and stored areas; Challenge search.
  - Content tests: every Estimation question has a reference value and worked solution; units match the appendix; Pastebin's five Stages; a primary with replicas is accepted in place of a replica node.
  - Playwright: the high-level design smoke now reaches its Stage by giving up the first two and checks that Scaling starts from that Design. A new smoke runs every Stage type, the score, a retry from the last Attempt, the history and search.
- **Left for later tickets.**
  - Simulation targets for Scaling are ticket 19, Mock Interview mode is 17, and the standalone calculators that reuse `estimate` are 16.
  - A retry from the last Attempt copies its Scaling Design too, rather than rebuilding it from the new high-level Design.
