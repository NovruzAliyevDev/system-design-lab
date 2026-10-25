import type { ComponentProps, ElementType } from 'react'
import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkEmoji from 'remark-emoji'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { headingAnchorAt, type Lesson } from '../core/content/catalog'
import { resolveLink, type ResolvedLink } from '../core/content/links'
import { catalog } from './catalog'
import { lessonPath } from './routes'

/** The URL a non-Lesson link or image points at in the app. */
function hrefFor(link: Exclude<ResolvedLink, { kind: 'lesson' }>): string {
  switch (link.kind) {
    case 'asset':
      return `${import.meta.env.BASE_URL}primer/${link.path}`
    case 'external':
      return link.url
    case 'unresolved':
      return link.href
  }
}

function PrimerLink({ href = '', children, node: _node, ...rest }: ComponentProps<'a'> & ExtraProps) {
  const link = resolveLink(catalog, href)
  if (link.kind === 'lesson') {
    return (
      <Link to={lessonPath(link.lessonId, link.anchor)} {...rest}>
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

function PrimerImage({ src = '', alt = '', node: _node, ...rest }: ComponentProps<'img'> & ExtraProps) {
  const link = typeof src === 'string' ? resolveLink(catalog, src) : undefined
  const resolved = link && link.kind !== 'lesson' ? hrefFor(link) : src
  return <img {...rest} src={resolved} alt={alt} loading="lazy" />
}

/** Wide primer tables scroll on their own instead of widening the page on phones. */
function PrimerTable({ node: _node, ...rest }: ComponentProps<'table'> & ExtraProps) {
  return (
    <div className="overflow-x-auto">
      <table {...rest} />
    </div>
  )
}

/** Headings inside a Lesson get their GitHub ids, so primer anchors can scroll to them. */
function headingWithAnchor(Tag: ElementType, lesson: Lesson) {
  return function Heading({ node, ...rest }: ComponentProps<'h2'> & ExtraProps) {
    return <Tag {...rest} id={headingAnchorAt(lesson, node?.position?.start.offset)} className="scroll-mt-20" />
  }
}

export function PrimerMarkdown({ lesson }: { lesson: Lesson }) {
  const components: Components = {
    a: PrimerLink,
    img: PrimerImage,
    table: PrimerTable,
    h1: headingWithAnchor('h2', lesson),
    h2: headingWithAnchor('h2', lesson),
    h3: headingWithAnchor('h3', lesson),
    h4: headingWithAnchor('h4', lesson),
    h5: headingWithAnchor('h5', lesson),
    h6: headingWithAnchor('h6', lesson),
  }
  return (
    // The primer's raw HTML (centred image blocks, captions) is rendered, then sanitised.
    <Markdown
      remarkPlugins={[remarkGfm, remarkEmoji]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={components}
    >
      {lesson.body}
    </Markdown>
  )
}
