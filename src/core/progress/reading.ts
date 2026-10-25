import type { ReadingProgress } from './progress'

export function isLessonRead(reading: ReadingProgress, lessonId: string): boolean {
  return Object.hasOwn(reading.readLessons, lessonId)
}

/** Marks a Lesson read at `now`; a Lesson that is already read keeps the time it was first read. */
export function markLessonRead(reading: ReadingProgress, lessonId: string, now: Date): ReadingProgress {
  if (isLessonRead(reading, lessonId)) return reading
  return { readLessons: { ...reading.readLessons, [lessonId]: now.toISOString() } }
}

export function markLessonUnread(reading: ReadingProgress, lessonId: string): ReadingProgress {
  const { [lessonId]: _, ...readLessons } = reading.readLessons
  return { readLessons }
}
