import { toString } from 'mdast-util-to-string'
import type { List, Table } from 'mdast'
import type { Catalog } from './catalog'
import { resolveLink } from './links'
import { parseMarkdown } from './markdown'

export type Timeline = 'short' | 'medium' | 'long'

/** How much of a step a timeline covers: all of it ("yes"), or some, many or most of its questions. */
export type StudyAmount = 'yes' | 'some' | 'many' | 'most'

export interface StudyGuide {
  lessonId: string
  timelines: { id: Timeline; summary: string }[]
  steps: StudyGuideStep[]
}

/** A row of the primer's study guide table: what to do, and how much of it each timeline covers. */
export interface StudyGuideStep {
  /** The step's text; the part the primer links carries the Lesson it links to. */
  parts: StudyGuidePart[]
  amounts: Record<Timeline, StudyAmount>
}

export interface StudyGuidePart {
  text: string
  lessonId?: string
  anchor?: string
}

const STUDY_GUIDE_LESSON = 'study-guide'
const TIMELINES: Timeline[] = ['short', 'medium', 'long']
const AMOUNTS: Record<string, StudyAmount> = { ':+1:': 'yes', some: 'some', many: 'many', most: 'most' }
/** e.g. "Short timeline - Aim for breadth with system design topics." */
const TIMELINE_ITEM = /^(Short|Medium|Long) timeline\s*-\s*(.+)$/

/**
 * Reads the study guide out of its Lesson: the timeline summaries from its list and the steps from
 * its table. The build fails if the table cannot be read or a step links to no Lesson.
 */
export function extractStudyGuide(catalog: Catalog): StudyGuide | undefined {
  const lesson = catalog.lessons.find((candidate) => candidate.id === STUDY_GUIDE_LESSON)
  if (!lesson) return undefined
  const tree = parseMarkdown(lesson.body)

  const summaries = new Map<string, string>()
  for (const list of tree.children.filter((node): node is List => node.type === 'list')) {
    for (const item of list.children) {
      const match = TIMELINE_ITEM.exec(plainText(toString(item)))
      if (match) summaries.set(match[1].toLowerCase(), match[2])
    }
  }
  const timelines = TIMELINES.map((id) => {
    const summary = summaries.get(id)
    if (!summary) throw new Error(`Study guide: no summary of the ${id} timeline`)
    return { id, summary }
  })

  const table = tree.children.find((node): node is Table => node.type === 'table')
  if (!table) throw new Error('Study guide: no table of steps')
  const [header, ...rows] = table.children
  const columns = header.children.map((cell) => toString(cell).toLowerCase())
  if (TIMELINES.some((id, i) => columns[i + 1] !== id)) {
    throw new Error(`Study guide: expected the columns Short, Medium and Long, found "${columns.join(' | ')}"`)
  }

  const steps = rows.map(({ children: [stepCell, ...amountCells] }): StudyGuideStep => {
    const parts = stepCell.children.map((node): StudyGuidePart => {
      if (node.type !== 'link') return { text: toString(node) }
      const link = resolveLink(catalog, node.url)
      if (link.kind !== 'lesson') return { text: toString(node) }
      return { text: toString(node), lessonId: link.lessonId, ...(link.anchor && { anchor: link.anchor }) }
    })
    if (!parts.some((part) => part.lessonId)) {
      throw new Error(`Study guide: the step "${parts.map((part) => part.text).join('')}" links to no Lesson`)
    }
    const amounts = Object.fromEntries(
      TIMELINES.map((id, i) => {
        const cell = amountCells[i] ? toString(amountCells[i]).trim() : ''
        const amount = AMOUNTS[cell.toLowerCase()]
        if (!amount) throw new Error(`Study guide: unknown amount "${cell}"`)
        return [id, amount]
      }),
    ) as Record<Timeline, StudyAmount>
    return { parts, amounts }
  })

  return { lessonId: lesson.id, timelines, steps }
}

function plainText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
