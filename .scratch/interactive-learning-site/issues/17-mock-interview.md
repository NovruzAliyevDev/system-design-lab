# 17: Mock Interview mode

**What to build:** Start any Challenge as a Mock Interview. There is a 45-minute timer (configurable) with a suggested time box per Stage. Time boxes are shown, but they do not block me. Hints are disabled. At the end, I fill in a self-assessment rubric (communication, scoping, estimation, design, trade-offs, scaling) next to the automatic Stage scores. The result is saved as an Attempt with mode "mock interview".

**Blocked by:** 15

**Status:** resolved

- [x] Mock Interview start option on each Challenge; configurable total time and per-Stage time boxes.
- [x] Hints are unavailable during the interview.
- [x] The timer survives a page reload during the interview.
- [x] End screen: Azerbaijani rubric plus automatic scores; saved as an Attempt (mode = mock interview).
- [x] Attempt history distinguishes practice and mock interview Attempts.

## Comments

**Done on `main`.**
- **Mock Interview** (`src/core/challenges/mock-interview.ts`). An Attempt now has the mode `mock-interview` alongside `practice`.
  - `startMockInterview(challenge, plan, now)` starts one fresh, with its `InterviewPlan` stored on the Attempt: the length in minutes and a time box per Stage, all positive.
  - `defaultInterviewPlan(challenge, minutes = 45)` gives time boxes by Stage type: 5, 5, 15, 10 and 10 minutes for 45. Other lengths and Stage sets are shared out in proportion, in whole minutes that add up to the length rounded to a minute, at least 1 each.
  - `interviewClock(challenge, attempt, now)` gives the time left (negative in overtime) and each Stage's time against its box. A Stage is timed from the end of the one before. It is computed from the stored start and finish times only, so it survives a reload and stops when the last Stage is over. Neither the time limit nor a time box blocks anything.
  - Hints: `updateStage` refuses opened Hints in a Mock Interview, and `readAttempt` rejects a stored one with them.
  - Self-assessment: `assessInterview(attempt, { ratings, notes }, now)` records ratings from 1 to 5 on six criteria (communication, scoping, estimation, design, trade-offs, scaling) plus notes on a finished Mock Interview, replacing any before. `averageRating` gives their mean.
- **Persistence.** `readAttempt` reads the plan and self-assessment. A Mock Interview needs a plan with at least one time box; a practice Attempt may not have a self-assessment. Export moves to schemaVersion 9. A v8 file is a valid v9 file, so the upgrade only changes the version, which tells older apps not to read Mock Interviews.
- **UI** (`src/ui/challenge/MockInterview.tsx`).
  - A "Müsahibə simulyasiyası" panel on each Challenge page starts one. It has a field for the length and one per Stage time box; the boxes follow the length until edited. It asks first when the current Attempt is in progress.
  - While the interview runs, a sticky timer shows the time left (overtime in red) and the current Stage's time against its box (amber once over). The Stage stepper shows each time box.
  - Design Stages hide the Hint buttons and the problem list; the check still gives the score and the number of problems left.
  - The end screen shows the automatic scores, the time taken overall and per Stage, and the rubric, which can be edited on the current Attempt. Starting a new Attempt over an interview not yet self-assessed asks first, since an earlier Attempt is read-only.
  - The Attempt history labels each Attempt Məşq or Müsahibə simulyasiyası and shows the average self-assessment.
- **Tests.**
  - Seam A (`mock-interview.test.ts`): default time boxes and their rounding; plan validation; Hints refused; the clock at the start, per Stage, in overtime and once stopped; the self-assessment and its validation; reading a Mock Interview back and rejecting invalid ones. A v8 export migrates unchanged (`repository.test.ts`).
  - Playwright: a Mock Interview with a paused clock covers time boxes following the length, an overrun time box, the time after a reload, no Hints, the end screen, the warning before leaving an interview unassessed, the rubric, the history and the read-only earlier interview.
- **Choices to revisit.**
  - The design check still reports the score and the number of problems left during an interview. A real interviewer would not, but it is not a Hint.
  - Each Stage's Reference Solution still shows once that Stage is over, as in practice, so the high-level design solution is visible before Scaling.
- **Unrelated.** The Playwright test "remembers read Lessons and restores them from an exported file after a reset" fails locally, at this commit and before tickets 16 and 17 alike: the end of "When to update the cache" is never marked read.
