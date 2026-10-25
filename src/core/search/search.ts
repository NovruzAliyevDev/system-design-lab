import MiniSearch, { type AsPlainObject, type Options } from 'minisearch'
import type { Catalog } from '../content/catalog'
import { markdownToPlainText } from '../content/markdown'

/** What a search result opens. Challenges join here as their ticket adds them to the catalog. */
export type SearchKind = 'lesson' | 'glossary'

/** One searchable item; `searchDocuments` collects them from the catalog. */
export interface SearchDocument {
  kind: SearchKind
  /** Id of the item within its kind, e.g. a Lesson id. */
  id: string
  title: string
  /** Where the item sits, shown next to its title: the Lesson group for a Lesson; empty for a Glossary Term. */
  context: string
  /** Plain text that is searched and that snippets are cut from. */
  text: string
}

/** A range of a string to highlight, `end` exclusive. */
export interface Highlight {
  start: number
  end: number
}

export interface SearchResult extends Omit<SearchDocument, 'text'> {
  titleHighlights: Highlight[]
  /** A short passage of the text around the hits, with `…` where it was cut. */
  snippet: { text: string; highlights: Highlight[] }
}

/** The index as the Content Pipeline writes it (plain JSON) and the app loads it. */
export interface SerializedSearchIndex {
  index: AsPlainObject
}

export interface SearchIndex {
  readonly miniSearch: MiniSearch<IndexedDocument>
}

interface IndexedDocument extends SearchDocument {
  /** Unique across kinds. */
  key: string
}

/** Letters and digits; everything else separates words. Indexing and highlighting must agree on this. */
const WORD = /[\p{L}\p{N}]+/gu
const DEFAULT_LIMIT = 20
const SNIPPET_LENGTH = 160
/** How much text the snippet shows before its first hit. */
const SNIPPET_LEAD = 40
const GLOSSARY_BOOST = 0.5

const OPTIONS: Options<IndexedDocument> = {
  idField: 'key',
  fields: ['title', 'text'],
  storeFields: ['kind', 'id', 'title', 'context', 'text'],
  tokenize: (text) => text.match(WORD) ?? [],
  // One typo is forgiven in longer words; more would let e.g. "replication" find "application".
  searchOptions: {
    boost: { title: 3 },
    // A Lesson about a topic leads over the Glossary Term of the same name, which is its short summary.
    boostDocument: (_key, _term, stored) => (stored?.kind === 'glossary' ? GLOSSARY_BOOST : 1),
    prefix: true,
    fuzzy: (term) => (term.length >= 5 ? 1 : false),
    combineWith: 'AND',
  },
}

/** Everything in the catalog that search finds. A new kind of content adds its documents here. */
export function searchDocuments(catalog: Catalog): SearchDocument[] {
  return [...lessonDocuments(catalog), ...glossaryDocuments(catalog)]
}

function lessonDocuments(catalog: Catalog): SearchDocument[] {
  const groupTitles = new Map(catalog.groups.map((group) => [group.id, group.title]))
  return catalog.lessons.map((lesson) => ({
    kind: 'lesson',
    id: lesson.id,
    title: lesson.title,
    context: groupTitles.get(lesson.groupId) ?? '',
    text: markdownToPlainText(lesson.body),
  }))
}

function glossaryDocuments(catalog: Catalog): SearchDocument[] {
  return catalog.glossary.map((term) => ({
    kind: 'glossary',
    id: term.id,
    title: term.term,
    context: '',
    // Aliases are searchable too, and the snippet shows them before the explanation.
    text: term.aliases.length > 0 ? `${term.aliases.join(', ')} — ${term.explanation}` : term.explanation,
  }))
}

export function buildSearchIndex(documents: SearchDocument[]): SerializedSearchIndex {
  const miniSearch = new MiniSearch(OPTIONS)
  miniSearch.addAll(documents.map((document) => ({ ...document, key: `${document.kind}:${document.id}` })))
  return { index: miniSearch.toJSON() }
}

export function loadSearchIndex(data: SerializedSearchIndex): SearchIndex {
  return { miniSearch: MiniSearch.loadJS(data.index, OPTIONS) }
}

export function search(index: SearchIndex, query: string, options: { limit?: number } = {}): SearchResult[] {
  if (!query.trim()) return []
  return index.miniSearch
    .search(query)
    .slice(0, options.limit ?? DEFAULT_LIMIT)
    .map((result) => {
      const hitTerms = new Set(result.terms)
      // MiniSearch returns the stored fields untyped.
      const { kind, id, title, context, text } = result as typeof result & SearchDocument
      return {
        kind,
        id,
        title,
        titleHighlights: wordsIn(title).filter((word) => hitTerms.has(word.term)),
        context,
        snippet: snippetOf(text, hitTerms),
      }
    })
}

interface Word extends Highlight {
  term: string
}

function wordsIn(text: string): Word[] {
  return [...text.matchAll(WORD)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    term: match[0].toLowerCase(),
  }))
}

/** Cuts the passage around the place where the most different query words are close together. */
function snippetOf(text: string, hitTerms: Set<string>): SearchResult['snippet'] {
  const words = wordsIn(text)
  const hits = words.filter((word) => hitTerms.has(word.term))
  const best = hits.reduce<{ hit?: Word; count: number }>(
    (bestSoFar, hit) => {
      const count = new Set(
        hits.filter((other) => other.start >= hit.start && other.end <= hit.start + SNIPPET_LENGTH - SNIPPET_LEAD).map((other) => other.term),
      ).size
      return count > bestSoFar.count ? { hit, count } : bestSoFar
    },
    { count: 0 },
  )

  // Near the end of the text the window starts earlier, so it stays full.
  const leadStart = Math.min((best.hit?.start ?? 0) - SNIPPET_LEAD, text.length - SNIPPET_LENGTH)
  // The cut ends fall between words.
  const start = leadStart <= 0 ? 0 : (words.find((word) => word.start >= leadStart)?.start ?? 0)
  const end =
    start + SNIPPET_LENGTH >= text.length
      ? text.length
      : words.findLast((word) => word.end <= start + SNIPPET_LENGTH && word.start >= start)?.end ?? start + SNIPPET_LENGTH
  const prefix = start > 0 ? '…' : ''
  const shift = prefix.length - start
  return {
    text: `${prefix}${text.slice(start, end)}${end < text.length ? '…' : ''}`,
    highlights: hits
      .filter((hit) => hit.start >= start && hit.end <= end)
      .map((hit) => ({ start: hit.start + shift, end: hit.end + shift })),
  }
}
