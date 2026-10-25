# 28: UML Class Builder and the LRU cache Challenge

**What to build:** Solve the primer's LRU cache OOD question on a UML canvas:
- I add classes with fields, methods and abstract/interface flags.
- I draw relationships (inheritance, implementation, composition, aggregation, association) with multiplicity.
- "Check" evaluates my model with the same Rule Engine, through new UML predicates, and the same tiered Hints.
- After checking, the reference UML is shown next to the primer's Python solution code.

The UML Design uses the same Design graph shape in Core.

**Blocked by:** 13

**Status:** ready-for-agent

- [ ] UML Node and Edge kinds in the Core Design model; UML canvas mode on React Flow.
- [ ] UML predicates: class exists (by role/name pattern), has field/method, relation kind between classes, multiplicity.
- [ ] The Challenge definition supports kind = ood (design Stage plus code view); LRU cache authored with Rules, Hints and a reference UML.
- [ ] The primer's Python solution is rendered as code next to the reference UML.
- [ ] Content validation test covers OOD Challenges (the reference UML scores 100%).
- [ ] Seam A tests for each UML predicate.
