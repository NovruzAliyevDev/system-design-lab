# 07: Appendix tables, Solution pages, study guide

**What to build:** Use the primer's reference material as interactive pages:
- The appendix tables (powers of two, latency numbers every programmer should know) become sortable, filterable tables backed by structured data.
- The eight system design solution READMEs become readable Solution pages, with their images.
- The primer's short / medium / long study guide is offered as a suggested path through the Lessons.

**Blocked by:** 02

**Status:** resolved

- [x] The Content Pipeline extracts the appendix tables into structured data, reused later by calculators and simulation defaults.
- [x] Appendix pages render the tables with sort and filter.
- [x] The eight Solution pages render with images and attribution, and are reachable from a Solutions index.
- [x] The study guide page shows the three timelines, each linking to Lessons.
- [x] Seam A test: the latency and powers-of-two data are extracted with the expected row count and known values.

## Comments

**Done on `main`.**
- **Appendix tables** (`src/core/content/appendix.ts`). `buildContentCatalog` reads the two plain-text tables out of their Lessons into `catalog.appendix`:
  - `powersOfTwo`: `{ power, exactValue, approxValue?, bytes? }`. 8 rows; a row whose exact value is not 2^power fails the build.
  - `latencyNumbers`: `{ operation, nanoseconds, note? }`. 15 rows; the "Notes" block after the table is not data.
  - Each table records its Lesson id and the offset of its code block. A table is absent only when its Lesson is (test catalogs); the pipeline fails if either is missing. `formatDuration(ns)` ("150 µs") lives next to them for the calculators.
  - The Lesson shows a sortable, filterable table in place of the code block (`PrimerMarkdown`'s new `codeBlocks` prop), with the primer's original text (Notes included) in a collapsed "Primer-dəki orijinal mətn" below. Filtering and sorting are Core (`queryTable` in `table-query.ts`): every word of the filter must appear; rows without a value sort last. Approx Value and Bytes do not sort (the Power column sorts the same rows).
- **Solution pages** (`src/core/content/solutions.ts`). The pipeline reads every `solutions/system_design/*/README.md`; `catalog.solutions` lists them in the order the README links them, with title (the H1), body, heading anchors and source URL at the pinned commit. Routes: `/solutions` (index) and `/solutions/:id` (folder name, e.g. `pastebin`), each with the source link and CC BY credit.
  - `resolveLink(catalog, href, from)` now takes the file the link is written in: relative links resolve from its folder; `solutions/.../README.md` goes to its Solution page (the README's links to solutions are now in-app); `https://github.com/donnemartin/system-design-primer#anchor` goes to the Lesson (all ~400 such links in the solutions resolve; an unknown anchor fails the build). `findUnresolvedLinks` and `referencedAssets` cover Solutions too (`UnresolvedLink.lessonId` became `location`).
  - **Images.** The solutions show their diagrams from imgur. `content/image-mirrors.ts` (authored, validated) maps each imgur URL to the same image in the primer repo, so all 20 are served with the site and cached offline. The first diagram of each solution is `<name>_basic.png` and the last is `<name>.png`/`images/<id>.png` (dimensions match). The scaling_aws steps were matched by content (Users+ = `_2` … Users++++ = `_5`, Users+++++ = `_7`, the high-level design = `scaling_aws.png`); `_1` and `_6` are unused. This could not be checked against imgur itself.
- **Study guide** (`src/core/content/study-guide.ts`). `catalog.studyGuide` has the three timelines with the primer's summary of each and the 7 steps of the table, each step's link resolved to a Lesson, with the amount per timeline (`yes`/`some`/`many`/`most`). An unknown cell or a step linking to no Lesson fails the build. `/study-guide` shows a tab per timeline (kept in `?timeline=`), the steps with read markers, and links to the Lesson and the source.
- **Also fixed.** The primer writes some HTML links unquoted (`<a href=https://…>`), which CommonMark does not read as HTML: the tag showed as text with a broken URL (27 in the README, mostly image captions, and a footnote in each solution). `quoteUnquotedLinkUrls` quotes them before the catalog is built. `PrimerMarkdown` now memoizes its components, so a re-render of the page no longer remounts the text (which reset tooltips and the tables' state).
- **UI.** Header links Öyrənmə planı / Həllər / Lüğət from `md` up (the tagline from `xl`); below `md` they are in the table of contents drawer.
- **Tests.**
  - Seam A: `appendix.test.ts`, `study-guide.test.ts`, `solutions.test.ts`, `table-query.test.ts`, a case in `catalog.test.ts`; `tests/primer-catalog.test.ts` checks the pinned primer: powers of two and latency rows (count and known values), the study guide, the 8 Solutions in primer order, and every Solution diagram served as an asset.
  - Seam B: sort/filter the latency table; Lesson → Solution page (diagram loads) → Lesson via a GitHub link → Solutions index; study guide timeline → Lesson. The offline test also opens a Solution page.
- **Not done / open.**
  - Solutions are linked from the header everywhere; hiding them until a Challenge is attempted (story 10) belongs to the Challenge tickets.
  - Solutions are not in search.

