# 08: Content pin update change report

**What to build:** When I move the primer submodule to a newer commit, a command tells me what changed. It compares the Lesson catalogs of the old and new pins and reports added, removed and renamed Lessons. It also lists any authored content that now points at a missing Lesson.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] A command compares the catalogs for two commits and prints added, removed and renamed Lessons (renames detected by anchor and title similarity).
- [ ] It lists authored items (Glossary, and later Quizzes and Challenges) that reference Lessons which no longer exist.
- [ ] The repo README documents the update procedure.
- [ ] Seam A test: catalog diff on two small fabricated markdown inputs.
