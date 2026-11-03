---
name: system-design-lab
description: Interactive Azerbaijani-language study site built on the English system-design-primer.
colors:
  surface: "oklch(14.1% 0.005 285.823)"
  surface-raised: "oklch(21% 0.006 285.885)"
  border: "oklch(37% 0.013 285.805)"
  text: "oklch(96.7% 0.001 286.375)"
  text-muted: "oklch(70.5% 0.015 286.067)"
  accent: "oklch(74.6% 0.16 232.661)"
  danger: "oklch(70.4% 0.191 22.216)"
  warning: "oklch(82.8% 0.189 84.429)"
  success: "oklch(76.5% 0.177 163.223)"
  surface-light: "oklch(98.5% 0 none)"
  surface-raised-light: "oklch(96.7% 0.001 286.375)"
  border-light: "oklch(87.1% 0.006 286.286)"
  text-light: "oklch(21% 0.006 285.885)"
  text-muted-light: "oklch(44.2% 0.017 285.786)"
  accent-light: "oklch(50% 0.134 242.749)"
  danger-light: "oklch(50.5% 0.213 27.518)"
  warning-light: "oklch(55.5% 0.163 48.998)"
  success-light: "oklch(50.8% 0.118 165.612)"
typography:
  body:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  title:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  ui:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
  mono:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace"
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  full: "9999px"
spacing:
  header: "3.5rem"
  header-sm: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  header-control:
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "44px"
    width: "44px"
  nav-item-active:
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "8px"
  dialog:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
---

# Design System: system-design-lab

## Overview

The site keeps the identity it was built with: zinc neutrals, a single sky accent, dark-first with a full light theme. The design-polish pass (tickets 34–37) is about consistency and accessibility, not a redesign. This file records what the shipped code does. Ticket 34 covers the foundation and the shell. Tickets 35–37 add page patterns under **Page patterns** below.

It is a quiet reading and practice tool. Surfaces are flat. The accent marks what you can act on and where you are. Primer content is English and reads as long-form prose. The UI around it is Azerbaijani and set small and muted, so the content leads.

**Key Characteristics:**
- Dark theme by default (the `.dark` class on `html`). The light theme swaps the token values under `html:not(.dark)`, so components never need `dark:` variants for token colours.
- One accent (sky). Status colours (danger, warning, success) only carry meaning, never decoration.
- Flat, bordered surfaces. Shadows appear only on overlays.
- No component library. Shared styling lives in tokens and Tailwind utilities.
- The UI language is Azerbaijani, through i18n keys. Primer content (lessons, titles) is English and marked `lang="en"`.

## Colors

Cool zinc greys with a hue near 286, a sky-blue accent, and three status hues. Every value is OKLCH and defined in `src/index.css` `@theme`. The frontmatter keys without a suffix hold the dark values; the `-light` keys hold the values under `html:not(.dark)`. In code each pair is one token (`bg-surface`, `text-accent`, …) that follows the theme.

### Primary
- **Sky Accent** (`accent`): links, the primary button fill, the current-page underline, the active table-of-contents row, the focus ring, `accent-color`, the caret and the selection tint (accent mixed to 30%). The light value is a darker sky so it stays readable on a pale surface.

### Neutral
- **Zinc Ground** (`surface`): the page background, and the header at 90% opacity with a backdrop blur.
- **Raised Zinc** (`surface-raised`): dialogs, the update prompt, code blocks in prose, and the hover fill of navigation rows.
- **Zinc Rule** (`border`): every divider, control outline, header and footer rule, and the scrollbar thumb.
- **Ink** (`text`): headings, titles and active labels.
- **Muted Ink** (`text-muted`): secondary UI text, metadata, inactive navigation, and the hover border of bordered controls.

### Status
- **Danger** (`danger`): errors and wrong answers. It is one colour: the old red and rose are merged into it.
- **Warning** (`warning`): cautions. At 25% opacity it is also the search-match highlight.
- **Success** (`success`): correct and completed states.

### Measured contrast (WCAG, on surface / surface-raised)
| Token | Dark | Light |
|---|---|---|
| text | 18.1 / 16.1 | 17.0 / 16.1 |
| text-muted | 7.6 / 6.7 | 7.4 / 7.0 |
| accent | 9.1 / 8.1 | 5.6 / 5.3 |
| danger | 6.9 / 6.1 | 6.2 / 5.8 |
| warning | 11.6 / 10.3 | 4.8 / 4.6 |
| success | 10.3 / 9.2 | 5.1 / 4.9 |

### Separately calibrated palettes
- **Canvas edges** (`--canvas-read`, `--canvas-write`, `--canvas-both`): Design Canvas edges, coloured by the traffic they carry. They have their own light values.
- **Series** (`--series-1` … `--series-8`): Concept Simulation series, in a fixed order (server or node *i* always wears slot *i*). They have their own light values.

These are calibrated for both themes and are never derived from or changed by the semantic tokens.

### Named Rules
**The Token-Only Rule.** Components use the semantic tokens, never raw `zinc-*`, `sky-*`, `red-*`, `rose-*`, `amber-*` or `emerald-*` classes.

**The Ten-Percent Tint Rule.** A tinted active state is `accent/10` behind accent text. The light theme is the constraint: there `accent/10` measures about 4.85:1 and `accent/15` about 4.5:1, right at the floor, so stronger tints are not used. A tint is too faint (about 1.15:1) to be the only cue for an active item, so a selected option also gets a 1px inset `accent` ring.

**The AA Floor Rule.** Every text token meets 4.5:1 on both `surface` and `surface-raised` in both themes. A new token or tint has to be measured before it ships.

## Typography

**Body Font:** Inter Variable (falling back to Inter, ui-sans-serif, system-ui)
**Mono Font:** JetBrains Mono Variable (falling back to JetBrains Mono, ui-monospace)

Both are self-hosted through `@fontsource-variable/*`, imported in `src/main.tsx`, so the service worker precaches them and the type still works offline. Google Fonts or any other CDN font is not allowed.

**Character:** one neutral sans for everything, with mono only for code. Hierarchy comes from size, weight and the text/text-muted split, not from a second display face.

### Hierarchy (shell)
- **Title** (600, 1rem): the site title in the header.
- **UI** (400–500, 0.875rem): navigation, buttons, search results, prompts.
- **Label** (400, 0.75rem): metadata, result context, keyboard hints, the footer.
- **Prose** (Tailwind Typography `.prose`): primer content. Body text is `text` mixed 80% with `text-muted`. Headings, bold, quotes and code use `text`. Links use `accent`. Rules, bullets and table borders use `border`. `pre` uses `surface-raised`. The mapping sets the `--tw-prose-*` and `--tw-prose-invert-*` variables to the same values, so the prose follows the theme with or without `prose-invert`.

Page heading sizes are recorded per slice under **Page patterns**.

## Layout

- **Header:** sticky, `z-30`, `--spacing-header` tall (3.5rem below 40rem, 3rem from 40rem up; utilities `h-header` and `top-header`). Anything sticky or fixed below it, such as the drawer or a page's sticky bar, is offset by the same token.
- **Sidebar:** from `lg` up, the table of contents is a sticky 18rem (`w-72`) column with a right border. Below `lg`, and on canvas pages (Sandbox, Challenge, Skill Tree) at every width, it is a fixed drawer under the header (full width below `lg`, 18rem from `lg` up), opened by the header button. The pages besides the Lessons are linked from the header from `xl` up; below `xl` the table of contents lists them at its top. Seven links do not fit a 1024px header in Inter.
- **Content:** reading pages use a centred `max-w-3xl` column (`px-4 py-8`). Canvas pages take the full width (`px-4 py-6`). The footer shares the reading column width.
- **Spacing and radius** stay on Tailwind's default scale. No custom spacing tokens besides `header`.
- **Responsive floor:** every page works at 375px wide with no horizontal page scroll. Wide content, such as tables and canvases, scrolls inside its own container.

## Elevation & Depth

Flat by default, separated by tone: `surface` versus `surface-raised`, plus 1px `border` rules. Shadows are used only on elements that float over the page.

### Shadow Vocabulary
- **Prompt** (Tailwind `shadow-lg`): the fixed update prompt.
- **Modal** (Tailwind `shadow-2xl`, with a `black/60` backdrop): the search dialog.
- **Tooltip** (Tailwind `shadow-lg`, as the prompt): the Glossary tooltip in primer text.

### Named Rules
**The Float-Only Shadow Rule.** A shadow means the element floats over content. Cards and sections in the page flow use a border, not a shadow.

## Shapes

Slightly rounded corners with thin borders. Controls, rows and small containers use 0.25rem (`rounded`). Dialogs use 0.5rem (`rounded-lg`). Highlights inside text use `rounded-sm`. Full rounding is kept for dots and markers. Borders are always 1px in `border`. Focus rings follow the element's radius.

## Components

### Buttons
Buttons are bordered and links are not. The border helps tell them apart, but it is below 3:1 (1.9:1 dark, 1.4:1 light), so it is never the only cue: a control is identified by its label or icon, and its state by text, weight, an underline or a ring.
- **Shape:** 0.25rem radius, 1px border, `px-3` (`px-2` for icon buttons).
- **Primary:** `accent` fill and border, `surface` text, 500 weight. Hover drops to 90% opacity.
- **Secondary:** `border` outline on the parent surface, inheriting text colour. Hover moves the border to `text-muted`.
- **Size:** at least 44px tall (`min-h-11`) below `sm`, and 32px (`min-h-8`) from `sm` up.
- **Class constants:** when a button class bundle is repeated 5+ times, it may become a local constant next to where it is used (`UpdatePrompt.tsx` has an older two-use `buttonClass`; new code waits for five uses). Never a shared `Button` component.

### Links
- **Text links** (attribution, meta lines, link lists, prose): the `link` utility in `src/index.css`. It gives `accent` text, underlined at 40% accent with a 2px offset, and the underline becomes full accent on hover. Prose links get the same colour from the prose mapping.
- **Navigation links** are not underlined at rest (see Navigation). Neither are rows and cards that are a link as a whole.

### Inputs / Fields
- **Search input:** no box of its own. It is a full-width row in the dialog with a bottom `border`, a transparent background, and a `text-muted` placeholder. Its focus ring is drawn inset (`-outline-offset-2`, top corners rounded to the dialog), so the dialog edge does not clip it.

### Navigation
- **Header links** (from `xl` up): 0.875rem `text-muted`, `text` on hover. The current page is `text` with a 2px `accent` underline at a 6px offset, so it is marked by more than colour. On a phone the icon-only Settings link has nothing to underline, so the current page gets a 1px `accent` ring instead.
- **Header controls on phones:** the table-of-contents button, search and settings are 44×44px (`min-h-11 min-w-11`) below `sm`. They show an inline 20px SVG icon only, and the label stays for screen readers (`max-sm:sr-only` or `aria-label`). From `sm` up they show the text label.
- **Table of contents rows:** two levels. Top-level entries (the header pages listed below `xl`, single-Lesson groups and group headings) are 0.875rem `text`: links at 500, group headings at 600 and not links. The Lessons in a group are 0.875rem 400 `text-muted`, `text` on hover, indented on a 1px `border` rule (`ml-2 border-l pl-1.5`). So a level reads from colour, weight and indent together. Groups are 1.25rem apart. Every link row gets a `surface-raised` fill on hover. The active row is `accent/10` fill with `accent` text and 500 weight. Rows are 44px on phones (`py-3`) and compact from `sm` up (`py-1`).
- **Search results:** the active option has an `accent/10` fill and a 1px inset `accent` ring. The title is `text` and 500 weight, the context and snippet are `text-muted`, and matches are highlighted with `warning/25` in `text` colour (muted text on the highlight would fall to 3.8:1).

### Overlays
- **Search dialog:** native `<dialog>`, `surface-raised`, `border`, 0.5rem radius, modal shadow, up to 40rem wide (full width minus 2rem on phones). It opens 10vh from the top and is at most 80vh tall.
- **Update prompt:** fixed at the bottom (`inset-x-4 bottom-4`, right-aligned from `sm` up), `surface-raised`, bordered, prompt shadow, with a primary and a secondary button. It uses `role="status"`.

### Global behaviour (`src/index.css`)
- **Focus:** `:focus-visible` gets a 2px solid `accent` outline at a 2px offset on every element. A component may replace it only with an equally visible indicator. React Flow's own stylesheet removes it on canvas nodes and edges, so `src/index.css` puts it back there with a more specific unlayered rule.
- **Native controls:** `accent-color` and `caret-color` are `accent`. `scrollbar-color` is `border` on transparent.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, motion stops but state stays. For example, an animated Design Canvas edge stays dashed, but the dashes stop moving.

## Do's and Don'ts

### Do:
- **Do** use the semantic tokens (`surface`, `surface-raised`, `border`, `text`, `text-muted`, `accent`, `danger`, `warning`, `success`) for every new or migrated surface.
- **Do** mark the current page or item with more than colour (an underline, weight or fill).
- **Do** keep main controls 44px below `sm`, icon-only with a screen-reader label.
- **Do** keep the global focus ring on every interactive element.
- **Do** check every page at 375px, in dark and in light.
- **Do** keep UI strings in Azerbaijani i18n keys and mark English primer text with `lang="en"`.
- **Do** use `danger` for every error or wrong state.

### Don't:
- **Don't** add a component library or shared `Button`/`Card`/`Badge` components.
- **Don't** add custom spacing or radius values outside Tailwind's scale (the `header` height token is the only exception).
- **Don't** underline buttons or put borders on links.
- **Don't** use `accent/15` or stronger tints behind accent text.
- **Don't** change `--canvas-*` or `--series-*` when retuning the tokens.
- **Don't** load fonts from a CDN. The site has to work offline.
- **Don't** use `outline-none` without an equally visible replacement indicator.

## Page patterns

Each slice adds its page-level patterns here, built only on the tokens and rules above.

### Reading pages (ticket 35)
Lesson list, Lesson, Glossary, Solutions, Solution and Study Guide.

- **Page heading:** `text-2xl` 600 `text` for list pages, and `text-3xl` 600 for a Lesson or Solution title, which is English and `text-balance`. Under it sits a `text-sm` `text-muted` line: a count, a description, or the source and attribution links.
- **Primer prose:** `PRIMER_PROSE_CLASS` caps running text (paragraphs, lists, quotes and headings) at `max-w-xl` (576px), about 75 characters a line in Inter at 16px. Images, tables, code blocks and the interactive tables that replace them keep the full `max-w-3xl` column, as do the title, the quiz and Concept Simulations. The same class styles Flashcard faces. Headings are `text-balance` and paragraphs `text-pretty`. Code blocks have a `border` outline, because `surface-raised` alone barely shows on the light page. Images keep their white plate, because primer diagrams are drawn for a white page.
- **Heading levels:** the primer's sections often open with `####` or skip a level. `nestHeadings` (Core) renumbers the levels under the page's `h1`, so no level is skipped. Anchors are unchanged, because they come from the source. Each stretch of Lesson text between Concept Simulations is nested on its own.
- **List of links:** a `rounded-lg border border-border` list with `divide-border/60` rows. Each row is a whole-row link, `px-4 py-2.5` (44px for one line), `surface-raised` on hover. The focus ring is drawn inside the row (`-outline-offset-2`). An ordinal is `font-mono text-xs text-muted`. A second link in a row, such as Solutions' "Çağırış kimi həll et", goes under the title on a phone, lined up with it, and to the right of the title from `sm` up.
- **Glossary entry:** the term is 500 `text`, aliases are `text-xs text-muted`, and the explanation is `text` at `max-w-prose` with `text-pretty`. An entry opened by its link (`:target`) gets an `accent/10` fill and a 1px inset `accent` ring.
- **Segmented tabs** (Study Guide timelines): a bordered `p-1` strip of equal buttons, 44px on a phone. The selected tab follows the Ten-Percent Tint Rule: `accent/10`, `accent` text, 500 weight, and a 1px inset `accent` ring.
- **Callout** (Solution's Challenge hint): `accent/30` border, `accent/10` fill, `text` text.
- **Lesson navigation cards:** bordered `rounded-lg p-4` links, with a `text-xs text-muted` label over the English title. Hover moves the border to `text-muted`.
- **Quiz:** the question cards are bordered. Each answer row is a whole-row `label`, 44px tall. A checked answer marks the row border `success/60` or `danger/60` and repeats the result in words (✓/✗ plus text), so the colour is never the only cue. The verdict is `success`, `warning` (partly right) or `danger`. Buttons use the secondary style, and ↑/↓ are 44×44px on a phone.
- **Sortable table** (appendix tables): a `border` outline with a `surface-raised` header in `text-muted`, `divide-border/60` rows and right-aligned mono numbers. The filter field is `surface-raised`, 44px on a phone. A sort button has a 28px target inside its header cell: table headers are not main controls, so they meet the 24px floor of WCAG 2.5.8 rather than 44px.
- **Glossary term in prose:** a dotted `text-muted` underline that turns `accent` on hover. Its tooltip is `surface-raised`, bordered and `rounded-lg`, with the tooltip shadow.
- **Read marker:** a `success` ✓ with a screen-reader label.

### Practice pages (ticket 36)
Dashboard, Flashcards, Calculators, Skill Tree and Settings.

- **Page heading:** as on the reading pages, `text-2xl` 600 `text` over a `text-sm` `text-muted` description. A long description is capped at `max-w-prose` with `text-pretty` (the Skill Tree's ran to 122 characters a line).
- **Stat tiles** (Dashboard blocks): bordered `rounded-lg p-4` sections in a two-column grid from `sm` up. The label is the `h2`, `text-sm` 500 `text-muted`. The figure is `text-3xl` 600 `text` with `tabular-nums`, or a `text-lg` 500 title when the tile names a Lesson, Challenge or topic. A `text-sm text-muted` detail sits under it, and the tile's one action is a `link` pinned to the bottom (`mt-auto`). A streak that counts today says so in `success`, in words.
- **Deck stats:** each Deck is a bordered card with a five-column `dl`: `text-xs text-muted` labels over `text-lg` `text` numbers in `tabular-nums`.
- **Mastery:** four levels, each with a colour and a mark, so a level reads without its colour. The mark is a 12px circle filled as far as the level goes: an empty ring (none, `text-muted`), a quarter (started, `warning`), a half (past half, `accent`) and a full disc (mastered, `success`). The legend, the map's nodes and the list rows show the mark before the percentage. The bar is a 6px `rounded-full` track in `border` with the level's colour as its fill. A map node is a `surface-raised` card with a 2px border in the level's colour (plain `border` with no Mastery), and a topic recommended for later is dashed `text-muted` with the words. The selected node has a 2px `accent` ring offset by 2px from its border, so it shows on a past-half node whose border is `accent` too. Measured in the light theme, the weaker one: the `warning` bar on its track is 3.4:1, and the marks are at least 4.5:1 on `surface-raised`.
- **Skill Tree map:** React Flow's chrome follows the tokens (see Challenges and sandbox). Its edges are `text-muted` (`--xy-edge-stroke-default`, set on the map only): React Flow's own grey was 2:1 on the page in both themes. Met prerequisites are solid and unmet ones dashed.
- **Lists:** the Skill Tree list is a list of links (see Reading pages), with the mark and percentage on the right. Its rows are `py-3`, because each holds a title and a bar. In a topic's details every link is 44px tall on a phone, where the details fill the page, and inline text from `sm` up. The prerequisites are text links, not bordered chips.
- **Flashcard review:** the card is a bordered `rounded-lg` article. "Cavabı göstər" is the Primary button, 48px tall (`min-h-12`), because it is the one action at that point. The four grades are 48px outlined buttons in a grid: "Yenidən" has a `danger/60` border and a `danger/10` hover, "Çətin" `border` and a `surface-raised` hover, "Yaxşı" `success/60` and `success/10`, and "Asan" `accent/60` and `accent/10`. The label and the next interval are in words, so the colour is only a hint. On a phone both bars stick to the bottom of the screen on `surface`, above the safe area. The explanation is a `surface-raised/50` box under a `text-xs` uppercase `text-muted` `h2`.
- **Form controls:** text fields and selects are `surface-raised` with a `border` outline and `text`, 44px on a phone and 32px from `sm` up. An invalid count field turns its border `danger`. The Calculators show an invalid entry as a `danger` alert under the fields. Radio options are whole `label`s, 44px on a phone. A hint under a Settings control is `text-xs text-muted` at `max-w-prose`. A Calculator field's hint is a `text-muted` aside in brackets inside its label.
- **Calculator results:** a bordered `dl` with `divide-border/60` rows, `text-sm text-muted` names and `text` values. The other periods of a rate are `text-sm text-muted` after the per-second value. The worked steps are `font-mono text-xs text-muted` on `surface-raised/50`, with each step's name and result in `text`. The latency examples are Secondary buttons, one per line, and the ratio is `text-3xl` 600 `tabular-nums`.
- **Settings actions:** export, import and reset are Secondary buttons. The import button is a `label` around a visually hidden file input, so it draws the focus ring itself (`has-focus-visible:outline-2`). The confirming "Bəli, sıfırla" is a danger fill: `danger` fill and border with `surface` text (6.2:1 light, 6.9:1 dark). The result line under the actions is `success` or `danger` text, in words.

### Challenges and sandbox (ticket 37)
Challenges, Challenge (its Stages, Hints, scoring and the Reference Solution), Sandbox, and the chrome of the Design Canvas, the Traffic Simulation panel, the UML Class Builder and the Concept Simulations.

- **Page frame:** the Challenges list is a list of links (see Reading pages), each row with a `text-xs text-muted` meta line. The Challenge title is `text-2xl` 600 `text-balance`, under a `text-sm text-muted` source line. A Stage's task is `text-sm` `text` at `max-w-prose` with `text-pretty`.
- **Buttons:** `primaryButtonClass` and `buttonClass` in `challenge/shared.tsx` are the Primary and Secondary styles from Components. Canvas toolbars keep their own local `buttonClass` with `text-xs` and `px-2`. Every button, field and select that shows below `sm` is 44px there. The palette and the canvas editing toolbar only show on the editable canvas, from `md` up. A Hint button and the small remove buttons in Concept Simulations are 28px and 24px from `sm` up, which meets the 24px floor.
- **Stage steps:** a row of bordered buttons. The current Stage has a 2px `accent` edge (border plus a 1px inset ring), `accent` text and 500 weight, and `aria-current="step"`. It has no `accent/10` fill: the step's `success` result measured 4.4:1 on the tint in the light theme. A Stage that is not open yet is disabled at 50% opacity. Each step shows its result in words (a percentage or "təslim"), coloured `success` or `danger`.
- **Notices:** a status notice ("use a wider screen" on canvas pages) is a `warning/40` border, `warning/10` fill and `text` text. The note that an earlier Attempt is open read-only is the Callout (`accent/30` border, `accent/10` fill).
- **Mock Interview timer:** sticky under the header (`top-header`) on `surface/90` with a backdrop blur. Its border is `accent/40` while time is left and `danger/60` in overtime, and the clock turns `danger`. The words ("qalıb" or "əlavə vaxt") say which, so colour is not the only cue.
- **Rubric levels:** each level is a `label` around a visually hidden radio, 44px on a phone. The chosen level follows the Ten-Percent Tint Rule: `accent` border, `accent/10` fill, a 1px inset `accent` ring, `accent` text and 500 weight. Because the radio is hidden, the label draws the focus ring itself (`has-focus-visible:outline-2`).
- **Rule results and Hints:** a pass is `success` ✓ and a fail is `danger` ✗, always with the words. Each Hint card is bordered, and the opened Hint tiers are `text` with a `text-muted` tier name.
- **Panels** (Traffic Simulation, Chaos Scenario, config, results): bordered `rounded p-3` sections on the page surface, with a `text-sm` 600 `text` heading and `text-xs text-muted` help. Worked solutions and rule results use a `surface-raised/50` fill.
- **Canvas nodes:** `surface-raised` with a `border` outline, and an `accent` border and ring when selected. An overloaded node has a `danger` border and ring and the words "Həddən artıq yüklənib". A node that is down is dashed `danger` on `surface`, with the words "Sıradan çıxıb". Neither is tinted or faded: a 15% `danger` tint put `warning` text at 3.7:1 in the light theme, and 75% opacity put `text-muted` at 4.0:1. The component tag ("LB", "SQL") is `text-[10px]` mono `text-muted` on `surface`. Handles are `text-muted` (in) and `accent` (out) with a `surface` rim.
- **React Flow chrome:** `src/index.css` maps React Flow's own variables to the tokens on every canvas: the ground is `surface` with `border` dots, the zoom controls are `surface-raised` with `border` and `text`, and the attribution link is `text-muted`. The focus ring on nodes and edges is restored as described under Global behaviour. It scales with the canvas zoom. These rules apply to every React Flow canvas, the Skill Tree map included.
- **Concept Simulations:** the frame is a bordered `rounded-lg` section inside the Lesson, with an `accent` uppercase label over the `text-xl` title. Controls and stat tiles are `surface-raised/50` boxes. An option group (`role="radiogroup"`) marks the chosen option by the Ten-Percent Tint Rule (`accent` border, `accent/10` fill, 1px inset `accent` ring, 500 weight). A destructive action (cutting the network, stopping the primary) is a `danger/60` outlined button with `danger` text. Outcomes in the logs are `success`, `warning` (stale) or `danger` (rejected), always in words. A stopped Replication node is a `danger/40` bordered card on a `danger/5` fill, with a `danger/10` role pill. Measured in the light theme, the weaker one: `danger` on that pill is 4.7:1, `danger` on a destructive button's `danger/10` hover is 4.9:1, and `accent` on the primary's `accent/10` pill is 4.8:1.

**Left for a later ticket.** The canvas internals were deliberately not reworked here: the node and edge layout, the Rough.js sketch mode, the edge and series colours (`--canvas-*`, `--series-*`), pan and zoom, and the nested boxes inside Concept Simulations. Only their colours moved to the tokens.
