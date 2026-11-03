# 35: Design polish: reading pages

**What to build:** Apply the design foundation from ticket 34 to the reading pages. Each page moves to the semantic colour tokens, follows `DESIGN.md`, and gets its own audit findings from 34 fixed. All the decisions in 34 apply here: visual changes only, no component library, AA contrast in both themes, 375px, and the same done-per-slice checks.

**Blocked by:** 34

**Status:** resolved

- [x] Lesson list (`LessonList.tsx`).
- [x] Lesson (`LessonPage.tsx`), with what it renders: `PrimerMarkdown.tsx`, `LessonQuiz.tsx`, `ReadMarker.tsx`, `GlossaryTooltip.tsx`, `AppendixTables.tsx`. The Concept Simulations inside Lessons belong to 37.
- [x] Glossary (`GlossaryPage.tsx`).
- [x] Solutions and Solution (`SolutionPages.tsx`).
- [x] Study Guide (`StudyGuidePage.tsx`).
- [x] Long English primer text reads well in both themes: line length, prose rhythm, code blocks, tables and images.
- [x] `DESIGN.md` gains whatever reading-page patterns this slice settles.
- [x] Verify: each page checked in the built-in browser pane in dark, light and at 375px, and the full E2E suite green. One commit on `main`, no push.

## Comments

### Done (2026-11-03)

- Every reading page, and what a Lesson renders apart from the Concept Simulations, uses the tokens. No `zinc-*`, `sky-*`, `red-*`, `amber-*` or `emerald-*` classes are left in them. `CalculatorLinks` (in `CalculatorsPage.tsx`) moved too, because a Lesson shows it. `ChoiceOptions` is shared with the Challenge deep-dive stage, so that stage picks up the quiz changes.
- Text links use a new `link` utility in `src/index.css`: accent and underlined, so a link in a muted line stands apart by more than colour. `Attribution` uses it too.
- Primer running text is capped at `max-w-xl`: lines measured at most 75 characters, down from about 87. Images, tables, code blocks and the appendix tables keep the full column. The redundant `dark:prose-invert` and `prose-a:text-sky-400` are gone. Code blocks have a border. Flashcard faces use the same class, so their text gets the same cap.
- Heading levels: 34 primer texts skipped a level (a Lesson opening with `####`, a Solution going from `##` to `####`). A new Core function, `nestHeadings`, renumbers them under the page title. It was built test-first (`src/core/content/markdown.test.ts`). The anchors do not change.
- The lists on Lessons and Solutions keep the global focus ring, drawn inside the row. Their rows are 44px.
- On a phone, the "mark as read" button, the quiz buttons and answer rows, the Study Guide tabs, the table filter and the "original text" disclosure are all 44px. On a phone, the Solutions challenge link sits under the title, so the title keeps the row's width.
- Glossary: explanations are capped at `max-w-prose` with `text-pretty`, and an entry opened by its link gets a ring as well as the tint.
- Table sort buttons are 28px, not 44px: they are not main controls, and they clear WCAG 2.5.8's 24px.
- Checked in the browser pane at 1280px and 375px, in dark and light. No text below AA, no horizontal scroll and no skipped heading level on any page. The only failures left on these routes are inside Concept Simulations, which belong to 37. The pane was hidden during the checks, so they ran as script measurements, not screenshots.
- The full E2E suite passed (33/33), as did `npx tsc -b` and the new `markdown.test.ts`.

