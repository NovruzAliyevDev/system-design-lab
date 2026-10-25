# 01: Walking skeleton: primer → Lessons → reader

**What to build:** Open the app locally and read any section of the primer as its own Lesson. This sets up the project: React + TypeScript + Vite, a git repo, and the primer as a git submodule pinned to a specific commit. A minimal Content Pipeline splits the README along its H2/H3 headings into Lessons with stable ids taken from the heading anchors. The app shows a flat Lesson list and a Lesson page that renders the Lesson's markdown. The UI uses the dark theme, and all UI strings go through an Azerbaijani i18n layer. The three layers from the spec (Content Pipeline, Core, UI) exist from the start, with `buildContentCatalog` living in Core.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Project builds and runs with a single dev command; the repo README explains how to init the submodule and run.
- [x] The primer is a submodule pinned to a recorded commit; the build never reads the network.
- [x] `buildContentCatalog` produces Lessons with id, title, parent group, order and source URL at the pinned commit.
- [x] The app lists all Lessons and renders a selected Lesson's text (image/link fidelity is ticket 02).
- [x] UI strings come from the Azerbaijani string catalog, not hard-coded in components.
- [x] Vitest is set up; a Seam A test asserts the catalog's Lesson id/title list against a snapshot for the pinned commit.
- [x] Playwright is set up; one smoke test opens the app and a Lesson.
- [x] Core has no React or browser API imports (enforced by a lint rule or test).

## Comments

**Done on branch `ticket-01/walking-skeleton`.**

- The primer is pinned at `ae9bbd7` and yields 98 Lessons in 30 groups.
- The Content Pipeline fails if the submodule checkout differs from the pinned commit.
- Decisions made in this ticket:
  - "Source(s) and further reading" H3 sections are kept inside the Lesson above them.
  - A section with no markdown before the next section (e.g. "Availability vs consistency") is a group without a Lesson of its own.
  - Content before the first heading (the translation links) is dropped.
  - Raw HTML in the primer is skipped for now (see the comment on ticket 02).
- Core purity is enforced twice: `tsconfig.core.json` has no DOM or Node types, and `tests/core-purity.test.ts` rejects React, storage and Node imports.
- The app bundle is about 500 kB, because the whole catalog is imported eagerly. Code-splitting can come later if it matters.
