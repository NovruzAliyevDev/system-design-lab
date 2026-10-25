import { describe, expect, it } from 'vitest'
import { loadPrimerCatalog } from '../scripts/build-content'
import { buildSearchIndex, loadSearchIndex, search, searchDocuments } from '../src/core/search/search'

describe('search over the pinned primer commit', () => {
  const catalog = loadPrimerCatalog()
  const index = loadSearchIndex(JSON.parse(JSON.stringify(buildSearchIndex(searchDocuments(catalog)))))
  const topResult = (query: string) => search(index, query)[0]

  it('finds every Lesson by its own title', () => {
    for (const lesson of catalog.lessons) {
      expect(search(index, lesson.title).map((result) => result.id), lesson.title).toContain(lesson.id)
    }
  })

  it('leads with the Lesson about the searched topic', () => {
    expect(topResult('round robin')).toMatchObject({ id: 'load-balancer', context: 'Load balancer' })
    expect(topResult('eventual consistency')).toMatchObject({ id: 'eventual-consistency', context: 'Consistency patterns' })
  })
})
