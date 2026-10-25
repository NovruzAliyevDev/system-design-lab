import { describe, expect, it } from 'vitest'
import { loadPrimerCatalog } from '../scripts/build-content'
import { findUnresolvedLinks, resolveLink } from '../src/core/content/links'
import { linkUrls } from '../src/core/content/markdown'
import { htmlLinkUrls } from '../src/core/flashcards/deck'

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

  it('resolves every internal link in the primer and its solutions to a page of the app', () => {
    expect(findUnresolvedLinks(catalog)).toEqual([])
  })

  it('has a Solution page for each of the eight system design questions, in primer order', () => {
    expect(catalog.solutions.map((solution) => [solution.id, solution.title])).toEqual([
      ['pastebin', 'Design Pastebin.com (or Bit.ly)'],
      ['twitter', 'Design the Twitter timeline and search'],
      ['web_crawler', 'Design a web crawler'],
      ['mint', 'Design Mint.com'],
      ['social_graph', 'Design the data structures for a social network'],
      ['query_cache', 'Design a key-value cache to save the results of the most recent web server queries'],
      ['sales_rank', "Design Amazon's sales rank by category feature"],
      ['scaling_aws', 'Design a system that scales to millions of users on AWS'],
    ])
    expect(resolveLink(catalog, 'solutions/system_design/pastebin/README.md')).toEqual({ kind: 'solution', solutionId: 'pastebin' })
  })

  it('serves every diagram of the Solution pages with the site', () => {
    for (const solution of catalog.solutions) {
      const images = linkUrls(solution.body).filter((href) => /\.(png|jpe?g|gif|svg|webp)$/i.test(href))
      expect(images.length, solution.id).toBeGreaterThan(0)
      for (const src of images) expect(resolveLink(catalog, src, solution.path).kind, `${solution.id}: ${src}`).toBe('asset')
    }
  })

  it("converts the primer's three Decks into Flashcards, front to back", () => {
    const [deck] = catalog.decks

    expect(catalog.decks.map(({ id, title, cards }) => [id, title, cards.length])).toEqual([
      ['system-design', 'System Design', 42],
      ['system-design-exercises', 'System Design Exercises', 8],
      ['oo-design', 'OO Design', 6],
    ])
    expect(deck.cards[0]).toMatchObject({ id: 'system-design/1482325088071', front: '<h2>Performance vs scalability</h2>' })
    expect(deck.cards[0].back).toContain('if it results in increased')
    const html = deck.cards.map((card) => card.front + card.back).join('')
    expect(html).not.toMatch(/ style=|<script|<svg/)
  })

  it('links the Exercises to their Lessons, and the links in their write-ups into the README', () => {
    const exercises = catalog.decks[1].cards
    const primerLinks = exercises.flatMap((card) => htmlLinkUrls(card.back)).filter((href) => href.startsWith(`${catalog.source.repoUrl}#`))

    expect(exercises[1]).toMatchObject({ lessonIds: ['design-pastebincom-or-bitly'] })
    expect(primerLinks.length).toBeGreaterThan(100)
    expect(primerLinks.filter((href) => resolveLink(catalog, href).kind !== 'lesson')).toEqual([])
  })

  it('serves every Flashcard image with the site, except the one the README also shows from GitHub', () => {
    const external = catalog.decks.flatMap((deck) =>
      deck.cards.flatMap((card) =>
        [...card.back.matchAll(/<img src="([^"]*)"/g)]
          .map((match) => match[1])
          .filter((src) => resolveLink(catalog, src).kind !== 'asset')
          .map((src) => `${card.id}: ${src}`),
      ),
    )
    const latencyChart = catalog.lessons.find((lesson) => lesson.id === 'latency-numbers-every-programmer-should-know')

    expect(external).toHaveLength(1)
    expect(latencyChart?.body).toContain(external[0].split(': ')[1])
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

  it('extracts the powers of two table from the appendix', () => {
    const rows = catalog.appendix.powersOfTwo?.rows ?? []

    expect(rows.map((row) => row.power)).toEqual([7, 8, 10, 16, 20, 30, 32, 40])
    expect(rows.find((row) => row.power === 10)).toEqual({ power: 10, exactValue: 1024, approxValue: '1 thousand', bytes: '1 KB' })
    expect(rows.find((row) => row.power === 16)).toEqual({ power: 16, exactValue: 65_536, bytes: '64 KB' })
    expect(rows.find((row) => row.power === 40)?.exactValue).toBe(1_099_511_627_776)
  })

  it('extracts the latency numbers table from the appendix', () => {
    const rows = catalog.appendix.latencyNumbers?.rows ?? []

    expect(rows).toHaveLength(15)
    expect(rows[0]).toEqual({ operation: 'L1 cache reference', nanoseconds: 0.5 })
    expect(rows.find((row) => row.operation === 'Main memory reference')).toEqual({
      operation: 'Main memory reference',
      nanoseconds: 100,
      note: '20x L2 cache, 200x L1 cache',
    })
    expect(rows.find((row) => row.operation === 'Read 1 MB sequentially from SSD*')).toEqual({
      operation: 'Read 1 MB sequentially from SSD*',
      nanoseconds: 1_000_000,
      note: '~1GB/sec SSD, 4X memory',
    })
    expect(rows.at(-1)).toEqual({ operation: 'Send packet CA->Netherlands->CA', nanoseconds: 150_000_000 })
  })

  it("offers the primer's study guide as three timelines of steps through the Lessons", () => {
    const guide = catalog.studyGuide

    expect(guide?.timelines.map((timeline) => timeline.id)).toEqual(['short', 'medium', 'long'])
    expect(guide?.timelines[0].summary).toBe(
      'Aim for breadth with system design topics. Practice by solving some interview questions.',
    )
    expect(guide?.steps).toHaveLength(7)
    expect(guide?.steps[0]).toEqual({
      parts: [
        { text: 'Read through the ' },
        { text: 'System design topics', lessonId: 'index-of-system-design-topics' },
        { text: ' to get a broad understanding of how systems work' },
      ],
      amounts: { short: 'yes', medium: 'yes', long: 'yes' },
    })
    expect(guide?.steps[4].amounts).toEqual({ short: 'some', medium: 'many', long: 'most' })
  })

  it('matches the recorded Lesson list', () => {
    expect(catalog.lessons.map((lesson) => `${lesson.id} | ${lesson.title}`)).toMatchSnapshot()
  })
})
