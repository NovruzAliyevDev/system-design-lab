# 16: Calculators

**What to build:** Two standalone calculators for estimation practice:
- **Back-of-the-envelope calculator:** goes from users to requests/day, QPS, peak factor, object size, storage per year and bandwidth, with unit-aware output (KB…PB; per second/month/year).
- **Latency comparison tool:** built on the primer's latency numbers table, it answers questions like "how many disk seeks fit in one cross-continent round trip?".

Both reuse `estimate` and the appendix data, and are linked from the relevant Lessons and from the Estimation Stage.

**Blocked by:** 07, 15

**Status:** resolved

- [x] The calculator page reuses Core `estimate`; all intermediate steps are shown.
- [x] The latency comparison tool uses the extracted latency data; it compares any two operations and shows the ratio.
- [x] Linked from the Estimation Stage and from the appendix and back-of-the-envelope Lessons.
- [x] Usable on mobile.
- [x] Seam A test: latency ratio computation for known pairs.

## Comments

**Done on `main`.**
- **Back-of-the-envelope calculator** (`src/core/estimation/calculator.ts`). `estimateFromUsage(usage)` takes daily active users, writes and reads per user per day, object sizes, a peak factor and years.
  - It works out requests a day, then a month, with the steps behind each, and hands the monthly counts to `estimate`, which does QPS, storage and bandwidth as in ticket 15.
  - A month is 30 days, from the primer's Twitter solution ("500 million tweets per day or 15 billion tweets per month"). With the primer's 2.5 million seconds a month, a day is ~83,333 s, not 86,400; the page says so.
  - `perPeriod(perSecond, period)` gives a rate per second, day, month or year.
- **Latency comparison** (`src/core/estimation/latency.ts`). `compareLatencies(a, b)` takes two rows of the extracted latency table in either order and gives the faster, the slower and the ratio: 15 HDD seeks fit in one CA→Netherlands round trip.
- **UI.**
  - `/calculators` has two sections, `#back-of-the-envelope` and `#latency`.
  - The calculator starts from the primer's Twitter usage. It shows every rate per second, day, month and year, storage per month, year and total, and every step from users to bandwidth. A field that is not a number of at least 0 shows a message instead of results.
  - The latency tool has two operation pickers, three example questions and the ratio as "N dəfə" with a sentence.
  - `src/ui/EstimationSteps.tsx` now holds the step rendering and number formatting shared with the Estimation Stage. `parseDecimal` accepts digits grouped by spaces, so the Estimation Stage now takes "1 000" too.
- **Links.**
  - The Estimation Stage links both calculators, opening in a new tab.
  - Lessons link them from `CALCULATOR_LESSONS` in `src/core/content/calculator-lessons.ts`: back-of-the-envelope-calculations and appendix link both; powers-of-two-table links the calculator; latency-numbers-every-programmer-should-know links the latency tool.
  - The header links Kalkulyatorlar. With one more link the header overflowed at 768px, so the header page links now show from `lg` up, and the table of contents drawer lists them below that.
- **Tests.**
  - Seam A: `calculator.test.ts` checks the primer's Twitter numbers (500 million a day, 15 billion a month, 6,000 writes/s, ~100 thousand reads/s, 150 TB a month), the usage steps and the handy conversion guide. `latency.test.ts` checks ratios for known pairs (15, 14, 200, 20, ~3.57) and order independence.
  - Content tests: the ratio on the pinned primer's table, and every Lesson in `CALCULATOR_LESSONS` exists.
  - Playwright: a phone smoke goes from the back-of-the-envelope Lesson to the calculator, changes the peak factor and a unit, sees the invalid-input message, and uses the latency examples and pickers. The Challenge smoke checks the Estimation Stage link opens in a new tab.
- **Left as is.**
  - The peak factor applies to QPS only. Bandwidth uses the average rate, as `estimate` does.
  - The latency examples name operations by the primer's text. An example whose operation is missing after a re-pin is not shown.
