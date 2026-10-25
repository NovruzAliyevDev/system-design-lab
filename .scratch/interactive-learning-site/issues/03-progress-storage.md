# 03: Progress storage, read state, export/import

**What to build:** The app remembers what I have read, and I can back up or move that progress. A Lesson can be marked as read manually, and it is marked automatically when I scroll to its end. The TOC shows a read marker per Lesson. Settings has three actions:
- export all progress as one JSON file;
- import a file, which validates it, migrates older `schemaVersion`s, backs up the current progress automatically, then replaces it;
- reset progress (all, or per area) with confirmation.

All persistence goes through a `ProgressRepository` interface in Core, with a Dexie (IndexedDB) implementation in the UI and an in-memory implementation for tests.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `ProgressRepository` interface with get/put per area and `exportAll`/`importAll`; Dexie and in-memory implementations.
- [ ] Read state: manual toggle plus auto-mark on reaching the end; TOC shows read markers; persists across reloads.
- [ ] Export downloads a versioned JSON (`schemaVersion`); `migrateProgress` upgrades older versions.
- [ ] Import rejects invalid files without changing state; a valid import backs up current progress first.
- [ ] Reset (all / per area) asks for confirmation.
- [ ] Settings page also hosts the dark/light theme toggle (dark by default), persisted.
- [ ] Seam A tests: export→import round trip is lossless; an invalid file leaves state unchanged; migration from a fabricated v0 export works.
- [ ] Playwright smoke: mark read, export, reset, import, read state restored.
