# 37: Design polish: Challenges and sandbox

**What to build:** Apply the design foundation from ticket 34 to the Challenge pages and the sandbox. The page frame around the interactive surfaces gets the full polish. The Design Canvas, the Traffic Simulation panel, the Concept Simulations and the UML Class Builder get only a light touch: their chrome (panels, buttons, text, borders) moves to the semantic tokens. Their layout, interaction and the `--canvas-*`/`--series-*` palettes stay as they are. All the decisions in 34 apply here: visual changes only, no component library, AA contrast in both themes, 375px, and the same done-per-slice checks.

**Blocked by:** 34

**Status:** ready-for-agent

- [ ] Challenges list (`ChallengesPage.tsx`).
- [ ] Challenge (`ChallengePage.tsx` and `src/ui/challenge/`): stages, hints, scoring and the Reference Solution view.
- [ ] Sandbox page frame (`SandboxPage.tsx`).
- [ ] Light touch on the chrome in `src/ui/canvas/` (Design Canvas, palette, `SimulationPanel.tsx`, UML Class Builder) and `src/ui/concept-simulations/`. Nothing deeper.
- [ ] At 375px the page frame has no horizontal page scroll. Inside the canvas itself, the existing pan and zoom behaviour stays as it is.
- [ ] `DESIGN.md` gains whatever patterns this slice settles, and notes that the canvas internals were deliberately left for a later ticket.
- [ ] Verify: each page checked in the built-in browser pane in dark, light and at 375px, and the full E2E suite green. One commit on `main`, no push.

## Comments

### Note from 35 (2026-11-03)

- Measured on `/lessons/cap-theorem` in the light theme: `CapSimulation`'s "Şəbəkəni kəs" button (`border-red-400/70`) is 1.8:1 and its "Uğurlu" label (`text-emerald-300`) is 1.5:1. The status colours are not mirrored, so they fail badly on a light page. In the dark theme its `text-xs text-zinc-500` notes are 4.1:1.
- `ChoiceOptions` in the Challenge deep-dive stage already uses the tokens, because 35 moved it with the Lesson quiz.
