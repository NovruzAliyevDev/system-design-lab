import type { StringKey } from './i18n'

/** App route of a Lesson, optionally scrolled to a heading inside it. */
export function lessonPath(lessonId: string, anchor?: string): string {
  return `/lessons/${lessonId}${anchor ? `#${anchor}` : ''}`
}

export const LESSON_ROUTE = '/lessons/:lessonId'

export const SETTINGS_ROUTE = '/settings'

export const GLOSSARY_ROUTE = '/glossary'

/** App route of a term on the Glossary page. */
export function glossaryPath(termId: string): string {
  return `${GLOSSARY_ROUTE}#${termId}`
}

export const SOLUTIONS_ROUTE = '/solutions'

export const SOLUTION_ROUTE = '/solutions/:solutionId'

/** App route of a Solution page, optionally scrolled to a heading inside it. */
export function solutionPath(solutionId: string, anchor?: string): string {
  return `${SOLUTIONS_ROUTE}/${solutionId}${anchor ? `#${anchor}` : ''}`
}

export const STUDY_GUIDE_ROUTE = '/study-guide'

/** Pages of reference material, linked from the header (from `md` up) and the table of contents drawer. */
export const REFERENCE_PAGES: { to: string; label: StringKey }[] = [
  { to: STUDY_GUIDE_ROUTE, label: 'studyGuideTitle' },
  { to: SOLUTIONS_ROUTE, label: 'solutionsTitle' },
  { to: GLOSSARY_ROUTE, label: 'glossaryTitle' },
]
