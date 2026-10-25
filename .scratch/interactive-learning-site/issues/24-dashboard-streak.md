# 24: Dashboard and streak

**What to build:** The home page tells me what to do today:
- today's flashcard review count;
- my current streak;
- continue-where-you-left-off (the last Lesson or Challenge);
- the suggested next Skill Tree node.

`computeStreak(activityLog, now, timezone)` in Core counts a day when the daily review is finished or a minimum learning activity is reached.

**Blocked by:** 23

**Status:** ready-for-agent

- [ ] Activity log recorded for reviews, Lesson reads, quizzes and Challenge Attempts.
- [ ] `computeStreak` in Core; the minimum-activity threshold is configurable.
- [ ] Dashboard is the home route and shows the four blocks above; usable on mobile.
- [ ] Seam A tests: streak across local midnight, a missed day resets, and timezone handling.
