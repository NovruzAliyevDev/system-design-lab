import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError } from '../content/catalog'
import { findLesson } from '../content/catalog'
import { conceptSimulationsOfLesson, lessonParts } from './embed'

const source = {
  repoUrl: 'https://github.com/donnemartin/system-design-primer',
  commit: 'abc123',
  path: 'README.md',
}

const markdown = ['## Load balancer', 'Load balancer text.', '## Database', 'Database text.', '### Sharding', 'Sharding text.'].join('\n')

function catalogWith(conceptSimulations: unknown) {
  return buildContentCatalog({ markdown, source, authored: { conceptSimulations } })
}

/** The problems the build reports for the authored embeds, or none when they are valid. */
function problemsOf(conceptSimulations: unknown): string[] {
  try {
    catalogWith(conceptSimulations)
    return []
  } catch (error) {
    if (error instanceof ContentValidationError) return error.problems
    throw error
  }
}

describe('Concept Simulation embeds', () => {
  it('attach simulations to their Lessons, in authored order', () => {
    const catalog = catalogWith([
      { simulationId: 'consistent-hashing', lessonId: 'sharding' },
      { simulationId: 'load-balancer', lessonId: 'load-balancer' },
      { simulationId: 'load-balancer', lessonId: 'sharding' },
    ])

    expect(conceptSimulationsOfLesson(catalog.conceptSimulations, 'sharding')).toEqual(['consistent-hashing', 'load-balancer'])
    expect(conceptSimulationsOfLesson(catalog.conceptSimulations, 'load-balancer')).toEqual(['load-balancer'])
    expect(conceptSimulationsOfLesson(catalog.conceptSimulations, 'database')).toEqual([])
  })

  it('are none when none are authored', () => {
    expect(buildContentCatalog({ markdown, source }).conceptSimulations).toEqual([])
  })

  it('fail the build on an unknown simulation or Lesson, a repeat in one Lesson, or a wrong shape', () => {
    expect(
      problemsOf([
        { simulationId: 'cache', lessonId: 'database' },
        { simulationId: 'load-balancer', lessonId: 'cache' },
        { simulationId: 'load-balancer', lessonId: 'load-balancer' },
        { simulationId: 'load-balancer', lessonId: 'load-balancer' },
        { simulationId: 'consistent-hashing', lessonId: 'sharding', title: 'Ring' },
        'sharding',
      ]),
    ).toEqual([
      'Concept Simulation #1: unknown simulation "cache" (known: "load-balancer", "consistent-hashing")',
      'Concept Simulation "load-balancer": unknown Lesson id "cache"',
      'Concept Simulation "load-balancer": already embedded in Lesson "load-balancer"',
      'Concept Simulation "consistent-hashing": unknown field "title"',
      'Concept Simulation #6: must be an object',
    ])
    expect(problemsOf({ simulationId: 'load-balancer', lessonId: 'load-balancer' })).toEqual([
      'Concept Simulations: must be a list of embeds',
    ])
  })

  describe('placed after a section of their Lesson', () => {
    const sectionMarkdown = [
      '## Database',
      'Intro text.',
      '#### Sharding',
      'Sharding text.',
      '##### Disadvantage(s): sharding',
      'Rebalancing text.',
      '#### Denormalization',
      'Denormalization text.',
    ].join('\n')
    const embeds = [
      { simulationId: 'load-balancer', lessonId: 'database' },
      { simulationId: 'consistent-hashing', lessonId: 'database', afterSection: 'sharding' },
    ]
    const catalog = buildContentCatalog({ markdown: sectionMarkdown, source, authored: { conceptSimulations: embeds } })
    const lesson = findLesson(catalog, 'database')!

    it('split the Lesson text where the section ends, subsections included, and keep the rest at the end', () => {
      const parts = lessonParts(lesson, catalog.conceptSimulations)

      expect(parts.map(({ text, simulations }) => [text.body, simulations])).toEqual([
        ['Intro text.\n#### Sharding\nSharding text.\n##### Disadvantage(s): sharding\nRebalancing text.\n', ['consistent-hashing']],
        ['#### Denormalization\nDenormalization text.', ['load-balancer']],
      ])
      expect(parts[1].start).toBe(parts[0].text.body.length)
      expect(parts[1].text.headingAnchors).toEqual([{ offset: 0, anchor: 'denormalization' }])
    })

    it('keep the Lesson whole when no simulation is placed inside it', () => {
      const parts = lessonParts(lesson, [{ simulationId: 'load-balancer', lessonId: 'database' }])

      expect(parts).toEqual([{ start: 0, text: { body: lesson.body, headingAnchors: lesson.headingAnchors }, simulations: ['load-balancer'] }])
    })

    it('fail the build when the section is not a heading inside the Lesson', () => {
      const problems = (afterSection: string) => {
        try {
          buildContentCatalog({ markdown: sectionMarkdown, source, authored: { conceptSimulations: [{ simulationId: 'load-balancer', lessonId: 'database', afterSection }] } })
          return []
        } catch (error) {
          if (error instanceof ContentValidationError) return error.problems
          throw error
        }
      }

      expect(problems('replication')).toEqual(['Concept Simulation "load-balancer": "afterSection" must be a heading inside Lesson "database", not "replication"'])
      expect(problems('denormalization')).toEqual([])
    })
  })
})
