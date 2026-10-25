# 05: Global search

**What to build:** Press a keyboard shortcut anywhere, type a term, and jump straight to the matching Lesson. A full-text index over Lessons (and, later, Glossary Terms and Challenges as they appear) is built at build time and loaded on the client. Each result shows its title, its Lesson group and a highlighted snippet.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The search index is generated at build time from the Content Catalog; all content is never indexed at runtime.
- [ ] A shortcut (Ctrl/Cmd+K) opens search from any page; results can be navigated with the keyboard.
- [ ] Results show title, Lesson group and a matching snippet with the hit highlighted.
- [ ] The index has an extension point so Glossary Terms and Challenges can be added by their own tickets.
- [ ] Playwright smoke: open a Lesson, search for another term, land on its Lesson.
