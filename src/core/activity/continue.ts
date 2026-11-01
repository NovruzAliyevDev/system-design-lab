import { findChallenge } from '../challenges/challenge'
import type { Catalog, Lesson } from '../content/catalog'
import type { ReadingProgress } from '../progress/progress'
import { isLessonRead } from '../progress/reading'
import type { OpenedItem } from './activity'

/** Where the learner can pick up: a Lesson to resume, the next one, or the first one to start with; or a Challenge. */
export type ContinueTarget = { kind: 'lesson'; lessonId: string; reason: 'resume' | 'next' | 'start' } | { kind: 'challenge'; challengeId: string }

export type ContinueCatalog = Pick<Catalog, 'lessons' | 'challenges'>

/**
 * Where to continue from the item opened last. A Lesson already read leads on to the next unread one in
 * primer order (from the start after the last), or back to itself once every Lesson is read. With nothing
 * opened, or an item the catalog no longer has, the first unread Lesson; undefined when every one is read.
 */
export function continueTarget(lastOpened: OpenedItem | undefined, reading: ReadingProgress, catalog: ContinueCatalog): ContinueTarget | undefined {
  const isUnread = (lesson: Lesson) => !isLessonRead(reading, lesson.id)
  if (lastOpened?.kind === 'challenge' && findChallenge(catalog.challenges, lastOpened.challengeId)) return lastOpened
  const at = lastOpened?.kind === 'lesson' ? catalog.lessons.findIndex((lesson) => lesson.id === lastOpened.lessonId) : -1
  if (at === -1) {
    const first = catalog.lessons.find(isUnread)
    return first && { kind: 'lesson', lessonId: first.id, reason: 'start' }
  }
  const opened = catalog.lessons[at]
  if (isUnread(opened)) return { kind: 'lesson', lessonId: opened.id, reason: 'resume' }
  const next = [...catalog.lessons.slice(at + 1), ...catalog.lessons.slice(0, at)].find(isUnread)
  return next ? { kind: 'lesson', lessonId: next.id, reason: 'next' } : { kind: 'lesson', lessonId: opened.id, reason: 'resume' }
}
