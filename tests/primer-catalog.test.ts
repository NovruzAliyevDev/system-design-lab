import { describe, expect, it } from 'vitest'
import { loadPrimerCatalog } from '../scripts/build-content'
import { findUnresolvedLinks } from '../src/core/content/links'

describe('catalog of the pinned primer commit', () => {
  const catalog = loadPrimerCatalog()

  it('contains the primer topics as Lessons in their groups', () => {
    const byId = new Map(catalog.lessons.map((lesson) => [lesson.id, lesson]))

    expect(byId.get('load-balancer')?.groupId).toBe('load-balancer')
    expect(byId.get('cap-theorem')?.groupId).toBe('availability-vs-consistency')
    expect(byId.get('relational-database-management-system-rdbms')?.groupId).toBe('database')
    expect(byId.get('latency-numbers-every-programmer-should-know')?.groupId).toBe('appendix')
    expect(catalog.lessons.some((lesson) => lesson.title === 'Source(s) and further reading')).toBe(false)
  })

  it('resolves every internal link in the primer to a Lesson', () => {
    expect(findUnresolvedLinks(catalog)).toEqual([])
  })

  it("has Glossary Terms for the primer's core vocabulary", () => {
    const forms = new Set(catalog.glossary.flatMap((term) => [term.term, ...term.aliases].map((form) => form.toLowerCase())))
    // The topics that head primer sections, and common terms used across them.
    const vocabulary = [
      'performance', 'scalability', 'latency', 'throughput', 'availability', 'cap theorem', 'consistency', 'weak consistency', 'eventual consistency',
      'strong consistency', 'fail-over', 'replication', 'dns', 'cdn', 'push cdn', 'pull cdn', 'load balancer',
      'layer 4 load balancing', 'layer 7 load balancing', 'horizontal scaling', 'reverse proxy', 'application layer',
      'microservices', 'service discovery', 'rdbms', 'nosql', 'master-slave replication', 'master-master replication',
      'federation', 'sharding', 'denormalization', 'sql tuning', 'key-value store', 'document store', 'wide column store',
      'graph database', 'cache', 'cache-aside', 'write-through', 'write-behind', 'refresh-ahead', 'asynchronism',
      'message queue', 'task queue', 'back pressure', 'http', 'tcp', 'udp', 'rpc', 'rest', 'quorum',
    ]

    expect(vocabulary.filter((term) => !forms.has(term))).toEqual([])
  })

  it('matches the recorded Lesson list', () => {
    expect(catalog.lessons.map((lesson) => `${lesson.id} | ${lesson.title}`)).toMatchSnapshot()
  })
})
