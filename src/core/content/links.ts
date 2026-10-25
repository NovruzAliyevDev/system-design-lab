import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Nodes } from 'mdast'
import type { Catalog } from './catalog'

/** Where a link or image URL found in primer text should take the reader. */
export type ResolvedLink =
  | { kind: 'lesson'; lessonId: string; anchor?: string }
  | { kind: 'asset'; path: string }
  | { kind: 'external'; url: string }
  | { kind: 'unresolved'; href: string }

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i
const IMAGE_PATH = /\.(png|jpe?g|gif|svg|webp)$/i

export function resolveLink(catalog: Catalog, href: string): ResolvedLink {
  if (ABSOLUTE_URL.test(href)) return { kind: 'external', url: href }

  const [path, hash] = splitHash(href.replace(/^\.\//, ''))
  if (path === '' || path === catalog.source.path) {
    if (hash === undefined) return { kind: 'lesson', lessonId: catalog.lessons[0].id }
    const lessonId = catalog.anchors[hash]
    if (lessonId === undefined) return { kind: 'unresolved', href }
    // Only headings inside the Lesson text exist on its page to scroll to.
    const insideLesson = catalog.lessons
      .find((lesson) => lesson.id === lessonId)!
      .headingAnchors.some(({ anchor }) => anchor === hash)
    return insideLesson ? { kind: 'lesson', lessonId, anchor: hash } : { kind: 'lesson', lessonId }
  }
  if (IMAGE_PATH.test(path)) return { kind: 'asset', path }

  const { repoUrl, commit } = catalog.source
  return { kind: 'external', url: `${repoUrl}/blob/${commit}/${href.replace(/^\.\//, '')}` }
}

/** Links in Lesson text that lead nowhere; the Content Pipeline fails the build on any. */
export function findUnresolvedLinks(catalog: Catalog): { lessonId: string; href: string }[] {
  return catalog.lessons.flatMap((lesson) =>
    urlsIn(lesson.body)
      .filter((href) => resolveLink(catalog, href).kind === 'unresolved')
      .map((href) => ({ lessonId: lesson.id, href })),
  )
}

/** Primer files (images) that Lessons display, in first-use order, each once. */
export function referencedAssets(catalog: Catalog): string[] {
  const paths = catalog.lessons.flatMap((lesson) =>
    urlsIn(lesson.body).flatMap((href) => {
      const link = resolveLink(catalog, href)
      return link.kind === 'asset' ? [link.path] : []
    }),
  )
  return [...new Set(paths)]
}

function splitHash(href: string): [string, string | undefined] {
  const at = href.indexOf('#')
  return at === -1 ? [href, undefined] : [href.slice(0, at), href.slice(at + 1)]
}

/** Every link and image URL in a markdown body, including those inside raw HTML. */
function urlsIn(markdown: string): string[] {
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
  visit(unified().use(remarkParse).use(remarkGfm).parse(markdown))
  return urls
}
