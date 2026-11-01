import { describe, expect, it } from 'vitest'
import type { Challenge } from '../challenges/challenge'
import type { Lesson } from '../content/catalog'
import { continueTarget, type ContinueCatalog } from './continue'

const lesson = (id: string, order: number) => ({ id, order }) as Lesson

const catalog: ContinueCatalog = {
  lessons: [lesson('dns', 0), lesson('cdn', 1), lesson('cache', 2)],
  challenges: [{ id: 'pastebin' } as Challenge],
}

const readAll = (...lessonIds: string[]) => ({ readLessons: Object.fromEntries(lessonIds.map((id) => [id, '2026-11-01T08:00:00.000Z'])) })

describe('continueTarget', () => {
  it('resumes the last Lesson opened while it is unread', () => {
    expect(continueTarget({ kind: 'lesson', lessonId: 'cdn' }, readAll('dns'), catalog)).toEqual({ kind: 'lesson', lessonId: 'cdn', reason: 'resume' })
  })

  it('moves on from a read Lesson to the next unread one, from the start once past the last', () => {
    expect(continueTarget({ kind: 'lesson', lessonId: 'dns' }, readAll('dns', 'cdn'), catalog)).toEqual({ kind: 'lesson', lessonId: 'cache', reason: 'next' })
    expect(continueTarget({ kind: 'lesson', lessonId: 'cache' }, readAll('cdn', 'cache'), catalog)).toEqual({ kind: 'lesson', lessonId: 'dns', reason: 'next' })
  })

  it('resumes a read Lesson when every Lesson is read', () => {
    expect(continueTarget({ kind: 'lesson', lessonId: 'cdn' }, readAll('dns', 'cdn', 'cache'), catalog)).toEqual({ kind: 'lesson', lessonId: 'cdn', reason: 'resume' })
  })

  it('resumes the last Challenge opened', () => {
    expect(continueTarget({ kind: 'challenge', challengeId: 'pastebin' }, readAll(), catalog)).toEqual({ kind: 'challenge', challengeId: 'pastebin' })
  })

  it('starts at the first unread Lesson when nothing known was opened', () => {
    expect(continueTarget(undefined, readAll('dns'), catalog)).toEqual({ kind: 'lesson', lessonId: 'cdn', reason: 'start' })
    expect(continueTarget({ kind: 'lesson', lessonId: 'removed' }, readAll(), catalog)).toEqual({ kind: 'lesson', lessonId: 'dns', reason: 'start' })
    expect(continueTarget({ kind: 'challenge', challengeId: 'removed' }, readAll(), catalog)).toEqual({ kind: 'lesson', lessonId: 'dns', reason: 'start' })
    expect(continueTarget(undefined, readAll('dns', 'cdn', 'cache'), catalog)).toBeUndefined()
  })
})
