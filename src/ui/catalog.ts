import type { Catalog } from '../core/content/catalog'
import data from '../generated/catalog.json'

export const catalog = data as Catalog

export function findLesson(id: string) {
  return catalog.lessons.find((lesson) => lesson.id === id)
}
