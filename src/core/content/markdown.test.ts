import { describe, expect, it } from 'vitest'
import type { Heading } from 'mdast'
import { nestHeadings, parseMarkdown } from './markdown'

/** The heading levels of `markdown` once nested under a page title of level 1. */
function nestedLevels(markdown: string): number[] {
  const tree = parseMarkdown(markdown)
  nestHeadings(tree)
  return tree.children.filter((node): node is Heading => node.type === 'heading').map((heading) => heading.depth)
}

describe('nestHeadings', () => {
  it('keeps levels that step down one at a time', () => {
    expect(nestedLevels('## A\n\n### B\n\n#### C\n\n## D')).toEqual([2, 3, 4, 2])
  })

  it('lowers a heading that skips a level to one below the heading before it', () => {
    expect(nestedLevels('## A\n\n#### B\n\n### C')).toEqual([2, 3, 3])
  })

  it('starts a text that opens deep right under the page title, keeping its own nesting', () => {
    expect(nestedLevels('#### A\n\n#### B\n\n###### C')).toEqual([2, 2, 3])
  })

  it('puts a top-level heading under the page title', () => {
    expect(nestedLevels('# A\n\n## B')).toEqual([2, 2])
  })
})
