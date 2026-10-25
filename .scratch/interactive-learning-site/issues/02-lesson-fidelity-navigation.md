# 02: Full Lesson fidelity and navigation

**What to build:** Read the primer in the app the way it was meant to be read. Lessons are grouped by the primer's own structure in a sidebar table of contents, with previous/next navigation. Images and diagrams from the primer are shown. Internal anchors ("see Cache") go to the matching Lesson route. External links open in a new tab. Every Lesson shows a link to its source section at the pinned commit, plus the CC BY 4.0 attribution.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Sidebar TOC shows Lesson groups in primer order; the current Lesson is highlighted.
- [ ] Previous/next navigation follows primer order.
- [ ] All primer images referenced by Lessons are copied at build time and render.
- [ ] Every internal anchor in the README resolves to an app route; an unresolved anchor fails the build.
- [ ] External links open in a new tab.
- [ ] Each Lesson shows a source link (pinned commit) and the CC BY 4.0 attribution; the site footer credits the primer.
- [ ] Reader layout is usable on mobile width.
- [ ] Seam A test: every internal anchor in the catalog resolves.
