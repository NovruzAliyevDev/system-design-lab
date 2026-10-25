import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Nodes, Root } from 'mdast'

/** Parses primer markdown the way GitHub reads it (CommonMark plus GFM tables, autolinks, etc.). */
export function parseMarkdown(markdown: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown)
}

/** Nodes whose children run on as one line of text; the children of any other node are separate blocks. */
const INLINE_PARENTS = new Set<Nodes['type']>(['paragraph', 'heading', 'emphasis', 'strong', 'delete', 'link', 'linkReference', 'tableCell'])

/** The readable text of markdown: no syntax, no raw HTML, blocks separated by single spaces. */
export function markdownToPlainText(markdown: string): string {
  return textOf(parseMarkdown(markdown)).replace(/\s+/g, ' ').trim()
}

function textOf(node: Nodes): string {
  // Raw HTML is dropped, but it may be all that separates two words (e.g. `<br/>`).
  if (node.type === 'html') return ' '
  if ('value' in node) return node.value
  if (!('children' in node)) return ''
  return node.children.map((child) => textOf(child)).join(INLINE_PARENTS.has(node.type) ? '' : ' ')
}
