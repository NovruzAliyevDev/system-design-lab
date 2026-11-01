import { challengeLessonReferences } from '../challenges/challenge'
import { conceptSimulationLessonReferences } from '../concept-simulations/embed'
import { flashcardLessonReferences } from '../flashcards/deck'
import { glossaryLessonReferences } from '../glossary/glossary'
import { quizLessonReferences } from '../quizzes/quiz'
import { skillTreeLessonReferences } from '../skill-tree/skill-tree'
import { readLessons, type AuthoredContent, type ContentSource, type LessonReference } from './catalog'

/** The primer README at one commit. */
export interface PrimerVersion {
  markdown: string
  source: ContentSource
}

export interface LessonSummary {
  id: string
  title: string
}

/** What moving the primer pin from one commit to another changes in the Lesson catalog. */
export interface PinChangeReport {
  before: ContentSource
  after: ContentSource
  /** In the new pin's order. */
  added: LessonSummary[]
  /** In the old pin's order. */
  removed: LessonSummary[]
  /** In the old pin's order. A Lesson whose title changed but whose id did not is here too. */
  renamed: LessonRename[]
  /** Authored items that reference a Lesson the new pin does not have; the build fails until they are fixed. */
  brokenReferences: BrokenReference[]
}

export interface LessonRename {
  before: LessonSummary
  after: LessonSummary
}

export interface BrokenReference extends LessonReference {
  /** The Lesson's id in the new pin, when the Lesson was renamed rather than removed. */
  renamedTo?: string
}

/** How similar a removed and an added Lesson must be, from 0 to 1, to count as one Lesson renamed. */
const RENAME_THRESHOLD = 0.6

/**
 * Compares the Lesson catalogs of two primer versions. Authored content is checked against the new
 * version only, and broken references are reported rather than thrown, so the report can show them all.
 */
export function comparePrimerVersions(input: {
  before: PrimerVersion
  after: PrimerVersion
  authored?: AuthoredContent
}): PinChangeReport {
  const before = lessonsOf(input.before)
  const after = lessonsOf(input.after)
  const afterById = new Map(after.map((lesson) => [lesson.id, lesson]))
  const beforeIds = new Set(before.map((lesson) => lesson.id))

  /** Renamed Lessons by their old id: same id with a new title, or a removed and an added Lesson paired by similarity. */
  const renames = new Map<string, LessonRename>()
  for (const lesson of before) {
    const now = afterById.get(lesson.id)
    if (now && now.title !== lesson.title) renames.set(lesson.id, { before: lesson, after: now })
  }
  const paired = matchRenames(
    before.filter((lesson) => !afterById.has(lesson.id)),
    after.filter((lesson) => !beforeIds.has(lesson.id)),
  )
  for (const rename of paired) renames.set(rename.before.id, rename)
  const pairedNewIds = new Set(paired.map((rename) => rename.after.id))

  return {
    before: input.before.source,
    after: input.after.source,
    added: after.filter((lesson) => !beforeIds.has(lesson.id) && !pairedNewIds.has(lesson.id)),
    removed: before.filter((lesson) => !afterById.has(lesson.id) && !renames.has(lesson.id)),
    renamed: before.flatMap((lesson) => renames.get(lesson.id) ?? []),
    brokenReferences: authoredLessonReferences(input.authored ?? {})
      .filter((reference) => !afterById.has(reference.lessonId))
      .map((reference) => {
        const newId = renames.get(reference.lessonId)?.after.id
        return newId ? { ...reference, renamedTo: newId } : reference
      }),
  }
}

function lessonsOf(version: PrimerVersion): LessonSummary[] {
  return readLessons(version).map(({ id, title }) => ({ id, title }))
}

/** The report as plain text, for the terminal. */
export function formatPinChangeReport(report: PinChangeReport): string {
  const short = (source: ContentSource) => source.commit.slice(0, 7)
  const lesson = ({ id, title }: LessonSummary) => `${id}  "${title}"`
  const section = <T>(heading: string, items: T[], line: (item: T) => string) =>
    items.length === 0 ? [] : [`${heading} (${items.length}):`, ...items.map((item) => `  ${line(item)}`)]

  const changes = [
    ...section('Added Lessons', report.added, (added) => `+ ${lesson(added)}`),
    ...section('Removed Lessons', report.removed, (removed) => `- ${lesson(removed)}`),
    ...section('Renamed Lessons', report.renamed, ({ before, after }) => {
      const ids = before.id === after.id ? before.id : `${before.id} → ${after.id}`
      return `~ ${ids}  "${before.title}" → "${after.title}"`
    }),
  ]
  const references = section(
    'Authored content that references a missing Lesson',
    report.brokenReferences,
    ({ referrer, lessonId, renamedTo }) => `${referrer}: ${lessonId} (${renamedTo ? `renamed to ${renamedTo}` : 'removed'})`,
  )
  return [
    `Primer pin ${short(report.before)} → ${short(report.after)}`,
    '',
    ...(changes.length > 0 ? changes : ['No Lessons added, removed or renamed.']),
    '',
    ...(references.length > 0 ? references : ['Every authored Lesson reference resolves.']),
  ].join('\n')
}

/** Every Lesson reference in authored content. Tickets that add authored content that references Lessons add it here. */
function authoredLessonReferences(authored: AuthoredContent): LessonReference[] {
  return [
    ...glossaryLessonReferences(authored.glossary),
    ...flashcardLessonReferences(authored.flashcards),
    ...quizLessonReferences(authored.quizzes),
    ...challengeLessonReferences(authored.challenges),
    ...skillTreeLessonReferences(authored.skillTree),
    ...conceptSimulationLessonReferences(authored.conceptSimulations),
  ]
}

/** Pairs removed and added Lessons that are similar enough, most similar first; each Lesson pairs at most once. */
function matchRenames(removed: LessonSummary[], added: LessonSummary[]): LessonRename[] {
  const candidates = removed
    .flatMap((before) => added.map((after) => ({ before, after, score: similarity(before, after) })))
    .filter((candidate) => candidate.score >= RENAME_THRESHOLD)
    // A stable sort keeps primer order among equally similar pairs.
    .sort((a, b) => b.score - a.score)
  const paired = new Set<LessonSummary>()
  const renames: LessonRename[] = []
  for (const { before, after } of candidates) {
    if (paired.has(before) || paired.has(after)) continue
    paired.add(before).add(after)
    renames.push({ before, after })
  }
  return renames
}

/**
 * The mean of two scores: how many words the anchors share, and how many letter pairs the titles
 * share. Anchor words keep "Client caching" and "CDN caching" apart; letter pairs see that "Load
 * balancer" and "Load balancers" are the same topic.
 */
function similarity(a: LessonSummary, b: LessonSummary): number {
  // "Layer 4 load balancing" and "Layer 7 load balancing" are different topics, however alike they look.
  if (numbersIn(a.title) !== numbersIn(b.title)) return 0
  return (dice(a.id.split('-'), b.id.split('-')) + dice(bigrams(a.title), bigrams(b.title))) / 2
}

function numbersIn(title: string): string {
  return (title.match(/\d+/g) ?? []).join(' ')
}

function bigrams(text: string): string[] {
  const lower = text.toLowerCase()
  return Array.from({ length: Math.max(lower.length - 1, 0) }, (_, i) => lower.slice(i, i + 2))
}

/** The Sørensen–Dice coefficient of two sets: 1 when they are equal, 0 when they share nothing. */
function dice(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size + setB.size === 0) return 0
  const shared = [...setA].filter((item) => setB.has(item)).length
  return (2 * shared) / (setA.size + setB.size)
}
