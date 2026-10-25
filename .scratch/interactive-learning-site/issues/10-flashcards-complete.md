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

**Status:** ready-for-agent

- [ ] All three decks are converted and selectable.
- [ ] `buildDailyQueue(cardStates, settings, now)` lives in Core; there is a daily new-card limit setting.
- [ ] Deck statistics view.
- [ ] Topic filter using authored card→Lesson links; each card shows a link to its Lesson.
- [ ] Authored Azerbaijani explanation field per card, validated at build time, shown under the English answer when present.
- [ ] Mobile-friendly review layout; keyboard shortcuts for reveal and grades.
- [ ] Seam A tests: daily queue ordering, and the new-card cap across a day boundary.
- [ ] Playwright smoke: complete a daily review.
