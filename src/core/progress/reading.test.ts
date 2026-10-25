import { describe, expect, it } from 'vitest'
import { isLessonRead, markLessonRead, markLessonUnread } from './reading'

const MONDAY = new Date('2026-10-19T09:00:00Z')
const TUESDAY = new Date('2026-10-20T09:00:00Z')

describe('read state', () => {
  it('marks a Lesson read at the given time', () => {
    const reading = markLessonRead({ readLessons: {} }, 'cache', MONDAY)

    expect(isLessonRead(reading, 'cache')).toBe(true)
    expect(isLessonRead(reading, 'dns')).toBe(false)
    expect(reading.readLessons.cache).toBe('2026-10-19T09:00:00.000Z')
  })

  it('keeps the first read time when a Lesson is marked read again', () => {
    const reading = markLessonRead(markLessonRead({ readLessons: {} }, 'cache', MONDAY), 'cache', TUESDAY)

    expect(reading.readLessons.cache).toBe('2026-10-19T09:00:00.000Z')
  })

  it('marks a Lesson unread and leaves the others read', () => {
    const reading = markLessonUnread(markLessonRead(markLessonRead({ readLessons: {} }, 'cache', MONDAY), 'dns', MONDAY), 'cache')

    expect(isLessonRead(reading, 'cache')).toBe(false)
    expect(isLessonRead(reading, 'dns')).toBe(true)
  })
})
