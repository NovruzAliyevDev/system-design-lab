import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { toString } from 'mdast-util-to-string'
import GithubSlugger from 'github-slugger'
import type { Heading } from 'mdast'

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

export interface Lesson {
  id: string
  title: string
  groupId: string
  /** Position of the Lesson in primer order, across all groups. */
  order: number
  /** Link to the Lesson's section of the source at the pinned commit. */
  sourceUrl: string
  /** Markdown under the Lesson heading, up to the next Lesson heading. */
  body: string
  /** Anchors of the headings inside `body`, keyed by the offset in `body` where each heading starts. */
  headingAnchors: { offset: number; anchor: string }[]
}

export interface Catalog {
  source: ContentSource
  groups: LessonGroup[]
  lessons: Lesson[]
  /** Every heading anchor of the source (as GitHub generates it) → id of the Lesson that shows it. */
  anchors: Record<string, string>
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

export function buildContentCatalog(input: { markdown: string; source: ContentSource }): Catalog {
  const { markdown, source } = input
  const sourceBase = `${source.repoUrl}/blob/${source.commit}/${source.path}`
  const headings = readHeadings(markdown)
  const sections = headings.filter((heading) => heading.startsSection)

  const groups: LessonGroup[] = []
  const lessons: Lesson[] = []
  /** Section id → id of the Lesson that shows it, for sections that became Lessons. */
  const lessonOfSection = new Map<string, string>()
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
    lessonOfSection.set(section.id, section.id)
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

  return { source, groups, lessons, anchors: mapAnchorsToLessons(headings, lessonOfSection) }
}

function readHeadings(markdown: string): SourceHeading[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown)
  const slugger = new GithubSlugger()
  return tree.children
    .filter((node): node is Heading => node.type === 'heading')
    .map((heading) => {
      const title = toString(heading)
      return {
        // Every heading is slugged, in order, so ids match GitHub's anchors including duplicate suffixes.
        id: slugger.slug(title),
        title,
        depth: heading.depth,
        startsSection:
          heading.depth < LESSON_HEADING_DEPTH || (heading.depth === LESSON_HEADING_DEPTH && !FOOTER_HEADING.test(title)),
        headingStart: heading.position!.start.offset!,
        bodyStart: heading.position!.end.offset!,
      }
    })
}

/**
 * A heading belongs to the Lesson of the section it sits in. A section without a Lesson of its own
 * (a bare group heading) is shown by the next Lesson, its first subsection.
 */
function mapAnchorsToLessons(headings: SourceHeading[], lessonOfSection: Map<string, string>): Record<string, string> {
  const anchors: Record<string, string> = {}
  let pending: string[] = []
  let current: string | undefined
  for (const heading of headings) {
    if (heading.startsSection) current = lessonOfSection.get(heading.id)
    if (current === undefined) {
      pending.push(heading.id)
      continue
    }
    for (const id of pending) anchors[id] = current
    pending = []
    anchors[heading.id] = current
  }
  return anchors
}

export function findLesson(catalog: Catalog, lessonId: string): Lesson | undefined {
  return catalog.lessons.find((lesson) => lesson.id === lessonId)
}
