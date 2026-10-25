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

**Status:** ready-for-agent

- [ ] Rule DSL types and `evaluateDesign` in Core; Rules are serialisable data validated at build time.
- [ ] Equivalent designs are accepted via any-of (e.g. reads served by a cache or a read replica).
- [ ] Hint tiers open one at a time per Rule; score caps apply; Hint usage is persisted with the Design.
- [ ] Level-0 feedback, then per-Rule pass/fail after the Stage is finished.
- [ ] Pastebin high-level Stage authored; side-by-side view with the Reference Solution and a link to the Solution page.
- [ ] Seam A tests: each predicate type passes and fails; combinators; Hint-tier caps; level-0 content.
- [ ] Content validation test: every authored Challenge's Reference Solution scores 100% on its own Rules, and every Rule has all three Hint tiers.
- [ ] Playwright smoke: solve the Pastebin high-level Stage by drag and drop and receive a passing score.
