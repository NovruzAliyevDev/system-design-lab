# 37: Design polish: Challenges and sandbox

**What to build:** Apply the design foundation from ticket 34 to the Challenge pages and the sandbox. The page frame around the interactive surfaces gets the full polish. The Design Canvas, the Traffic Simulation panel, the Concept Simulations and the UML Class Builder get only a light touch: their chrome (panels, buttons, text, borders) moves to the semantic tokens. Their layout, interaction and the `--canvas-*`/`--series-*` palettes stay as they are. All the decisions in 34 apply here: visual changes only, no component library, AA contrast in both themes, 375px, and the same done-per-slice checks.

**Blocked by:** 34

**Status:** resolved

- [x] Challenges list (`ChallengesPage.tsx`).
- [x] Challenge (`ChallengePage.tsx` and `src/ui/challenge/`): stages, hints, scoring and the Reference Solution view.
- [x] Sandbox page frame (`SandboxPage.tsx`).
- [x] Light touch on the chrome in `src/ui/canvas/` (Design Canvas, palette, `SimulationPanel.tsx`, UML Class Builder) and `src/ui/concept-simulations/`. Nothing deeper.
- [x] At 375px the page frame has no horizontal page scroll. Inside the canvas itself, the existing pan and zoom behaviour stays as it is.
- [x] `DESIGN.md` gains whatever patterns this slice settles, and notes that the canvas internals were deliberately left for a later ticket.
- [x] Verify: each page checked in the built-in browser pane in dark, light and at 375px, and the full E2E suite green. One commit on `main`, no push.

## Comments

### Note from 35 (2026-11-03)

- Measured on `/lessons/cap-theorem` in the light theme: `CapSimulation`'s "Şəbəkəni kəs" button (`border-red-400/70`) is 1.8:1 and its "Uğurlu" label (`text-emerald-300`) is 1.5:1. The status colours are not mirrored, so they fail badly on a light page. In the dark theme its `text-xs text-zinc-500` notes are 4.1:1.
- `ChoiceOptions` in the Challenge deep-dive stage already uses the tokens, because 35 moved it with the Lesson quiz.

### Done (2026-11-03)

- **Tokens.** Challenges, Challenge (Stages, Hints, scoring, Mock Interview, Reference Solution), Sandbox, the canvas chrome (`src/ui/canvas/`) and the Concept Simulations are on the semantic tokens. No raw `zinc`/`sky`/`red`/`rose`/`amber`/`emerald` class is left in these files. The primary button is `bg-accent text-surface`; the old `bg-sky-600 text-white` was 4.0:1.
- **React Flow.** `src/index.css` maps React Flow's own variables (ground, dots, zoom controls, attribution, edge labels) to the tokens on every canvas. It also puts the global focus ring back on keyboard-focused nodes and edges, which React Flow's stylesheet removed. Both apply to the Skill Tree map too.
- **Contrast.** The audit's `zinc-500` failures, the 10px palette tags and the CapSimulation failures noted by 35 are fixed. Two states were changed after measuring them:
  - The current Stage step has no `accent/10` fill, because its `success` result was 4.4:1 on the tint in the light theme. It gets a 2px `accent` edge instead.
  - Overloaded and down canvas nodes are no longer tinted or faded. Their border, ring and words carry the state, because a `danger` tint put `warning` text at 3.7:1 and 75% opacity put `text-muted` at 4.0:1.
- **Touch targets.** Every button, field, select and summary that shows on a phone is 44px there. That covers Stage steps, rubric levels, Hint buttons, the "Bax" and "back to the current Attempt" buttons, the simulation controls and the compare summaries.
- **Focus.** The Challenges list rows have their focus ring back. The rubric levels, whose radios are visually hidden, draw the ring on the label (`has-focus-visible`).
- **Smaller fixes.**
  - A Stage's task is capped at `max-w-prose`; it was about 150 characters a line.
  - The Mock Interview timer stays on `surface/90`. Overtime shows as a `danger` border and clock.
  - The design compare view's `h4`s became `h3`s, because they followed `h2` panels and skipped a level.
- **DESIGN.md.** It records the patterns under "Challenges and sandbox (ticket 37)". It also notes that the canvas internals (layout, sketch mode, `--canvas-*`/`--series-*`, pan and zoom, and the nested boxes in Concept Simulations) were left for a later ticket.
- **Verification.**
  - The Browser pane was hidden for the whole session, so the checks are script measurements, not visual reviews. The script measured text contrast against the composited background, horizontal overflow, phone touch targets and heading order.
  - The pages measured were Challenges, Sandbox, a Challenge in every state (each Stage over, Hints open, simulation running, a finished Attempt summary, a Mock Interview timer and self-assessment, an earlier Attempt read-only), and the five Concept Simulation lessons. Each was measured at 1024px and 375px, in dark and light.
  - Keyboard focus on canvas nodes and edges was checked with real Tab presses.
  - The full E2E suite passed, 33/33.
  - The verification created two Attempts of the URL shortener Challenge in the pane's local progress.
