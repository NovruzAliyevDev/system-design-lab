# 24: Dashboard and streak

**What to build:** The home page tells me what to do today:
- today's flashcard review count;
- my current streak;
- continue-where-you-left-off (the last Lesson or Challenge);
- the suggested next Skill Tree node.

`computeStreak(activityLog, now, timezone)` in Core counts a day when the daily review is finished or a minimum learning activity is reached.

**Blocked by:** 23

**Status:** resolved

- [x] Activity log recorded for reviews, Lesson reads, quizzes and Challenge Attempts.
- [x] `computeStreak` in Core; the minimum-activity threshold is configurable.
- [x] Dashboard is the home route and shows the four blocks above; usable on mobile.
- [x] Seam A tests: streak across local midnight, a missed day resets, and timezone handling.

## Comments

**Done on `main`.**
- **Activity log** (new `activity` progress area, export schema v10; a v9 file gets an empty log, since there was no streak before). The store logs:
  - `daily-review` when a grade finishes the whole daily queue (`finishesDailyReview` in `flashcards/queue.ts`): there was something to review before the grade and nothing after. A day with nothing due is not finished by a review.
  - `lesson-read` when a Lesson becomes read, `quiz` on each completed quiz, and `challenge-stage` for each Stage an Attempt update ends (`stageActivities`), dated when it ended.
  - The area also keeps `lastOpened`, the Lesson or Challenge opened last.
- **`computeStreak(log, now, timeZone, minActivities = 2)`** (`src/core/activity/streak.ts`).
  - Days run midnight to midnight in an IANA time zone (the browser's), so daylight saving changes are handled.
  - A day counts when the daily review was finished, or when `minActivities` distinct Lessons, quizzes and Challenge Stages were done that day. Repeating one adds nothing.
  - The streak still stands until today ends.
  - It also reports the longest streak and today's progress.
  - The minimum is the `streakMinActivities` setting (1–20, in Settings).
- **Dashboard** at `/`. The Lesson list moved to `/lessons` and the Dashboard links to it. It has four blocks, one column on phones, refreshed every minute:
  - today's review count, with its new/learning/review split;
  - the streak, with what today still needs;
  - continue (`continueTarget` in `src/core/activity/continue.ts`): the last Lesson while unread, else the next unread one; the last Challenge with its Stages done; or the first unread Lesson;
  - the next Skill Tree topic (`suggestNextTopic`): the first not mastered, layer by layer, so its prerequisites are mastered.
- **Settings** gain the streak minimum and a reset of the activity area.
- **Tests (Seam A).**
  - `streak.test.ts`: review vs minimum activity, a configurable minimum, distinct items, consecutive days, a missed day resetting (longest kept), local midnight in Baku vs UTC, and New York across its DST change.
  - Also `activity.test.ts`, `continue.test.ts`, `finishesDailyReview` in `queue.test.ts`, `suggestNextTopic` in `mastery.test.ts`, and v10 migration/validation in `repository.test.ts`.
  - Seam B: a Dashboard smoke test; existing tests updated for the new home page.
- **Known limits.**
  - The flashcard queue still splits days by the UTC offset in force now, while the streak uses the time zone. They can differ only on a daylight saving night.
  - The header overflows a 375px phone by ~13px on every page. That predates this ticket.
