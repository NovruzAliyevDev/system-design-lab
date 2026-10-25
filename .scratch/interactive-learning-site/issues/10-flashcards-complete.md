# 10: Flashcards complete: all Decks, daily review, stats

**What to build:** A full flashcard experience:
- All three primer Decks are available: System Design, System Design Exercises and OO Design.
- A daily review queue combines due cards with a capped number of new cards; the cap is set in Settings.
- Per-Deck statistics show new, learning, mature and due counts.
- I can study a single Deck, or only the cards linked to a topic.
- Cards link to their Lessons.
- A card's back can show an authored Azerbaijani explanation under the English answer.
- Review works comfortably on mobile and supports keyboard shortcuts for grading.

**Blocked by:** 09

**Status:** resolved

- [x] All three decks are converted and selectable.
- [x] `buildDailyQueue(cards, cardStates, settings, now)` lives in Core; there is a daily new-card limit setting.
- [x] Deck statistics view.
- [x] Topic filter using authored card→Lesson links; each card shows a link to its Lesson.
- [x] Authored Azerbaijani explanation field per card, validated at build time, shown under the English answer when present.
- [x] Mobile-friendly review layout; keyboard shortcuts for reveal and grades.
- [x] Seam A tests: daily queue ordering, and the new-card cap across a day boundary.
- [x] Playwright smoke: complete a daily review.

## Comments

**Done on `main`.**
- **Decks.** All three primer Decks are converted: System Design (42 cards), System Design Exercises (8) and OO Design (6).
  - The Exercises cards are the 2017 solution write-ups. They link into the primer under the repo's old name, `system-design-primer-interview` (`flashcardFormerRepoUrls`), so those links now resolve to Lessons and count in the build's unresolved-link check.
  - `content/flashcard-link-fixes.ts` maps the anchors that have changed since to the links the write-ups have now. Links that were `#` placeholders for sections the README did not have yet are fixed by their link text (`flashcardPlaceholderLinks`).
- **Daily queue.** `buildDailyQueue(cards, cardStates, settings, now)` takes the cards too: it needs Deck order and the Deck or topic selection. The spec line is updated to match.
  - `settings` is `{ newCardsPerDay, utcOffsetMinutes }`. A day runs from local midnight to midnight; the UI passes the offset in force now, so on a DST change day the window can be off by an hour.
  - Order: due cards (most overdue first), then new cards in Deck order up to what the limit has left, then learning cards due within 20 minutes. Review cards are due by the day (any time today), learning cards by the minute, as in Anki.
  - The limit counts new cards introduced today in any Deck. `scheduleReview` now records `introduced` on a new card's state. Cards reviewed before this change have no `introduced` and don't count.
- **Stats.** `deckStats` gives new, learning, young, mature (an interval of 21 days or more, as in Anki) and due, where due means the reviewed cards today's review shows now. Young is extra; without it, graduated cards would fit no column.
- **Authored cards.** `content/flashcards.ts` has, for every card, its Lessons and an Azerbaijani explanation (all 56 cards have one).
  - `linkCards` validates the entries: an unknown card or Lesson, a duplicate, a schema error or a card left out fails the build.
  - The pin change report lists Flashcards that reference a Lesson the new pin lacks.
  - `selectCards` picks all cards, one Deck's, or a Lesson's.
- **Progress.** Settings gain `newCardsPerDay`: default 20, a whole number from 0 to 999. The export moves to `schemaVersion: 3`, and a v2 file gets the default. Stored areas written by an older version get defaults for the fields added since.
- **UI.**
  - `/flashcards` shows the picker (all Decks, a Deck, or a topic, i.e. a Lesson cards link to, kept in `?deck=` / `?lesson=`), today's counts, the card, and per-Deck stats.
  - Under the answer: the explanation, then links to the card's Lessons.
  - Each Lesson with cards links to its review.
  - Settings has the limit field.
- **Keyboard and mobile.**
  - Space or Enter reveals the answer and 1–4 grade it. Keys are ignored in form controls (including the Deck picker), dialogs, with modifiers, and while held down.
  - On phones the reveal button and grade bar stick to the bottom with safe-area padding. The buttons are at least 48 px tall. At 375 px there is no horizontal scroll.
- **Tests.**
  - Seam A: queue ordering, the cap across Decks and across local midnight, stats, `introduced`, authored-card validation, former repo links and placeholders, `selectCards`, pin report references, progress v3, and the pinned primer (three Decks; every README link in the Exercises resolves to a Lesson).
  - Seam B: a keyboard daily review of the OO Design Deck with a limit of 2, run to "done".
