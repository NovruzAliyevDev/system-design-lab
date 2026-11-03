import GithubSlugger from 'github-slugger'
import { toString } from 'mdast-util-to-string'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Heading, Nodes, Root } from 'mdast'

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

/** A top-level heading of a markdown file, with the anchor GitHub gives it and the offsets of its line. */
export interface MarkdownHeading {
  id: string
  title: string
  depth: number
  headingStart: number
  bodyStart: number
}

export function readHeadings(markdown: string): MarkdownHeading[] {
  const slugger = new GithubSlugger()
  return parseMarkdown(markdown)
    .children.filter((node): node is Heading => node.type === 'heading')
    .map((heading) => {
      const title = toString(heading)
      return {
        // Every heading is slugged, in order, so ids match GitHub's anchors including duplicate suffixes.
        id: slugger.slug(title),
        title,
        depth: heading.depth,
        headingStart: heading.position!.start.offset!,
        bodyStart: heading.position!.end.offset!,
      }
    })
}

/**
 * Nests the headings of a text under its page's `h1` title, so no level is skipped: the
 * primer's sections often open with `####` or jump from `##` to `####`. A heading goes one level below
 * the nearest heading before it that it sits under in the source; `#` counts as `##`, a page has one title.
 */
export function nestHeadings(tree: Root): void {
  const open: { depth: number; level: number }[] = []
  const visit = (node: Nodes) => {
    if (node.type === 'heading') {
      const depth = Math.max(node.depth, 2)
      while ((open.at(-1)?.depth ?? 0) >= depth) open.pop()
      const level = (open.at(-1)?.level ?? 1) + 1
      open.push({ depth, level })
      node.depth = Math.min(level, 6) as Heading['depth']
    }
    if ('children' in node) node.children.forEach(visit)
  }
  visit(tree)
}

/** Every link and image URL in markdown, in order, including those inside raw HTML. */
export function linkUrls(markdown: string): string[] {
  const urls: string[] = []
  const visit = (node: Nodes) => {
    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') urls.push(node.url)
    if (node.type === 'html') {
      for (const match of node.value.matchAll(/\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
        urls.push(match[1] ?? match[2] ?? match[3])
      }
    }
    if ('children' in node) node.children.forEach(visit)
  }
  visit(parseMarkdown(markdown))
  return urls
}

/** `<a href=https://…>`: a link URL the primer writes without quotes, up to the `>` that closes the tag. */
const UNQUOTED_LINK_URL = /(<a\s(?:[^<>]*\s)?href=)(https?:\/\/[^\s"'<>`]+)>/gi

/**
 * The primer writes some link URLs in raw HTML without quotes. CommonMark does not read such a tag as
 * HTML, so the tag would show as text with a broken URL in it; quoting the URL makes it a link again.
 */
export function quoteUnquotedLinkUrls(markdown: string): string {
  return markdown.replace(UNQUOTED_LINK_URL, '$1"$2">')
}
