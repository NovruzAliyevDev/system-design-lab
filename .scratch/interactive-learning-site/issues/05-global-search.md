# 05: Global search

**What to build:** Press a keyboard shortcut anywhere, type a term, and jump straight to the matching Lesson. A full-text index over Lessons (and, later, Glossary Terms and Challenges as they appear) is built at build time and loaded on the client. Each result shows its title, its Lesson group and a highlighted snippet.

**Blocked by:** 02

**Status:** resolved

- [x] The search index is generated at build time from the Content Catalog; all content is never indexed at runtime.
- [x] A shortcut (Ctrl/Cmd+K) opens search from any page; results can be navigated with the keyboard.
- [x] Results show title, Lesson group and a matching snippet with the hit highlighted.
- [x] The index has an extension point so Glossary Terms and Challenges can be added by their own tickets.
- [x] Playwright smoke: open a Lesson, search for another term, land on its Lesson.

## Comments

**Done on `main`.**
- **Core** (`src/core/search`, MiniSearch).
  - `searchDocuments(catalog)` collects everything search finds; `buildSearchIndex(documents)` serialises the index; `loadSearchIndex` loads it back; `search(index, query)` returns results with the title, its `context` (the Lesson group) and a snippet, each with highlight ranges.
  - Lesson text is indexed as plain text (`markdownToPlainText` in `src/core/content/markdown.ts`), with no markdown syntax or raw HTML.
  - Matching: every query word must match; the last word matches as a prefix while typing; longer words (5+ letters) forgive one typo; title hits count 3x. Highlights cover the whole matched word, and the snippet is cut around the place where most query words are close together.
- **Extension point.** A Glossary Term or Challenge ticket widens `SearchKind`, adds its documents in `searchDocuments` (the catalog will hold them), and adds a case to `resultPath` in `src/ui/Search.tsx`; the `switch` has no default, so a missing route fails typechecking. `context` is the generic "where it sits" line; a new kind may want its own wording there, and the UI does not show the kind yet.
- **Pipeline.** `npm run content` writes `src/generated/search-index.json` (about 170 KB) next to the catalog. The client only loads it, never indexes.
- **UI.**
  - Ctrl+K (Cmd+K on a Mac) or the header button opens a modal dialog on any page. Up/Down move through results, Enter opens one, Esc closes. On a phone the button is an icon.
  - The index is a separate chunk, loaded on the first search, and the service worker precaches it like the rest of the build.
- **Tests.**
  - Seam A: 11 Vitest tests in `src/core/search` through build, JSON round trip, load and search. Also `tests/primer-search.test.ts`: every primer Lesson is found by its own title, and two topic queries lead with the right Lesson.
  - Seam B: Playwright smoke: on a Lesson, Ctrl+K, Esc, Ctrl+K, search "eventual consistency", arrow keys, Enter, land on its Lesson.
  - Not covered: no test checks that search works offline after one visit (the `pages` project could add one).
