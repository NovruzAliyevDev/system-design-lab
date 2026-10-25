import type { Catalog } from './catalog'
import { linkUrls } from './markdown'

/** Where a link or image URL found in primer text should take the reader. */
export type ResolvedLink =
  | { kind: 'lesson'; lessonId: string; anchor?: string }
  | { kind: 'solution'; solutionId: string; anchor?: string }
  | { kind: 'asset'; path: string }
  | { kind: 'external'; url: string }
  | { kind: 'unresolved'; href: string }

export interface UnresolvedLink {
  /** The Lesson id, or the path of the solution file, that has the link. */
  location: string
  href: string
}

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i
const IMAGE_PATH = /\.(png|jpe?g|gif|svg|webp)$/i

export function isImagePath(path: string): boolean {
  return IMAGE_PATH.test(path)
}

/**
 * Resolves a link written in the primer file at `from` (the README unless given). Relative paths are
 * relative to that file's folder; links to the primer's GitHub page count as links into the README.
 */
export function resolveLink(catalog: Catalog, href: string, from = catalog.source.path): ResolvedLink {
  if (Object.hasOwn(catalog.imageMirrors, href)) return { kind: 'asset', path: catalog.imageMirrors[href] }

  const { repoUrl, commit } = catalog.source
  const intoReadme = href === repoUrl || href.startsWith(`${repoUrl}#`)
  if (ABSOLUTE_URL.test(href) && !intoReadme) return { kind: 'external', url: href }

  const [relative, hash] = splitHash(intoReadme ? `${catalog.source.path}${href.slice(repoUrl.length)}` : href)
  const path = intoReadme ? relative : relative === '' ? from : joinPath(from, relative)
  if (path === undefined) return { kind: 'unresolved', href }
  if (path === catalog.source.path) return resolveInReadme(catalog, href, hash)
  const solution = catalog.solutions.find((candidate) => candidate.path === path)
  if (solution) {
    if (hash === undefined) return { kind: 'solution', solutionId: solution.id }
    const anchor = decodeAnchor(hash)
    const onPage = solution.headingAnchors.some((heading) => heading.anchor === anchor)
    return onPage && anchor !== undefined ? { kind: 'solution', solutionId: solution.id, anchor } : { kind: 'unresolved', href }
  }
  if (isImagePath(path)) return { kind: 'asset', path }
  return { kind: 'external', url: `${repoUrl}/blob/${commit}/${path}${hash === undefined ? '' : `#${hash}`}` }
}

function resolveInReadme(catalog: Catalog, href: string, hash: string | undefined): ResolvedLink {
  if (hash === undefined) {
    const first = catalog.lessons[0]
    return first ? { kind: 'lesson', lessonId: first.id } : { kind: 'unresolved', href }
  }
  const anchor = decodeAnchor(hash)
  const lessonId = anchor === undefined ? undefined : catalog.anchors[anchor]
  if (anchor === undefined || lessonId === undefined) return { kind: 'unresolved', href }
  // Only headings inside the Lesson text exist on its page to scroll to.
  const insideLesson = catalog.lessons.find((lesson) => lesson.id === lessonId)?.headingAnchors.some((heading) => heading.anchor === anchor)
  return insideLesson ? { kind: 'lesson', lessonId, anchor } : { kind: 'lesson', lessonId }
}

/** Every primer page's text, with where its links are written. */
function primerTexts(catalog: Catalog): { location: string; from: string; body: string }[] {
  return [
    ...catalog.lessons.map((lesson) => ({ location: lesson.id, from: catalog.source.path, body: lesson.body })),
    ...catalog.solutions.map((solution) => ({ location: solution.path, from: solution.path, body: solution.body })),
  ]
}

/** Links in Lesson and Solution text that lead nowhere; the Content Pipeline fails the build on any. */
export function findUnresolvedLinks(catalog: Catalog): UnresolvedLink[] {
  return primerTexts(catalog).flatMap(({ location, from, body }) =>
    linkUrls(body)
      .filter((href) => resolveLink(catalog, href, from).kind === 'unresolved')
      .map((href) => ({ location, href })),
  )
}

/** Primer files (images) that Lessons and Solution pages display, in first-use order, each once. */
export function referencedAssets(catalog: Catalog): string[] {
  const paths = primerTexts(catalog).flatMap(({ from, body }) =>
    linkUrls(body).flatMap((href) => {
      const link = resolveLink(catalog, href, from)
      return link.kind === 'asset' ? [link.path] : []
    }),
  )
  return [...new Set(paths)]
}

/** `relative` as a path from the repo root, read from the folder of the file at `from`; undefined if it leaves the repo. */
function joinPath(from: string, relative: string): string | undefined {
  const parts = from.split('/').slice(0, -1)
  for (const part of relative.split('/')) {
    if (part === '..') {
      if (parts.length === 0) return undefined
      parts.pop()
    } else if (part !== '.' && part !== '') {
      parts.push(part)
    }
  }
  return parts.join('/')
}

function splitHash(href: string): [string, string | undefined] {
  const at = href.indexOf('#')
  return at === -1 ? [href, undefined] : [href.slice(0, at), href.slice(at + 1)]
}

/** Decodes a URL fragment into a heading anchor; undefined when it is not valid percent-encoding. */
function decodeAnchor(hash: string): string | undefined {
  try {
    return decodeURIComponent(hash)
  } catch {
    return undefined
  }
}
