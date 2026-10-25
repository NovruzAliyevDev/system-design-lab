# 12: Design Canvas sandbox editor

**What to build:** A free sandbox page where I build any architecture by drag and drop. The full Component Palette is available: client, DNS, CDN, load balancer, reverse proxy / API gateway, web server, application service, cache, SQL database, NoSQL store (key-value, document, wide-column, graph), object store, message queue, task queue / worker, search index, analytics / MapReduce, data warehouse.

- Components are dragged onto a React Flow canvas and connected with Edges. Each Edge has a mode (sync / async) and a traffic kind (read / write / both).
- Selecting a Node opens a config panel driven by that component type's config schema (e.g. database kind, primary/replica, replica count, shard key; cache strategy and eviction; load balancer layer and algorithm; instance count). Nodes can be renamed and given notes.
- Each component type also declares its default capacity, base latency and monthly cost per instance, derived from the primer's latency numbers. These are shown in the config, ready for the simulation in ticket 18.
- The Design is auto-saved; undo/redo and delete work.
- Below the tablet breakpoint, the canvas is read-only and shows a "best on desktop" notice.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The Design model (Nodes, Edges, typed per-component config, zone id, position) lives in Core, independent of React Flow.
- [ ] Each component type defines its config schema, default capacity, latency and cost; invalid config is prevented in the panel.
- [ ] All palette components can be dragged in, connected, configured, renamed and annotated.
- [ ] Edge mode and traffic kind are editable and visibly distinguished (e.g. dashed for async).
- [ ] Undo/redo and delete with keyboard shortcuts.
- [ ] Sandbox Designs are auto-saved through `ProgressRepository` and survive reloads.
- [ ] Read-only view with a notice on small screens.
- [ ] Seam A test: Design serialise/deserialise round trip; config schema validation rejects invalid values.
