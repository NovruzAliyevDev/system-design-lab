# UML classes and relations sit beside Nodes and Edges in the Design

A UML Design (ticket 28) is a `Design` like any other, but its classes and relations are their own
lists, `classes` and `relations`, next to `nodes`, `edges` and `zones`, rather than new kinds of Node
and Edge inside `nodes` and `edges`.

The spec asked for "the same graph shape" so that the UML Class Builder shares the Design model with the
Design Canvas. The lists keep what that sharing is for:
- one type for a Stage's Design and one serialisation;
- the same undo history, removal and moves;
- Attempt storage;
- the same Rule Engine with its Hints and scoring.

Every Design also reads without classes or relations when it was stored before they existed.

We chose this over Node and Edge kinds because a class has nothing a component Node has: no
`componentType`, config or simulation numbers. A relation has none of an Edge's mode or traffic. As kinds
inside `nodes` and `edges`, they would make every Traffic Simulation, Chaos Scenario, palette and Design
Canvas path narrow each Node and Edge first, and let an architecture Rule meet a class by mistake.
Separate lists keep each side's types exact. A Stage's Rules check only one side: validation refuses
architecture predicates in a class-design Stage and UML predicates elsewhere.

## Consequences

- Every Design literal names the two lists. `emptyDesign()` and `readDesign` fill them in.
- Shared operations take both sides:
  - `removeElements` reads its `nodeIds` as Nodes or classes and its `edgeIds` as Edges or relations;
  - `moveElements` moves classes too.
- A class can relate to itself, e.g. a linked-list Node to the next one. An Edge cannot connect a Node to
  itself.
- A class is of a kind: `class`, `abstract`, `interface` or `enum` (ticket 29, for the primer's Python
  Enums). An enum's fields are its values, so Rules find one by them like any class by its fields.
