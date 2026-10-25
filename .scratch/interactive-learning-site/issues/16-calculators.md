# 16: Calculators

**What to build:** Two standalone calculators for estimation practice:
- **Back-of-the-envelope calculator:** goes from users to requests/day, QPS, peak factor, object size, storage per year and bandwidth, with unit-aware output (KB…PB; per second/month/year).
- **Latency comparison tool:** built on the primer's latency numbers table, it answers questions like "how many disk seeks fit in one cross-continent round trip?".

Both reuse `estimate` and the appendix data, and are linked from the relevant Lessons and from the Estimation Stage.

**Blocked by:** 07, 15

**Status:** ready-for-agent

- [ ] The calculator page reuses Core `estimate`; all intermediate steps are shown.
- [ ] The latency comparison tool uses the extracted latency data; it compares any two operations and shows the ratio.
- [ ] Linked from the Estimation Stage and from the appendix and back-of-the-envelope Lessons.
- [ ] Usable on mobile.
- [ ] Seam A test: latency ratio computation for known pairs.
