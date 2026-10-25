import type { ContentSource, PrimerText } from './catalog'
import { linkUrls, quoteUnquotedLinkUrls, readHeadings } from './markdown'

/** A solution write-up file of the primer, as the Content Pipeline reads it. */
export interface SolutionSource {
  /** Path of the file in the primer repo, e.g. `solutions/system_design/pastebin/README.md`. */
  path: string
  markdown: string
}

/** A solution write-up of a system design question, shown as a Solution page. */
export interface Solution extends PrimerText {
  /** The name of its folder, e.g. `pastebin`. */
  id: string
  /** The file's H1, the question it answers. */
  title: string
  path: string
  /** Link to the file at the pinned commit. */
  sourceUrl: string
  /** Markdown under the title. */
  body: string
}

/** Solution pages in the order the README links them; solutions it does not link come last. */
export function buildSolutions(inputs: SolutionSource[], source: ContentSource, readme: string): Solution[] {
  const linked = linkUrls(readme).map((href) => href.replace(/^\.\//, '').split('#')[0])
  const rank = (path: string) => {
    const at = linked.indexOf(path)
    return at === -1 ? linked.length : at
  }
  return [...inputs]
    .sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path))
    .map(({ path, markdown: raw }) => {
      const markdown = quoteUnquotedLinkUrls(raw)
      const headings = readHeadings(markdown)
      const titleHeading = headings.find((heading) => heading.depth === 1)
      if (!titleHeading) throw new Error(`Solution ${path}: has no title heading`)
      const rawBody = markdown.slice(titleHeading.bodyStart)
      const bodyStart = titleHeading.bodyStart + (rawBody.length - rawBody.trimStart().length)
      return {
        id: path.split('/').at(-2) ?? path,
        title: titleHeading.title,
        path,
        sourceUrl: `${source.repoUrl}/blob/${source.commit}/${path}`,
        body: rawBody.trim(),
        headingAnchors: headings
          .filter((heading) => heading.headingStart >= bodyStart)
          .map((heading) => ({ offset: heading.headingStart - bodyStart, anchor: heading.id })),
      }
    })
}
