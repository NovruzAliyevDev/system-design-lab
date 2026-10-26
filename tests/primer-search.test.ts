import { describe, expect, it } from 'vitest'
import { loadPrimerCatalog } from '../scripts/build-content'
import { buildSearchIndex, loadSearchIndex, search, searchDocuments } from '../src/core/search/search'

describe('search over the pinned primer commit', () => {
  const catalog = loadPrimerCatalog()
  const index = loadSearchIndex(JSON.parse(JSON.stringify(buildSearchIndex(searchDocuments(catalog)))))
  const topResult = (query: string) => search(index, query)[0]
  const topLesson = (query: string) => search(index, query).find((result) => result.kind === 'lesson')

  it('finds every Lesson by its own title', () => {
    for (const lesson of catalog.lessons) {
      expect(search(index, lesson.title).map((result) => result.id), lesson.title).toContain(lesson.id)
    }
  })

  it('leads with the Lesson about the searched topic', () => {
    expect(topResult('eventual consistency')).toMatchObject({ kind: 'lesson', id: 'eventual-consistency', context: 'Consistency patterns' })
    expect(topLesson('round robin')).toMatchObject({ id: 'load-balancer', context: 'Load balancer' })
  })

  it('finds every Challenge by its own title', () => {
    for (const challenge of catalog.challenges) {
      expect(search(index, challenge.title).map((result) => `${result.kind}:${result.id}`), challenge.title).toContain(`challenge:${challenge.id}`)
    }
    expect(search(index, 'pastebin').map((result) => `${result.kind}:${result.id}`)).toContain('challenge:pastebin')
  })

  it('leads with the Glossary Term for a term that has no Lesson of its own', () => {
    expect(topResult('round robin')).toMatchObject({ kind: 'glossary', id: 'round-robin' })
    expect(topResult('sharding')).toMatchObject({ kind: 'glossary', id: 'sharding' })
  })
})
