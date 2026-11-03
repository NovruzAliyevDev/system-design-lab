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
