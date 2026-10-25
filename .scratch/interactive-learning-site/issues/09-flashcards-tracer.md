# 09: Flashcard tracer: review one Deck

**What to build:** Review the primer's "System Design" Anki Deck in the app. The `.apkg` file (zipped SQLite) is converted to Flashcard JSON at build time, with card HTML sanitised. A review screen shows the front, reveals the back, and lets me grade the card (again / hard / good / easy). `scheduleReview` (SM-2 style, in Core) computes the next due date. Card state is persisted through `ProgressRepository`.

**Blocked by:** 03

**Status:** resolved

- [x] The "System Design" deck is converted to Flashcard JSON at build time; card HTML is sanitised; images in cards, if any, are handled.
- [x] `scheduleReview(cardState, grade, now)` lives in Core, with `now` injected.
- [x] Review screen: front → reveal → grade; due cards come first.
- [x] Card states persist across reloads and are included in export/import.
- [x] Seam A tests: grade sequences produce the expected intervals with a fixed clock; "again" resets the card to learning.

## Comments

**Done on `main`.**
- **Conversion.**
  - `scripts/anki.ts` unzips the `.apkg` with `fflate`, then reads its SQLite collection with `node:sqlite`. Notes must have Front and Back fields, which all three primer Decks' Basic notes do.
  - `buildDeck` in `src/core/flashcards/deck.ts` runs inside `buildContentCatalog` and fills `catalog.decks`. Card ids are `<deck slug>/<Anki card id>`.
  - The card HTML is GitHub's rendering of the README from 2017. It is sanitised with GitHub's schema, which drops inline styles, the heading permalink SVGs and scripts. Empty permalink links and ids are removed.
  - Card links are resolved as if they were on the README page, and they count in the build's unresolved-link check. Two anchors have changed since 2017; `content/flashcard-link-fixes.ts` maps them to the links the README has now.
- **Images.**
  - Card images are camo-proxied imgur URLs. They are served from the primer's copy `images/<imgur name>` when it has one, and the links GitHub wraps them in point there too.
  - The Reverse proxy card has the diagram the primer replaced in issue #1. `content/image-mirrors.ts` maps it to the current one, `images/n41Azff.png`.
  - The latency chart stays on its camo URL, as it does in the README itself.
- **Scheduler.**
  - `scheduleReview(state | undefined, grade, now)` works like Anki's SM-2 (`undefined` = new card):
    - Learning steps are 1 min and 10 min. On the first step, hard waits 5.5 min.
    - Graduating gives 1 day; easy gives 4 days.
    - Ease starts at 2.5, never goes below 1.3, and changes by −0.15 for hard and +0.15 for easy.
    - Hard multiplies the interval by 1.2 and easy by an extra 1.3. Each review waits at least one day longer than the last.
    - Again on a graduated card sends it back to learning, with a lapse and −0.2 ease.
  - `reviewQueue` orders the cards: due cards (most overdue first), then new cards in Deck order, then learning cards due within 20 minutes. `reviewCounts` and `nextDueAt` serve the review screen. Ticket 10's `buildDailyQueue` with the new-card cap builds on these.
- **Progress.**
  - New `flashcards` area (card id → state), with a "reset flashcards" button in Settings.
  - The export moves to `schemaVersion: 2`, and a v1 file migrates with no card states. Card states are validated on import.
- **UI.**
  - `/flashcards`, linked from the header, shows the front, then a reveal button, then the back with the four grade buttons. Each grade button shows the wait it would schedule.
  - The page checks the clock every 15 s, so cards that fall due appear without a reload.
  - Card HTML renders through `PrimerHtml`, which reuses the Lesson link and image components.
- **Tests.**
  - Seam A: the scheduler (interval sequences with a fixed clock; again → learning), the queue, Decks through `buildContentCatalog`, progress v2, and the pinned primer (42 cards; every image local except the latency chart).
  - Seam B: one smoke test grades a card and reloads.

