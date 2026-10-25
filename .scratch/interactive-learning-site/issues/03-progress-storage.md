# 03: Progress storage, read state, export/import

**What to build:** The app remembers what I have read, and I can back up or move that progress. A Lesson can be marked as read manually, and it is marked automatically when I scroll to its end. The TOC shows a read marker per Lesson. Settings has three actions:
- export all progress as one JSON file;
- import a file, which validates it, migrates older `schemaVersion`s, backs up the current progress automatically, then replaces it;
- reset progress (all, or per area) with confirmation.

All persistence goes through a `ProgressRepository` interface in Core, with a Dexie (IndexedDB) implementation in the UI and an in-memory implementation for tests.

**Blocked by:** 01

**Status:** resolved

- [x] `ProgressRepository` interface with get/put per area and `exportAll`/`importAll`; Dexie and in-memory implementations.
- [x] Read state: manual toggle plus auto-mark on reaching the end; TOC shows read markers; persists across reloads.
- [x] Export downloads a versioned JSON (`schemaVersion`); `migrateProgress` upgrades older versions.
- [x] Import rejects invalid files without changing state; a valid import backs up current progress first.
- [x] Reset (all / per area) asks for confirmation.
- [x] Settings page also hosts the dark/light theme toggle (dark by default), persisted.
- [x] Seam A tests: export→import round trip is lossless; an invalid file leaves state unchanged; migration from a fabricated v0 export works.
- [x] Playwright smoke: mark read, export, reset, import, read state restored.

## Comments

**Done on `main`.**
- **Core** (`src/core/progress`).
  - `ProgressRepository` has get/put per area plus `getAll`, `reset(area?)`, `exportAll(now)`, `importAll(fileText, now)` and `latestBackup()`.
  - It is built over a small `KeyValueStore` (get, atomic `putAll`), so the Dexie store (`src/ui/progress/repository.ts`) and the in-memory one share all logic.
  - Areas so far: `reading` (Lesson id → time it was marked read) and `settings` (theme).
  - `migrateProgress` validates a parsed file and upgrades it step by step; anything invalid throws `InvalidProgressFileError` with a reason (`not-json`, `malformed`, `unsupported-version`).
- **Export format.** `schemaVersion: 1`. There was never a real v0; the fabricated v0 is `{ schemaVersion: 0, exportedAt, readLessons: string[] }`, with no settings, and each read Lesson gets `exportedAt` as its read time.
- **Backup.** A valid import first stores the current progress as the backup, in the same transaction as the replacement. Settings offers it as a download. There is one backup slot, so a second import replaces the first backup. Keeping several is a possible follow-up if that matters.
- **Read state.**
  - A toggle under each Lesson title marks it read or unread; the TOC shows a ✓ marker.
  - A Lesson is also marked automatically once the end of its text is in view, after its images have loaded. So a Lesson short enough to fit on screen is marked on opening.
  - A manual toggle wins for the rest of that visit.
- **UI state.** It lives in a Zustand store (`src/ui/progress/store.ts`). Changes show at once and are stored after; loads that a newer change supersedes are dropped. This matters because React StrictMode double-loads in dev.
- **Theme.**
  - Dark by default, stored in the `settings` area.
  - The light theme mirrors the zinc scale and darkens the sky scale in `src/index.css`, so components are written once, dark-first. Colours outside those scales (emerald, red, white) are the same in both themes.
  - A copy of the theme in `localStorage` lets `index.html` apply it before first paint.
- **Tests.**
  - Seam A: 17 Vitest tests in `src/core/progress`: round trip, invalid files (state and backup unchanged), backup on import, v0 migration, reset, and read-state helpers.
  - Seam B: 3 Playwright tests: mark read (manual, at the end, short Lesson) → export → reset → import → restored; an invalid file changes nothing; the light theme persists.
