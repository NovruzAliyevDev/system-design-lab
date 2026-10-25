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
