# 25: Concept simulation: load balancing and consistent hashing

**What to build:** Two interactive Concept Simulations, embedded in their Lessons:
- **Load balancer:** compares round robin, least connections and hashing on servers with different speeds, showing the distribution and queue lengths over time.
- **Consistent hashing:** a hash ring where I add and remove nodes (with virtual nodes) and see which keys move, compared with naive modulo hashing.

The simulation logic is pure Core code with an injected seed; the UI only renders it.

**Blocked by:** 02

**Status:** resolved

- [x] Concept Simulation embed mechanism: authored data attaches a simulation to a Lesson, validated at build time.
- [x] Load balancer simulation with algorithm switch, server speed controls and live distribution chart.
- [x] Consistent hashing simulation with add/remove nodes, virtual-node count and moved-key highlighting versus modulo.
- [x] Azerbaijani explanations alongside each control.
- [x] Seam A tests: round robin distribution; least connections favours faster servers; adding a node to the ring moves about 1/n of keys, versus most keys under modulo.

## Comments

**Done on `main`.**
- **Embeds** (`src/core/concept-simulations/embed.ts`, authored in `content/concept-simulations.ts`, catalog field `conceptSimulations`).
  - An embed names a simulation, a Lesson and optionally `afterSection`, a heading anchor inside the Lesson. The simulation is shown where that heading's section ends (subsections included), otherwise at the end of the Lesson.
  - The build fails on an unknown simulation, Lesson or heading, a simulation repeated in one Lesson, or an unknown field. The pin change report lists embeds whose Lesson is gone.
  - `lessonParts(lesson, embeds)` splits the Lesson text at those section ends. `LessonText` renders each part with its simulations after it.
  - Load balancer: at the end of `load-balancer`. Consistent hashing: after the Sharding section of `relational-database-management-system-rdbms`, where the primer suggests consistent hashing for rebalancing.
- **Load balancer** (`simulateLoadBalancer` in `load-balancer.ts`).
  - Poisson arrivals from a seeded PRNG, spread over 10 steps per tick so requests arrive while servers are busy. Each server finishes `speed` requests per tick.
  - Round robin; least connections (fewest waiting or in service, ties rotate); hashing of the client id, so a client sticks to one server.
  - It returns per-tick queue lengths and requests given so far, plus per-server totals.
  - UI: algorithm switch, 2–6 servers with speeds of 1–5, arrival rate, client count, a re-run with a new seed, and playback with a tick scrubber. Charts show the live distribution bars and queue lengths over time (hover crosshair, legend), with a results table as the table view.
  - Playback starts when the charts come into view; with reduced motion the whole run is shown.
- **Consistent hashing** (`rebalance` in `consistent-hashing.ts`).
  - A 32-bit hash (FNV-1a plus Murmur3's finaliser) places keys and `virtualNodes` points per node on a 2^32 ring. Modulo hashing is compared on the same keys.
  - `rebalance` reports for each key its node before and after the change and whether it moved, on the ring and under modulo. It also reports keys per node and the ideal share to move.
  - UI: add and remove nodes A–H, and 1–200 virtual nodes. 500 keys are drawn on the ring and as a modulo grid, with moved keys lit, moved counts against the ideal, and keys-per-node bars.
- `mulberry32` moved from quiz grading to `src/core/random.ts`, shared by both simulations.
- Colours: the reference categorical palette as `--series-1…8` (dark and light), in a fixed order per server or node.
- **Phones:** below tablet width a notice says the simulation is best on a larger screen. The simulations stay fully interactive there, since they fit at 375px; only the canvas and UML editors are read-only.
- **Tests (Seam A).**
  - `load-balancer.test.ts`: round robin evens out regardless of speed; least connections gives the fastest server more than 2× the slowest, with short queues where round robin's grow; hashing sticks a client to one server; runs are seeded.
  - `consistent-hashing.test.ts`: adding a 5th node moves 15–25% of 10k keys on the ring versus more than 75% under modulo; moved keys go only to the added node (or only off a removed one); virtual nodes even out the load.
  - Also `embed.test.ts`, `pin-change-report.test.ts` and a `primer-catalog.test.ts` check of the real placements.

