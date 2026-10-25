# 11: Quizzes

**What to build:** At the end of a Lesson, I answer a short quiz and get an Azerbaijani explanation for every option. Quizzes are authored data attached to Lessons and validated at build time. Question types: multiple choice, multi-select, ordering, and "which component fits". Results are persisted, so that topic mastery can use them later.

**Blocked by:** 02, 03

**Status:** resolved

- [x] Authored Quiz schema covering the four question types, with Lesson references; the build fails on invalid quizzes or unknown Lesson ids.
- [x] The quiz renders at the end of its Lesson, with immediate per-question feedback and an explanation for each option.
- [x] Results (best score, last attempt date) are persisted via `ProgressRepository`.
- [x] Quizzes are authored for at least one Lesson group (e.g. caching) as the first content set.
- [x] Seam A test: quiz grading for each question type, including partial multi-select.

## Comments

**Done on `main`.**
- **Schema.** `content/quizzes.ts` holds the authored Quizzes (`QuizInput` in `src/core/quizzes/quiz.ts`).
  - Each Quiz has a stable `id` (results are stored by it) and the `lessonId` it is shown at the end of. A Lesson has at most one Quiz.
  - Question types: `multiple-choice`, `multi-select`, `ordering` (items written in the right order, shown scrambled) and `component-fit` (a `flow` of components with one `"?"` blank, answered like multiple choice).
  - Every option and ordering item needs an Azerbaijani explanation.
  - `buildContentCatalog` validates them into `catalog.quizzes`: unknown fields, a wrong correct-option count (single-answer questions need exactly one; multi-select needs at least one right and one wrong option), repeated options, a bad blank and unknown Lesson ids all fail the build. The pin change report lists Quizzes in missing Lessons.
- **Grading** (`src/core/quizzes/grading.ts`). Each question is worth one point.
  - Single-answer questions earn the point for the correct option.
  - Multi-select earns (right chosen − wrong chosen) / correct count, never below 0, so choosing everything earns little.
  - Ordering is all-or-nothing; each position is still marked right or wrong in the feedback.
  - `scrambledOrder(count, seed)` gives a shuffle that is never already in order.
- **Results.** A new `quizzes` progress area stores `{ bestScore (0–1), lastAttemptAt }` per Quiz id; `recordQuizResult` keeps the best score. Export moves to schemaVersion 4; v3 files migrate with no results. Settings can reset the area.
- **UI.** The quiz renders at the end of its Lesson once progress has loaded. Each question has its own Yoxla button, then shows the verdict and the explanation of every option (marking the right one and a wrong choice). Ordering uses up/down buttons rather than drag, so it works on phones.
- **Content.** One Quiz for each of the 10 Lessons of the Cache group (20 questions).
- **Tests.** Seam A: grading for every type including partial multi-select, schema validation, result recording, the v3 migration and invalid results on import, and a check that the whole Cache group has Quizzes. A Playwright smoke test answers the caching-strategies Quiz and sees the best score after a reload.
