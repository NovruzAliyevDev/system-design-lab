# UI colour comes from nine semantic tokens with a dark and a light value

Components colour themselves with nine semantic tokens rather than raw Tailwind scales (ticket 34):
`surface`, `surface-raised`, `border`, `text`, `text-muted`, `accent`, `danger`, `warning` and `success`.
They live in `@theme` in `src/index.css`, so Tailwind generates `bg-surface`, `text-text-muted`,
`border-border` and so on. `@theme` holds the dark value. `html:not(.dark)` overrides it with the light
value, the same switch the light theme already used.

Before this, the UI was styled dark-first with `zinc-*` and `sky-*`. The light theme mirrored those
scales in reverse, so `zinc-950` became the lightest shade. That kept components free of light variants,
but it had two costs:
- Status colours were never mirrored. `red-400`, `rose-400` and `amber-300` stayed tuned for a dark page.
- The text greys drifted into six shades. Four of them sat at or below AA:
  - `zinc-500` was 4.1:1 on the dark page and 3.7:1 on a dark card;
  - in the light theme it was not mirrored at all.

A token names the role, so each theme can pick a value that meets AA for that role.

We chose a short list over a full scale of tokens, so that the choice a component makes is about
meaning, not shade:
- **Two text tokens.** Hierarchy comes from size and weight. `text-muted` is the old `zinc-400`, which
  passes on both surfaces in both themes.
- **One border.** In the dark theme it is the old `zinc-700` (1.9:1), because `zinc-800` all but vanished
  on the dark page (1.4:1). The light theme keeps the value the mirroring already gave controls (1.4:1).
  Neither reaches 3:1, so a border is never the only cue that something is a control or is selected.
  Lighter dividers use an opacity modifier such as `border-border/60`.
- **Sky stays the accent.** In the light theme it is the darker sky that the mirroring already used for
  accent text.
- **`danger` is one colour.** The old red and rose are merged.

Spacing and radius stay on Tailwind's scale. They had not drifted.

## Consequences

- Every text token reaches at least 4.5:1 on `surface` and on `surface-raised`, in both themes. The
  values and their measured ratios are in `DESIGN.md`.
- Accent text on an accent tint uses `accent/10`. The light theme is the constraint: there `accent/15`
  measures about 4.5:1, right at the AA floor, against about 4.85:1 for `accent/10`.
- Primer prose follows the tokens. `.prose` sets the typography plugin's variables, and its
  `prose-invert` variables, to token values. So `dark:prose-invert` changes nothing, and code blocks
  read as `surface-raised` in both themes.
- The `--canvas-*` and `--series-*` palettes stay outside the tokens. They are data colours, already
  calibrated for both themes.
- The zinc and sky mirroring stays until tickets 35–37 have moved every page onto the tokens. Then it is
  deleted.
