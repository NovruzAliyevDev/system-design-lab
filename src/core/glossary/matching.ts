import type { Nodes, Parent, Root, Text } from 'mdast'
import type { GlossaryTerm } from './glossary'

/** An occurrence of a Glossary Term in Lesson text, which the UI shows with a tooltip. */
export interface GlossaryTermNode extends Parent {
  type: 'glossaryTerm'
  termId: string
  children: [Text]
}

declare module 'mdast' {
  interface PhrasingContentMap {
    glossaryTerm: GlossaryTermNode
  }
  interface RootContentMap {
    glossaryTerm: GlossaryTermNode
  }
}

/** Built once per Glossary and passed to `markGlossaryTerms`; its fields are internal to this module. */
export interface GlossaryMatcher {
  /** Matches any term or alias at word boundaries; group 1 is the term or alias without a plural ending. */
  readonly pattern: RegExp | undefined
  /** Term or alias written in capitals (an acronym such as REST) → term id; matched exactly. */
  readonly exactForms: ReadonlyMap<string, string>
  /** Any other term or alias, lower-cased → term id; matched ignoring case. */
  readonly lowerCaseForms: ReadonlyMap<string, string>
}

/** Letters, digits and hyphens make up a word, so "cache" does not match inside "cache-aside". */
const NOT_WORD_BEFORE = '(?<![\\p{L}\\p{N}-])'
const NOT_WORD_AFTER = '(?![\\p{L}\\p{N}-])'
const PLURAL_ENDING = '(?:e?s)?'

export function createGlossaryMatcher(terms: GlossaryTerm[]): GlossaryMatcher {
  const exactForms = new Map<string, string>()
  const lowerCaseForms = new Map<string, string>()
  const forms: string[] = []
  for (const term of terms) {
    for (const form of [term.term, ...term.aliases]) {
      forms.push(form)
      if (isWrittenInCapitals(form)) exactForms.set(normalizeSpace(form), term.id)
      else lowerCaseForms.set(normalizeSpace(form).toLowerCase(), term.id)
    }
  }
  // Longer forms first, so a regex alternative prefers "write-through cache" over "write-through".
  const alternatives = forms
    .sort((a, b) => b.length - a.length)
    .map((form) => form.split(/\s+/).map(escapeRegExp).join('\\s+'))
  const pattern =
    alternatives.length > 0
      ? new RegExp(`${NOT_WORD_BEFORE}(${alternatives.join('|')})${PLURAL_ENDING}${NOT_WORD_AFTER}`, 'giu')
      : undefined
  return { pattern, exactForms, lowerCaseForms }
}

/** Node types whose text never gets a tooltip: headings, links (a tooltip inside a link could not be opened) and code. */
const SKIPPED = new Set<Nodes['type']>(['heading', 'link', 'linkReference', 'inlineCode', 'code', 'html', 'definition'])

/**
 * Wraps occurrences of Glossary Terms in Lesson text in `glossaryTerm` nodes, in place.
 * Each heading starts a new section, and within a section only the first occurrence of a term
 * (by any of its forms) is wrapped.
 */
export function markGlossaryTerms(tree: Root, matcher: GlossaryMatcher): void {
  let seen = new Set<string>()
  const visit = (parent: Parent) => {
    parent.children = parent.children.flatMap((child): Nodes[] => {
      if (child.type === 'heading') seen = new Set()
      if (child.type === 'text') return splitText(child, matcher, seen)
      if (!SKIPPED.has(child.type) && 'children' in child) visit(child)
      return [child]
    }) as Parent['children']
  }
  visit(tree)
}

/** The text with its first occurrences of terms not in `seen` wrapped; adds those terms to `seen`. */
function splitText(text: Text, matcher: GlossaryMatcher, seen: Set<string>): Array<Text | GlossaryTermNode> {
  const { pattern } = matcher
  if (!pattern) return [text]
  const parts: Array<Text | GlossaryTermNode> = []
  let at = 0
  for (const match of text.value.matchAll(pattern)) {
    const termId = termIdOf(match[1], match[0].slice(match[1].length), matcher)
    if (termId === undefined || seen.has(termId)) continue
    seen.add(termId)
    if (match.index > at) parts.push(textNode(text.value.slice(at, match.index)))
    parts.push({ type: 'glossaryTerm', termId, children: [textNode(match[0])] })
    at = match.index + match[0].length
  }
  if (parts.length === 0) return [text]
  if (at < text.value.length) parts.push(textNode(text.value.slice(at)))
  return parts
}

/** The term written as `form` followed by `ending` (a plural ending or nothing), if that is a term at all. */
function termIdOf(form: string, ending: string, matcher: GlossaryMatcher): string | undefined {
  const normalized = normalizeSpace(form)
  // An acronym's plural ending is lower case: "HTTPS" is not more than one HTTP.
  const exact = ending === ending.toLowerCase() ? matcher.exactForms.get(normalized) : undefined
  return exact ?? matcher.lowerCaseForms.get(normalized.toLowerCase())
}

function textNode(value: string): Text {
  return { type: 'text', value }
}

function isWrittenInCapitals(form: string): boolean {
  return form === form.toUpperCase() && form !== form.toLowerCase()
}

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
