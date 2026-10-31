import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError } from '../content/catalog'
import { skillTreeLayers, skillTreeLessonReferences, topicItems, type SkillTopic } from './skill-tree'

const source = {
  repoUrl: 'https://github.com/donnemartin/system-design-primer',
  commit: 'abc123',
  path: 'README.md',
}

const markdown = [
  '## Latency vs throughput',
  'Latency text.',
  '## Database',
  'Database text.',
  '### NoSQL',
  'NoSQL text.',
  '## Cache',
  'Cache text.',
  '## Credits',
  'Thanks.',
].join('\n')

const latency = { id: 'latency', title: 'Latency və throughput', lessonIds: ['latency-vs-throughput'], prerequisiteIds: [] }
const database = { id: 'database', title: 'Database', lessonIds: ['database', 'nosql'], prerequisiteIds: ['latency'] }
const cache = { id: 'cache', title: 'Cache', lessonIds: ['cache'], prerequisiteIds: ['database', 'latency'] }

function catalogWith(skillTree: unknown, authored: Record<string, unknown> = {}) {
  return buildContentCatalog({ markdown, source, authored: { ...authored, skillTree } })
}

/** The problems the build reports for the authored Skill Tree, or none when it is valid. */
function problemsOf(skillTree: unknown): string[] {
  try {
    catalogWith(skillTree)
    return []
  } catch (error) {
    if (error instanceof ContentValidationError) return error.problems
    throw error
  }
}

describe('authored Skill Tree', () => {
  it('puts the topics in the catalog in authored order', () => {
    expect(catalogWith([latency, database, cache]).skillTree).toEqual([latency, database, cache])
  })

  it('is empty when none is authored', () => {
    expect(buildContentCatalog({ markdown, source }).skillTree).toEqual([])
  })

  it('rejects unknown Lessons and prerequisites', () => {
    expect(problemsOf([{ ...latency, lessonIds: ['latency-vs-throughput', 'sharding'] }, { ...database, prerequisiteIds: ['networking'] }])).toEqual([
      'Skill Tree topic "latency": unknown Lesson id "sharding"',
      'Skill Tree topic "database": unknown prerequisite topic "networking"',
    ])
  })

  it('rejects a cycle of prerequisites, naming the topics in it', () => {
    expect(problemsOf([{ ...latency, prerequisiteIds: ['cache'] }, database, { ...cache, prerequisiteIds: ['database'] }])).toEqual([
      'Skill Tree: prerequisites form a cycle: latency → cache → database → latency',
    ])
    expect(problemsOf([{ ...latency, prerequisiteIds: ['latency'] }])).toEqual(['Skill Tree topic "latency": is its own prerequisite'])
  })

  it('rejects duplicate topics, a Lesson in two topics, and malformed topics', () => {
    expect(
      problemsOf([
        latency,
        { ...latency, title: 'Again' },
        { ...database, lessonIds: ['database', 'latency-vs-throughput'] },
        { ...cache, lessonIds: [], extra: true },
        { title: 'No id' },
        { ...cache, id: 'cache-2', title: ' ', prerequisiteIds: ['latency', 'latency'] },
      ]),
    ).toEqual([
      'Skill Tree topic "latency": its id is already used by another topic',
      'Skill Tree topic "database": Lesson "latency-vs-throughput" is already in topic "latency"',
      'Skill Tree topic "cache": unknown field "extra"',
      'Skill Tree topic "cache": "lessonIds" must list at least one Lesson id',
      'Skill Tree topic #5: must be an object with an "id"',
      'Skill Tree topic "cache-2": "title" must be a non-empty string',
      'Skill Tree topic "cache-2": prerequisite "latency" is listed twice',
    ])
    expect(problemsOf({})).toEqual(['Skill Tree: must be a list of topics'])
  })

  it('reports the Lessons its topics reference', () => {
    expect(skillTreeLessonReferences([database, { id: 'broken' }])).toEqual([
      { referrer: 'Skill Tree topic "database"', lessonId: 'database' },
      { referrer: 'Skill Tree topic "database"', lessonId: 'nosql' },
    ])
  })
})

describe('Skill Tree layers', () => {
  it('puts each topic one layer after its furthest prerequisite, in authored order within a layer', () => {
    const extra = { id: 'extra', title: 'Extra', lessonIds: ['credits'], prerequisiteIds: [] }

    expect(skillTreeLayers([cache, latency, database, extra])).toEqual([['latency', 'extra'], ['database'], ['cache']])
    expect(skillTreeLayers([])).toEqual([])
  })
})

describe('items of a topic', () => {
  const option = (text: string, correct?: boolean) => ({ text, ...(correct === undefined ? {} : { correct }), explanation: `${text}.` })
  const quiz = (id: string, lessonId: string) => ({
    id,
    lessonId,
    questions: [{ type: 'multiple-choice', prompt: 'Sual?', options: [option('Bəli', true), option('Xeyr')] }],
  })

  it("lists the topic's Lessons and the quizzes shown in them", () => {
    const catalog = catalogWith([latency, database, cache], { quizzes: [quiz('cache-quiz', 'cache'), quiz('nosql-quiz', 'nosql')] })

    expect(topicItems(catalog, database)).toEqual({ lessonIds: ['database', 'nosql'], quizzes: [catalog.quizzes[1]], cards: [], challenges: [] })
    expect(topicItems(catalog, latency).quizzes).toEqual([])
  })

  const card = (id: string, lessonIds: string[]) => ({ id, front: id, back: id, lessonIds })
  const challenge = (id: string, lessonIds: string[]) => ({ id, lessonIds })
  const catalogOf = (challenges: ReturnType<typeof challenge>[]) =>
    ({
      skillTree: [latency, database, cache],
      quizzes: [],
      decks: [{ id: 'deck', title: 'Deck', sourceUrl: '', cards: [card('a', ['nosql']), card('b', ['cache']), card('c', ['database', 'nosql'])] }],
      challenges,
    }) as unknown as Parameters<typeof topicItems>[0]

  it('lists the cards and Challenges linked to any of its Lessons, each once', () => {
    const items = topicItems(catalogOf([challenge('pastebin', ['database', 'nosql']), challenge('crawler', ['latency-vs-throughput'])]), database)

    expect(items.cards.map((each) => each.id)).toEqual(['a', 'c'])
    expect(items.challenges.map((each) => [each.challenge.id, each.required])).toEqual([['pastebin', true]])
  })

  it('requires a Challenge only in the furthest topics it practises, not in their prerequisites', () => {
    // Cache builds on Database, which builds on Latency. Without prerequisites among them, each topic is a furthest one.
    const pastebin = catalogOf([challenge('pastebin', ['latency-vs-throughput', 'nosql', 'cache'])])
    const required = (topic: SkillTopic) => topicItems(pastebin, topic).challenges.map((each) => each.required)

    expect([required(latency), required(database), required(cache)]).toEqual([[false], [false], [true]])
    const unrelated = { ...pastebin, skillTree: [latency, { ...database, prerequisiteIds: [] }, { ...cache, prerequisiteIds: [] }] }
    expect([latency, database, cache].map((topic) => topicItems(unrelated, topic).challenges[0].required)).toEqual([true, true, true])
  })
})
