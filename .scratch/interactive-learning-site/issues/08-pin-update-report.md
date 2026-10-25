# 08: Content pin update change report

**What to build:** When I move the primer submodule to a newer commit, a command tells me what changed. It compares the Lesson catalogs of the old and new pins and reports added, removed and renamed Lessons. It also lists any authored content that now points at a missing Lesson.

**Blocked by:** 02

**Status:** resolved

- [x] A command compares the catalogs for two commits and prints added, removed and renamed Lessons (renames detected by anchor and title similarity).
- [x] It lists authored items (Glossary, and later Quizzes and Challenges) that reference Lessons which no longer exist.
- [x] The repo README documents the update procedure.
- [x] Seam A test: catalog diff on two small fabricated markdown inputs.

## Comments

**Done on `main`.**
- **Command.** `npm run pin-report -- [<from> [<to>]]` (`scripts/pin-report.ts`). `<from>` defaults to the pin committed in `HEAD` (`HEAD:vendor/system-design-primer`) and `<to>` to the submodule checkout. Both READMEs are read with `git show` in the submodule, so any revision it knows works. It prints added, removed and renamed Lessons, then the authored content that references a missing Lesson, and exits with 1 if there is any.
- **Core** (`src/core/content/pin-change-report.ts`). `comparePrimerVersions({ before, after, authored })` returns a `PinChangeReport`, and `formatPinChangeReport` formats it as terminal text.
  - Lessons come from the new `readLessons` in `catalog.ts`. It does the same Lesson split as `buildContentCatalog` but reads nothing else, so an old primer whose study guide or appendix the catalog cannot read still gets a report (e.g. `69d4e5a`).
  - **Renames.** The same id with a new title is a rename. Otherwise a removed and an added Lesson are paired when the mean of the anchor-word Dice and the title letter-pair Dice is at least 0.6, most similar first, one-to-one. Titles that differ in a number never pair ("Layer 4" and "Layer 7 load balancing").
  - **Broken references** are checked against the new pin only. Each one names the referrer as build errors do, plus the new id when the Lesson was renamed. Only Glossary Terms reference Lessons today (`glossaryLessonReferences`); `authoredLessonReferences` is where Quizzes and Challenges add theirs.
- **README.** The "Update the primer" section gives the procedure: check out the new commit, run the report, fix the references, then stage the pin, `npm run content`, `npm test` and update the `primer-catalog` snapshot.
- **Tests.** Seam A: `pin-change-report.test.ts` (fabricated markdown: added/removed, renames incl. same-anchor retitles, one-to-one pairing, near misses, numbered siblings, an unreadable study guide, broken references, the text format).
- **Not done / open.**
  - A heading whose id is taken over by a new heading of the same title (`sharding` moves to `sharding-1`) is not detected. The old id still resolves, but to the new section. Catching that would mean comparing Lesson bodies.
  - Changes to a Lesson's text (story 109's "changed sections") are not reported. The ticket asks for added, removed and renamed only.
