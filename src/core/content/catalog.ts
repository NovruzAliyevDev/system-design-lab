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
}

export interface Catalog {
  source: ContentSource
  groups: LessonGroup[]
  lessons: Lesson[]
}

const GROUP_HEADING_DEPTH = 2
const LESSON_HEADING_DEPTH = 3
/** H3 sections that are a footer of the section above them rather than a topic of their own. */
const FOOTER_HEADING = /^Source\(s\) and further reading$/

export function buildContentCatalog(input: { markdown: string; source: ContentSource }): Catalog {
  const { markdown, source } = input
  const sourceBase = `${source.repoUrl}/blob/${source.commit}/${source.path}`
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown)
  const slugger = new GithubSlugger()

  const starts: { id: string; title: string; depth: number; headingStart: number; bodyStart: number }[] = []
  for (const node of tree.children) {
    if (node.type !== 'heading') continue
    const heading = node as Heading
    const title = toString(heading)
    // Every heading is slugged, in order, so ids match GitHub's anchors including duplicate suffixes.
    const id = slugger.slug(title)
    if (heading.depth > LESSON_HEADING_DEPTH) continue
    if (heading.depth === LESSON_HEADING_DEPTH && FOOTER_HEADING.test(title)) continue
    starts.push({
      id,
      title,
      depth: heading.depth,
      headingStart: heading.position!.start.offset!,
      bodyStart: heading.position!.end.offset!,
    })
  }

  const groups: LessonGroup[] = []
  const lessons: Lesson[] = []
  starts.forEach((start, i) => {
    if (start.depth <= GROUP_HEADING_DEPTH || groups.length === 0) {
      groups.push({ id: start.id, title: start.title, order: groups.length })
    }
    const end = i + 1 < starts.length ? starts[i + 1].headingStart : markdown.length
    const body = markdown.slice(start.bodyStart, end).trim()
    if (!body) return
    lessons.push({
      id: start.id,
      title: start.title,
      groupId: groups[groups.length - 1].id,
      order: lessons.length,
      sourceUrl: `${sourceBase}#${start.id}`,
      body,
    })
  })

  return { source, groups, lessons }
}
