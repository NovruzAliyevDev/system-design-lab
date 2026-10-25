# 01: Walking skeleton: primer → Lessons → reader

**What to build:** Open the app locally and read any section of the primer as its own Lesson. This sets up the project: React + TypeScript + Vite, a git repo, and the primer as a git submodule pinned to a specific commit. A minimal Content Pipeline splits the README along its H2/H3 headings into Lessons with stable ids taken from the heading anchors. The app shows a flat Lesson list and a Lesson page that renders the Lesson's markdown. The UI uses the dark theme, and all UI strings go through an Azerbaijani i18n layer. The three layers from the spec (Content Pipeline, Core, UI) exist from the start, with `buildContentCatalog` living in Core.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Project builds and runs with a single dev command; the repo README explains how to init the submodule and run.
- [ ] The primer is a submodule pinned to a recorded commit; the build never reads the network.
- [ ] `buildContentCatalog` produces Lessons with id, title, parent group, order and source URL at the pinned commit.
- [ ] The app lists all Lessons and renders a selected Lesson's text (image/link fidelity is ticket 02).
- [ ] UI strings come from the Azerbaijani string catalog, not hard-coded in components.
- [ ] Vitest is set up; a Seam A test asserts the catalog's Lesson id/title list against a snapshot for the pinned commit.
- [ ] Playwright is set up; one smoke test opens the app and a Lesson.
- [ ] Core has no React or browser API imports (enforced by a lint rule or test).
