import { describe, expect, it } from 'vitest'
import { buildContentCatalog } from './catalog'

const source = { repoUrl: 'https://github.com/donnemartin/system-design-primer', commit: 'abc123', path: 'README.md' }

const studyGuide = [
  '## Study guide',
  '',
  '* **Short timeline** - Aim for **breadth** with system design topics.',
  '* **Medium timeline** - Aim for **breadth** and **some depth**.',
  '* **Long timeline** - Aim for **breadth** and **more depth**.',
  '',
  '| | Short | Medium | Long |',
  '|---|---|---|---|',
  '| Read through the [Load balancer](#load-balancer) topic | :+1: | :+1: | :+1: |',
  '| Work through [Active-passive](#active-passive) | Some | Many | Most |',
]

function catalogWith(lines: string[]) {
  const markdown = [...lines, '## Fail-over', '#### Active-passive', 'Text.', '## Load balancer', 'Text.'].join('\n')
  return buildContentCatalog({ markdown, source })
}

describe('study guide', () => {
  it('describes the short, medium and long timelines', () => {
    expect(catalogWith(studyGuide).studyGuide?.timelines).toEqual([
      { id: 'short', summary: 'Aim for breadth with system design topics.' },
      { id: 'medium', summary: 'Aim for breadth and some depth.' },
      { id: 'long', summary: 'Aim for breadth and more depth.' },
    ])
  })

  it('turns each row into a step linking to its Lesson, with how much of it each timeline covers', () => {
    expect(catalogWith(studyGuide).studyGuide?.steps).toEqual([
      {
        parts: [{ text: 'Read through the ' }, { text: 'Load balancer', lessonId: 'load-balancer' }, { text: ' topic' }],
        amounts: { short: 'yes', medium: 'yes', long: 'yes' },
      },
      {
        parts: [{ text: 'Work through ' }, { text: 'Active-passive', lessonId: 'fail-over', anchor: 'active-passive' }],
        amounts: { short: 'some', medium: 'many', long: 'most' },
      },
    ])
  })

  it('fails on a cell it cannot read', () => {
    const broken = [...studyGuide.slice(0, -1), '| Work through [Active-passive](#active-passive) | Some | Lots | Most |']

    expect(() => catalogWith(broken)).toThrow('Study guide: unknown amount "Lots"')
  })

  it('fails on a step that links to no Lesson', () => {
    const broken = [...studyGuide.slice(0, -1), '| Work through [nowhere](#nowhere) | Some | Many | Most |']

    expect(() => catalogWith(broken)).toThrow('Study guide: the step "Work through nowhere" links to no Lesson')
  })

  it('is absent when the primer has no study guide', () => {
    expect(catalogWith([]).studyGuide).toBeUndefined()
  })
})
