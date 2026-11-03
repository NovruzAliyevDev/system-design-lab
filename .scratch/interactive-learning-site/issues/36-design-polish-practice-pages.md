# 36: Design polish: practice pages

**What to build:** Apply the design foundation from ticket 34 to the practice and progress pages. Each page moves to the semantic colour tokens, follows `DESIGN.md`, and gets its own audit findings from 34 fixed. All the decisions in 34 apply here: visual changes only, no component library, AA contrast in both themes, 375px, and the same done-per-slice checks.

**Blocked by:** 34

**Status:** ready-for-agent

- [ ] Dashboard (`DashboardPage.tsx`), with the streak and progress pieces under `src/ui/progress/`.
- [ ] Flashcards (`FlashcardsPage.tsx`).
- [ ] Calculators (`CalculatorsPage.tsx`, `EstimationSteps.tsx`).
- [ ] Skill Tree (`SkillTreePage.tsx`). Mastery states stay distinguishable in both themes, and not by colour alone.
- [ ] Settings (`SettingsPage.tsx`).
- [ ] `DESIGN.md` gains whatever practice-page patterns this slice settles (stat tiles, progress, form controls).
- [ ] Verify: each page checked in the built-in browser pane in dark, light and at 375px, and the full E2E suite green. One commit on `main`, no push.

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
