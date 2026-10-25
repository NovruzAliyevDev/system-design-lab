import { describe, expect, it } from 'vitest'
import { buildContentCatalog } from './catalog'
import { findUnresolvedLinks, referencedAssets, resolveLink } from './links'

const source = {
  repoUrl: 'https://github.com/donnemartin/system-design-primer',
  commit: 'abc123',
  path: 'README.md',
}

const catalog = buildContentCatalog({
  markdown: [
    '## Availability vs consistency',
    '### CAP theorem',
    'See [load balancer](#load-balancer) and [CP](#cp---consistency-and-partition-tolerance).',
    '#### CP - consistency and partition tolerance',
    'CP text.',
    '## Load balancer',
    '<p align="center"><img src="images/h81n9iK.png"></p>',
    '',
    '![Imgur](images/OfVllex.png)',
    'Solution: [Pastebin](solutions/system_design/pastebin/README.md), [ext](https://example.com).',
  ].join('\n'),
  source,
})

describe('resolveLink', () => {
  it('sends an anchor of a Lesson heading to that Lesson', () => {
    expect(resolveLink(catalog, '#load-balancer')).toEqual({ kind: 'lesson', lessonId: 'load-balancer' })
  })

  it('sends an anchor inside a Lesson to that Lesson and keeps the anchor to scroll to', () => {
    expect(resolveLink(catalog, '#cp---consistency-and-partition-tolerance')).toEqual({
      kind: 'lesson',
      lessonId: 'cap-theorem',
      anchor: 'cp---consistency-and-partition-tolerance',
    })
  })

  it('sends the anchor of a group without its own Lesson to the group’s first Lesson', () => {
    expect(resolveLink(catalog, '#availability-vs-consistency')).toEqual({ kind: 'lesson', lessonId: 'cap-theorem' })
  })

  it('reports an anchor that matches no heading as unresolved', () => {
    expect(resolveLink(catalog, '#nowhere')).toEqual({ kind: 'unresolved', href: '#nowhere' })
  })

  it('treats a primer image path as an asset', () => {
    expect(resolveLink(catalog, 'images/OfVllex.png')).toEqual({ kind: 'asset', path: 'images/OfVllex.png' })
  })

  it('points other primer files at GitHub at the pinned commit', () => {
    expect(resolveLink(catalog, 'solutions/system_design/pastebin/README.md')).toEqual({
      kind: 'external',
      url: 'https://github.com/donnemartin/system-design-primer/blob/abc123/solutions/system_design/pastebin/README.md',
    })
  })

  it('keeps absolute URLs as external links', () => {
    expect(resolveLink(catalog, 'https://example.com')).toEqual({ kind: 'external', url: 'https://example.com' })
  })
})

describe('findUnresolvedLinks', () => {
  it('lists links in Lesson text that resolve to nothing', () => {
    const broken = buildContentCatalog({ markdown: '## A\n[ok](#a) [bad](#missing)', source })

    expect(findUnresolvedLinks(broken)).toEqual([{ lessonId: 'a', href: '#missing' }])
    expect(findUnresolvedLinks(catalog)).toEqual([])
  })
})

describe('referencedAssets', () => {
  it('lists every primer image used by a Lesson, from markdown and raw HTML', () => {
    expect(referencedAssets(catalog)).toEqual(['images/h81n9iK.png', 'images/OfVllex.png'])
  })
})
