import { describe, expect, it } from 'vitest'
import { buildContentCatalog } from './catalog'
import { adjacentLessons, tableOfContents } from './navigation'

const catalog = buildContentCatalog({
  markdown: ['# Primer', 'a', '## Cache', 'b', '### Client caching', 'c', '## Database', 'd'].join('\n'),
  source: { repoUrl: 'https://github.com/donnemartin/system-design-primer', commit: 'abc123', path: 'README.md' },
})

describe('tableOfContents', () => {
  it('lists Lesson groups in primer order with their Lessons', () => {
    expect(tableOfContents(catalog).map(({ group, lessons }) => [group.id, lessons.map((l) => l.id)])).toEqual([
      ['primer', ['primer']],
      ['cache', ['cache', 'client-caching']],
      ['database', ['database']],
    ])
  })

  it('marks a group that is just one Lesson of the same name', () => {
    expect(tableOfContents(catalog).map(({ group, isSingleLesson }) => [group.id, isSingleLesson])).toEqual([
      ['primer', true],
      ['cache', false],
      ['database', true],
    ])
  })
})

describe('adjacentLessons', () => {
  it('gives the previous and next Lesson in primer order, across groups', () => {
    const { previous, next } = adjacentLessons(catalog, 'client-caching')

    expect(previous?.id).toBe('cache')
    expect(next?.id).toBe('database')
  })

  it('has no previous Lesson at the start and no next Lesson at the end', () => {
    expect(adjacentLessons(catalog, 'primer').previous).toBeUndefined()
    expect(adjacentLessons(catalog, 'database').next).toBeUndefined()
  })
})
