import { describe, expect, it } from 'vitest'
import { buildContentCatalog } from '../content/catalog'
import { buildSearchIndex, searchDocuments, loadSearchIndex, search, type Highlight, type SearchDocument } from './search'

const source = {
  repoUrl: 'https://github.com/donnemartin/system-design-primer',
  commit: 'abc123',
  path: 'README.md',
}

/** Builds the index the way the pipeline does and loads it back the way the app does, through JSON. */
function roundTrippedIndex(documents: SearchDocument[]) {
  return loadSearchIndex(JSON.parse(JSON.stringify(buildSearchIndex(documents))))
}

function indexOfMarkdown(markdown: string) {
  return roundTrippedIndex(searchDocuments(buildContentCatalog({ markdown, source })))
}

/** Shows highlighted ranges as [brackets], so expectations read like the rendered result. */
function marked(text: string, highlights: Highlight[]): string {
  let out = ''
  let at = 0
  for (const { start, end } of highlights) {
    out += `${text.slice(at, start)}[${text.slice(start, end)}]`
    at = end
  }
  return out + text.slice(at)
}

const primer = [
  '## Load balancer',
  'Load balancers distribute incoming client requests to computing resources such as **application servers**.',
  '### Layer 4 load balancing',
  'Layer 4 load balancers look at info at the [transport layer](#transport-layer) to decide how to distribute requests.',
  '## Cache',
  'Caching improves page load times and can reduce the load on your servers and databases.',
  '### Database caching',
  'Your database usually includes some level of caching in a default configuration.',
  '## Database',
  '<p align="center"><img src="images/Xkm5CXz.png"></p>',
  '',
  'Replication with a master and one or more slaves.',
].join('\n')

describe('search', () => {
  it('finds a Lesson by a word in its text and shows its title, group and a snippet with the hit highlighted', () => {
    const [result, ...rest] = search(indexOfMarkdown(primer), 'replication')

    expect(rest).toEqual([])
    expect(result).toMatchObject({ kind: 'lesson', id: 'database', title: 'Database', context: 'Database' })
    expect(marked(result.snippet.text, result.snippet.highlights)).toBe(
      '[Replication] with a master and one or more slaves.',
    )
  })

  it('names the Lesson group of a Lesson inside a group', () => {
    const [result] = search(indexOfMarkdown(primer), 'transport')

    expect(result).toMatchObject({ id: 'layer-4-load-balancing', title: 'Layer 4 load balancing', context: 'Load balancer' })
  })

  it('matches words as they are typed and highlights the whole matching word', () => {
    const [result] = search(indexOfMarkdown(primer), 'distrib')

    expect(result.id).toBe('load-balancer')
    expect(marked(result.snippet.text, result.snippet.highlights)).toContain('[distribute]')
  })

  it('requires every word of the query and highlights each of them', () => {
    const results = search(indexOfMarkdown(primer), 'default configuration')

    expect(results.map((r) => r.id)).toEqual(['database-caching'])
    expect(marked(results[0].snippet.text, results[0].snippet.highlights)).toContain('a [default] [configuration].')
  })

  it('ranks a Lesson whose title matches above Lessons that only mention the word', () => {
    const results = search(indexOfMarkdown(primer), 'cache')

    expect(results[0].id).toBe('cache')
    expect(marked(results[0].title, results[0].titleHighlights)).toBe('[Cache]')
  })

  it('tolerates a small typo', () => {
    expect(search(indexOfMarkdown(primer), 'replicaton').map((r) => r.id)).toEqual(['database'])
  })

  it('shows Lesson text as plain text, without markdown syntax or HTML', () => {
    const [balancer] = search(indexOfMarkdown(primer), 'computing')
    const [database] = search(indexOfMarkdown(primer), 'slaves')

    expect(balancer.snippet.text).toContain('such as application servers.')
    expect(database.snippet.text).not.toContain('img')
  })

  it('keeps words apart where inline HTML such as a line break separated them', () => {
    const [result] = search(indexOfMarkdown('## Links\n| Question | Reference |\n|---|---|\n| Design | [one.com](a)<br/>[two.com](b) |'), 'two')

    expect(result.snippet.text).toContain('one.com two.com')
  })

  it('cuts a long text to a short snippet around the hits, marking the cut ends', () => {
    const filler = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')
    const index = roundTrippedIndex([{ kind: 'lesson', id: 'long', title: 'Long', context: 'Group', text: `${filler} needle ${filler}` }])

    const [{ snippet }] = search(index, 'needle')

    expect(snippet.text.length).toBeLessThanOrEqual(200)
    expect(snippet.text.startsWith('…')).toBe(true)
    expect(snippet.text.endsWith('…')).toBe(true)
    expect(marked(snippet.text, snippet.highlights)).toMatch(/word\d+ \[needle\] word0/)
  })

  it('starts the snippet at the text when only the title matches', () => {
    const index = roundTrippedIndex([{ kind: 'lesson', id: 'cap', title: 'CAP theorem', context: 'Group', text: 'In a distributed system...' }])

    const [result] = search(index, 'theorem')

    expect(result.snippet).toEqual({ text: 'In a distributed system...', highlights: [] })
    expect(marked(result.title, result.titleHighlights)).toBe('CAP [theorem]')
  })

  it('finds a Glossary Term by its name or an alias, with its explanation as the snippet', () => {
    const glossary = [
      { term: 'Write-behind', aliases: ['write-back'], explanation: 'Yazma keşə gedir, bazaya isə sonra yazılır.', lessonIds: ['cache'] },
    ]
    const index = roundTrippedIndex(searchDocuments(buildContentCatalog({ markdown: primer, source, authored: { glossary } })))

    const [byName] = search(index, 'write-behind')
    const [byAlias] = search(index, 'write-back')

    expect(byName).toMatchObject({ kind: 'glossary', id: 'write-behind', title: 'Write-behind', context: '' })
    expect(byName.snippet.text).toContain('Yazma keşə gedir')
    expect(byAlias).toMatchObject({ kind: 'glossary', id: 'write-behind' })
    expect(marked(byAlias.snippet.text, byAlias.snippet.highlights)).toContain('[write]-[back]')
  })

  it('finds a Challenge by its title or the task of a Stage, with the task as the snippet', () => {
    const challenge = {
      id: 'url-shortener',
      title: 'Qısa link servisi dizayn edin',
      kind: 'architecture',
      source: 'authored',
      lessonIds: ['cache'],
      stages: [
        {
          id: 'requirements',
          type: 'requirements',
          weight: 1,
          prompt: 'Servisin istifadə hallarını seçin.',
          items: [
            { section: 'use-case', text: 'Link yaradılır', correct: true, explanation: 'Əsas ssenari.' },
            { section: 'use-case', text: 'Hesab yaradılır', explanation: 'Kənarda qalır.' },
          ],
        },
      ],
    }
    const index = roundTrippedIndex(searchDocuments(buildContentCatalog({ markdown: primer, source, authored: { challenges: [challenge] } })))

    const [byTitle] = search(index, 'qısa link')
    const [byPrompt] = search(index, 'istifadə hallarını')

    expect(byTitle).toMatchObject({ kind: 'challenge', id: 'url-shortener', title: 'Qısa link servisi dizayn edin', context: '' })
    expect(byPrompt).toMatchObject({ kind: 'challenge', id: 'url-shortener' })
    expect(marked(byPrompt.snippet.text, byPrompt.snippet.highlights)).toBe('Servisin [istifadə] [hallarını] seçin.')
  })

  it('returns nothing for an empty query and at most `limit` results', () => {
    const index = indexOfMarkdown(primer)

    expect(search(index, '   ')).toEqual([])
    expect(search(index, 'load', { limit: 2 })).toHaveLength(2)
  })
})
