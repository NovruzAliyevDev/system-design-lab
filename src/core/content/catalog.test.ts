import { describe, expect, it } from 'vitest'
import { buildContentCatalog } from './catalog'

const source = {
  repoUrl: 'https://github.com/donnemartin/system-design-primer',
  commit: 'abc123',
  path: 'README.md',
}

describe('buildContentCatalog', () => {
  it('turns each H2 and H3 section into a Lesson in document order', () => {
    const markdown = [
      '# Primer',
      'Intro text.',
      '## Cache',
      'Cache intro.',
      '### Client caching',
      'Client text.',
      '## Database',
      'DB text.',
    ].join('\n')

    const catalog = buildContentCatalog({ markdown, source })

    expect(catalog.lessons.map((l) => [l.id, l.title])).toEqual([
      ['primer', 'Primer'],
      ['cache', 'Cache'],
      ['client-caching', 'Client caching'],
      ['database', 'Database'],
    ])
  })

  it('gives each Lesson the markdown under its heading, keeping deeper headings and code inside it', () => {
    const markdown = [
      '## Database',
      'DB intro.',
      '#### Sharding',
      '```python',
      '# not a heading',
      '```',
      '### NoSQL',
      'NoSQL text.',
    ].join('\n')

    const [database, nosql] = buildContentCatalog({ markdown, source }).lessons

    expect(database.body).toBe(['DB intro.', '#### Sharding', '```python', '# not a heading', '```'].join('\n'))
    expect(nosql.body).toBe('NoSQL text.')
  })

  it('groups H3 Lessons under the H2 (or H1) section they belong to, in primer order', () => {
    const markdown = ['# Primer', 'a', '## Cache', 'b', '### Client caching', 'c', '### CDN caching', 'd', '## Database', 'e'].join(
      '\n',
    )

    const catalog = buildContentCatalog({ markdown, source })

    expect(catalog.groups).toEqual([
      { id: 'primer', title: 'Primer', order: 0 },
      { id: 'cache', title: 'Cache', order: 1 },
      { id: 'database', title: 'Database', order: 2 },
    ])
    expect(catalog.lessons.map((l) => [l.id, l.groupId, l.order])).toEqual([
      ['primer', 'primer', 0],
      ['cache', 'cache', 1],
      ['client-caching', 'cache', 2],
      ['cdn-caching', 'cache', 3],
      ['database', 'database', 4],
    ])
  })

  it('links every Lesson to its section of the source at the pinned commit', () => {
    const catalog = buildContentCatalog({ markdown: '## Load balancer\nText.', source })

    expect(catalog.source).toEqual(source)
    expect(catalog.lessons[0].sourceUrl).toBe(
      'https://github.com/donnemartin/system-design-primer/blob/abc123/README.md#load-balancer',
    )
  })

  it('keeps a "Source(s) and further reading" section inside the Lesson it belongs to', () => {
    const markdown = [
      '## Cache',
      'Cache text.',
      '### Source(s) and further reading',
      '* [Caching](https://example.com)',
      '## Database',
      '### Source(s) and further reading',
      '* [DB](https://example.com)',
    ].join('\n')

    const catalog = buildContentCatalog({ markdown, source })

    expect(catalog.lessons.map((l) => l.id)).toEqual(['cache', 'database'])
    expect(catalog.lessons[0].body).toBe(
      ['Cache text.', '### Source(s) and further reading', '* [Caching](https://example.com)'].join('\n'),
    )
  })

  it('does not create a Lesson for a section with no text of its own', () => {
    const markdown = ['## Availability vs consistency', '', '### CAP theorem', 'CAP text.'].join('\n')

    const catalog = buildContentCatalog({ markdown, source })

    expect(catalog.groups.map((g) => g.id)).toEqual(['availability-vs-consistency'])
    expect(catalog.lessons.map((l) => [l.id, l.groupId, l.order])).toEqual([
      ['cap-theorem', 'availability-vs-consistency', 0],
    ])
  })
})
