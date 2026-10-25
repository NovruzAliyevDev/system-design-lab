# 06: Glossary Terms and tooltips

**What to build:** Technical terms in Lesson text show a tooltip with a short Azerbaijani explanation, and a Glossary page lists every term. Glossary Terms are authored data: the English term, aliases, an Azerbaijani explanation and related Lesson ids. They are validated at build time. In each Lesson section, only the first occurrence of a term gets a tooltip. The Glossary page links every term to the Lessons that use it. Glossary Terms are added to search.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Authored Glossary schema; the build fails on schema errors or references to unknown Lesson ids.
- [ ] An initial set of terms covers the primer's core vocabulary: at least the terms that head primer sections, plus common ones like sharding, replication, quorum and write-through.
- [ ] Tooltip on hover (desktop) and tap (mobile) for the first occurrence per Lesson section.
- [ ] Glossary page: alphabetical, with each term, its explanation and links to the Lessons using it.
- [ ] Glossary Terms appear in global search (if ticket 05 has landed; otherwise hook into its extension point when it does).
- [ ] Seam A test: term matching respects aliases and first-occurrence-per-section.
