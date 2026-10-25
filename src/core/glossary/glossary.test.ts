import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError } from '../content/catalog'

const source = {
  repoUrl: 'https://github.com/donnemartin/system-design-primer',
  commit: 'abc123',
  path: 'README.md',
}

const markdown = ['## Database', 'Text.', '### Sharding', 'Shards.', '## Cache', 'Cache text.'].join('\n')

function catalogWith(glossary: unknown) {
  return buildContentCatalog({ markdown, source, authored: { glossary } })
}

/** The problems the build reports for an authored Glossary, or none when it is valid. */
function problemsOf(glossary: unknown): string[] {
  try {
    catalogWith(glossary)
    return []
  } catch (error) {
    if (error instanceof ContentValidationError) return error.problems
    throw error
  }
}

const sharding = {
  term: 'Sharding',
  aliases: ['shard'],
  explanation: 'Məlumatların bir neçə verilənlər bazasına bölünməsi.',
  lessonIds: ['sharding', 'database'],
}

describe('authored Glossary', () => {
  it('puts the Glossary Terms in the catalog in alphabetical order, each with an id for its anchor', () => {
    const catalog = catalogWith([
      sharding,
      { term: 'Write-through', explanation: 'Yazma həm keşə, həm bazaya gedir.', lessonIds: ['cache'] },
      { term: 'cache', explanation: 'Tez-tez lazım olan məlumatın sürətli yaddaşda saxlanması.', lessonIds: ['cache'] },
    ])

    expect(catalog.glossary).toEqual([
      { id: 'cache', term: 'cache', aliases: [], explanation: 'Tez-tez lazım olan məlumatın sürətli yaddaşda saxlanması.', lessonIds: ['cache'] },
      { id: 'sharding', ...sharding },
      { id: 'write-through', term: 'Write-through', aliases: [], explanation: 'Yazma həm keşə, həm bazaya gedir.', lessonIds: ['cache'] },
    ])
  })

  it('has no Glossary Terms when none are authored', () => {
    expect(buildContentCatalog({ markdown, source }).glossary).toEqual([])
  })

  it('fails on a reference to a Lesson id that does not exist', () => {
    expect(problemsOf([{ ...sharding, lessonIds: ['sharding', 'partitioning'] }])).toEqual([
      'Glossary Term "Sharding": unknown Lesson id "partitioning"',
    ])
  })

  it('fails on a term that is missing a field, has a field of the wrong type or an unknown field', () => {
    expect(problemsOf([{ term: 'Sharding', lessonIds: ['sharding'] }])).toEqual([
      'Glossary Term "Sharding": "explanation" must be a non-empty string',
    ])
    expect(problemsOf([{ ...sharding, aliases: 'shard' }])).toEqual([
      'Glossary Term "Sharding": "aliases" must be a list of non-empty strings',
    ])
    expect(problemsOf([{ ...sharding, lessonIds: [] }])).toEqual([
      'Glossary Term "Sharding": "lessonIds" must list at least one Lesson id',
    ])
    expect(problemsOf([{ ...sharding, alias: ['shard'] }])).toEqual(['Glossary Term "Sharding": unknown field "alias"'])
    expect(problemsOf([{ ...sharding, term: '  ' }])).toEqual(['Glossary Term #1: "term" must be a non-empty string'])
    expect(problemsOf(['Sharding'])).toEqual(['Glossary Term #1: must be an object'])
    expect(problemsOf({ sharding })).toEqual(['Glossary: must be a list of Glossary Terms'])
  })

  it('fails when two terms share a name or alias, ignoring case, since the text could not tell them apart', () => {
    expect(
      problemsOf([
        sharding,
        { term: 'Shard', explanation: 'Bölünmüş məlumatın bir hissəsi.', lessonIds: ['sharding'] },
        { term: 'Cache', aliases: ['cache'], explanation: 'Keş.', lessonIds: ['cache'] },
      ]),
    ).toEqual([
      'Glossary Term "Shard": "Shard" is already used by Glossary Term "Sharding"',
      'Glossary Term "Cache": "cache" is already used by Glossary Term "Cache"',
    ])
  })

  it('reports every problem at once', () => {
    expect(
      problemsOf([
        { ...sharding, lessonIds: ['nope'] },
        { term: 'Cache', explanation: '', lessonIds: ['cache'] },
      ]),
    ).toHaveLength(2)
  })

  it('names the problems in the error message, so the build output shows them', () => {
    expect(() => catalogWith([{ ...sharding, lessonIds: ['nope'] }])).toThrow(/unknown Lesson id "nope"/)
  })
})
