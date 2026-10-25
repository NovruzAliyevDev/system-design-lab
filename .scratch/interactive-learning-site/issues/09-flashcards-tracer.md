# 09: Flashcard tracer: review one Deck

**What to build:** Review the primer's "System Design" Anki Deck in the app. The `.apkg` file (zipped SQLite) is converted to Flashcard JSON at build time, with card HTML sanitised. A review screen shows the front, reveals the back, and lets me grade the card (again / hard / good / easy). `scheduleReview` (SM-2 style, in Core) computes the next due date. Card state is persisted through `ProgressRepository`.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The "System Design" deck is converted to Flashcard JSON at build time; card HTML is sanitised; images in cards, if any, are handled.
- [ ] `scheduleReview(cardState, grade, now)` lives in Core, with `now` injected.
- [ ] Review screen: front → reveal → grade; due cards come first.
- [ ] Card states persist across reloads and are included in export/import.
- [ ] Seam A tests: grade sequences produce the expected intervals with a fixed clock; "again" resets the card to learning.
