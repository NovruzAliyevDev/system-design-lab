import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError } from '../content/catalog'
import type { DesignStage } from './challenge'
import { evaluateDesign } from './rules'

const source = {
  repoUrl: 'https://github.com/donnemartin/system-design-primer',
  commit: 'abc123',
  path: 'README.md',
}

const markdown = ['## Cache', 'Cache text.', '## Database', 'Database text.'].join('\n')

const solutions = [
  {
    path: 'solutions/system_design/pastebin/README.md',
    markdown: [
      '# Design Pastebin.com (or Bit.ly)',
      'Intro.',
      '## Step 1: Outline use cases and constraints',
      'Use cases.',
      '## Step 2: Create a high level design',
      'Diagram.',
      '## Step 4: Scale the design',
      'Bigger diagram.',
    ].join('\n'),
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
  weight: 3,
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
  loadProfile: { readQps: 40, writeQps: 4, requestBytes: 1_000 },
  stages: [stage],
}

const withStage = (change: Record<string, unknown>) => [{ ...pastebin, stages: [{ ...stage, ...change }] }]
const withRule = (check: unknown, extra: Record<string, unknown> = {}) => withStage({ rules: [rule('only', check, extra)] })

describe('Load Profiles and simulation targets', () => {
  /** Under this load the reference's single application service (500 QPS) is overloaded. */
  const peak = { readQps: 900, writeQps: 100, requestBytes: 1_000 }
  const target = rule('target', { type: 'simulation', maxOverloadedNodes: 0, maxErrorRate: 0 })

  it('give every Challenge its default Load Profile, and every design Stage that load unless it sets its own', () => {
    const [challenge] = catalogWith([{ ...pastebin, stages: [stage, { ...stage, id: 'scaling', type: 'scaling', loadProfile: peak }] }]).challenges
    const [highLevel, scaling] = challenge.stages

    expect(challenge.loadProfile).toEqual(pastebin.loadProfile)
    expect(highLevel).toMatchObject({ loadProfile: pastebin.loadProfile })
    expect(scaling).toMatchObject({ loadProfile: peak })
  })

  it('check simulation targets under the Load Profile of their Stage', () => {
    const [challenge] = catalogWith(withStage({ rules: [...stage.rules, target] })).challenges

    expect(evaluateDesign(challenge.stages[0] as DesignStage, (challenge.stages[0] as DesignStage).referenceSolution, {}).failingCount).toBe(0)
  })

  it('fail the build when a Reference Solution misses its own simulation target', () => {
    const failing = withStage({ loadProfile: peak, rules: [...stage.rules, target] })

    expect(problemsOf(failing)).toEqual(['Challenge "pastebin" Stage "high-level-design": the Reference Solution fails Rule "target"'])
  })
})

describe('Chaos tasks', () => {
  const appDown = { id: 'app-down', prompt: 'Tətbiq servisi sıradan çıxıb.', scenario: { type: 'node-down', nodes: ['app-service'] } }
  const keepsWorking = rule('keeps-working', { type: 'simulation', chaos: 'app-down', maxErrorRate: 0 })
  /** The reference with a second, bigger application service behind a load balancer, so that the first can go down. */
  const redundant = {
    nodes: [
      node('client-1', 'client'),
      node('load-balancer-1', 'load-balancer'),
      node('app-service-1', 'app-service'),
      node('app-service-2', 'app-service', { instances: 2 }),
      node('sql-database-1', 'sql-database'),
    ],
    edges: [
      edge('client-1', 'load-balancer-1'),
      edge('load-balancer-1', 'app-service-1'),
      edge('load-balancer-1', 'app-service-2'),
      edge('app-service-1', 'sql-database-1'),
      edge('app-service-2', 'sql-database-1'),
    ],
  }
  const oneAppDown = { ...appDown, scenario: { type: 'node-down', nodes: [{ component: 'app-service', config: { instances: 1 } }] } }

  it('belong to their design Stage, and Rules check simulation targets under them: a Reference Solution that fails over passes', () => {
    const [challenge] = catalogWith(withStage({ referenceSolution: redundant, chaosTasks: [oneAppDown], rules: [...stage.rules, keepsWorking] })).challenges
    const designStage = challenge.stages[0] as DesignStage

    expect(designStage.chaosTasks).toEqual([oneAppDown])
    expect(evaluateDesign(designStage, designStage.referenceSolution, {}).rules.map((result) => result.passed)).toEqual([true, true, true])
  })

  it('fail the build when the Reference Solution fails a Rule under its Chaos task', () => {
    const failing = withStage({ chaosTasks: [appDown], rules: [...stage.rules, keepsWorking] })

    expect(problemsOf(failing)).toEqual(['Challenge "pastebin" Stage "high-level-design": the Reference Solution fails Rule "keeps-working"'])
  })

  it.each([
    ['a list that is not one', withStage({ chaosTasks: {} }), '"chaosTasks" must be a list of Chaos tasks'],
    ['a repeated id', withStage({ chaosTasks: [appDown, appDown] }), 'Chaos task "app-down": its id is already used in the Stage'],
    ['no prompt', withStage({ chaosTasks: [{ ...appDown, prompt: '' }] }), 'Chaos task "app-down": "prompt" must be a non-empty string'],
    ['an unknown field', withStage({ chaosTasks: [{ ...appDown, severity: 3 }] }), 'Chaos task "app-down": unknown field "severity"'],
    ['an unknown scenario type', withStage({ chaosTasks: [{ ...appDown, scenario: { type: 'meteor' } }] }), 'scenario: "type" must be one of node-down, zone-down, cache-cold, partition'],
    ['a field of another scenario type', withStage({ chaosTasks: [{ ...appDown, scenario: { type: 'node-down', nodes: ['app-service'], zonesOf: ['cache'] } }] }), 'scenario: unknown field "zonesOf" in a node-down scenario'],
    ['no node selectors', withStage({ chaosTasks: [{ ...appDown, scenario: { type: 'cache-cold', nodes: [] } }] }), 'scenario: "nodes" must list at least one node selector'],
    ['an unknown component type', withStage({ chaosTasks: [{ ...appDown, scenario: { type: 'node-down', nodes: ['mainframe'] } }] }), 'scenario: unknown component type "mainframe"'],
    ['one side of a partition', withStage({ chaosTasks: [{ ...appDown, scenario: { type: 'partition', sides: [['client']] } }] }), 'scenario: "sides" must be two lists of node selectors'],
    ['a scenario breaking nothing in the Reference Solution', withStage({ chaosTasks: [{ ...appDown, scenario: { type: 'cache-cold', nodes: ['cache'] } }] }), 'Chaos task "app-down": breaks nothing in the Reference Solution'],
    ['a zone down where the Reference Solution has none', withStage({ chaosTasks: [{ ...appDown, scenario: { type: 'zone-down', zonesOf: ['app-service'] } }] }), 'Chaos task "app-down": breaks nothing in the Reference Solution'],
    ['a Rule naming another Chaos task', withRule({ type: 'simulation', chaos: 'meteor', maxErrorRate: 0 }), 'check: "chaos" names no Chaos task of the Stage: "meteor"'],
    ['a per-kind error-rate target for an unknown kind', withRule({ type: 'simulation', maxErrorRate: { delete: 0 } }), 'check: "maxErrorRate" must be a number from 0 to 1, or such numbers for "read" and "write" only'],
  ])('fail the build with %s', (_, challenges, problem) => {
    expect(problemsOf(challenges).some((reported) => reported.endsWith(problem))).toBe(true)
  })
})

describe('authored Challenges', () => {
  it('become part of the catalog, with their Reference Solution read as a Design', () => {
    const [challenge] = catalogWith([pastebin]).challenges
    const [read] = challenge.stages
    if (read.type !== 'high-level-design') throw new Error('expected the high-level design Stage')

    expect(challenge).toMatchObject({ id: 'pastebin', solutionId: 'pastebin', lessonIds: ['cache', 'database'] })
    expect(read.rules.map((checked) => checked.id)).toEqual(['api', 'store'])
    // Config fields the author left out get their defaults.
    expect(read.referenceSolution.nodes[2].config).toEqual({ role: 'primary', replicas: 0, shardKey: '', instances: 1 })
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
    ['an unknown Stage type', withStage({ type: 'review' }), '"type" must be one of requirements, estimation, high-level-design, deep-dive, scaling'],
    ['a Stage weight that is not positive', withStage({ weight: -1 }), '"weight" must be a positive number'],
    ['no Stage weight', withStage({ weight: undefined }), '"weight" must be a positive number'],
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
    ['a simulation predicate without a target', withRule({ type: 'simulation' }), 'check: a simulation predicate must set at least one target'],
    ['a latency target that is not positive', withRule({ type: 'simulation', maxLatencyMs: { read: 0 } }), 'check: "maxLatencyMs" must give positive numbers for "read" and "write" only'],
    ['a latency target for an unknown kind', withRule({ type: 'simulation', maxLatencyMs: { delete: 5 } }), 'check: "maxLatencyMs" must give positive numbers for "read" and "write" only'],
    ['an overload target that is not a count', withRule({ type: 'simulation', maxOverloadedNodes: 1.5 }), 'check: "maxOverloadedNodes" must be a whole number of at least 0'],
    ['an error-rate target above 1', withRule({ type: 'simulation', maxErrorRate: 2 }), 'check: "maxErrorRate" must be a number from 0 to 1, or such numbers for "read" and "write" only'],
    ['no default Load Profile', [{ ...pastebin, loadProfile: undefined }], 'loadProfile: must be an object'],
    ['a Load Profile with a negative rate', [{ ...pastebin, loadProfile: { ...pastebin.loadProfile, writeQps: -1 } }], 'loadProfile: "writeQps" must be a number of at least 0'],
    ['a Load Profile without a request size', [{ ...pastebin, loadProfile: { readQps: 40, writeQps: 4 } }], 'loadProfile: "requestBytes" must be a number of at least 0'],
    ['a Load Profile sending nothing', [{ ...pastebin, loadProfile: { readQps: 0, writeQps: 0, requestBytes: 1_000 } }], 'loadProfile: must send some reads or writes'],
    ['an unknown Load Profile field', [{ ...pastebin, loadProfile: { ...pastebin.loadProfile, users: 5 } }], 'loadProfile: unknown field "users"'],
    ['an invalid Stage Load Profile', withStage({ loadProfile: { readQps: 'many', writeQps: 4, requestBytes: 1_000 } }), 'loadProfile: "readQps" must be a number of at least 0'],
  ])('fail the build with %s', (_, challenges, problem) => {
    expect(problemsOf(challenges).some((reported) => reported.endsWith(problem))).toBe(true)
  })
})

const requirements = {
  id: 'requirements',
  type: 'requirements',
  weight: 1,
  prompt: 'Tələbləri seçin.',
  solutionAnchor: 'step-1-outline-use-cases-and-constraints',
  items: [
    { section: 'use-case', text: 'İstifadəçi mətn yapışdırır və link alır', correct: true, explanation: 'Əsas ssenari.' },
    { section: 'use-case', text: 'İstifadəçi qeydiyyatdan keçir', explanation: 'Primer bunu kənarda saxlayır.' },
    { section: 'constraint', text: 'Oxuma:yazma nisbəti 10:1-dir', correct: true, explanation: 'Primer-in fərziyyəsi.' },
  ],
}

const estimation = {
  id: 'estimation',
  type: 'estimation',
  weight: 1,
  prompt: 'Yükü hesablayın.',
  explanation: 'Ayda 2,5 milyon saniyə var.',
  inputs: { writesPerMonth: 10_000_000, readsPerMonth: 100_000_000, bytesPerWrite: 1_271, years: 3 },
  questions: [
    { id: 'write-qps', quantity: 'writeQps', prompt: 'Saniyədə neçə yazma?' },
    { id: 'storage', quantity: 'storageTotal', prompt: '3 ildə nə qədər yer?' },
  ],
}

const deepDive = {
  id: 'deep-dive',
  type: 'deep-dive',
  weight: 2,
  prompt: 'Trade-off-ları seçin.',
  questions: [
    {
      type: 'multiple-choice',
      prompt: 'Linklər üçün SQL, yoxsa key-value?',
      options: [
        { text: 'İkisi də olar', correct: true, explanation: 'Primer hər ikisini təklif edir.' },
        { text: 'Yalnız graph database', explanation: 'Əlaqə sorğusu yoxdur.' },
      ],
    },
  ],
}

const scaling = {
  ...stage,
  id: 'scaling',
  type: 'scaling',
  solutionAnchor: 'step-4-scale-the-design',
  rules: [rule('cache', { type: 'node', node: 'cache' })],
  referenceSolution: {
    nodes: [...stage.referenceSolution.nodes, node('cache-1', 'cache')],
    edges: [...stage.referenceSolution.edges, edge('app-service-1', 'cache-1')],
  },
}

const fullPastebin = { ...pastebin, stages: [requirements, estimation, stage, deepDive, scaling] }

const withStages = (...stages: unknown[]) => [{ ...pastebin, stages }]

describe('Challenges with all five Stages', () => {
  it('become part of the catalog with each Stage read by its type, in the interview order', () => {
    const [challenge] = catalogWith([fullPastebin]).challenges

    expect(challenge.stages.map((each) => [each.type, each.weight])).toEqual([
      ['requirements', 1],
      ['estimation', 1],
      ['high-level-design', 3],
      ['deep-dive', 2],
      ['scaling', 3],
    ])
  })

  it('read requirement items as distractors unless marked correct', () => {
    const [read] = catalogWith([fullPastebin]).challenges[0].stages
    if (read.type !== 'requirements') throw new Error('expected the requirements Stage')

    expect(read.items.map((item) => [item.section, item.correct])).toEqual([
      ['use-case', true],
      ['use-case', false],
      ['constraint', true],
    ])
  })

  it('give every Estimation question its reference value, computed from the Stage inputs', () => {
    const read = catalogWith([fullPastebin]).challenges[0].stages[1]
    if (read.type !== 'estimation') throw new Error('expected the estimation Stage')

    expect(read.questions).toEqual([
      { id: 'write-qps', quantity: 'writeQps', prompt: 'Saniyədə neçə yazma?', referenceValue: 4 },
      { id: 'storage', quantity: 'storageTotal', prompt: '3 ildə nə qədər yer?', referenceValue: 457_560_000_000 },
    ])
  })

  it('read deep-dive questions as quiz questions with their explanations', () => {
    const read = catalogWith([fullPastebin]).challenges[0].stages[3]
    if (read.type !== 'deep-dive') throw new Error('expected the deep-dive Stage')

    expect(read.questions[0].options.map((option) => option.correct)).toEqual([true, false])
  })

  it('fail the build when a Scaling Reference Solution does not pass its own Rules', () => {
    const failing = withStages(stage, { ...scaling, referenceSolution: stage.referenceSolution })

    expect(problemsOf(failing)).toEqual(['Challenge "pastebin" Stage "scaling": the Reference Solution fails Rule "cache"'])
  })

  const anotherItem = (change: Record<string, unknown>) => ({ ...requirements, items: [...requirements.items, { ...requirements.items[1], text: 'Başqa', ...change }] })

  it.each([
    ['Stages out of the interview order', withStages(stage, requirements), 'Stage "requirements": must come before the high-level-design Stage'],
    ['a Stage type used twice', withStages(requirements, { ...requirements, id: 'again' }), 'Stage "again": the Challenge already has a requirements Stage'],
    ['a Scaling Stage without a high-level design to start from', withStages(requirements, scaling), 'Stage "scaling": needs a high-level-design Stage before it to start from'],
    ['a requirement item in an unknown section', withStages(anotherItem({ section: 'risk' })), 'item 4: "section" must be "use-case" or "constraint"'],
    ['a requirement item without an explanation', withStages(anotherItem({ explanation: undefined })), 'item 4: "explanation" must be a non-empty string; every item is explained'],
    ['a requirement listed twice', withStages(anotherItem({ text: requirements.items[0].text })), `item 4: "${requirements.items[0].text}" is listed twice`],
    ['no distractor among the requirements', withStages({ ...requirements, items: requirements.items.filter((item) => item.correct) }), '"items" must have a distractor'],
    ['no correct requirement', withStages({ ...requirements, items: requirements.items.map((item) => ({ ...item, correct: false })) }), '"items" must have a correct item'],
    [
      'an unknown estimation quantity',
      withStages({ ...estimation, questions: [{ id: 'x', quantity: 'latency', prompt: 'Gecikmə?' }] }),
      'question "x": "quantity" must be one of writeQps, readQps, peakWriteQps, peakReadQps, storagePerMonth, storagePerYear, storageTotal, writeBandwidth, readBandwidth',
    ],
    ['a repeated estimation question id', withStages({ ...estimation, questions: [estimation.questions[0], estimation.questions[0]] }), 'question "write-qps": its id is already used in the Stage'],
    ['no estimation questions', withStages({ ...estimation, questions: [] }), '"questions" must list at least one question'],
    ['an estimation input that is not a positive number', withStages({ ...estimation, inputs: { ...estimation.inputs, bytesPerWrite: -1 } }), 'inputs: "bytesPerWrite" must be a positive number'],
    ['a missing estimation input', withStages({ ...estimation, inputs: { writesPerMonth: 1 } }), 'inputs: "readsPerMonth" must be a positive number'],
    ['an unknown estimation input', withStages({ ...estimation, inputs: { ...estimation.inputs, users: 5 } }), 'inputs: unknown field "users"'],
    ['a peak factor of zero', withStages({ ...estimation, inputs: { ...estimation.inputs, peakFactor: 0 } }), 'inputs: "peakFactor" must be a positive number'],
    ['no worked-solution explanation', withStages({ ...estimation, explanation: '' }), '"explanation" must be a non-empty string'],
    ['an invalid deep-dive question', withStages({ ...deepDive, questions: [{ ...deepDive.questions[0], options: [deepDive.questions[0].options[0]] }] }), 'question 1: "options" must list at least two options'],
    [
      'an ordering deep-dive question',
      withStages({ ...deepDive, questions: [{ type: 'ordering', prompt: 'Sırala', items: [{ text: 'a', explanation: 'a' }, { text: 'b', explanation: 'b' }] }] }),
      'question 1: "type" must be "multiple-choice" or "multi-select"',
    ],
    ['no deep-dive questions', withStages({ ...deepDive, questions: [] }), '"questions" must list at least one question'],
    ['Rules on a requirements Stage', withStages({ ...requirements, rules: [] }), 'unknown field "rules"'],
  ])('fail the build with %s', (_, challenges, problem) => {
    const problems = problemsOf(challenges)
    expect(problems.some((reported) => reported.endsWith(problem)), problems.join('\n')).toBe(true)
  })
})
