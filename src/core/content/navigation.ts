import type { Catalog, Lesson, LessonGroup } from './catalog'

export interface TocEntry {
  group: LessonGroup
  lessons: Lesson[]
}

/** The primer's structure for the sidebar: groups in primer order, each with its Lessons. */
export function tableOfContents(catalog: Catalog): TocEntry[] {
  return catalog.groups
    .map((group) => ({ group, lessons: catalog.lessons.filter((lesson) => lesson.groupId === group.id) }))
    .filter((entry) => entry.lessons.length > 0)
}

export function adjacentLessons(catalog: Catalog, lessonId: string): { previous?: Lesson; next?: Lesson } {
  const at = catalog.lessons.findIndex((lesson) => lesson.id === lessonId)
  if (at === -1) return {}
  return { previous: catalog.lessons[at - 1], next: catalog.lessons[at + 1] }
}
