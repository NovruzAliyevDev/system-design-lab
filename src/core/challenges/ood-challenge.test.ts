import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError, findCodeSolution } from '../content/catalog'
import { addClass, emptyDesign, updateClass } from '../design/design'
import { finishStage, newAttempt, readAttempt, stageWork, updateStage } from './attempt'
import type { ClassDesignStage } from './challenge'
import { defaultInterviewPlan } from './mock-interview'
import { evaluateDesign } from './rules'

const source = { repoUrl: 'https://github.com/donnemartin/system-design-primer', commit: 'abc123', path: 'README.md' }
const markdown = ['## Cache', 'Cache text.', '## Database', 'Database text.'].join('\n')
const codeSolutions = [
  { path: 'solutions/object_oriented_design/lru_cache/lru_cache.py', code: 'class Cache(object):\n    pass\n' },
  { path: 'solutions/object_oriented_design/hash_table/hash_map.py', code: 'class HashTable(object):\n    pass\n' },
]

function catalogWith(challenges: unknown) {
  return buildContentCatalog({ markdown, source, codeSolutions, authored: { challenges } })
}

/** The problems the build reports for authored Challenges, or none when they are valid. */
function problemsOf(challenges: unknown): string[] {
  try {
    catalogWith(challenges)
    return []
  } catch (error) {
    if (error instanceof ContentValidationError) return error.problems
    throw error
  }
}

const hints = ['Sual?', 'İşarə.', 'İzah.']
const rule = (id: string, check: unknown) => ({ id, weight: 1, description: `${id} təsviri`, hints, check })

const umlClass = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, kind: 'class', fields: [], methods: [], position: { x: 0, y: 0 }, ...extra })

const classDesign = {
  id: 'class-design',
  type: 'class-design',
  weight: 1,
  prompt: 'LRU cache-in siniflərini qurun.',
  rules: [
    rule('cache', { type: 'member', class: { name: 'cache' }, method: 'get' }),
    rule('list', { type: 'relation', from: { name: 'cache' }, to: { name: 'linked_?list' }, kind: 'composition', toMultiplicity: '1' }),
  ],
  referenceSolution: {
    nodes: [],
    edges: [],
    classes: [umlClass('class-1', 'Cache', { methods: ['get(query)'] }), umlClass('class-2', 'LinkedList')],
    relations: [{ id: 'class-1->class-2', source: 'class-1', target: 'class-2', kind: 'composition', targetMultiplicity: '1' }],
  },
}

const lruCache = {
  id: 'lru-cache',
  title: 'LRU cache dizayn edin',
  kind: 'ood',
  source: 'primer',
  codeSolutionId: 'lru_cache',
  lessonIds: ['cache'],
  stages: [classDesign],
}

const withStage = (change: Record<string, unknown>) => [{ ...lruCache, stages: [{ ...classDesign, ...change }] }]

describe('object-oriented design Challenges', () => {
  it('become part of the catalog with a class-design Stage, its reference UML read as a Design', () => {
    const [challenge] = catalogWith([lruCache]).challenges
    const stage = challenge.stages[0] as ClassDesignStage

    expect(challenge).toMatchObject({ id: 'lru-cache', kind: 'ood', codeSolutionId: 'lru_cache' })
    expect(challenge.loadProfile).toBeUndefined()
    expect(stage.type).toBe('class-design')
    expect(stage.referenceSolution.classes.map((each) => each.name)).toEqual(['Cache', 'LinkedList'])
    expect(evaluateDesign(stage, stage.referenceSolution, {}).failingCount).toBe(0)
  })

  it('point at the primer Python solution, shown as code', () => {
    const catalog = catalogWith([lruCache])

    expect(findCodeSolution(catalog, 'lru_cache')).toEqual({
      id: 'lru_cache',
      path: 'solutions/object_oriented_design/lru_cache/lru_cache.py',
      sourceUrl: 'https://github.com/donnemartin/system-design-primer/blob/abc123/solutions/object_oriented_design/lru_cache/lru_cache.py',
      code: 'class Cache(object):\n    pass\n',
    })
    expect(catalog.codeSolutions.map((solution) => solution.id)).toEqual(['hash_table', 'lru_cache'])
  })

  it('fail the build when the reference UML does not pass its own Rules', () => {
    const failing = withStage({ rules: [...classDesign.rules, rule('abstract', { type: 'class', class: { kind: 'abstract' } })] })

    expect(problemsOf(failing)).toEqual(['Challenge "lru-cache" Stage "class-design": the Reference Solution fails Rule "abstract"'])
  })

  it('fail the build for architecture predicates in a class-design Stage, and UML predicates elsewhere', () => {
    expect(problemsOf(withStage({ rules: [rule('node', { type: 'node', node: 'cache' })] }))).toEqual([
      'Challenge "lru-cache" Stage "class-design": Rule "node": check: a node predicate does not check a UML Design',
    ])
    expect(problemsOf(withStage({ rules: [rule('any', { type: 'any-of', predicates: [{ type: 'path', from: 'client', to: 'cache' }] })] }))).toEqual([
      'Challenge "lru-cache" Stage "class-design": Rule "any": check: a path predicate does not check a UML Design',
    ])
  })

  it('fail the build for a class selector or relation that cannot match', () => {
    const problems = problemsOf(
      withStage({
        rules: [
          rule('pattern', { type: 'class', class: { name: '(cache', colour: 'red' } }),
          rule('member', { type: 'member', class: { kind: 'mixin' }, field: 'size', method: 'get' }),
          rule('relation', { type: 'relation', from: {}, to: { fields: [] }, kind: 'friendship', toMultiplicity: ['*', 'many'] }),
        ],
      }),
    )

    expect(problems).toEqual([
      'Challenge "lru-cache" Stage "class-design": Rule "pattern": check: unknown field "colour" in a class selector',
      'Challenge "lru-cache" Stage "class-design": Rule "pattern": check: "(cache" is not a regular expression',
      'Challenge "lru-cache" Stage "class-design": Rule "member": check: "kind" must be one of class, abstract, interface, or a list of them',
      'Challenge "lru-cache" Stage "class-design": Rule "member": check: give either "field" or "method"',
      'Challenge "lru-cache" Stage "class-design": Rule "relation": check: "fields" must list at least one pattern',
      'Challenge "lru-cache" Stage "class-design": Rule "relation": check: "kind" must be one of inheritance, implementation, composition, aggregation, association, or a list of them',
      'Challenge "lru-cache" Stage "class-design": Rule "relation": check: "toMultiplicity" must be one of 1, 0..1, *, 1..*, or a list of them',
    ])
  })

  it('fail the build without a known Python solution, with a Load Profile, or with Stages of an architecture Challenge', () => {
    const { codeSolutionId: _, ...withoutCode } = lruCache
    const architectureStage = { ...classDesign, id: 'high-level-design', type: 'high-level-design' }

    expect(problemsOf([withoutCode])).toEqual(['Challenge "lru-cache": "codeSolutionId" must name a Python solution of the primer'])
    expect(problemsOf([{ ...lruCache, codeSolutionId: 'lru' }])).toEqual(['Challenge "lru-cache": unknown Python solution "lru"'])
    expect(problemsOf([{ ...lruCache, loadProfile: { readQps: 1, writeQps: 1, requestBytes: 1 } }])).toEqual([
      'Challenge "lru-cache": an ood Challenge has no "loadProfile"',
    ])
    expect(problemsOf([{ ...lruCache, stages: [architectureStage] }])).toEqual([
      'Challenge "lru-cache" Stage "high-level-design": an ood Challenge has no high-level-design Stage',
      'Challenge "lru-cache": an ood Challenge needs a class-design Stage',
    ])
  })

  it('fail the build for a class-design Stage, or a Python solution, in an architecture Challenge', () => {
    const architecture = { ...lruCache, kind: 'architecture', loadProfile: { readQps: 1, writeQps: 1, requestBytes: 1 } }

    expect(problemsOf([architecture])).toEqual([
      'Challenge "lru-cache": an architecture Challenge has no "codeSolutionId"',
      'Challenge "lru-cache" Stage "class-design": an architecture Challenge has no class-design Stage',
    ])
  })
})

describe('class-design Stages of an Attempt', () => {
  const [challenge] = catalogWith([lruCache]).challenges
  const stage = challenge.stages[0] as ClassDesignStage
  const now = new Date('2026-11-02T10:00:00Z')

  it('start from an empty UML Design without Hints', () => {
    expect(stageWork(challenge, newAttempt(now), 'class-design')).toEqual({ type: 'class-design', design: emptyDesign(), hintUsage: {} })
  })

  it('score the UML Design against the Rules, capped by the Hints opened', () => {
    const added = addClass(emptyDesign(), { x: 0, y: 0 }, 'Class')
    const design = updateClass(added.design, added.classId, { name: 'Cache', methods: ['get(query)'] })
    const attempt = updateStage(challenge, newAttempt(now), 'class-design', { type: 'class-design', design, hintUsage: { cache: 1 } })

    const finished = finishStage(challenge, attempt, 'class-design', now)

    // `cache` passes at 75%, `list` fails: 0.75 of 2.
    expect(finished.score).toBe(0.375)
    expect(finished.stages['class-design'].outcome?.evaluation?.failingCount).toBe(1)
  })

  it('are read back from storage', () => {
    const attempt = updateStage(challenge, newAttempt(now), 'class-design', { type: 'class-design', design: stage.referenceSolution, hintUsage: {} })

    expect(readAttempt(JSON.parse(JSON.stringify(attempt)))).toEqual(attempt)
  })

  it('get a time box in a Mock Interview', () => {
    expect(defaultInterviewPlan(challenge).timeBoxes).toEqual({ 'class-design': 45 })
  })
})
