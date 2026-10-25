# 12: Design Canvas sandbox editor

**What to build:** A free sandbox page where I build any architecture by drag and drop. The full Component Palette is available: client, DNS, CDN, load balancer, reverse proxy / API gateway, web server, application service, cache, SQL database, NoSQL store (key-value, document, wide-column, graph), object store, message queue, task queue / worker, search index, analytics / MapReduce, data warehouse.

- Components are dragged onto a React Flow canvas and connected with Edges. Each Edge has a mode (sync / async) and a traffic kind (read / write / both).
- Selecting a Node opens a config panel driven by that component type's config schema (e.g. database kind, primary/replica, replica count, shard key; cache strategy and eviction; load balancer layer and algorithm; instance count). Nodes can be renamed and given notes.
- Each component type also declares its default capacity, base latency and monthly cost per instance, derived from the primer's latency numbers. These are shown in the config, ready for the simulation in ticket 18.
- The Design is auto-saved; undo/redo and delete work.
- Below the tablet breakpoint, the canvas is read-only and shows a "best on desktop" notice.

**Blocked by:** 03

**Status:** resolved

- [x] The Design model (Nodes, Edges, typed per-component config, zone id, position) lives in Core, independent of React Flow.
- [x] Each component type defines its config schema, default capacity, latency and cost; invalid config is prevented in the panel.
- [x] All palette components can be dragged in, connected, configured, renamed and annotated.
- [x] Edge mode and traffic kind are editable and visibly distinguished (e.g. dashed for async).
- [x] Undo/redo and delete with keyboard shortcuts.
- [x] Sandbox Designs are auto-saved through `ProgressRepository` and survive reloads.
- [x] Read-only view with a notice on small screens.
- [x] Seam A test: Design serialise/deserialise round trip; config schema validation rejects invalid values.

## Comments

**Done on `main`.**
- **Design model** (`src/core/design/design.ts`). A Design is `{ nodes, edges }`. A Node has an id, a `componentType`, a typed `config` (`ComponentConfig<T>`, derived from the schema), a label, notes, an optional `zoneId` and a position. An Edge has a source, a target, a `mode` (sync | async) and `traffic` (read | write | both).
  - Editing functions are pure: `addNode` (ids like `cache-3`, numbered after the highest in use), `connect` (no self-loops or duplicate pairs), `updateEdge`, `renameNode`, `setNodeNotes`, `setNodeConfig`, `moveNodes` and `removeElements` (removing a Node removes its Edges).
  - `serializeDesign`/`deserializeDesign` round-trip a Design. `readDesign` checks a stored one and fills config fields added since with their defaults.
- **Component Palette** (`src/core/design/components.ts`). It has 16 types. NoSQL is one type with a `kind` (key-value, document, wide-column, graph).
  - Each type has a config schema of choice, integer and text fields, and `configProblem` refuses values outside them.
  - A field can depend on another (`onlyWhen`): read `replicas` only apply to a `primary`, and become 0 when the node turns into a replica.
  - Every type except the client has per-instance `simulation` defaults. Base latency is a sum of the primer's latency numbers (e.g. SQL = 1 datacenter round trip + 4 random SSD reads = 1.1 ms), and a content test checks those numbers against the extracted table. Capacity and monthly cost are rough rule-of-thumb values. The client only sends traffic, so it has none.
- **Undo/redo** (`src/core/design/history.ts`). The history keeps up to 100 steps. Typing in one field merges into one step until the learner leaves the field (`endMerge`).
- **Persistence.** A new `designs` progress area holds `drafts` by id; the sandbox is `sandbox`. Every change is saved at once. Export moves to schemaVersion 5, and v4 files migrate with no drafts. Settings can reset the area.
- **UI.**
  - `/sandbox` ("Sərbəst dizayn", linked in the header) uses `@xyflow/react` 12. The canvas is full width there, and the table of contents is only a drawer.
  - Components can be dragged from the palette or clicked to add. Nodes connect from the right handle to the left one.
  - The panel configures the one selected Node or Edge. It shows the simulation defaults with the latency breakdown and refuses invalid values with a message.
  - Async edges are dashed, and traffic sets the colour and label.
  - Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y and Delete/Backspace work, plus toolbar buttons.
  - Below `md` (48rem), the canvas is read-only with a notice: no palette, no dragging, disabled fields.
- **Tests.** Seam A covers the round trip, schema rejection (per field, cross-field and whole-Design), editing operations, the history, the v4 migration and invalid drafts on import. Playwright smoke tests build a Design by drag and drop and reload it, delete/undo/redo by keyboard, and show the read-only phone view.
- **Left for later tickets.** Multi-select is turned off (ticket 14). Zones exist only as `zoneId` (ticket 14). Capacity, latency and cost are shown but not editable (ticket 18).
