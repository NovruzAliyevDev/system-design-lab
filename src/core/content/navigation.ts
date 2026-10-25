import type { Catalog, Lesson, LessonGroup } from './catalog'

export interface TocEntry {
  group: LessonGroup
  lessons: Lesson[]
  /** The group is a single Lesson of the same name, so it can be shown as just that Lesson. */
  isSingleLesson: boolean
}

/** The primer's structure for the sidebar: groups in primer order, each with its Lessons. */
export function tableOfContents(catalog: Catalog): TocEntry[] {
  return catalog.groups
    .map((group) => {
      const lessons = catalog.lessons.filter((lesson) => lesson.groupId === group.id)
      return { group, lessons, isSingleLesson: lessons.length === 1 && lessons[0].id === group.id }
    })
    .filter((entry) => entry.lessons.length > 0)
}

export function adjacentLessons(catalog: Catalog, lessonId: string): { previous?: Lesson; next?: Lesson } {
  const index = catalog.lessons.findIndex((lesson) => lesson.id === lessonId)
  if (index === -1) return {}
  return { previous: catalog.lessons[index - 1], next: catalog.lessons[index + 1] }
}
