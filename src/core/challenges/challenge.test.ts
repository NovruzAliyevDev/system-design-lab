import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError } from '../content/catalog'

const source = {
  repoUrl: 'https://github.com/donnemartin/system-design-primer',
  commit: 'abc123',
  path: 'README.md',
}

const markdown = ['## Cache', 'Cache text.', '## Database', 'Database text.'].join('\n')

const solutions = [
  {
    path: 'solutions/system_design/pastebin/README.md',
    markdown: ['# Design Pastebin.com (or Bit.ly)', 'Intro.', '## Step 2: Create a high level design', 'Diagram.'].join('\n'),
  },
]

function catalogWith(challenges: unknown) {
  return buildContentCatalog({ markdown, source, solutions, authored: { challenges } })
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

const node = (id: string, componentType: string, config: Record<string, unknown> = {}) => ({
  id,
  componentType,
  config,
  label: id,
  notes: '',
  position: { x: 0, y: 0 },
})
const edge = (source: string, target: string) => ({ id: `${source}->${target}`, source, target, mode: 'sync', traffic: 'both' })

const hints = ['Sual?', 'İşarə.', 'İzah.']

const rule = (id: string, check: unknown, extra: Record<string, unknown> = {}) => ({ id, weight: 1, description: `${id} təsviri`, hints, check, ...extra })

const stage = {
  id: 'high-level-design',
  type: 'high-level-design',
  prompt: 'Pastebin-in yüksək səviyyəli dizaynını qurun.',
  solutionAnchor: 'step-2-create-a-high-level-design',
  rules: [
    rule('api', { type: 'path', from: 'client', to: 'sql-database', through: 'app-service' }),
    rule('store', { type: 'any-of', predicates: [{ type: 'node', node: 'sql-database' }, { type: 'node', node: { component: 'nosql-store', config: { kind: 'key-value' } } }] }),
  ],
  referenceSolution: {
    nodes: [node('client-1', 'client'), node('app-service-1', 'app-service'), node('sql-database-1', 'sql-database')],
    edges: [edge('client-1', 'app-service-1'), edge('app-service-1', 'sql-database-1')],
  },
}

const pastebin = {
  id: 'pastebin',
  title: 'Pastebin.com (və ya Bit.ly) dizayn edin',
  kind: 'architecture',
  source: 'primer',
  solutionId: 'pastebin',
  lessonIds: ['cache', 'database'],
  stages: [stage],
}

const withStage = (change: Record<string, unknown>) => [{ ...pastebin, stages: [{ ...stage, ...change }] }]
const withRule = (check: unknown, extra: Record<string, unknown> = {}) => withStage({ rules: [rule('only', check, extra)] })

describe('authored Challenges', () => {
  it('become part of the catalog, with their Reference Solution read as a Design', () => {
    const [challenge] = catalogWith([pastebin]).challenges

    expect(challenge).toMatchObject({ id: 'pastebin', solutionId: 'pastebin', lessonIds: ['cache', 'database'] })
    expect(challenge.stages[0].rules.map((checked) => checked.id)).toEqual(['api', 'store'])
    // Config fields the author left out get their defaults.
    expect(challenge.stages[0].referenceSolution.nodes[2].config).toEqual({ role: 'primary', replicas: 0, shardKey: '', instances: 1 })
  })

  it('fail the build when a Reference Solution does not pass its own Rules', () => {
    const failing = withStage({ rules: [...stage.rules, rule('cache', { type: 'node', node: 'cache' })] })

    expect(problemsOf(failing)).toEqual(['Challenge "pastebin" Stage "high-level-design": the Reference Solution fails Rule "cache"'])
  })

  it('report an unknown Solution page once, not again for the Stage anchor into it', () => {
    expect(problemsOf([{ ...pastebin, solutionId: 'twitter' }])).toEqual(['Challenge "pastebin": unknown Solution page "twitter"'])
  })

  it.each([
    ['an unknown Lesson id', [{ ...pastebin, lessonIds: ['nope'] }], 'unknown Lesson id "nope"'],
    ['an unknown Solution page', [{ ...pastebin, solutionId: 'twitter' }], 'unknown Solution page "twitter"'],
    ['an anchor the Solution page lacks', withStage({ solutionAnchor: 'step-9' }), 'Solution page "pastebin" has no heading "step-9"'],
    ['an unknown field', [{ ...pastebin, difficulty: 'easy' }], 'unknown field "difficulty"'],
    ['a repeated Challenge id', [pastebin, pastebin], 'its id is already used by another Challenge'],
    ['no Stages', [{ ...pastebin, stages: [] }], '"stages" must list at least one Stage'],
    ['an unknown Stage type', withStage({ type: 'deep-dive' }), '"type" must be "high-level-design"'],
    ['an invalid Reference Solution', withStage({ referenceSolution: { nodes: [node('x', 'mainframe')], edges: [] } }), 'unknown component type "mainframe"'],
    ['a repeated Rule id', withStage({ rules: [stage.rules[0], stage.rules[0]] }), 'Rule "api": its id is already used in the Stage'],
    ['a weight that is not positive', withRule({ type: 'node', node: 'client' }, { weight: 0 }), '"weight" must be a positive number'],
    ['two Hint tiers', withRule({ type: 'node', node: 'client' }, { hints: ['Sual?', 'İşarə.'] }), '"hints" must be three texts'],
    ['an empty Hint tier', withRule({ type: 'node', node: 'client' }, { hints: ['Sual?', '', 'İzah.'] }), '"hints" must be three texts'],
    ['no description', withRule({ type: 'node', node: 'client' }, { description: ' ' }), '"description" must be a non-empty string'],
    ['an unknown predicate', withRule({ type: 'magic' }), 'check: unknown predicate type "magic"'],
    ['an unknown component type', withRule({ type: 'node', node: 'mainframe' }), 'check: unknown component type "mainframe"'],
    ['a config key the component lacks', withRule({ type: 'node', node: { component: 'cache', config: { role: 'primary' } } }), 'check: cache has no config field "role"'],
    ['a config value outside the schema', withRule({ type: 'node', node: { component: 'cache', config: { eviction: 'random' } } }), 'check: "random" does not fit the cache config field "eviction"'],
    ['count bounds that cross', withRule({ type: 'node', node: 'client', min: 3, max: 1 }), 'check: "min" and "max" must be whole numbers with min ≤ max'],
    ['an unknown traffic kind', withRule({ type: 'edge', from: 'client', to: 'cache', traffic: 'delete' }), 'check: "traffic" must be "read" or "write"'],
    ['an unknown edge mode', withRule({ type: 'edge-mode', from: 'client', to: 'cache', mode: 'batch' }), 'check: "mode" must be one of sync, async'],
    ['a config check with both a value and a set', withRule({ type: 'config', node: 'cache', key: 'eviction', equals: 'lru', in: ['lfu'] }), 'check: give either "equals" or "in"'],
    ['an empty any-of', withRule({ type: 'any-of', predicates: [] }), 'check: "predicates" must list at least one predicate'],
    ['an invalid part of a combinator', withRule({ type: 'not', predicate: { type: 'node', node: 'mainframe' } }), 'check: unknown component type "mainframe"'],
    ['an unregistered custom predicate', withRule({ type: 'custom', name: 'is-scalable' }), 'check: no custom predicate "is-scalable" is registered'],
  ])('fail the build with %s', (_, challenges, problem) => {
    expect(problemsOf(challenges).some((reported) => reported.endsWith(problem))).toBe(true)
  })
})
