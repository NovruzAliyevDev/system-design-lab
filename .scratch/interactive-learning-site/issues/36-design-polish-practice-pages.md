# 36: Design polish: practice pages

**What to build:** Apply the design foundation from ticket 34 to the practice and progress pages. Each page moves to the semantic colour tokens, follows `DESIGN.md`, and gets its own audit findings from 34 fixed. All the decisions in 34 apply here: visual changes only, no component library, AA contrast in both themes, 375px, and the same done-per-slice checks.

**Blocked by:** 34

**Status:** resolved

- [x] Dashboard (`DashboardPage.tsx`), with the streak and progress pieces under `src/ui/progress/`.
- [x] Flashcards (`FlashcardsPage.tsx`).
- [x] Calculators (`CalculatorsPage.tsx`, `EstimationSteps.tsx`).
- [x] Skill Tree (`SkillTreePage.tsx`). Mastery states stay distinguishable in both themes, and not by colour alone.
- [x] Settings (`SettingsPage.tsx`).
- [x] `DESIGN.md` gains whatever practice-page patterns this slice settles (stat tiles, progress, form controls).
- [x] Verify: each page checked in the built-in browser pane in dark, light and at 375px, and the full E2E suite green. One commit on `main`, no push.

## Comments

### Note from 35 (2026-11-03)

- Flashcard faces use `PRIMER_PROSE_CLASS`, so 35 already gave them the token prose, the running-text cap (`max-w-xl`) and bordered code blocks. Check them in this slice.
- `CalculatorLinks` in `CalculatorsPage.tsx` is on the tokens already, because Lessons show it. The rest of the file is not.

### Note from 37 (2026-11-03)

- **React Flow on the Skill Tree map.**
  - `src/index.css` now maps React Flow's ground, zoom controls and attribution to the tokens on every canvas, the Skill Tree map included. The 4.3:1 attribution from the audit is now `text-muted`.
  - The focus ring on keyboard-focused nodes is back too.
  - The map's own nodes, legend and list in `SkillTreePage.tsx` are still raw `zinc`/`sky`/`emerald`.
- **Legacy mirror.** After 37, the pages in this slice are the only ones still relying on the legacy `zinc`/`sky` mirror in `src/index.css`. Once they move, remove the mirror and its note in DESIGN.md.

### Done (2026-11-03)

- **Tokens.** Dashboard, Flashcards, Calculators (`EstimationSteps.tsx` too), Skill Tree and Settings are on the semantic tokens. No raw `zinc`/`sky`/`red`/`rose`/`amber`/`emerald` class is left anywhere in `src/ui/`.
- **Legacy mirror removed.** No page relies on it any more, so the `zinc`/`sky` mirror is gone from `src/index.css`, and its section is gone from `DESIGN.md`.
- **Audit findings from 34.**
  - The failing `text-xs`/`zinc-500` labels, hints and footnotes (Flashcards deck stats, Calculator field hints, Settings hints, the Skill Tree's 9) are `text-muted` now.
  - Red and rose are merged into `danger`: the "Yenidən" grade, the Calculator alert, the invalid count field, the reset confirmation and the Settings error line.
  - The Skill Tree intro is capped at `max-w-prose`.
  - The Skill Tree list rows have their focus ring back (`-outline-offset-2`), instead of `outline-none` with a fill.
- **Mastery without colour alone.** Each level has a 12px mark filled as far as the level goes: a ring, a quarter, a half or a full disc. It is shown in the legend, on the map's nodes and in the list rows, before the percentage. The selected node's ring is offset from its border, so it still shows on a past-half node whose border is `accent`. The map's edges are `text-muted`, because React Flow's own grey was 2:1 in both themes.
- **Touch targets.** On a phone these are 44px: fields, selects, radio labels, Settings buttons, the latency examples, the Skill Tree's back link and topic-detail links, and the Flashcards deck links.
- **Smaller fixes.**
  - "Cavabı göstər" is the Primary button.
  - The latency examples were link-styled buttons; they are Secondary buttons now.
  - The prerequisite chips were bordered links; they are text links now.
  - The import label draws the global focus ring (`has-focus-visible`), instead of a 1px `sky` outline.
  - The Flashcard explanation heading is an `h2`, because it followed the `h1` and skipped a level.
  - The worked steps in the Calculators and in the Estimation Stage are `text-muted`, with names and results in `text`, so the highlight the steps had before is back.
- **DESIGN.md.** It records the patterns under "Practice pages (ticket 36)": stat tiles, deck stats, Mastery, the map, the review, form controls, calculator results and the Settings actions.
- **Verification.**
  - The Browser pane was open, but at first the page reported itself hidden, so most checks are script measurements. Later the screenshots worked. They covered the Dashboard and Settings in dark, the Skill Tree map in light, and the Skill Tree list and a revealed Flashcard at 375px in dark.
  - The script measured text contrast against the composited background, horizontal overflow, phone touch targets and heading order.
  - Pages measured: Dashboard, Settings (with the reset confirmation and an invalid count), Flashcards (front and revealed), Calculators (with an invalid entry), the Skill Tree map with a selected topic, the Skill Tree list, and a topic on a phone. Each was measured at 1024px and 375px, in dark and light.
  - The tints and graphics the script cannot reach were measured by hand. The worst values are all in the light theme:
    - `text-muted` on the grade hovers is at least 6.1:1;
    - `surface` text on `accent` is 5.6:1;
    - the `warning` bar on its track is 3.4:1.
  - E2E: the full suite passes, 33/33, with one worker (`--workers=1`).
    - With the default parallel workers, one test fails: "deletes, undoes and redoes on the canvas with the keyboard". It fails 32/33 the same way on HEAD `2cae244` with this diff stashed, so it is not caused by this slice.
    - The test passes on its own (3/3 with `--repeat-each 3`), and the full suite was 33/33 in 37's runs. So it looks like a timing problem under load, in a Sandbox test this slice does not touch.
  - Review fixes: the DESIGN.md text for the grade hovers, the no-Mastery node border, the list row height and the hints now matches the code.
