import { slug } from 'github-slugger'

/** A Glossary Term as it is authored. */
export interface GlossaryTermInput {
  /** The English term, as interviews use it. */
  term: string
  /** Other ways the primer writes the term (spellings, short forms); they match in Lesson text like the term itself. */
  aliases?: string[]
  /** A short explanation in Azerbaijani. */
  explanation: string
  /** Lessons about the term, at least one. */
  lessonIds: string[]
}

export interface GlossaryTerm extends Required<GlossaryTermInput> {
  /** Derived from the term; the anchor of the term on the Glossary page. */
  id: string
}

const FIELDS = new Set<string>(['term', 'aliases', 'explanation', 'lessonIds'])

/**
 * Checks an authored Glossary against its schema and the Lessons it references.
 * Returns the terms in alphabetical order, or every problem found.
 */
export function validateGlossary(
  input: unknown,
  lessonIds: ReadonlySet<string>,
): { terms: GlossaryTerm[]; problems: string[] } {
  if (!Array.isArray(input)) return { terms: [], problems: ['Glossary: must be a list of Glossary Terms'] }

  const terms: GlossaryTerm[] = []
  const problems: string[] = []
  /** Every term and alias seen so far, lower-cased → the term that uses it. */
  const owners = new Map<string, string>()
  const ids = new Map<string, string>()
  input.forEach((item: unknown, i) => {
    const name = isRecord(item) && isText(item.term) ? `Glossary Term "${item.term}"` : `Glossary Term #${i + 1}`
    const problem = (message: string) => problems.push(`${name}: ${message}`)
    if (!isRecord(item)) return problem('must be an object')

    const { term, aliases = [], explanation, lessonIds: termLessonIds } = item
    for (const field of Object.keys(item)) if (!FIELDS.has(field)) problem(`unknown field "${field}"`)
    if (!isText(term)) problem('"term" must be a non-empty string')
    if (!isTextList(aliases)) problem('"aliases" must be a list of non-empty strings')
    if (!isText(explanation)) problem('"explanation" must be a non-empty string')
    if (!isTextList(termLessonIds)) problem('"lessonIds" must be a list of Lesson ids')
    else if (termLessonIds.length === 0) problem('"lessonIds" must list at least one Lesson id')
    else for (const id of termLessonIds) if (!lessonIds.has(id)) problem(`unknown Lesson id "${id}"`)
    if (!isText(term) || !isTextList(aliases) || !isText(explanation) || !isTextList(termLessonIds)) return

    for (const form of [term, ...aliases]) {
      const owner = owners.get(form.toLowerCase())
      if (owner !== undefined) problem(`"${form}" is already used by Glossary Term "${owner}"`)
      else owners.set(form.toLowerCase(), term)
    }
    const id = slug(term)
    const idOwner = ids.get(id)
    if (idOwner !== undefined && idOwner.toLowerCase() !== term.toLowerCase()) {
      problem(`its id "${id}" is already used by Glossary Term "${idOwner}"`)
    }
    ids.set(id, term)
    terms.push({ id, term, aliases, explanation, lessonIds: termLessonIds })
  })

  terms.sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }))
  return { terms, problems }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A non-empty string without surrounding whitespace. */
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.trim() === value
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText)
}
