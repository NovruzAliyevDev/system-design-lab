# 35: Design polish: reading pages

**What to build:** Apply the design foundation from ticket 34 to the reading pages. Each page moves to the semantic colour tokens, follows `DESIGN.md`, and gets its own audit findings from 34 fixed. All the decisions in 34 apply here: visual changes only, no component library, AA contrast in both themes, 375px, and the same done-per-slice checks.

**Blocked by:** 34

**Status:** ready-for-agent

- [ ] Lesson list (`LessonList.tsx`).
- [ ] Lesson (`LessonPage.tsx`), with what it renders: `PrimerMarkdown.tsx`, `LessonQuiz.tsx`, `ReadMarker.tsx`, `GlossaryTooltip.tsx`, `AppendixTables.tsx`. The Concept Simulations inside Lessons belong to 37.
- [ ] Glossary (`GlossaryPage.tsx`).
- [ ] Solutions and Solution (`SolutionPages.tsx`).
- [ ] Study Guide (`StudyGuidePage.tsx`).
- [ ] Long English primer text reads well in both themes: line length, prose rhythm, code blocks, tables and images.
- [ ] `DESIGN.md` gains whatever reading-page patterns this slice settles.
- [ ] Verify: each page checked in the built-in browser pane in dark, light and at 375px, and the full E2E suite green. One commit on `main`, no push.

## Comments
