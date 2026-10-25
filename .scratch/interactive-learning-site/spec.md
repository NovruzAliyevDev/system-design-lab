# Spec: Interactive System Design Learning Site

Status: ready-for-agent

## Problem Statement

I want to learn system design properly, and [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer) is the best free source for it. But it is one very long README, a set of solution write-ups, Python files and three Anki decks. Reading it is passive. Nothing checks whether I understood a topic. Nothing lets me practise a design question the way I would in an interview: sketching components, choosing trade-offs, estimating load and seeing whether my design survives. The solution write-ups give the answer away immediately. Estimation numbers stay abstract. And there is no sense of progress across the whole primer, so I lose track of what I have covered and what I have forgotten.

## Solution

A web app (UI in Azerbaijani, source content kept in English) that turns the whole primer into an interactive course:

- Every topic of the primer is readable inside the app. The text comes straight from a pinned commit of the repo, with search, glossary tooltips and attribution.
- Interactive blocks are authored separately and attached to topics: quizzes, calculators and concept simulations.
- Every system design question in the primer becomes a **Challenge**. I solve it stage by stage:
  - requirements: a checklist;
  - estimation: a calculator, with my numbers checked;
  - high-level design and scaling: a drag-and-drop **Design Canvas**;
  - deep dive: trade-off questions.
- My design is checked automatically against **Rules**, with tiered Socratic **Hints**, and then compared side by side with the **Reference Solution**.
- I can run a **Traffic Simulation** on my own design (e.g. "send 10k QPS") and watch bottlenecks light up. A **Chaos Scenario** breaks part of the system and asks me to recover.
- Object-oriented design questions are solved on a **UML Class Builder** using the same checking engine.
- The primer's Anki decks become in-app **Flashcards** with spaced repetition and a daily review.
- A **Skill Tree** shows the whole primer as a map of topics with mastery. A **Mock Interview** mode adds a timer and a self-assessment rubric. A streak keeps me coming back.
- All progress is stored in the browser and can be exported/imported as JSON.
- The site is static and deployable to GitHub Pages, built so it can later become public.

## User Stories

### Reading and navigation

1. As a learner, I want every section of the primer's README available as a separate Lesson, so that I can study one topic at a time instead of scrolling one huge page.
2. As a learner, I want Lessons grouped by the primer's own structure (performance vs scalability, latency vs throughput, CAP, DNS, CDN, load balancer, reverse proxy, application layer, database, cache, asynchronism, communication, security, appendix), so that the order matches the original study guide.
3. As a learner, I want a sidebar table of contents with my read/unread state per Lesson, so that I can see what I have covered.
4. As a learner, I want "previous / next Lesson" navigation, so that I can read the primer linearly.
5. As a learner, I want the primer's images and diagrams shown inside Lessons, so that nothing from the original is lost.
6. As a learner, I want internal links in the primer (anchors like "see Cache") to go to the matching Lesson in the app, so that cross-references keep working.
7. As a learner, I want external links to open in a new tab, so that I do not lose my place.
8. As a learner, I want each Lesson to show a link to the exact source section on GitHub at the pinned commit and a CC BY 4.0 attribution, so that the original author is credited.
9. As a learner, I want to mark a Lesson as read (and have it marked automatically after I scroll to the end), so that progress tracking does not require effort.
10. As a learner, I want the solution write-ups of the eight system design questions available as readable pages, so that I can read them after (not before) attempting a Challenge.
11. As a learner, I want the primer's study guide (short / medium / long timelines) available as a suggested path, so that I can follow a plan that matches my time.
12. As a learner, I want the appendix tables (powers of two, latency numbers every programmer should know) rendered as interactive tables, so that I can sort, filter and reference them from calculators.

### Search and glossary

13. As a learner, I want a global search (keyboard shortcut) over Lessons, Glossary Terms and Challenges, so that I can jump to any topic instantly.
14. As a learner, I want search results to show the matching snippet and its Lesson, so that I can pick the right result.
15. As a learner, I want technical terms in Lesson text (e.g. sharding, write-through, quorum) to show a Glossary tooltip with a short Azerbaijani explanation on hover/tap, so that I understand terms without leaving the page.
16. As a learner, I want each Glossary Term to keep its English name with the Azerbaijani explanation, so that I learn the vocabulary used in real interviews.
17. As a learner, I want a Glossary page listing all terms with links to the Lessons that use them, so that I can review vocabulary on its own.

### Flashcards and spaced repetition

18. As a learner, I want the three Anki decks from the primer (System Design, System Design Exercises, OO Design) available as in-app Flashcard Decks, so that I do not need Anki.
19. As a learner, I want the card front in English and the back showing the English answer plus a short Azerbaijani explanation (when one has been authored), so that I learn both the concept and the terminology.
20. As a learner, I want to grade each card (again / hard / good / easy), so that the scheduler can adapt to my memory.
21. As a learner, I want a daily review queue ("today: 15 cards") combining due cards and a capped number of new cards, so that I build a consistent habit.
22. As a learner, I want to configure the daily new-card limit, so that I can control my workload.
23. As a learner, I want to study a single Deck or only the cards linked to a specific topic, so that I can focus before an interview.
24. As a learner, I want cards linked to Lessons, so that from a card I can open the Lesson it comes from.
25. As a learner, I want to see per-Deck statistics (new, learning, mature, due), so that I know how well I retain the material.
26. As a learner, I want the flashcard review to work comfortably on my phone, so that I can review during short breaks.

### Quizzes

27. As a learner, I want short quizzes at the end of Lessons (multiple choice, multi-select, ordering, "which component fits"), so that I can check understanding right after reading.
28. As a learner, I want quiz feedback with an Azerbaijani explanation for each option, so that wrong answers teach me something.
29. As a learner, I want quiz results to count toward the topic's mastery, so that the Skill Tree reflects real understanding, not just reading.

### Challenges: stage-by-stage solving

30. As a learner, I want a Challenge list with all eight primer system design questions (Pastebin/Bit.ly, Twitter timeline & search, web crawler, Mint.com, social network data structures, key-value store for a search engine (query cache), Amazon sales rank, scaling to millions of users on AWS), so that I can practise each one.
31. As a learner, I want each Challenge split into Stages (Requirements & use cases, Estimation, High-level design, Deep dive, Scaling), following the primer's own "how to approach a system design interview question" method, so that I practise the interview structure.
32. As a learner, I want the Reference Solution hidden until I finish a Stage (or explicitly give up on it), so that I am not spoiled.
33. As a learner, in the Requirements Stage, I want to pick the relevant use cases and constraints from a checklist that includes distractors, so that I practise scoping.
34. As a learner, in the Requirements Stage, I want to write free-text notes alongside the checklist, so that I can capture my own thoughts.
35. As a learner, in the Estimation Stage, I want to enter my own numbers (QPS, storage per year, bandwidth) with the calculator available, so that I practise back-of-the-envelope maths.
36. As a learner, I want my estimates accepted when within a tolerance of the reference (order-of-magnitude correctness), so that I am not penalised for rounding.
37. As a learner, I want to see the reference calculation step by step after the Estimation Stage, so that I learn the method, not just the result.
38. As a learner, in the High-level design Stage, I want to build my design on the Design Canvas, so that I practise drawing architecture.
39. As a learner, in the Deep dive Stage, I want trade-off questions (e.g. SQL vs NoSQL for this use case, cache-aside vs write-through), so that I practise justifying decisions.
40. As a learner, in the Scaling Stage, I want to continue from my own high-level design and evolve it to meet a target load, so that I practise iterating on a design.
41. As a learner, I want my Stage results combined into a Challenge score, so that I can track improvement over attempts.
42. As a learner, I want each Challenge to keep the history of my Attempts (designs, scores, date), so that I can compare against my previous tries.
43. As a learner, I want to retry a Challenge from scratch or from my last Attempt, so that I can practise repeatedly.

### Design Canvas

44. As a learner, I want a Component Palette (client, DNS, CDN, load balancer, reverse proxy / API gateway, web server, application service, cache, SQL database, NoSQL store (key-value, document, wide-column, graph), object store, message queue, task queue / worker, search index, analytics / MapReduce, data warehouse), so that I can build any design from the primer.
45. As a learner, I want to drag components from the palette onto the canvas, so that building a design feels direct.
46. As a learner, I want to connect components with edges and mark each edge as synchronous or asynchronous and as read, write or both, so that data flow is explicit.
47. As a learner, I want to configure a component (e.g. database: SQL/NoSQL, primary/replica, replica count, shard key; cache: cache-aside / write-through / write-behind / refresh-ahead, eviction; load balancer: L4/L7, round robin / least connections / hashing; instance count), so that my design expresses the decisions the primer teaches.
48. As a learner, I want to rename components and add notes to them, so that my design is readable.
49. As a learner, I want undo/redo, multi-select, delete, copy/paste and auto-layout on the canvas, so that editing is comfortable.
50. As a learner, I want to group components into a zone/region box, so that I can express multi-region or availability-zone designs.
51. As a learner, I want to export my design as PNG, so that I can keep or share it.
52. As a learner, I want an optional hand-drawn (sketch) rendering style for nodes and edges, so that the canvas feels like a whiteboard.
53. As a learner, I want my canvas auto-saved, so that I never lose work.
54. As a learner, I want to see a tooltip with the Glossary explanation of each palette component, so that I remember what each part does.

### Checking, hints and reference comparison

55. As a learner, I want a "Check" button that evaluates my design against the Challenge's Rules, so that I get immediate feedback.
56. As a learner, I want the first feedback level to show only my current score and how many problems remain, so that I try to find them myself first.
57. As a learner, I want to open Hints per problem in tiers (Socratic question → concrete pointer → full explanation), so that I get only as much help as I need.
58. As a learner, I want each opened Hint tier to reduce the maximum points I can earn for that Rule, so that using hints has a cost and scores stay meaningful.
59. As a learner, I want Rules to recognise equivalent designs (e.g. "reads served from cache or read replica" accepts either), so that I am not punished for a valid alternative.
60. As a learner, I want to see which Rules pass and which fail after I finish a Stage, so that I understand my score.
61. As a learner, I want to view my design and the Reference Solution side by side, with the primer's original diagram and explanation, so that I can compare decisions.
62. As a learner, I want to load the Reference Solution onto the canvas as a separate read-only view, so that I can inspect it and run the simulation on it.

### Traffic Simulation and Chaos

63. As a learner, I want to define a Load Profile (read QPS, write QPS, data size, read/write mix) or use the Challenge's default, so that I can test my design under realistic load.
64. As a learner, I want to run a Traffic Simulation on my own design and see animated request flow along the edges, so that I understand how traffic moves through the system.
65. As a learner, I want each node to show utilisation, latency and cost, and to turn red when overloaded, so that I can spot bottlenecks.
66. As a learner, I want a summary of end-to-end latency, error rate (dropped requests), and monthly cost, so that I can judge my design overall.
67. As a learner, I want a load slider (e.g. 100 → 100k QPS) to see at which point my design breaks, so that I understand its limits.
68. As a learner, I want component capacities and latencies based on the primer's latency numbers, with values visible in the component's config, so that the simulation is explainable.
69. As a learner, I want the Scaling Stage to set a target (e.g. "handle 20k read QPS with p50 < 200 ms and no overloaded node"), checked by running the simulation, so that scaling is verified, not just drawn.
70. As a learner, I want Chaos Scenarios (a node goes down, a whole zone goes down, the cache is flushed/cold, a network partition between two nodes), so that I learn availability and failover.
71. As a learner, I want Chaos tasks inside Challenges ("the primary database failed — keep the read path working"), checked by simulation, so that I practise recovery design.
72. As a learner, I want a free sandbox canvas (no Challenge), so that I can experiment with any architecture and simulate it.
73. As a learner, I want a "realistic" simulation mode (queueing model with p99 latency and randomness) as an option later, so that I can go deeper once I understand the simple model.

### Concept simulations

74. As a learner, I want an interactive load balancer simulation comparing round robin, least connections and hashing, so that I see how distribution differs.
75. As a learner, I want an interactive cache simulation (hit/miss, eviction policies, cache-aside vs write-through vs write-behind), so that caching strategies become concrete.
76. As a learner, I want an interactive replication simulation (primary-replica and primary-primary, replication lag, failover), so that I understand consistency trade-offs.
77. As a learner, I want an interactive CAP/partition simulation where I cut the network and choose CP or AP behaviour, so that the CAP theorem becomes tangible.
78. As a learner, I want an interactive consistent hashing simulation (add/remove nodes, see key redistribution), so that I understand sharding.
79. As a learner, I want concept simulations embedded in the matching Lessons, so that I can play with a concept right where I read about it.

### Calculators

80. As a learner, I want a back-of-the-envelope calculator (users → requests/day → QPS, peak factor, object size → storage/year, bandwidth), so that I can practise estimation.
81. As a learner, I want unit-aware results (KB/MB/GB/TB/PB, per second/month/year) using powers of two, so that numbers stay readable.
82. As a learner, I want a latency comparison tool built on the latency numbers table (e.g. "how many disk seeks fit in a cross-continent round trip?"), so that I build intuition.

### UML Class Builder (object-oriented design)

83. As a learner, I want the six OOD questions from the primer (hash map, LRU cache, call center, deck of cards, parking lot, online chat) as Challenges, so that I practise OOD too.
84. As a learner, I want to add classes (with fields and methods, and abstract/interface flags) on a UML canvas, so that I can model a solution.
85. As a learner, I want to draw relationships (inheritance, implementation, composition, aggregation, association) with multiplicity, so that my model is complete.
86. As a learner, I want my UML model checked by Rules with the same tiered Hints, so that OOD practice works like system design practice.
87. As a learner, I want to see the primer's Python reference solution next to the reference UML, so that I connect the model to code.

### Learning path, motivation and mock interviews

88. As a learner, I want a Skill Tree map of all topics with prerequisite edges, so that I see the big picture and a recommended order.
89. As a learner, I want each Skill Tree node to show my mastery (from Lesson read state, quiz results, flashcard maturity and related Challenge scores), so that I know where I am weak.
90. As a learner, I want nodes whose prerequisites I have not mastered marked as "recommended later", but still open, so that I am guided but never blocked.
91. As a learner, I want a daily streak (a day counts when I finish the daily review or reach a minimum learning activity), so that I stay consistent.
92. As a learner, I want a dashboard with today's review, streak, recently studied Lessons, and suggested next step, so that I always know what to do.
93. As a learner, I want a Mock Interview mode on any Challenge with a 45-minute timer (configurable) and a time box per Stage, so that I practise under interview conditions.
94. As a learner, I want hints disabled during a Mock Interview, so that the practice is realistic.
95. As a learner, I want a self-assessment rubric at the end of a Mock Interview (communication, scoping, estimation, design, trade-offs, scaling) next to the automatic scores, so that I reflect on my performance.
96. As a learner, I want Mock Interview results saved as Attempts, so that I can see improvement over time.

### More questions

97. As a learner, I want additional authored Challenges beyond the primer (URL shortener, rate limiter, chat system, news feed, video streaming, ride sharing, notification system, distributed ID generator, search autocomplete), in the same format with Rules, Hints and a Reference Solution, so that I have more practice material.
98. As a learner, I want authored Challenges clearly marked as "not from the primer", so that I know their source.

### Progress, settings and devices

99. As a learner, I want all my progress (read state, quiz results, flashcard schedule, Attempts, canvas drafts, streak, settings) saved in my browser automatically, so that I can close the tab at any time.
100. As a learner, I want to export all progress as a single JSON file and import it on another computer, so that I can back up or move my progress.
101. As a learner, I want importing to validate the file, upgrade older export versions, and back up my current progress before replacing it, so that I cannot lose data by mistake.
102. As a learner, I want to reset progress (all, or per area) with a confirmation, so that I can start over.
103. As a learner, I want a dark theme by default with a light theme toggle, so that long study sessions are comfortable.
104. As a learner, I want reading, flashcards and quizzes to be fully usable on mobile, so that I can study anywhere.
105. As a learner, I want the canvas, UML builder and simulations to show a "best on desktop" notice and a read-only view on small screens, so that the mobile experience is honest.
106. As a learner, I want the whole UI (menus, buttons, hints, explanations) in Azerbaijani while the primer content stays in English, so that I learn in my language without losing original terminology.
107. As a learner, I want keyboard shortcuts (search, next/previous Lesson, flashcard grading, canvas undo/redo/delete), so that I can work quickly.
108. As a learner, I want the site to load fast and work offline after the first visit, so that I can study without a connection.

### Maintainer (me, later)

109. As the maintainer, I want to update the pinned primer commit and rebuild, with a report of added/removed/changed sections, so that I can keep the content current deliberately.
110. As the maintainer, I want Challenges, Rules, Hints, Quizzes, Glossary Terms and card explanations authored as typed data files validated at build time, so that content mistakes fail the build instead of showing up in the UI.
111. As the maintainer, I want the site deployed to GitHub Pages from the main branch, so that publishing is automatic.
112. As the maintainer, I want the storage layer behind one interface, so that cloud sync can be added later without touching features.

## Implementation Decisions

### Stack and architecture

- Static single-page app: React + TypeScript + Vite. No backend.
- Canvas and UML builder use React Flow. Sketch rendering style uses Rough.js.
- State: Zustand for UI state. Persistence: IndexedDB through Dexie.
- Styling: Tailwind, with dark theme default and a light toggle.
- Client-side full-text search, with an index built at build time (e.g. MiniSearch).
- Routing works under the GitHub Pages base path with an SPA fallback.
- Offline support through a service worker (PWA) caching the built site.
- The UI string catalog is Azerbaijani. All UI text goes through one i18n layer, so that a second UI language can be added later. Primer content is rendered untranslated.
- Code is organised in three layers:
  1. **Content Pipeline** (build time, Node) → produces static JSON artefacts.
  2. **Core** (pure TypeScript, no React, no browser APIs) → all domain logic.
  3. **UI** (React) → a thin layer that renders Core outputs and calls Core functions.

### Content Pipeline (build time)

- The primer is a git submodule pinned to a specific commit. Updating content means moving the pin.
- The README is split into **Lessons** along its H2/H3 headings. Each Lesson keeps:
  - a stable id derived from the heading anchor;
  - its parent group;
  - its order;
  - its source URL at the pinned commit.
- Images are copied and their paths rewritten. In-document anchors are rewritten to app routes.
- Solution READMEs become **Solution pages** attached to their Challenge. OOD Python solutions are rendered as code.
- Appendix tables (powers of two, latency numbers) are extracted into structured data used by calculators and simulation defaults.
- The three `.apkg` decks (zipped SQLite) are converted at build time into Flashcard JSON. HTML in card fields is sanitised.
- Authored content is loaded and validated against schemas; validation errors fail the build. Authored content includes:
  - Challenges, Rules, Hints and Reference Solutions;
  - Quizzes and Glossary Terms;
  - Azerbaijani card explanations;
  - Skill Tree prerequisite edges;
  - Concept-simulation embeds.
- Every authored item that references a Lesson must reference an existing Lesson id. A missing reference fails the build.
- The pipeline emits a change report when the pin moves: sections added, removed and renamed.

### Core modules and their public interfaces

All Core functions are deterministic. Time (`now`) and randomness (seed) are passed in, never read globally.

- **Content Catalog**: `buildContentCatalog(sourceMarkdown, authoredContent) → Catalog`. Returns Lessons, groups, Glossary Terms, Challenges, Decks and the Skill Tree graph. Used by the pipeline; its output is what the UI loads.
- **Design model** (shared by Canvas, UML builder, Rules and Simulation):
  - A **Design** is a graph of **Nodes** and **Edges**.
  - A Node has a `componentType`, a typed `config` (per component type), a label, an optional zone id and a position. Position is not used by Rules or Simulation.
  - An Edge has source, target, `mode` (sync | async) and `traffic` (read | write | both).
  - A UML Design uses the same graph shape: class Nodes carry fields, methods and abstract/interface flags; Edges carry the relation kind and multiplicity.
  - Each component type defines default capacity (QPS per instance), base latency, monthly cost per instance and its config schema. Defaults are derived from the primer's latency numbers.
- **Rule Engine**: `evaluateDesign(challengeStage, design, hintUsage) → Evaluation`.
  - Rules are declarative, serialisable data built from a fixed set of predicates:
    - node exists (type plus config filter) and count bounds;
    - edge exists between types, or no direct edge between types;
    - path from A to B passes through C;
    - any-of / all-of / not combinators;
    - config value equals or is in a set;
    - edge mode equals;
    - simulation target met (see below).
  - A small set of named custom predicates may be registered in code for cases the DSL cannot express.
  - Each Rule has an id, weight, Azerbaijani description and three Hint tiers (Socratic question, concrete pointer, full explanation).
  - Scoring: opening Hint tier k on a Rule caps that Rule's attainable points at weight × (1.0, 0.75, 0.5, 0.25) for k = 0..3.
  - The returned `Evaluation` contains: score, max attainable score, per-Rule pass/fail, the failing-Rule count, and the Hint tiers available.
  - Feedback level 0 shows only the score and the count of failing Rules.
- **Simulation Engine**: `simulate(design, loadProfile, scenario?, mode = "simple") → SimulationResult`.
  - Simple mode:
    - Traffic enters at client nodes and is routed along edges by node semantics:
      - a load balancer splits across downstream nodes by its algorithm;
      - a cache forwards misses (1 − hit ratio) downstream;
      - reads may go to replicas, writes go to the primary;
      - a queue converts synchronous load into deferred work at the consumer.
    - Utilisation ρ = load / (capacity × instances). Node latency = base latency × 1/(1 − ρ), capped. ρ ≥ 1 means the node is overloaded, and the excess load is reported as dropped.
  - The result reports:
    - per-node load, utilisation, latency, cost and an overloaded flag;
    - end-to-end latency per request path;
    - error rate and total monthly cost;
    - a ranked list of bottlenecks.
  - Rules can reference "simulation target met" so that the Scaling Stage and Chaos tasks are checked through this engine.
  - Realistic mode (M/M/c queueing, seeded randomness, p99) comes later, behind the same signature.
  - **Chaos Scenario** is data: nodes down, zone down, cache cold, partition between node sets. It is applied before routing.
- **Estimation**: `estimate(inputs) → EstimationResult`, with unit-aware outputs. Separately, `gradeEstimate(userValue, referenceValue) → pass/fail`, which accepts values within a factor of 2 of the reference.
- **Review Scheduler**: `scheduleReview(cardState, grade, now) → cardState`. Uses an SM-2-style algorithm with grades again/hard/good/easy. `buildDailyQueue(cardStates, settings, now)` returns due cards plus capped new cards.
- **Mastery and streak**:
  - `computeMastery(progress, catalog) → per-topic mastery`, a weighted mix of read state, quiz results, flashcard maturity and Challenge scores.
  - `computeStreak(activityLog, now, timezone)`.
- **Progress**:
  - A `ProgressRepository` interface (get/put per area, plus `exportAll`/`importAll`). It has a Dexie implementation in the UI layer and an in-memory implementation for tests.
  - The export format is versioned JSON with `schemaVersion`. `migrateProgress(data) → latest` upgrades older exports.
  - Import validates the file, backs up the current progress automatically, then replaces it.

### Challenge content format

- One authored definition per Challenge, containing:
  - kind (architecture | ood);
  - source (primer | authored);
  - links to its Solution page and Lessons;
  - the default Load Profile;
  - and per Stage:
    - Requirements: candidate items with correct/distractor flags;
    - Estimation: questions with reference values and a worked solution;
    - High-level design and Scaling: Rules, a Reference Solution Design, and optional simulation targets and Chaos tasks;
    - Deep dive: trade-off questions with explanations.
- Reference Solution Designs are authored to mirror the primer's diagrams for that question.
- The Challenge score combines Stage scores with fixed per-Stage weights stored in the Challenge definition.
- An **Attempt** stores:
  - the Challenge id and a timestamp;
  - the mode (practice | mock interview);
  - per-Stage inputs (checklist answers, estimates, Designs, notes);
  - Evaluations and Hint usage;
  - for mock interviews, the self-assessment rubric.

### UI decisions

- Dashboard as home page: today's review, streak, continue-where-you-left-off, suggested next Skill Tree node.
- Hints are disabled during a Mock Interview. Stage time boxes are shown but do not block progress.
- Canvas pages are desktop-first. Below the tablet breakpoint they render read-only with a notice.
- The Skill Tree is soft-gated: everything is reachable, and unmet prerequisites are shown as "recommended later".
- Glossary tooltips link only the first occurrence of each term per Lesson section.

### Delivery milestones (to be sliced into tickets)

- **M0** Project skeleton, Content Pipeline, Lesson reader, navigation, search, Glossary tooltips, progress storage with export/import, deploy to GitHub Pages.
- **M1** Flashcards, spaced repetition, daily review.
- **M2** Design Canvas with configurable components, Rule Engine and tiered Hints. Delivered first for Pastebin end to end, then the remaining seven primer Challenges.
- **M3** Stage-by-stage Challenge flow, Estimation calculator and grading, Mock Interview mode, quizzes.
- **M4** Skill Tree, mastery, streak, dashboard.
- **M5** Traffic Simulation on the canvas, simulation-target Rules, Chaos Scenarios.
- **M6** Concept simulations (load balancer, cache, replication, CAP, consistent hashing).
- **M7** UML Class Builder and the six OOD Challenges.
- **M8** Additional authored Challenges.
- Realistic simulation mode is a late ticket after M5/M6.

## Testing Decisions

- **What makes a good test here.** Tests exercise external behaviour through a public interface only. Inputs go in (a Design, a Load Profile, a card state and a clock) and observable outputs are asserted (scores, failing Rule ids, node metrics, next due date). Tests never assert on internal helper functions, React component internals or store shape. Time and randomness are always injected, so every test is deterministic.
- **Seam A: the Core public API (primary seam, Vitest).**
  - `evaluateDesign`: passing and failing Designs per predicate type, equivalent-design acceptance, Hint-tier score caps, and level-0 feedback content.
  - `simulate`: small hand-computed graphs (single server under/over capacity, load balancer split, cache hit ratio reducing database load, replica read routing, queue deferral), plus each Chaos Scenario type.
  - `estimate` / `gradeEstimate`: worked examples taken from the primer's solutions, and tolerance edges.
  - `scheduleReview` / `buildDailyQueue`: grade sequences against expected intervals with a fixed clock, and new-card caps.
  - `computeMastery`, `computeStreak`: boundary days, timezone midnight, a missed day.
  - `ProgressRepository` (in-memory): export → import round trip is lossless; migration from each older `schemaVersion`; invalid files are rejected without changing state.
  - `buildContentCatalog`: against the pinned primer commit, the catalog contains the expected Lesson list (a snapshot of Lesson ids/titles), every internal anchor resolves, and every authored reference resolves.
  - **Content validation tests** (also through Seam A): for every Challenge, the Reference Solution Design scores 100% on its own Rules and meets its own simulation targets; every Rule has all three Hint tiers; every Estimation question has a reference value and a worked solution.
- **Seam B: browser end-to-end smoke tests (Playwright, few).**
  - Open a Lesson and use search to jump to another.
  - Complete a flashcard daily review.
  - Solve the Pastebin high-level Stage by drag-and-drop and receive a passing score.
  - Export progress, reset, import, and see progress restored.
  - Run a Traffic Simulation and see an overloaded node flagged.
- **Not tested.** No React component unit tests: UI is a thin layer over Core, and Seam B covers wiring.
- **Prior art.** None yet; the repo is new. The first Seam A tests written in M0 (catalog and progress round trip) set the pattern for later ones.
- **Running tests.** When implementing a ticket, run only the tests written or changed for that ticket, not the whole suite, unless explicitly asked.

## Out of Scope

- User accounts, login and cloud sync of progress. These are prepared for by the `ProgressRepository` interface but not built.
- AI-based (LLM) review of designs.
- User-authored Challenges or Rules from inside the app.
- Full Azerbaijani translation of the primer content. Only the UI and authored explanations are in Azerbaijani.
- Badges, leaderboards and social features (only streak and progress are in scope).
- Translations of the primer other than the English README (ja, zh-Hans, zh-TW).
- Editing the primer content itself, or contributing changes upstream.
- Native mobile apps. Canvas editing on phones (read-only view only).

## Further Notes

- **License.** The primer is CC BY 4.0, so attribution is required on every page that shows primer content, with a link to the source at the pinned commit. Primer images are reused under the same license.
- **Primer contents to cover:**
  - the README (all topics plus appendix);
  - eight system design solutions under `solutions/system_design` (pastebin, twitter, web_crawler, mint, social_graph, query_cache, sales_rank, scaling_aws);
  - six OOD solutions under `solutions/object_oriented_design` (hash_table, lru_cache, call_center, deck_of_cards, parking_lot, online_chat), which are Python/notebooks without READMEs;
  - three Anki decks under `resources/flash_cards`.
  - The `.graffle` source diagrams are not used; the exported PNGs in `images/` are.
- **Language split.** Primer content stays in English. UI, Hints, Glossary explanations, quiz explanations and card explanations are written in Azerbaijani, with English technical terms kept as-is.
- **Simulation numbers are approximations.** They are for learning and must stay explainable: each node's capacity, latency and cost are visible and editable in its config.
- **Ticket slicing.** M2 and M5 are large. Slice them vertically, so that the first ticket of each delivers one Challenge (Pastebin) end to end before the rest are added.
- **Domain terms** used in this spec (Lesson, Glossary Term, Flashcard, Deck, Challenge, Stage, Rule, Hint, Evaluation, Reference Solution, Design, Node, Edge, Component Palette, Load Profile, Traffic Simulation, Chaos Scenario, Concept Simulation, Attempt, Mock Interview, Skill Tree, Mastery) should be recorded in `CONTEXT.md` when it is first created.
