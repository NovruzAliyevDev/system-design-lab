import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError } from './catalog'
import { findUnresolvedLinks, referencedAssets, resolveLink } from './links'

const source = { repoUrl: 'https://github.com/donnemartin/system-design-primer', commit: 'abc123', path: 'README.md' }

const readme = [
  '## Interview questions',
  '| Question | |',
  '|---|---|',
  '| Design Pastebin | [Solution](solutions/system_design/pastebin/README.md) |',
  '| Scale on AWS | [Solution](solutions/system_design/scaling_aws/README.md) |',
  '## Load balancer',
  'Text.',
  '#### Active-passive',
  'Text.',
].join('\n')

const pastebin = {
  path: 'solutions/system_design/pastebin/README.md',
  markdown: [
    '# Design Pastebin.com (or Bit.ly)',
    '',
    '*Note: links to the [system design topics](https://github.com/donnemartin/system-design-primer#load-balancer).*',
    '## Step 1: Outline use cases',
    'See [active-passive](https://github.com/donnemartin/system-design-primer#active-passive), [step 1](#step-1-outline-use-cases)',
    'and [scaling on AWS](../scaling_aws/README.md).<sup><a href=https://github.com/donnemartin/system-design-primer#load-balancer>1</a></sup>',
    '![Imgur](http://i.imgur.com/BKsBnmG.png)',
    '![Local](pastebin.png)',
    '## Step 2: Create a high level design',
  ].join('\n'),
}
const scalingAws = {
  path: 'solutions/system_design/scaling_aws/README.md',
  markdown: '# Design a system that scales to millions of users on AWS\n\nText.',
}
const imageMirrors = { 'http://i.imgur.com/BKsBnmG.png': 'solutions/system_design/pastebin/pastebin_basic.png' }

// Given in another order than the README lists them.
const catalog = buildContentCatalog({ markdown: readme, source, solutions: [scalingAws, pastebin], authored: { imageMirrors } })

describe('Solution pages', () => {
  it('lists the solutions in the order the README links them, titled by their heading', () => {
    expect(catalog.solutions.map((solution) => [solution.id, solution.title])).toEqual([
      ['pastebin', 'Design Pastebin.com (or Bit.ly)'],
      ['scaling_aws', 'Design a system that scales to millions of users on AWS'],
    ])
  })

  it('keeps the text under the title and links it to its file at the pinned commit', () => {
    const [solution] = catalog.solutions

    expect(solution.path).toBe('solutions/system_design/pastebin/README.md')
    expect(solution.sourceUrl).toBe(
      'https://github.com/donnemartin/system-design-primer/blob/abc123/solutions/system_design/pastebin/README.md',
    )
    expect(solution.body).toMatch(/^\*Note: links/)
    expect(solution.headingAnchors.map((heading) => heading.anchor)).toEqual([
      'step-1-outline-use-cases',
      'step-2-create-a-high-level-design',
    ])
    expect(solution.body.slice(solution.headingAnchors[0].offset)).toMatch(/^## Step 1/)
  })
})

describe('links to and from Solution pages', () => {
  const fromPastebin = (href: string) => resolveLink(catalog, href, pastebin.path)

  it('sends a README link to a solution file to its Solution page', () => {
    expect(resolveLink(catalog, 'solutions/system_design/pastebin/README.md')).toEqual({ kind: 'solution', solutionId: 'pastebin' })
  })

  it('resolves relative links from the folder of the solution', () => {
    expect(fromPastebin('../scaling_aws/README.md')).toEqual({ kind: 'solution', solutionId: 'scaling_aws' })
    expect(fromPastebin('pastebin.png')).toEqual({ kind: 'asset', path: 'solutions/system_design/pastebin/pastebin.png' })
  })

  it('keeps an anchor of the solution itself on its page', () => {
    expect(fromPastebin('#step-1-outline-use-cases')).toEqual({
      kind: 'solution',
      solutionId: 'pastebin',
      anchor: 'step-1-outline-use-cases',
    })
    expect(fromPastebin('#nowhere')).toEqual({ kind: 'unresolved', href: '#nowhere' })
  })

  it("sends a link to a section of the primer's GitHub page to its Lesson", () => {
    expect(fromPastebin('https://github.com/donnemartin/system-design-primer#load-balancer')).toEqual({
      kind: 'lesson',
      lessonId: 'load-balancer',
    })
    expect(fromPastebin('https://github.com/donnemartin/system-design-primer#active-passive')).toEqual({
      kind: 'lesson',
      lessonId: 'load-balancer',
      anchor: 'active-passive',
    })
    expect(fromPastebin('https://github.com/donnemartin/system-design-primer#nowhere')).toEqual({
      kind: 'unresolved',
      href: 'https://github.com/donnemartin/system-design-primer#nowhere',
    })
    expect(fromPastebin('https://github.com/donnemartin/system-design-primer/issues/28')).toEqual({
      kind: 'external',
      url: 'https://github.com/donnemartin/system-design-primer/issues/28',
    })
  })

  it('serves an image hosted elsewhere from its copy in the primer', () => {
    expect(fromPastebin('http://i.imgur.com/BKsBnmG.png')).toEqual({
      kind: 'asset',
      path: 'solutions/system_design/pastebin/pastebin_basic.png',
    })
    expect(fromPastebin('http://i.imgur.com/unknown.png')).toEqual({ kind: 'external', url: 'http://i.imgur.com/unknown.png' })
    // Only the mirrors themselves count, not what every object has.
    expect(fromPastebin('constructor').kind).toBe('external')
  })

  it('reports unresolved links in solutions and copies the images they use', () => {
    const broken = buildContentCatalog({
      markdown: readme,
      source,
      solutions: [{ path: scalingAws.path, markdown: '# AWS\n[bad](#missing) ![diagram](scaling_aws_1.png)' }],
    })

    expect(findUnresolvedLinks(broken)).toEqual([{ location: scalingAws.path, href: '#missing' }])
    expect(findUnresolvedLinks(catalog)).toEqual([])
    expect(referencedAssets(broken)).toEqual(['solutions/system_design/scaling_aws/scaling_aws_1.png'])
    expect(referencedAssets(catalog)).toEqual([
      'solutions/system_design/pastebin/pastebin_basic.png',
      'solutions/system_design/pastebin/pastebin.png',
    ])
  })
})

describe('image mirrors', () => {
  it('fail the build when they are not a map of URLs to primer image paths', () => {
    const build = (mirrors: unknown) => () => buildContentCatalog({ markdown: readme, source, authored: { imageMirrors: mirrors } })

    expect(build(['x'])).toThrow(ContentValidationError)
    expect(build({ 'http://i.imgur.com/a.png': 'README.md' })).toThrow(
      'Image mirror "http://i.imgur.com/a.png": must be the path of an image in the primer',
    )
    expect(build({ 'http://i.imgur.com/a.png': '../outside.png' })).toThrow('must be the path of an image in the primer')
  })
})
