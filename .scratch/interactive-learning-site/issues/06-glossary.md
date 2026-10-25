# 06: Glossary Terms and tooltips

**What to build:** Technical terms in Lesson text show a tooltip with a short Azerbaijani explanation, and a Glossary page lists every term. Glossary Terms are authored data: the English term, aliases, an Azerbaijani explanation and related Lesson ids. They are validated at build time. In each Lesson section, only the first occurrence of a term gets a tooltip. The Glossary page links every term to the Lessons that use it. Glossary Terms are added to search.

**Blocked by:** 02

**Status:** resolved

- [x] Authored Glossary schema; the build fails on schema errors or references to unknown Lesson ids.
- [x] An initial set of terms covers the primer's core vocabulary: at least the terms that head primer sections, plus common ones like sharding, replication, quorum and write-through.
- [x] Tooltip on hover (desktop) and tap (mobile) for the first occurrence per Lesson section.
- [x] Glossary page: alphabetical, with each term, its explanation and links to the Lessons using it.
- [x] Glossary Terms appear in global search (if ticket 05 has landed; otherwise hook into its extension point when it does).
- [x] Seam A test: term matching respects aliases and first-occurrence-per-section.

## Comments

**Done on `main`.**
- **Authored data.** `content/glossary.ts` (72 terms), typed `GlossaryTermInput[]`: `term`, optional `aliases`, Azerbaijani `explanation`, `lessonIds` (at least one).
  - `buildContentCatalog({ markdown, source, authored: { glossary } })` validates it (`validateGlossary` in `src/core/glossary/glossary.ts`). It throws `ContentValidationError` listing every problem: missing or mistyped fields, unknown fields, unknown Lesson ids, and a name or alias used by two terms (case-insensitive). `npm run content` therefore fails the build.
  - `catalog.glossary` is sorted alphabetically; each term gets an `id` (slug of the term) used as its anchor on the Glossary page.
- **Matching** (`src/core/glossary/matching.ts`). `markGlossaryTerms(tree, createGlossaryMatcher(terms))` wraps occurrences in the Lesson's mdast in `glossaryTerm` nodes.
  - A term matches by its name or any alias, as a whole word (letters, digits and hyphens make a word, so "cache" does not match in "cache-aside"), with an optional plural ending ("caches", "load balancers"). The longest form at a position wins.
  - A name or alias written in capitals (REST, BASE, ACID) matches in capitals only, so "the rest of" is not REST, and "HTTPS" is not a plural of HTTP.
  - **Section = the text between any two headings in a Lesson** (H4–H6 included), so the "Sharding" and "Disadvantage(s): sharding" parts of the RDBMS Lesson each get their own first tooltip. Text in headings, links and code never gets one.
- **UI.**
  - `PrimerMarkdown` runs the matcher as a remark plugin; a `remarkRehypeOptions` handler turns the node into `<span data-glossary-term>`, which the sanitize schema now allows on `span`. `PrimerSpan` renders a known term id with `GlossaryTooltip`.
  - Tooltip: hover opens it (mouse), a click or tap keeps it open until clicked again, Esc or a click/tap elsewhere. It is fixed to the viewport (so table scroll containers cannot clip it), kept inside the screen, and links to the term on the Glossary page.
  - `/glossary`: every term alphabetically, with aliases, explanation and its Lessons; `#term-id` scrolls to and highlights a term. Linked from the header (from `sm` up) and from the table of contents drawer on phones. `useScrollToHash` is now shared with `LessonPage`.
- **Search.** `SearchKind` gained `'glossary'`; the text indexed is the aliases plus the explanation. Glossary Terms rank at half weight, so a Lesson titled like the query leads ("eventual consistency"), while a term with no Lesson of its own leads with its Glossary Term ("round robin", "sharding"; the ticket 05 test now checks the top *Lesson* for "round robin"). Results show "Lüğət" as the context of a term. `resultDetails` in `src/ui/Search.tsx` is now the one switch a new kind adds a case to.
- **Tests.**
  - Seam A: `src/core/glossary/glossary.test.ts` (schema, unknown Lesson ids, duplicates) and `matching.test.ts` (aliases, first occurrence per section, headings/links/code skipped, longest match, word boundaries, acronyms). Search: a Glossary Term found by name and alias. `tests/primer-catalog.test.ts` checks the primer's core vocabulary is covered; `tests/primer-search.test.ts` checks ranking.
  - Seam B: hover/click/Esc tooltip → Glossary page → back to a Lesson; search "quorum" → Glossary page; tap on a touch phone keeps the tooltip on screen and a tap elsewhere closes it.
- **Not done / open.**
  - The Glossary page lists the authored `lessonIds`, not every Lesson whose text mentions the term.
  - "Quorum" is authored as the ticket asks, but the pinned README never uses the word, so it has no tooltip anywhere (only the Glossary page and search).
  - Group headings that are not technical terms (Security, Communication) have no Glossary Term.
  - Already true before this ticket: on a phone the header wraps to about 73px, while the drawer assumes 48px (`top-12`).
