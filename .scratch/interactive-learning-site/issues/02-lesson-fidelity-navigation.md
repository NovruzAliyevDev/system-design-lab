# 02: Full Lesson fidelity and navigation

**What to build:** Read the primer in the app the way it was meant to be read. Lessons are grouped by the primer's own structure in a sidebar table of contents, with previous/next navigation. Images and diagrams from the primer are shown. Internal anchors ("see Cache") go to the matching Lesson route. External links open in a new tab. Every Lesson shows a link to its source section at the pinned commit, plus the CC BY 4.0 attribution.

**Blocked by:** 01

**Status:** resolved

- [x] Sidebar TOC shows Lesson groups in primer order; the current Lesson is highlighted.
- [x] Previous/next navigation follows primer order.
- [x] All primer images referenced by Lessons are copied at build time and render.
- [x] Every internal anchor in the README resolves to an app route; an unresolved anchor fails the build.
- [x] External links open in a new tab.
- [x] Each Lesson shows a source link (pinned commit) and the CC BY 4.0 attribution; the site footer credits the primer.
- [x] Reader layout is usable on mobile width.
- [x] Seam A test: every internal anchor in the catalog resolves.

## Comments

**From ticket 01.** The catalog has some behaviour that affects this ticket:
- Anchors that point at a group with no text of its own must also resolve, e.g. `#availability-vs-consistency`, which the primer's index links to. It has a group but no Lesson, so map it to the group's first Lesson.
- H4+ headings and folded "Source(s) and further reading" sections have anchors that live inside a Lesson. Resolving them needs a heading-anchor → Lesson map, not just Lesson ids.
- `LessonPage` currently passes `skipHtml` to react-markdown, so the primer's raw HTML (mostly `<p align="center"><img …></p>` blocks) is dropped. The intro Lesson "The System Design Primer" renders blank until this ticket renders that HTML.

**Done on branch `ticket-02/lesson-fidelity`.**
- **Link handling.** Core maps every primer heading anchor to the Lesson that shows it (`catalog.anchors`) and records the heading ids inside each Lesson (`headingAnchors`). `resolveLink` turns any primer href into one of four results: a Lesson route (optionally with an anchor to scroll to), a copied asset, a GitHub URL at the pinned commit, or an unresolved link.
  - Percent-encoded anchors are decoded; malformed ones count as unresolved.
  - Links to other primer files (solutions, notebooks) go to GitHub until ticket 07 adds Solution pages.
- **Build.** The Content Pipeline fails on unresolved links (all 137 anchor links in the pinned primer resolve) and copies the 36 images Lessons use into `public/primer/`, which is gitignored.
- **Rendering.** Lessons render the primer's raw HTML through rehype-raw, then rehype-sanitize, plus GFM and emoji shortcodes. Headings get their GitHub ids, looked up by source offset. Wide tables scroll inside their own box. Primer text is marked `lang="en"`, so upper-casing is correct on the Azerbaijani page.
- **UI.**
  - A grouped sidebar shows the current Lesson highlighted. Below the `lg` breakpoint it becomes a drawer.
  - Previous/next cards.
  - A source link and CC BY 4.0 credit on each Lesson, plus a site footer credit.
- **Tests.**
  - Seam A (Core): 26 Vitest tests, including "every internal link in the pinned primer resolves".
  - Seam B (Playwright): 3 smoke tests (desktop navigation, anchors, previous/next; phone width with the drawer and no horizontal page scroll).
  - e2e code has its own `tsconfig.e2e.json`, which includes DOM types.
