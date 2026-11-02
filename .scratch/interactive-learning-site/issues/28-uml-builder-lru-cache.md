# 28: UML Class Builder and the LRU cache Challenge

**What to build:** Solve the primer's LRU cache OOD question on a UML canvas:
- I add classes with fields, methods and abstract/interface flags.
- I draw relationships (inheritance, implementation, composition, aggregation, association) with multiplicity.
- "Check" evaluates my model with the same Rule Engine, through new UML predicates, and the same tiered Hints.
- After checking, the reference UML is shown next to the primer's Python solution code.

The UML Design uses the same Design graph shape in Core.

**Blocked by:** 13

**Status:** resolved

- [x] UML Node and Edge kinds in the Core Design model; UML canvas mode on React Flow.
- [x] UML predicates: class exists (by role/name pattern), has field/method, relation kind between classes, multiplicity.
- [x] The Challenge definition supports kind = ood (design Stage plus code view); LRU cache authored with Rules, Hints and a reference UML.
- [x] The primer's Python solution is rendered as code next to the reference UML.
- [x] Content validation test covers OOD Challenges (the reference UML scores 100%).
- [x] Seam A tests for each UML predicate.

## Comments

**Done on `main`.**

- **Design model** (`src/core/design/design.ts`). Decision in `docs/adr/0001-uml-classes-and-relations-beside-nodes-and-edges.md`; the spec's Design model line points to it.
  - **Where UML lives.** A UML Design keeps its classes and relations in lists of their own on `Design`, `classes` and `relations`, beside `nodes`, `edges` and `zones`. They share serialisation, undo history, removal, moves and Attempt storage with every Design. Designs stored before UML read with none.
  - **Classes:** `DesignClass`, made by `addClass` and changed by `updateClass`. Each has a name, a kind (`class`, `abstract` or `interface`), fields and methods.
  - **Relations:** `DesignRelation`, made by `relate` and changed by `updateRelation` and `reverseRelation`.
    - Kinds: inheritance, implementation, composition, aggregation, association.
    - Multiplicity at each end: `1`, `0..1`, `*` or `1..*`.
    - At most one relation each way between two classes. A class can relate to itself, e.g. Node → next Node.
  - **Member names.** `memberName` gives the name Rules match a member by: `get` for `+ get(query): Node`.
- **UML predicates** (`rules.ts`).
  - **Class selector:** a name pattern, a kind, or the field and method patterns that give a class its role. Patterns are regular expressions, matched whole and ignoring case.
  - **Predicates:**
    - `class`: a class exists, with count bounds;
    - `member`: a class has a field or method;
    - `relation`: a relation of a kind, from one class to another, with optional multiplicity at each end.
  - **Families.** `validateRules` takes a family:
    - a class-design Stage takes only UML predicates;
    - architecture Stages take only architecture predicates;
    - the combinators work in both.
- **OOD Challenges** (`challenge.ts`, `attempt.ts`, `mock-interview.ts`).
  - **Kind `ood`:**
    - no Load Profile;
    - a required `codeSolutionId`;
    - Stages from requirements, class-design and deep-dive, with a class-design Stage required.
  - **Stage `class-design`:** Rules plus a reference UML, which must score 100% on them.
  - **Attempts** store and score it like the other design Stages. It gets a Mock Interview time box.
- **Python solutions.**
  - The Content Pipeline reads each `solutions/object_oriented_design/*/*.py` (not `__init__.py`) as a `CodeSolution`, giving the catalog `codeSolutions` and `findCodeSolution`.
  - The over-Stage view shows the reference UML beside that code, with its path, a link to the pinned commit and CC BY 4.0 credit.
- **LRU cache** (`content/primer-challenges/lru-cache.ts`).
  - **Shape.** One class-design Stage with nine Rules, each with three Azerbaijani Hints.
  - **Finding classes by role, not name.** Rules find the classes by the members that give them their role:
    - the cache is the class with `get` and `set`/`put`;
    - the list is named like a list, has `head` and `tail`, or moves entries to the front;
    - the node is named like a node, has `next`, or holds the results.
  - **What the Rules check:**
    - the cache has a lookup map and a capacity;
    - the list has two distinct operations, move-to-front and evict;
    - the cache owns the list by composition;
    - the list holds `*` Nodes by aggregation or composition;
    - the cache reaches `*` Nodes through the lookup, by association, aggregation or composition.
  - **Reference UML.**
    - It mirrors `lru_cache.py`, with links to other objects drawn as relations only.
    - Its Node keeps the `query` that eviction reads, which the primer's constructor leaves out.
    - Node → Node is an association for next and prev.
  - **Lessons.** It practises only the OOD Lesson, so the cache Skill Tree topic doesn't need a Challenge. The `object-oriented-design` topic now requires it.
- **UI.**
  - **UML Class Builder** (`UmlEditor.tsx`, `ClassNode.tsx`, `RelationEdge.tsx`, `UmlPanel.tsx`).
    - Canvas: class boxes with the keyword, name, fields and methods; UML end markers (hollow triangle, dashed implementation, filled and hollow diamonds, open arrow); multiplicities beside the ends; a loop for a class's relation to itself.
    - Editing: add, drag, connect (a new relation is selected so its kind can be set), delete, undo and redo.
    - Panel: name, kind, fields and methods one per line; relation kind with what it means for the two classes, multiplicity per end, reverse.
    - Not in it: copy and paste, auto-layout, PNG export, sketch style.
  - **Stage view** (`ClassDesignStageView.tsx`): check with level-0 feedback and Hints, read-only below the tablet width. Once over: the results, your UML, then the reference UML beside the Python code.
  - **Shared with the design Stage view.** The check feedback and the Rule results moved to `RuleFeedback.tsx`, which both Stage views use.
  - **Challenges list:** shows each Challenge's kind.
- **Tests (Seam A).**
  - `uml.test.ts`: the model — classes, member names, relations (self, reverse, multiplicity), removal, moves, round trip, and stored-problem reports.
  - `uml-rules.test.ts`: each UML predicate:
    - name and role selectors;
    - kind counts;
    - members;
    - relation kind and direction;
    - inheritance vs implementation;
    - multiplicity, including an end without one;
    - the combinators.
  - `ood-challenge.test.ts`:
    - validation of kind, Stages, predicate families, selectors and Python solutions;
    - the catalog's code solutions;
    - class-design Attempts: start, score with Hints, storage;
    - the Mock Interview time box.
  - `primer-catalog.test.ts`:
    - the reference UML of every Rule-checked Stage scores 100%;
    - the LRU cache reference scores 100%, and passes renamed;
    - reversed relations fail;
    - one method can't count as both list operations;
    - composition counts for the lookup, but `1..*` doesn't;
    - all six Python solutions load.
