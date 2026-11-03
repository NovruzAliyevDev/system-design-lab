# 34: Design polish: foundation and shell

**What to build:** The first slice of an audit-and-polish pass over every page with the `impeccable` skill. The site keeps its current identity: the zinc neutrals, the sky accent, and dark and light themes. This is not a redesign. The goal is consistency. This slice audits the whole site, lays down the shared foundation (semantic colour tokens and self-hosted fonts), and polishes the shell that every page shares. Tickets 35–37 then apply the same foundation page by page.

**Blocked by:** None

**Status:** resolved

## Decisions (apply to 34–37)

- **Audit and polish, not a redesign.** Hierarchy, spacing, typography, colour consistency and accessibility get fixed. The palette and character stay.
- **Visual changes only.** Markup, ARIA roles, accessible names and the Azerbaijani UI strings (i18n keys) stay as they are. Markup changes only where a fix truly needs it, and any E2E test that change breaks is updated with it. UI strings are touched only for obvious mistakes.
- **No component library.** No new `Button`/`Card`/`Badge` components. A class bundle repeated 5+ times may become a class constant (e.g. `const buttonClass = …`) next to where it is used.
- **Semantic colour tokens** in `@theme` (`src/index.css`): `surface`, `surface-raised`, `border`, `text`, `text-muted`, `accent`, `danger`, `warning`, `success`. Each has a dark and a light value. Components move from raw `zinc-*`/`sky-*`/status classes to the tokens. Spacing and radius stay on Tailwind's scale.
- **Colours.** Sky stays the accent. `danger` is a single colour: red and rose are merged. The `--canvas-*` and `--series-*` palettes are not touched, because they are already calibrated for both themes.
- **Accessibility.**
  - WCAG 2.2 AA contrast in both themes.
  - A visible focus ring on every interactive element.
  - `prefers-reduced-motion` respected.
  - A 44px touch target for the main controls on mobile.
- **Responsive.** Every page works at 375px wide with no horizontal page scroll.
- **Done per slice.**
  1. Every page in the slice is checked in the built-in browser pane in dark, light and at 375px.
  2. The full E2E suite (`npm run test:e2e`) passes. The maintainer has allowed the full E2E run for these tickets. Vitest is not run, since it covers no UI.
  3. The slice lands on `main` as one commit, with no push.

## Scope of this slice

- [x] **Audit.** Run an `impeccable` audit across all 14 routes and the shell. Record the findings per page in this ticket's Comments, so 35–37 start from them.
- [x] **Tokens.** Add the semantic colour tokens to `@theme` with dark and light values that meet AA. Record the token decision as `docs/adr/0002-semantic-colour-tokens.md`.
- [x] **Fonts.** Inter and JetBrains Mono are named in `--font-sans`/`--font-mono` but never loaded. Self-host them with `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`. Google Fonts would break offline use (ticket 04). Make sure the service worker precaches the font files.
- [x] **Shell.** Polish and move to the tokens: the header and navigation (`App.tsx`), search (`Search.tsx`), the table of contents (`TableOfContents.tsx`), the update prompt (`UpdatePrompt.tsx`) and the attribution (`Attribution.tsx`).
- [x] **Global.** Focus ring, reduced motion and base typography (`@tailwindcss/typography` prose settings) in `src/index.css`.
- [x] **DESIGN.md.** Write `DESIGN.md` at the repo root from the shipped code (`impeccable-documenter`). Tickets 35–37 extend it.
- [x] **Verify.** The shell checked on several pages in dark, light and at 375px, and the full E2E suite green.

## Comments

### Audit (2026-11-03, before this slice)

How it was run:
- The `impeccable detect` scan ran on all 14 routes, at 1280×800 and at 375×812.
- The source was reviewed by hand.
- The token contrast was measured.

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | `text-zinc-500` (108 uses) is 4.1:1 on the page and 3.7:1 on a card, so it fails AA. Four list pages remove the focus ring. |
| 2 | Performance | 3 | No issues of note. The fonts were named but never loaded. |
| 3 | Theming | 2 | No semantic tokens. The light theme works by mirroring zinc and sky, but the status colours were never mirrored. Red and rose are used side by side. |
| 4 | Responsive | 3 | Every page fits at 375px. Header controls were about 24px tall. At 1024px the header overflowed by 3px once Inter loaded. |
| 5 | Implementation integrity | 3 | The identity is coherent. The drift is in colour roles, not in structure. |
| | **Total** | **13/20** | Acceptable: consistency work, no redesign. |

The detector also flags `overused-font` (Inter) on every route. This is intentional: the decisions pin Inter.

Shell findings, all fixed in this slice:
- The table of contents group headings, the search `kbd` hint and the footer failed AA. They now use `text-muted`.
- On a phone, the header controls were 24px. They are now 44px, and every header control shows an icon only, including the table of contents toggle. This keeps a 360px phone from overflowing.
- The header links had no current-page state. They are now `NavLink`s, underlined in the accent.
- The attribution links were marked by colour only. They are now underlined.
- The update prompt had two equal buttons. "Yenilə" is now the primary button.
- No focus ring was defined, so the browser default showed. There is now one global accent ring.
- The search input removed its focus ring. The ring is now drawn inset.
- On canvas pages from `lg` up, the table of contents toggle was hidden, so the drawer could not be opened. The toggle now shows there.
- Seven header links in Inter overflow a 1024px header. The header links them from `xl` up. Below that, the table of contents lists them.

Findings per page, for 35–37. Every page uses `text-zinc-500`, which fails AA, and moves to `text-muted`. The counts are uses of `text-zinc-500` per file.

**Reading pages (35)**
- **Lesson list.** The ordinal `span.w-8` fails AA. The rows set `focus-visible:outline-none` and show only a zinc-900 background, which is too faint as a focus state.
- **Lesson.**
  - The meta line, the figure captions (`figure > p.text-xs`) and the "related" card subtitles fail AA.
  - `LessonPage` has `py-0.5` buttons.
  - Prose runs to about 105 characters a line (`max-w-none` inside `max-w-3xl`). Aim for 65–75ch.
  - The `prose-a:text-sky-400` override is redundant now that `.prose` uses the tokens.
  - `LessonQuiz` uses red and rose plus 4× `zinc-500`. `AppendixTables` has 4× `zinc-500`.
- **Glossary.**
  - Each term's `dd.text-xs` category line fails AA: 60 findings.
  - The definitions run to 95–103 characters a line, with 19 one-word last lines. Add `text-pretty` and a max width.
- **Solutions and Solution.**
  - The list rows remove the focus ring.
  - The Solution page has a skipped heading level.
  - At 375px the headings are unbalanced and the text leaves one-word last lines. Add `text-balance` and `text-pretty`.
- **Study Guide.** 2× `zinc-500`.

**Practice pages (36)**
- **Dashboard.** No AA failures once the shell is fixed. The cards are the stat-tile pattern. Keep them, but check the hierarchy.
- **Flashcards.**
  - The `dt.text-xs` labels in every deck card fail AA (15 findings), as do the footnotes.
  - Red and rose are used for the grades.
- **Calculators.**
  - The field hints (`label > span.text-zinc-500`) fail AA.
  - Red is used for invalid input (`aria-invalid:border-red-500`). Move it to `danger`.
- **Skill Tree.**
  - The intro paragraph runs to 122 characters a line.
  - The mastery list rows remove the focus ring.
  - 9× `zinc-500`.
  - The React Flow attribution is 4.3:1 at 10px.
- **Settings.** The `fieldset > p.text-xs` hints fail AA. The danger actions use red.

**Challenges and sandbox (37)**
- **Challenges list.** The meta spans fail AA. The rows remove the focus ring.
- **Challenge.**
  - 10× `zinc-500` in `ChallengePage` plus more in `challenge/`.
  - The task paragraph runs to 150 characters a line.
  - `MockInterview` switches between rose and sky for overtime. Its sticky offset now uses `top-header`, changed in this slice.
  - `RuleFeedback` has `py-0.5` buttons.
- **Sandbox.**
  - The primary button `bg-sky-600 text-white` is 4.0:1, so it fails AA. Use `bg-accent text-surface`.
  - The palette abbreviations ("LB", "SQL" and others) are 10px and 3.7:1 on the card.
  - The canvas helper text fails AA.
- **Concept Simulations.** They nest cards inside the Lesson card (4–5 "nested-cards" findings). Their controls are `py-0.5`/`py-1` buttons. `CapSimulation` and `ReplicationSimulation` use red and rose. They already honour `prefers-reduced-motion`.
- **Design Canvas, Skill Tree map and UML Class Builder.** React Flow's unlayered stylesheet sets `outline: none` on focused nodes and edges, which beats the global `:focus-visible` ring in `@layer base`. Restore a visible focus indicator there.
