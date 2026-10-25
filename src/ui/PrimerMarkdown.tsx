import type { ComponentProps, ElementType } from 'react'
import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import type { Lesson } from '../core/content/catalog'
import { resolveLink } from '../core/content/links'
import { catalog } from './catalog'

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}primer/${path}`
}

function PrimerLink({ href = '', children, node: _node, ...rest }: ComponentProps<'a'> & ExtraProps) {
  const link = resolveLink(catalog, href)
  switch (link.kind) {
    case 'lesson':
      return (
        <Link to={`/lessons/${link.lessonId}${link.anchor ? `#${link.anchor}` : ''}`} {...rest}>
          {children}
        </Link>
      )
    case 'asset':
    case 'external':
      return (
        <a
          {...rest}
          href={link.kind === 'asset' ? assetUrl(link.path) : link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      )
    case 'unresolved':
      return <span {...rest}>{children}</span>
  }
}

function PrimerImage({ src = '', alt = '', node: _node, ...rest }: ComponentProps<'img'> & ExtraProps) {
  const link = typeof src === 'string' ? resolveLink(catalog, src) : undefined
  const resolved = link?.kind === 'asset' ? assetUrl(link.path) : link?.kind === 'external' ? link.url : src
  return <img {...rest} src={resolved} alt={alt} loading="lazy" />
}

/**
 * Headings inside a Lesson get the same ids as on GitHub, so primer anchors can scroll to them.
 * The id is looked up by where the heading starts in the Lesson's markdown.
 */
function headingWithAnchor(tag: ElementType, lesson: Lesson) {
  return function Heading({ node, ...rest }: ComponentProps<'h2'> & ExtraProps) {
    const offset = node?.position?.start.offset
    const id = lesson.headingAnchors.find((heading) => heading.offset === offset)?.anchor
    const Tag = tag
    return <Tag {...rest} id={id} className="scroll-mt-20" />
  }
}

export function PrimerMarkdown({ lesson }: { lesson: Lesson }) {
  const components: Components = {
    a: PrimerLink,
    img: PrimerImage,
    h1: headingWithAnchor('h2', lesson),
    h2: headingWithAnchor('h2', lesson),
    h3: headingWithAnchor('h3', lesson),
    h4: headingWithAnchor('h4', lesson),
    h5: headingWithAnchor('h5', lesson),
    h6: headingWithAnchor('h6', lesson),
  }
  return (
    // The primer's raw HTML (centred image blocks, captions) is rendered, then sanitised.
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]} components={components}>
      {lesson.body}
    </Markdown>
  )
}
