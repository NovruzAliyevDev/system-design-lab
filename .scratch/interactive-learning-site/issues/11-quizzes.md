# 11: Quizzes

**What to build:** At the end of a Lesson, I answer a short quiz and get an Azerbaijani explanation for every option. Quizzes are authored data attached to Lessons and validated at build time. Question types: multiple choice, multi-select, ordering, and "which component fits". Results are persisted, so that topic mastery can use them later.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Authored Quiz schema covering the four question types, with Lesson references; the build fails on invalid quizzes or unknown Lesson ids.
- [ ] The quiz renders at the end of its Lesson, with immediate per-question feedback and an explanation for each option.
- [ ] Results (best score, last attempt date) are persisted via `ProgressRepository`.
- [ ] Quizzes are authored for at least one Lesson group (e.g. caching) as the first content set.
- [ ] Seam A test: quiz grading for each question type, including partial multi-select.
