/** App route of a Lesson, optionally scrolled to a heading inside it. */
export function lessonPath(lessonId: string, anchor?: string): string {
  return `/lessons/${lessonId}${anchor ? `#${anchor}` : ''}`
}

export const LESSON_ROUTE = '/lessons/:lessonId'

export const SETTINGS_ROUTE = '/settings'
