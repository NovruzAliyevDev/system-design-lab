# 13: Rule Engine and the Pastebin high-level design check

**What to build:** Open the Pastebin Challenge, build its high-level design on the canvas, press "Check", and get scored feedback with tiered Hints.

- `evaluateDesign(challengeStage, design, hintUsage)` in Core evaluates declarative Rules built from a fixed predicate set:
  - node exists (type plus config filter) and count bounds;
  - edge exists between types, or no direct edge between types;
  - path from A to B passes through C;
  - any-of / all-of / not combinators;
  - config value equals or is in a set;
  - edge mode equals.
  Named custom predicates can be registered in code.
- Each Rule has a weight, an Azerbaijani description and three Hint tiers: Socratic question, concrete pointer, full explanation.
- Opening Hint tier k on a Rule caps that Rule's points at weight × (1.0, 0.75, 0.5, 0.25).
- First feedback (level 0) shows only the score and the number of failing Rules.
- The Pastebin Challenge definition (high-level design Stage only) is authored with Rules and a Reference Solution Design that mirrors the primer's diagram. After checking, I can view my Design side by side with the Reference Solution (read-only canvas) and the primer's Solution page.

**Blocked by:** 12

**Status:** resolved

- [x] Rule DSL types and `evaluateDesign` in Core; Rules are serialisable data validated at build time.
- [x] Equivalent designs are accepted via any-of (e.g. reads served by a cache or a read replica).
- [x] Hint tiers open one at a time per Rule; score caps apply; Hint usage is persisted with the Design.
- [x] Level-0 feedback, then per-Rule pass/fail after the Stage is finished.
- [x] Pastebin high-level Stage authored; side-by-side view with the Reference Solution and a link to the Solution page.
- [x] Seam A tests: each predicate type passes and fails; combinators; Hint-tier caps; level-0 content.
- [x] Content validation test: every authored Challenge's Reference Solution scores 100% on its own Rules, and every Rule has all three Hint tiers.
- [x] Playwright smoke: solve the Pastebin high-level Stage by drag and drop and receive a passing score.

## Comments

**Done on `main`.**
- **Rule DSL and engine** (`src/core/challenges/rules.ts`). Rules are serialisable data: `{ id, weight, description, hints (3 tiers), check }`.
  - The predicate set is `node` (selector plus `min`/`max`; `min` defaults to 1, or 0 when `max` is 0), `edge` (optionally carrying `read`/`write`), `no-edge`, `path` (a path from `from` to `to`; with `through`, *every* such path passes a `through` node; optionally only along edges carrying `read`/`write`), `config` (every matching node `equals` a value or is `in` a set, and at least one exists), `edge-mode`, `all-of`, `any-of`, `not` and `custom`.
  - A node selector is a component type, a list of types, or `{ component, config }` with per-field values or value sets. Edges are directional, following request flow.
  - `CUSTOM_PREDICATES` registers named checks in code. The first is `all-connected`: at least two nodes, all joined, whichever way the edges point.
  - `evaluateDesign(stage, design, hintUsage)` returns the score, the max attainable score, the total weight, per-Rule results (pass/fail, Hints opened and available, max points, points) and the failing count.
  - Opening `k` Hint tiers caps a Rule at weight × (1, 0.75, 0.5, 0.25). Invalid Hint usage throws.
  - `openNextHint` opens one tier at a time. `levelZeroFeedback` gives only the score and the failing count. `problemHints` lists the opened tiers per failing Rule without naming it.
- **Challenge definition** (`src/core/challenges/challenge.ts`, authored in `content/challenges.ts`). A Challenge has an id, an Azerbaijani title, a kind (`architecture`), a source, a Solution page, Lessons and Stages. For now the only Stage type is `high-level-design`, with a prompt, Rules, a Reference Solution and an optional `solutionAnchor`.
  - `buildContentCatalog` validates them into `catalog.challenges`. Unknown fields, predicates, component types, config fields or values, bad bounds, traffic or mode, empty combinators, unregistered custom predicates, missing Hint tiers, repeated ids, unknown Lessons, Solution pages or anchors all fail the build. So does a Reference Solution that fails one of its own Rules.
  - The pin change report lists Challenges that practise missing Lessons.
- **Pastebin content.** There are 8 Rules (14 points): an entry point (web server, reverse proxy or load balancer), separate Write/Read APIs, a metadata store, a content store, the write path, the read path, offline analytics and nothing standing apart.
  - Equivalents are accepted with `any-of`: SQL or a key-value store for metadata; an object store or a document store for contents; analytics that pulls stored data, or receives Web Server logs asynchronously.
  - The Reference Solution mirrors `pastebin_basic.png`, laid out left to right.
- **Persistence.** A new `challenges` progress area stores `StageWork` (`{ design, hintUsage, finishedAt? }`) by `stageWorkKey(challengeId, stageId)`. Export moves to schemaVersion 6, and v5 files migrate with no work. Settings can reset the area.
- **UI** (`/challenges/:challengeId`, linked from the Solutions list and the Pastebin Solution page).
  - "Yoxla" shows level-0 feedback: the score, and how many problems remain. Each problem is numbered, not named, and can open its Hint tiers one at a time; the opened Hints are saved.
  - "Mərhələni bitir" (with a confirmation) freezes the Design. It then shows each Rule's result with its points and Hints, the learner's Design beside the read-only Reference Solution, and a link to the Solution page's high-level design section.
  - Below `md` the canvas is read-only, as in the sandbox.
- **Tests.**
  - Seam A covers every predicate passing and failing, the combinators, cache-or-replica equivalence, the Hint caps at each tier, opening Hints, the problem Hints, level-0 content and invalid Hint usage.
  - It also covers Challenge validation (every problem above), the v5 migration and invalid Stage work on import.
  - A content test checks that every Reference Solution scores 100% and every Rule has three Hint tiers, and that Pastebin accepts the store and analytics alternatives.
  - A Playwright smoke test solves the Stage by drag and drop, gets 14/14, finishes, and sees the comparison after a reload.
- **Left for later tickets.**
  - Retrying a finished Stage (with Attempts) is ticket 15. Until then, only Settings can reset the work.
  - So are the Challenge list, search and the other Stages.
  - The comparison links to the primer's diagram rather than embedding it.
  - Problem numbers follow the Rules still failing, so they can shift between checks.
