# 14: Canvas power features

**What to build:** The canvas feels like a real whiteboard tool:
- I can group Nodes into zone/region boxes to express multi-zone or multi-region designs.
- Multi-select, copy/paste and auto-layout work.
- My Design can be exported as PNG.
- An optional hand-drawn (sketch) rendering style draws Nodes and Edges with Rough.js.
- Each palette component shows its Glossary explanation in a tooltip.

**Blocked by:** 12, 06

**Status:** resolved

- [x] Zones: create, resize, and assign Nodes (zone id stored on the Node in the Design model).
- [x] Multi-select (box and shift-click), copy/paste, and auto-layout.
- [x] PNG export of the current canvas.
- [x] Sketch style toggle, persisted in settings; works in dark and light themes.
- [x] Palette tooltips show the Glossary explanation for each component type.

## Comments

**Done on `main`.**
- **Zones** (`src/core/design/design.ts`). A Design now has `zones`: boxes with an id (`zone-N`), a label, a position and a size (at least 160×100). A Node's `zoneId` is the innermost zone around its centre (Core knows the canvas's Node box, `NODE_SIZE`, 176×64), so a region holds zones and the Nodes go to the zone inside it.
  - `addZone`, `renameZone`, `setZoneBounds` (resize), `moveZone` (takes its Nodes and the zones wholly inside it along) and `removeElements({ zoneIds })` (the Nodes stay and fall to the zone around them). Adding or moving a Node puts it in the zone it lands in. `moveElements` moves a dragged selection of zones and Nodes in one step.
  - `readDesign` reads Designs stored before zones as having none, so drafts need no migration; a `zoneId` must name a zone of the Design.
- **Copy/paste** (`src/core/design/clipboard.ts`). `copyElements` copies the selected Nodes, and zones with everything in them, plus the Edges between copied Nodes. `pasteElements` adds copies with fresh ids (numbered like added ones), shifted by an offset, into any Design.
- **Auto-layout** (`src/core/design/layout.ts`). Left to right: each Node sits one column after its furthest sender (Edges closing a cycle are left out). Zones become stacked horizontal bands, nested for regions, so every Node keeps its zone and zones never overlap; within a column Nodes follow their senders. A zone with no Nodes keeps its size.
- **Canvas style setting.** `settings.canvasStyle` is `clean` or `sketch`. Export moves to schemaVersion 7, and v6 files migrate to `clean`.
- **Palette tooltips.** Each component type names a Glossary Term (`glossaryTermId`). New terms: Client, Object store, Search index, MapReduce, Data warehouse. The content build fails when a palette component has no term (`paletteGlossaryProblems`).
- **UI** (`src/ui/canvas/`).
  - Zones are React Flow nodes drawn under the Edges. Only their header takes the pointer (select, drag); the rest lets clicks through. Selected, they resize from their corners and sides. The config panel renames a zone and counts its Nodes. "Zona əlavə et" puts a zone around the selected Nodes, or in the middle of the canvas.
  - Shift-click adds to the selection; Shift-drag on the canvas selects in a box. Ctrl+C / Ctrl+V and toolbar buttons copy and paste, also between canvases; each paste lands 40 px further. "Avtomatik düzən" lays out and fits the view.
  - "PNG kimi yüklə" exports the whole Design (not just the visible part) with `html-to-image` 1.11.11 (the version React Flow recommends), at most 4096 px a side, on the theme's background.
  - "Əl ilə çəkilmiş üslub" (toolbar checkbox, also on the Settings page) draws Node and zone outlines and Edges with Rough.js, seeded by id so shapes stay still, with a handwriting system font. Strokes use the theme's colour variables, so dark and light both work.
  - Palette items show the Glossary explanation in a tooltip on hover or keyboard focus.
- **Tests.** Seam A: zones (assignment, nesting, resize, move, removal, validation), copy/paste, auto-layout (left-to-right, no overlap, zones kept apart and nested, cycles, determinism), the v6 migration and the palette's Glossary Terms against the real catalog. Seam B: zone creation, resize, assignment and moving with its Nodes plus PNG export; Shift multi-select, copy/paste and auto-layout; palette tooltips and the sketch style across a reload and both themes.
