# 25: Concept simulation: load balancing and consistent hashing

**What to build:** Two interactive Concept Simulations, embedded in their Lessons:
- **Load balancer:** compares round robin, least connections and hashing on servers with different speeds, showing the distribution and queue lengths over time.
- **Consistent hashing:** a hash ring where I add and remove nodes (with virtual nodes) and see which keys move, compared with naive modulo hashing.

The simulation logic is pure Core code with an injected seed; the UI only renders it.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Concept Simulation embed mechanism: authored data attaches a simulation to a Lesson, validated at build time.
- [ ] Load balancer simulation with algorithm switch, server speed controls and live distribution chart.
- [ ] Consistent hashing simulation with add/remove nodes, virtual-node count and moved-key highlighting versus modulo.
- [ ] Azerbaijani explanations alongside each control.
- [ ] Seam A tests: round robin distribution; least connections favours faster servers; adding a node to the ring moves about 1/n of keys, versus most keys under modulo.
