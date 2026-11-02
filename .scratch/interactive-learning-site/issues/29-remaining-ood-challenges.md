# 29: Remaining OOD Challenges

**What to build:** The other five primer OOD questions become UML Challenges in the LRU cache format:
- hash map;
- call center;
- deck of cards;
- parking lot;
- online chat.

Each has Rules, three-tier Azerbaijani Hints, a reference UML derived from the primer's Python solution, and the code view.

**Blocked by:** 28

**Status:** resolved

- [x] Five OOD Challenge definitions authored.
- [x] Content validation tests pass for all five.
- [x] Any new UML predicate has Seam A tests.

## Comments

**Done on `main`.**

- **Enum class kind** (`design.ts`). The primer's Python solutions model ranks, suits, sizes and statuses as Enums, so a class can now be of kind `enum` beside `class`, `abstract` and `interface`.
  - An enum's fields are its values, so Rules find one with the existing `class` predicate: `{ kind: 'enum', fields: [...] }`. No new UML predicate was needed.
  - The canvas writes «enumeration» above its name; the kind menu calls it "Sadalama (enum)".
  - Recorded in ADR 0001's consequences and the spec's Design model line.
- **Shared helpers** (`primer-challenges/shared.ts`).
  - `anyClass` and `anyRelation` moved there from the LRU cache.
  - New: `anyMember`; `anyRelationEitherWay`, for a link drawn from either class; `ABSTRACT` (abstract or interface); and `MANY_OR_SOME` (`*` or `1..*`).
- **Five Challenges** (`content/primer-challenges/`). They are in primer order around the LRU cache: hash map, LRU cache, call center, deck of cards, parking lot, online chat.
  - Each has:
    - one class-design Stage with 7–9 Rules, each with three Azerbaijani Hints;
    - a prompt from the notebook's constraints and assumptions;
    - a reference UML of the Python solution's classes, scoring 100%;
    - the Python code beside it (`codeSolutionId`).
  - **Finding classes.** Rules find classes by role where they can. Where the question names classes, they find them by name: the three employee ranks, the three vehicle types, and private and group chats. Abstract bases also accept an interface implemented instead of subclassed.
  - **Hash map** (`hash-map.ts`):
    - `get`, `set` and `remove`, a bucket table, its size, and a hash function;
    - Items holding key and value;
    - the map holding `*` Items by composition or aggregation, directly or through a Bucket class.
  - **Call center** (`call-center.ts`):
    - dispatch and a call queue;
    - an abstract Employee that escalates, with Operator, Supervisor and Director as subclasses;
    - a Call with state and rank, and each employee handling 0..1 calls;
    - the center aggregating `*` employees;
    - a Rank enum.
  - **Deck of cards** (`deck-of-cards.ts`):
    - a Card with suit and value, abstract, and a Suit enum;
    - a Deck that deals and shuffles, aggregating `*` Cards;
    - a Hand that adds and scores, aggregating (not composing) `*` Cards;
    - BlackJackCard (knowing aces or face cards) and BlackJackHand (scoring) as subclasses.
  - **Parking lot** (`parking-lot.ts`):
    - a lot composed of Levels composed of Spots;
    - `park_vehicle`;
    - an abstract Vehicle that knows where it fits, with Motorcycle, Car and Bus as subclasses;
    - a spot holding 0..1 vehicles and a vehicle taking `*` spots;
    - a VehicleSize enum.
  - **Online chat** (`online-chat.ts`):
    - a UserService composing `*` Users and passing friend requests;
    - User → User friends;
    - an AddRequest with status, and a RequestStatus enum;
    - PrivateChat and GroupChat extending an abstract Chat;
    - a Chat composing `*` Messages and aggregating `*` Users;
    - GroupChat `add_user`.
  - **Reference UMLs.** They follow the LRU cache's convention. Containers that give a class its role stay fields: the bucket table, the call queue and the lookups by id. Other links to objects are drawn as relations, leaving out back-links to the whole (an Employee's call center, a spot's level).
  - **Hints and stubs.** Some primer methods are stubs (`notify_call_escalated`, `dispatch_queued_call_to_newly_freed_employee`). Hints say so where they describe them.
- **Tests.**
  - `uml.test.ts`: an enum class and its round trip; the kind list in stored-problem reports.
  - `uml-rules.test.ts`: enums counted by kind and found by their values.
  - `primer-catalog.test.ts`, for the five Challenges:
    - the OOD Challenges are the primer's six, in order, each beside its Python solution;
    - each reference UML has the Python classes, every one of them in the code;
    - no Rule passes on an empty canvas;
    - per Challenge, renamed classes pass by role, and the key mistakes fail exactly their Rule: a missing hash function, a missing subclass, wrong multiplicities, composition for a hand's cards, and a non-abstract Card or Chat;
    - the bucket path and an interface Chat are accepted.
