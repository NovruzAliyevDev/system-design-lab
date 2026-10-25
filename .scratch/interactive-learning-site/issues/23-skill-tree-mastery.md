# 23: Skill Tree and mastery

**What to build:** A Skill Tree map shows the whole primer as a graph of topics with prerequisite edges, and each node shows my Mastery. `computeMastery(progress, catalog)` in Core combines four signals per topic:
- Lesson read state;
- quiz results;
- flashcard maturity for the topic's cards;
- related Challenge scores.

The tree is soft-gated. Every node is reachable, but a node whose prerequisites are not yet mastered is marked "recommended later". Clicking a node lists its Lessons, quizzes, cards and Challenges.

**Blocked by:** 10, 11, 15

**Status:** ready-for-agent

- [ ] Authored prerequisite edges between topics, validated at build time (no cycles, known ids).
- [ ] `computeMastery` in Core with documented weights.
- [ ] Skill Tree map UI with mastery colouring and "recommended later" state; pan/zoom on desktop, list fallback on mobile.
- [ ] Node detail panel linking to all related learning items.
- [ ] Seam A tests: mastery from each signal alone and combined; a topic with no Challenge or cards still reaches full mastery from the remaining signals.
