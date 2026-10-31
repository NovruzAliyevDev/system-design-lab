import { validateChallenges, type Challenge } from '../challenges/challenge'
import { buildDeck, linkCards, validateFormerRepoUrls, validateLinkFixes, type Deck, type DeckSource } from '../flashcards/deck'
import { validateGlossary, type GlossaryTerm } from '../glossary/glossary'
import { validateQuizzes, type Quiz } from '../quizzes/quiz'
import { validateSkillTree, type SkillTopic } from '../skill-tree/skill-tree'
import { extractAppendix, type Appendix } from './appendix'
import { validateImageMirrors } from './image-mirrors'
import { quoteUnquotedLinkUrls, readHeadings } from './markdown'
import { buildSolutions, type Solution, type SolutionSource } from './solutions'
import { extractStudyGuide, type StudyGuide } from './study-guide'

export interface ContentSource {
  repoUrl: string
  commit: string
  path: string
}

/** A top-level (H1/H2) section of the primer; its H3 sections are Lessons inside it. */
export interface LessonGroup {
  id: string
  title: string
  order: number
}

/** Primer markdown shown on a page of the app: a Lesson or a Solution page. */
export interface PrimerText {
  body: string
  /** Anchors of the headings inside `body`, keyed by the offset in `body` where each heading starts. */
  headingAnchors: HeadingAnchor[]
}

export interface Lesson extends PrimerText {
  id: string
  title: string
  groupId: string
  /** Position of the Lesson in primer order, across all groups. */
  order: number
  /** Link to the Lesson's section of the source at the pinned commit. */
  sourceUrl: string
  /** Markdown under the Lesson heading, up to the next Lesson heading. */
  body: string
}

/** A heading inside a page's text and the GitHub anchor it has in its source file. */
export interface HeadingAnchor {
  offset: number
  anchor: string
}

export interface Catalog {
  source: ContentSource
  groups: LessonGroup[]
  lessons: Lesson[]
  /** Every heading anchor of the source (as GitHub generates it) → id of the Lesson that shows it. */
  anchors: Record<string, string>
  /** In alphabetical order. */
  glossary: GlossaryTerm[]
  /** The appendix tables as data, for the appendix Lessons, calculators and simulation defaults. */
  appendix: Appendix
  /** The primer's suggested path through the Lessons; absent only when the source has no study guide. */
  studyGuide?: StudyGuide
  /** The solution write-ups of the system design questions, in the order the README lists them. */
  solutions: Solution[]
  /** Image URLs used by primer text → the same image in the primer repo, served with the site. */
  imageMirrors: Record<string, string>
  /** The primer's Anki Decks as Flashcards. */
  decks: Deck[]
  /** Authored Quizzes, at most one per Lesson, in authored order. */
  quizzes: Quiz[]
  /** System design questions solved Stage by Stage, in authored order. */
  challenges: Challenge[]
  /** The topics of the Skill Tree with their prerequisite edges, in authored order. */
  skillTree: SkillTopic[]
}

/**
 * Content authored for the app rather than taken from the primer. It is typed `unknown` because the
 * catalog checks it whatever its source file claims: the pipeline runs before typechecking.
 */
export interface AuthoredContent {
  glossary?: unknown
  imageMirrors?: unknown
  flashcardLinkFixes?: unknown
  flashcardFormerRepoUrls?: unknown
  flashcardPlaceholderLinks?: unknown
  /** Per card: the Lessons it links to and its Azerbaijani explanation. */
  flashcards?: unknown
  /** Quizzes shown at the end of Lessons. */
  quizzes?: unknown
  /** Challenges with their Rules, Hints and Reference Solutions. */
  challenges?: unknown
  /** The Skill Tree's topics: their Lessons and prerequisites. */
  skillTree?: unknown
}

/** A Lesson that an authored item references. */
export interface LessonReference {
  /** The authored item, as build errors name it (e.g. `Glossary Term "Cache"`). */
  referrer: string
  lessonId: string
}

/** Authored content that does not match its schema or references something that does not exist. */
export class ContentValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Authored content is invalid:\n${problems.map((problem) => `  ${problem}`).join('\n')}`)
    this.name = 'ContentValidationError'
  }
}

const GROUP_HEADING_DEPTH = 2
const LESSON_HEADING_DEPTH = 3
/** H3 sections that are a footer of the section above them rather than a topic of their own. */
const FOOTER_HEADING = /^Source\(s\) and further reading$/

/** A heading of the source with its GitHub anchor and the offsets of its line. */
interface SourceHeading {
  id: string
  title: string
  depth: number
  /** Whether the heading starts a section that may become a Lesson. */
  startsSection: boolean
  headingStart: number
  bodyStart: number
}

export function buildContentCatalog(input: {
  markdown: string
  source: ContentSource
  /** The primer's solution write-ups, in any order. */
  solutions?: SolutionSource[]
  /** The primer's Anki Decks, in the order the app lists them. */
  decks?: DeckSource[]
  /** Paths of the image files in the primer, which card images are served from when they have a copy there. */
  primerImages?: string[]
  authored?: AuthoredContent
}): Catalog {
  const { source, solutions = [], decks = [], primerImages = [], authored = {} } = input
  const markdown = quoteUnquotedLinkUrls(input.markdown)
  const { headings, groups, lessons, sectionsWithLesson } = splitIntoLessons(markdown, source)

  const lessonIds = new Set(lessons.map((lesson) => lesson.id))
  const glossary = validateGlossary(authored.glossary ?? [], lessonIds)
  const imageMirrors = validateImageMirrors(authored.imageMirrors ?? {})
  const linkFixes = validateLinkFixes(authored.flashcardLinkFixes ?? {})
  const placeholderLinks = validateLinkFixes(authored.flashcardPlaceholderLinks ?? {}, {
    one: 'placeholder link',
    all: 'placeholder links',
  })
  const formerRepoUrls = validateFormerRepoUrls(authored.flashcardFormerRepoUrls ?? [])
  const context = {
    repoUrl: source.repoUrl,
    commit: source.commit,
    imageMirrors: imageMirrors.mirrors,
    primerImages: new Set(primerImages),
    linkFixes: linkFixes.fixes,
    placeholderLinks: placeholderLinks.fixes,
    formerRepoUrls: formerRepoUrls.urls,
  }
  const flashcards = linkCards(
    decks.map((deck) => buildDeck(deck, context)),
    authored.flashcards ?? [],
    lessonIds,
  )
  const quizzes = validateQuizzes(authored.quizzes ?? [], lessonIds)
  const builtSolutions = buildSolutions(solutions, source, markdown)
  const challenges = validateChallenges(authored.challenges ?? [], lessonIds, builtSolutions)
  const skillTree = validateSkillTree(authored.skillTree ?? [], lessonIds)
  const problems = [
    ...glossary.problems,
    ...imageMirrors.problems,
    ...linkFixes.problems,
    ...placeholderLinks.problems,
    ...formerRepoUrls.problems,
    ...flashcards.problems,
    ...quizzes.problems,
    ...challenges.problems,
    ...skillTree.problems,
  ]
  if (problems.length > 0) throw new ContentValidationError(problems)

  const catalog: Catalog = {
    source,
    groups,
    lessons,
    anchors: mapAnchorsToLessons(headings, sectionsWithLesson),
    glossary: glossary.terms,
    appendix: extractAppendix(lessons),
    solutions: builtSolutions,
    imageMirrors: imageMirrors.mirrors,
    decks: flashcards.decks,
    quizzes: quizzes.quizzes,
    challenges: challenges.challenges,
    skillTree: skillTree.topics,
  }
  // The study guide's links resolve against the catalog itself.
  const studyGuide = extractStudyGuide(catalog)
  return studyGuide ? { ...catalog, studyGuide } : catalog
}

/**
 * Only the Lessons of the source, as `buildContentCatalog` splits them. Unlike the full catalog it
 * reads nothing else, so it never fails on the appendix, the study guide or authored content.
 */
export function readLessons(input: { markdown: string; source: ContentSource }): Lesson[] {
  return splitIntoLessons(quoteUnquotedLinkUrls(input.markdown), input.source).lessons
}

function splitIntoLessons(markdown: string, source: ContentSource) {
  const sourceBase = `${source.repoUrl}/blob/${source.commit}/${source.path}`
  const headings = readSourceHeadings(markdown)
  const sections = headings.filter((heading) => heading.startsSection)

  const groups: LessonGroup[] = []
  const lessons: Lesson[] = []
  /** Sections that became Lessons; a Lesson's id is its section's id. */
  const sectionsWithLesson = new Set<string>()
  sections.forEach((section, i) => {
    if (section.depth <= GROUP_HEADING_DEPTH || groups.length === 0) {
      groups.push({ id: section.id, title: section.title, order: groups.length })
    }
    const end = i + 1 < sections.length ? sections[i + 1].headingStart : markdown.length
    const rawBody = markdown.slice(section.bodyStart, end)
    const body = rawBody.trim()
    // A section with no markdown at all before the next section (e.g. an H2 directly followed by
    // its first H3) is only a group heading. Raw HTML such as an image block counts as content.
    if (!body) return
    sectionsWithLesson.add(section.id)
    const bodyStart = section.bodyStart + (rawBody.length - rawBody.trimStart().length)
    lessons.push({
      id: section.id,
      title: section.title,
      groupId: groups[groups.length - 1].id,
      order: lessons.length,
      sourceUrl: `${sourceBase}#${section.id}`,
      body,
      headingAnchors: headings
        .filter((heading) => heading.headingStart >= bodyStart && heading.headingStart < end)
        .map((heading) => ({ offset: heading.headingStart - bodyStart, anchor: heading.id })),
    })
  })
  return { headings, groups, lessons, sectionsWithLesson }
}

function readSourceHeadings(markdown: string): SourceHeading[] {
  return readHeadings(markdown).map((heading) => ({
    ...heading,
    startsSection:
      heading.depth < LESSON_HEADING_DEPTH || (heading.depth === LESSON_HEADING_DEPTH && !FOOTER_HEADING.test(heading.title)),
  }))
}

/**
 * A heading belongs to the Lesson of the section it sits in. A section without a Lesson of its own
 * (a bare group heading) is shown by the next Lesson, its first subsection.
 */
function mapAnchorsToLessons(headings: SourceHeading[], sectionsWithLesson: Set<string>): Record<string, string> {
  const anchors: Record<string, string> = {}
  /** Anchors seen since the last section with a Lesson, waiting for the next Lesson to show them. */
  let unplaced: string[] = []
  let currentLesson: string | undefined
  for (const heading of headings) {
    if (heading.startsSection) currentLesson = sectionsWithLesson.has(heading.id) ? heading.id : undefined
    if (currentLesson === undefined) {
      unplaced.push(heading.id)
      continue
    }
    for (const id of unplaced) anchors[id] = currentLesson
    unplaced = []
    anchors[heading.id] = currentLesson
  }
  return anchors
}

export function findLesson(catalog: Catalog, lessonId: string): Lesson | undefined {
  return catalog.lessons.find((lesson) => lesson.id === lessonId)
}

export function findSolution(catalog: Catalog, solutionId: string): Solution | undefined {
  return catalog.solutions.find((solution) => solution.id === solutionId)
}

/** The source anchor of the heading that starts at `offset` in the page's text, if any. */
export function headingAnchorAt(text: PrimerText, offset: number | undefined): string | undefined {
  return text.headingAnchors.find((heading) => heading.offset === offset)?.anchor
}
