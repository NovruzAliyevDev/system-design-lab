# 23: Skill Tree and mastery

**What to build:** A Skill Tree map shows the whole primer as a graph of topics with prerequisite edges, and each node shows my Mastery. `computeMastery(progress, catalog)` in Core combines four signals per topic:
- Lesson read state;
- quiz results;
- flashcard maturity for the topic's cards;
- related Challenge scores.

The tree is soft-gated. Every node is reachable, but a node whose prerequisites are not yet mastered is marked "recommended later". Clicking a node lists its Lessons, quizzes, cards and Challenges.

**Blocked by:** 10, 11, 15

**Status:** resolved

- [x] Authored prerequisite edges between topics, validated at build time (no cycles, known ids).
- [x] `computeMastery` in Core with documented weights.
- [x] Skill Tree map UI with mastery colouring and "recommended later" state; pan/zoom on desktop, list fallback on mobile.
- [x] Node detail panel linking to all related learning items.
- [x] Seam A tests: mastery from each signal alone and combined; a topic with no Challenge or cards still reaches full mastery from the remaining signals.

## Comments

**Done on `main`.**
- **Topics** (`content/skill-tree.ts`): 21 topics that follow the primer's sections, each a set of Lessons, with Azerbaijani titles. They run from the scalability basics through the trade-offs, each component from DNS inward, estimation and the interview approach, to the design questions, OOD and real world architectures. Only the introduction and the meta sections (Anki, contributing, study guide, credits…) are outside every topic.
- **Validation** (`validateSkillTree` in `src/core/skill-tree/skill-tree.ts`, run by `buildContentCatalog`, output in `catalog.skillTree`). The build fails on:
  - unknown Lesson or prerequisite ids;
  - a Lesson in two topics;
  - duplicate ids;
  - a topic that is its own prerequisite;
  - any cycle of prerequisites, named topic by topic.

  The pin report checks the topics' Lessons too.
- **`computeMastery(progress, catalog)`** (`mastery.ts`). It works from the items `topicItems` lists for each topic, and combines:
  - reading 0.2: the share of the topic's Lessons read;
  - quizzes 0.3: their best scores;
  - flashcards 0.2: card maturity, the interval up to 21 days, 0 while new or learning;
  - Challenges 0.3: the best finished Attempt of each.

  A signal the topic has no items for is left out, and the remaining weights are renormalised. `TopicMastery.weights` reports the shares in use. A topic is mastered from 0.8.
  - **Challenge rule.** A Challenge counts in full (0 until finished) only toward the furthest topics it practises: those that are not a prerequisite of another topic it practises. Toward the topics before them, it counts once finished. Without this rule, 15 topics, foundational ones included, needed Challenge scores to reach 0.8, so the recommended order could not be followed. With it, only "System design sualları" requires Challenges. For that to hold, Security became one of its prerequisites (scaling AWS practises it).
- **Soft gating:** `unmetPrerequisites` lists the direct prerequisites not yet mastered. Any such topic is "recommended later" but stays open.
- **UI** (`/skill-tree`, linked in the header).
  - From the tablet width up: a React Flow map, top to bottom by layer (`skillTreeLayers`), that pans and zooms. Nodes are coloured by Mastery, and recommended-later nodes and unmet prerequisite edges are dashed. Below that width: a list in layer order. Same breakpoint as the Design Canvas.
  - Selecting a topic (`?topic=`) opens its details: Mastery by signal with weights, prerequisites, and links to its Lessons (read state), quizzes (new `#lesson-quiz` anchor), cards per Lesson and Challenges, each with its best score.
- `bestAttemptScore` is now in Core and is used by the Challenges page too.
- **Tests (Seam A).**
  - `skill-tree.test.ts`: validation, layers, topic items and required Challenges.
  - `mastery.test.ts`: each signal alone, combined, full mastery, topics without cards or Challenges reaching 1, the 0.8 threshold, the Challenge rule, and `unmetPrerequisites`.
  - `attempt.test.ts`: `bestAttemptScore`.
  - `pin-change-report.test.ts`: the topics' Lessons.
  - `tests/primer-catalog.test.ts`, against the pinned primer: every system design Lesson in a topic, the tree's first and last layers, every quiz, card and Challenge in some topic, and only the design questions requiring Challenges.
