/** The calculators on the calculators page, each a section with this id. */
export type CalculatorId = 'back-of-the-envelope' | 'latency'

/** The Lessons that link to each calculator: the primer's estimation advice and its appendix tables. */
export const CALCULATOR_LESSONS: Record<CalculatorId, string[]> = {
  'back-of-the-envelope': ['back-of-the-envelope-calculations', 'appendix', 'powers-of-two-table'],
  latency: ['back-of-the-envelope-calculations', 'appendix', 'latency-numbers-every-programmer-should-know'],
}

/** The calculators a Lesson links to, in page order. */
export function calculatorsOfLesson(lessonId: string): CalculatorId[] {
  return (Object.keys(CALCULATOR_LESSONS) as CalculatorId[]).filter((calculatorId) => CALCULATOR_LESSONS[calculatorId].includes(lessonId))
}
