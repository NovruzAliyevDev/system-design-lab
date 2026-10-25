import type { Nodes } from 'mdast'
import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../content/markdown'
import type { GlossaryTerm } from './glossary'
import { createGlossaryMatcher, markGlossaryTerms } from './matching'

function term(id: string, term: string, aliases: string[] = []): GlossaryTerm {
  return { id, term, aliases, explanation: '…', lessonIds: ['lesson'] }
}

const glossary = [
  term('sharding', 'Sharding', ['shard']),
  term('cache', 'Cache'),
  term('write-through', 'Write-through', ['write through']),
  term('load-balancer', 'Load balancer'),
  term('rest', 'REST'),
  term('nosql', 'NoSQL'),
]

/** The text of the markdown with each marked term shown as [text](term id), so expectations read like the rendered Lesson. */
function marked(markdown: string, terms: GlossaryTerm[] = glossary): string {
  const tree = parseMarkdown(markdown)
  markGlossaryTerms(tree, createGlossaryMatcher(terms))
  return textOf(tree).trim()
}

function textOf(node: Nodes): string {
  if (node.type === 'glossaryTerm') return `[${textOf(node.children[0])}](${node.termId})`
  if ('value' in node) return node.value
  if (!('children' in node)) return ''
  const separator = node.type === 'root' || node.type === 'list' ? '\n' : ''
  return node.children.map(textOf).join(separator)
}

describe('markGlossaryTerms', () => {
  it('marks a term in Lesson text, ignoring case and keeping the text as written', () => {
    expect(marked('Use a cache in front of the database.')).toBe('Use a [cache](cache) in front of the database.')
  })

  it('marks an alias as its term', () => {
    expect(marked('Each shard holds part of the data.')).toBe('Each [shard](sharding) holds part of the data.')
  })

  it('marks only the first occurrence of a term in a section, counting its aliases as the same term', () => {
    expect(marked('A shard is small. Sharding splits data. Every shard is a database.')).toBe(
      'A [shard](sharding) is small. Sharding splits data. Every shard is a database.',
    )
  })

  it('marks a term again in each section, since each heading starts a new section', () => {
    expect(marked(['Sharding helps.', '#### Disadvantage(s): sharding', 'Sharding is complex.'].join('\n'))).toBe(
      ['[Sharding](sharding) helps.', 'Disadvantage(s): sharding', '[Sharding](sharding) is complex.'].join('\n'),
    )
  })

  it('counts a section across its paragraphs, lists, emphasis and tables', () => {
    expect(marked(['* **Cache** reads.', '* Cache writes.', '', '| A |', '|---|', '| cache |', '', 'And a cache.'].join('\n'))).toBe(
      ['[Cache](cache) reads.', 'Cache writes.', 'Acache', 'And a cache.'].join('\n'),
    )
  })

  it('leaves terms in headings, links and code alone', () => {
    expect(
      marked(['### Cache', 'See [the cache](#cache) and `cache.get()`.', '```', 'cache = {}', '```', 'Then the cache.'].join('\n')),
    ).toBe(['Cache', 'See the cache and cache.get().', 'cache = {}', 'Then the [cache](cache).'].join('\n'))
  })

  it('prefers the longest term at a position', () => {
    expect(marked('A write-through cache.')).toBe('A [write-through](write-through) [cache](cache).')
    expect(marked('A write\nthrough cache.')).toBe('A [write\nthrough](write-through) [cache](cache).')
  })

  it('matches whole words only, with a plural ending', () => {
    expect(marked('Two caches.')).toBe('Two [caches](cache).')
    expect(marked('Cached pages and a cache-aside read and precache.')).toBe('Cached pages and a cache-aside read and precache.')
    expect(marked('Two load balancers.')).toBe('Two [load balancers](load-balancer).')
  })

  it('matches a term written in capitals, like an acronym, only in capitals', () => {
    expect(marked('The rest of the API is REST.')).toBe('The rest of the API is [REST](rest).')
    expect(marked('RESTS is not a plural of REST.')).toBe('RESTS is not a plural of [REST](rest).')
    expect(marked('A nosql store.')).toBe('A [nosql](nosql) store.')
  })

  it('marks different terms in the same text', () => {
    expect(marked('A cache and a shard and a cache.')).toBe('A [cache](cache) and a [shard](sharding) and a cache.')
  })

  it('changes nothing when the Glossary is empty', () => {
    expect(marked('A cache.', [])).toBe('A cache.')
  })
})
