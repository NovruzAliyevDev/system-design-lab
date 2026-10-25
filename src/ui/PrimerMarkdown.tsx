import { useMemo, type ComponentProps, type ElementType, type ReactNode } from 'react'
import Markdown, { type Components, type ExtraProps, type Options } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkEmoji from 'remark-emoji'
import remarkGfm from 'remark-gfm'
import type { Root } from 'mdast'
import { Link } from 'react-router-dom'
import { headingAnchorAt, type PrimerText } from '../core/content/catalog'
import { resolveLink, type ResolvedLink } from '../core/content/links'
import { createGlossaryMatcher, markGlossaryTerms, type GlossaryTermNode } from '../core/glossary/matching'
import { catalog } from './catalog'
import { GlossaryTooltip } from './GlossaryTooltip'
import { t } from './i18n'
import { lessonPath, solutionPath } from './routes'

const glossaryMatcher = createGlossaryMatcher(catalog.glossary)
const glossaryTerms = new Map(catalog.glossary.map((term) => [term.id, term]))

/** Marks Glossary Terms in the Lesson text (Core decides which occurrences get a tooltip). */
function remarkGlossary() {
  return (tree: Root) => markGlossaryTerms(tree, glossaryMatcher)
}

/** A marked term becomes a `<span data-glossary-term>`, which `PrimerSpan` renders with its tooltip. */
const remarkRehypeOptions: Options['remarkRehypeOptions'] = {
  handlers: {
    glossaryTerm: (state, node: GlossaryTermNode) => ({
      type: 'element',
      tagName: 'span',
      properties: { dataGlossaryTerm: node.termId },
      children: state.all(node),
    }),
  },
}

/** GitHub's sanitising rules, plus the attribute that marks a Glossary Term. */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: { ...defaultSchema.attributes, span: [...(defaultSchema.attributes?.span ?? []), 'dataGlossaryTerm'] },
}

/** A link to a page of the app, which the router follows. */
type PageLink = Extract<ResolvedLink, { kind: 'lesson' | 'solution' }>

function isPageLink(link: ResolvedLink): link is PageLink {
  return link.kind === 'lesson' || link.kind === 'solution'
}

/** Typography for primer text on its pages. */
export const PRIMER_PROSE_CLASS =
  'prose dark:prose-invert max-w-none prose-a:text-sky-400 prose-img:mx-auto prose-img:rounded-md prose-img:bg-white prose-img:p-2'

function pathFor(link: PageLink): string {
  return link.kind === 'lesson' ? lessonPath(link.lessonId, link.anchor) : solutionPath(link.solutionId, link.anchor)
}

/** The URL a link or image that is not a page of the app points at. */
function hrefFor(link: Exclude<ResolvedLink, PageLink>): string {
  switch (link.kind) {
    case 'asset':
      return `${import.meta.env.BASE_URL}primer/${link.path}`
    case 'external':
      return link.url
    case 'unresolved':
      return link.href
  }
}

/** Links in the text of the primer file at `from`, which relative links are relative to. */
function primerLink(from: string) {
  return function PrimerLink({ href = '', children, node: _node, ...rest }: ComponentProps<'a'> & ExtraProps) {
    const link = resolveLink(catalog, href, from)
    if (isPageLink(link)) {
      return (
        <Link to={pathFor(link)} {...rest}>
          {children}
        </Link>
      )
    }
    if (link.kind === 'unresolved') return <span {...rest}>{children}</span>
    return (
      <a {...rest} href={hrefFor(link)} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
}

function primerImage(from: string) {
  return function PrimerImage({ src = '', alt = '', node: _node, ...rest }: ComponentProps<'img'> & ExtraProps) {
    const link = typeof src === 'string' ? resolveLink(catalog, src, from) : undefined
    const resolved = link && !isPageLink(link) ? hrefFor(link) : src
    return <img {...rest} src={resolved} alt={alt} loading="lazy" />
  }
}

/** A span the primer's HTML could also contain, so only a known term id gets a tooltip. */
function PrimerSpan({ node, ...rest }: ComponentProps<'span'> & ExtraProps) {
  const termId = node?.properties.dataGlossaryTerm
  const term = typeof termId === 'string' ? glossaryTerms.get(termId) : undefined
  if (!term) return <span {...rest} />
  return <GlossaryTooltip term={term}>{rest.children}</GlossaryTooltip>
}

/** Wide primer tables scroll on their own instead of widening the page on phones. */
function PrimerTable({ node: _node, ...rest }: ComponentProps<'table'> & ExtraProps) {
  return (
    <div className="overflow-x-auto">
      <table {...rest} />
    </div>
  )
}

/** Headings inside the text get their GitHub ids, so primer anchors can scroll to them. */
function headingWithAnchor(Tag: ElementType, text: PrimerText) {
  return function Heading({ node, ...rest }: ComponentProps<'h2'> & ExtraProps) {
    return <Tag {...rest} id={headingAnchorAt(text, node?.position?.start.offset)} className="scroll-mt-20" />
  }
}

/** A code block of the text, unless the page shows something in its place; the primer's own text stays one click away. */
function codeBlock(replacements: ReadonlyMap<number, ReactNode>) {
  return function CodeBlock({ node, ...rest }: ComponentProps<'pre'> & ExtraProps) {
    const offset = node?.position?.start.offset
    const replacement = offset === undefined ? undefined : replacements.get(offset)
    if (replacement === undefined) return <pre {...rest} />
    return (
      <>
        <div className="not-prose">{replacement}</div>
        <details>
          <summary lang="az" className="cursor-pointer text-sm text-zinc-400">
            {t('primerOriginalText')}
          </summary>
          <pre {...rest} />
        </details>
      </>
    )
  }
}

const NO_CODE_BLOCKS: ReadonlyMap<number, ReactNode> = new Map()

export function PrimerMarkdown({
  text,
  path = catalog.source.path,
  codeBlocks = NO_CODE_BLOCKS,
}: {
  text: PrimerText
  /** The primer file the text comes from; its relative links and images are relative to it. */
  path?: string
  /** What to show in place of a code block of the text, keyed by the offset in the text where it starts. */
  codeBlocks?: ReadonlyMap<number, ReactNode>
}) {
  // Stable component types, so a re-render of the page does not remount the text (and lose the state
  // of tooltips and interactive blocks in it).
  const components = useMemo<Components>(
    () => ({
      a: primerLink(path),
      img: primerImage(path),
      span: PrimerSpan,
      table: PrimerTable,
      pre: codeBlock(codeBlocks),
      h1: headingWithAnchor('h2', text),
      h2: headingWithAnchor('h2', text),
      h3: headingWithAnchor('h3', text),
      h4: headingWithAnchor('h4', text),
      h5: headingWithAnchor('h5', text),
      h6: headingWithAnchor('h6', text),
    }),
    [text, path, codeBlocks],
  )
  return (
    // The primer's raw HTML (centred image blocks, captions) is rendered, then sanitised.
    <Markdown
      remarkPlugins={[remarkGfm, remarkEmoji, remarkGlossary]}
      remarkRehypeOptions={remarkRehypeOptions}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      components={components}
    >
      {text.body}
    </Markdown>
  )
}
