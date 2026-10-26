import { describe, expect, it } from 'vitest'
import { defaultConfig, type ComponentType } from '../design/components'
import { connect, setNodeConfig, updateEdge, type Design, type DesignNode, type EdgeMode, type EdgeTraffic } from '../design/design'
import { evaluateDesign, levelZeroFeedback, openNextHint, problemHints, type Predicate, type Rule } from './rules'

const HINTS: Rule['hints'] = ['Sual?', 'İşarə.', 'Tam izah.']

function rule(id: string, check: Predicate, weight = 1): Rule {
  return { id, weight, description: `${id} təsviri`, hints: HINTS, check }
}

/** Whether a Design passes a single Rule with this check. */
function passes(check: Predicate, design: Design): boolean {
  return evaluateDesign({ rules: [rule('r', check)] }, design, {}).rules[0].passed
}

/**
 * A Design built from a list of `<type>-<n>` ids and `a->b` edges, e.g. `build(['client-1', 'web-server-1'], ['client-1->web-server-1'])`.
 * Edges can carry their mode and traffic: `a->b:async:write`.
 */
function build(nodeIds: string[], edges: string[] = []): Design {
  let design: Design = {
    nodes: nodeIds.map((id) => {
      const componentType = id.slice(0, id.lastIndexOf('-')) as ComponentType
      return { id, componentType, config: defaultConfig(componentType), label: id, notes: '', position: { x: 0, y: 0 } } as DesignNode
    }),
    edges: [],
    zones: [],
  }
  for (const spec of edges) {
    const [pair, mode = 'sync', traffic = 'both'] = spec.split(':')
    const [source, target] = pair.split('->')
    design = connect(design, source, target)
    design = updateEdge(design, `${source}->${target}`, { mode: mode as EdgeMode, traffic: traffic as EdgeTraffic })
  }
  return design
}

describe('evaluateDesign predicates', () => {
  describe('node exists', () => {
    it('passes when a node of the type exists and fails when none does', () => {
      const check: Predicate = { type: 'node', node: 'cache' }

      expect(passes(check, build(['client-1', 'cache-1']))).toBe(true)
      expect(passes(check, build(['client-1']))).toBe(false)
    })

    it('accepts any of several types', () => {
      const check: Predicate = { type: 'node', node: ['sql-database', 'nosql-store'] }

      expect(passes(check, build(['nosql-store-1']))).toBe(true)
      expect(passes(check, build(['cache-1']))).toBe(false)
    })

    it('counts only nodes whose config matches the filter', () => {
      const check: Predicate = { type: 'node', node: { component: 'nosql-store', config: { kind: ['key-value', 'document'] } } }
      const graph = setNodeConfig(build(['nosql-store-1']), 'nosql-store-1', 'kind', 'graph')
      const document = setNodeConfig(build(['nosql-store-1']), 'nosql-store-1', 'kind', 'document')

      expect(passes(check, graph)).toBe(false)
      expect(passes(check, document)).toBe(true)
    })

    it('holds the count of matching nodes within its bounds', () => {
      const check: Predicate = { type: 'node', node: 'app-service', min: 2, max: 3 }

      expect(passes(check, build(['app-service-1']))).toBe(false)
      expect(passes(check, build(['app-service-1', 'app-service-2']))).toBe(true)
      expect(passes(check, build(['app-service-1', 'app-service-2', 'app-service-3']))).toBe(true)
      expect(passes(check, build(['app-service-1', 'app-service-2', 'app-service-3', 'app-service-4']))).toBe(false)
    })

    it('can require that no such node exists', () => {
      expect(passes({ type: 'node', node: 'cache', max: 0 }, build(['client-1']))).toBe(true)
      expect(passes({ type: 'node', node: 'cache', max: 0 }, build(['cache-1']))).toBe(false)
    })
  })

  describe('edge exists', () => {
    const check: Predicate = { type: 'edge', from: 'app-service', to: ['sql-database', 'nosql-store'] }

    it('passes when an edge leads from a node of one type to a node of the other', () => {
      expect(passes(check, build(['app-service-1', 'nosql-store-1'], ['app-service-1->nosql-store-1']))).toBe(true)
    })

    it('fails when the nodes are not connected, or connected the other way', () => {
      expect(passes(check, build(['app-service-1', 'sql-database-1']))).toBe(false)
      expect(passes(check, build(['app-service-1', 'sql-database-1'], ['sql-database-1->app-service-1']))).toBe(false)
    })

    it('can require the edge to carry reads or writes', () => {
      const writes: Predicate = { ...check, traffic: 'write' }

      expect(passes(writes, build(['app-service-1', 'sql-database-1'], ['app-service-1->sql-database-1:sync:read']))).toBe(false)
      expect(passes(writes, build(['app-service-1', 'sql-database-1'], ['app-service-1->sql-database-1:sync:write']))).toBe(true)
      expect(passes(writes, build(['app-service-1', 'sql-database-1'], ['app-service-1->sql-database-1:sync:both']))).toBe(true)
    })
  })

  describe('no direct edge', () => {
    const check: Predicate = { type: 'no-edge', from: 'client', to: ['sql-database', 'object-store'] }

    it('passes when no edge leads from one type straight to the other', () => {
      const throughApi = build(['client-1', 'app-service-2', 'sql-database-3'], ['client-1->app-service-2', 'app-service-2->sql-database-3'])

      expect(passes(check, throughApi)).toBe(true)
    })

    it('fails when one does', () => {
      expect(passes(check, build(['client-1', 'object-store-1'], ['client-1->object-store-1']))).toBe(false)
    })
  })

  describe('edge mode equals', () => {
    const check: Predicate = { type: 'edge-mode', from: 'app-service', to: 'message-queue', mode: 'async' }

    it('passes when every edge between the types has the mode', () => {
      const design = build(['app-service-1', 'app-service-2', 'message-queue-3'], ['app-service-1->message-queue-3:async', 'app-service-2->message-queue-3:async'])

      expect(passes(check, design)).toBe(true)
    })

    it('fails when any of them has another mode', () => {
      const design = build(['app-service-1', 'app-service-2', 'message-queue-3'], ['app-service-1->message-queue-3:async', 'app-service-2->message-queue-3:sync'])

      expect(passes(check, design)).toBe(false)
    })

    it('fails when there is no such edge', () => {
      expect(passes(check, build(['app-service-1', 'message-queue-2']))).toBe(false)
    })
  })

  describe('path from A to B through C', () => {
    const check: Predicate = { type: 'path', from: 'client', to: 'sql-database', through: 'app-service' }

    it('passes when every path from A to B passes a node of C', () => {
      const design = build(
        ['client-1', 'web-server-2', 'app-service-3', 'sql-database-4'],
        ['client-1->web-server-2', 'web-server-2->app-service-3', 'app-service-3->sql-database-4'],
      )

      expect(passes(check, design)).toBe(true)
    })

    it('fails when a path bypasses C', () => {
      const design = build(
        ['client-1', 'web-server-2', 'app-service-3', 'sql-database-4'],
        ['client-1->web-server-2', 'web-server-2->app-service-3', 'app-service-3->sql-database-4', 'web-server-2->sql-database-4'],
      )

      expect(passes(check, design)).toBe(false)
    })

    it('fails when B cannot be reached from A at all', () => {
      expect(passes(check, build(['client-1', 'app-service-2', 'sql-database-3'], ['client-1->app-service-2']))).toBe(false)
    })

    it('without C, passes when any path leads from A to B', () => {
      const reach: Predicate = { type: 'path', from: 'client', to: 'sql-database' }

      expect(passes(reach, build(['client-1', 'web-server-2', 'sql-database-3'], ['client-1->web-server-2', 'web-server-2->sql-database-3']))).toBe(true)
      expect(passes(reach, build(['client-1', 'web-server-2', 'sql-database-3'], ['sql-database-3->web-server-2']))).toBe(false)
    })

    it('follows only edges carrying the traffic it names', () => {
      const writes: Predicate = { ...check, traffic: 'write' }
      const readOnly = build(['client-1', 'app-service-2', 'sql-database-3'], ['client-1->app-service-2', 'app-service-2->sql-database-3:sync:read'])
      // A write that bypasses the API through a read-only edge is no write path.
      const bypassByReads = build(
        ['client-1', 'app-service-2', 'sql-database-3'],
        ['client-1->app-service-2', 'app-service-2->sql-database-3:sync:write', 'client-1->sql-database-3:sync:read'],
      )

      expect(passes(writes, readOnly)).toBe(false)
      expect(passes(writes, bypassByReads)).toBe(true)
      expect(passes(check, bypassByReads)).toBe(false)
    })
  })

  describe('config value', () => {
    it('passes when every matching node has the value', () => {
      const check: Predicate = { type: 'config', node: 'load-balancer', key: 'layer', equals: 'l7' }
      const design = build(['load-balancer-1', 'load-balancer-2'])

      expect(passes(check, design)).toBe(true)
      expect(passes(check, setNodeConfig(design, 'load-balancer-2', 'layer', 'l4'))).toBe(false)
    })

    it('passes when every matching node has one of a set of values', () => {
      const check: Predicate = { type: 'config', node: 'cache', key: 'strategy', in: ['cache-aside', 'write-through'] }
      const design = build(['cache-1'])

      expect(passes(check, setNodeConfig(design, 'cache-1', 'strategy', 'write-through'))).toBe(true)
      expect(passes(check, setNodeConfig(design, 'cache-1', 'strategy', 'write-behind'))).toBe(false)
    })

    it('fails when no node matches', () => {
      expect(passes({ type: 'config', node: 'cache', key: 'eviction', equals: 'lru' }, build(['client-1']))).toBe(false)
    })
  })

  describe('combinators', () => {
    const hasCache: Predicate = { type: 'node', node: 'cache' }
    const hasQueue: Predicate = { type: 'node', node: 'message-queue' }

    it('all-of passes only when every part passes', () => {
      const check: Predicate = { type: 'all-of', predicates: [hasCache, hasQueue] }

      expect(passes(check, build(['cache-1', 'message-queue-2']))).toBe(true)
      expect(passes(check, build(['cache-1']))).toBe(false)
    })

    it('any-of passes when one part passes', () => {
      const check: Predicate = { type: 'any-of', predicates: [hasCache, hasQueue] }

      expect(passes(check, build(['message-queue-1']))).toBe(true)
      expect(passes(check, build(['client-1']))).toBe(false)
    })

    it('not inverts its part', () => {
      const check: Predicate = { type: 'not', predicate: hasCache }

      expect(passes(check, build(['client-1']))).toBe(true)
      expect(passes(check, build(['cache-1']))).toBe(false)
    })

    it('accepts equivalent designs: reads served by a cache or by a read replica', () => {
      const readsOffloaded: Predicate = {
        type: 'any-of',
        predicates: [
          { type: 'edge', from: 'app-service', to: 'cache', traffic: 'read' },
          { type: 'edge', from: 'app-service', to: { component: 'sql-database', config: { role: 'replica' } }, traffic: 'read' },
        ],
      }
      const withCache = build(['app-service-1', 'cache-2', 'sql-database-3'], ['app-service-1->cache-2:sync:read', 'app-service-1->sql-database-3:sync:write'])
      const withReplica = setNodeConfig(
        build(['app-service-1', 'sql-database-2', 'sql-database-3'], ['app-service-1->sql-database-2:sync:read', 'app-service-1->sql-database-3:sync:write']),
        'sql-database-2',
        'role',
        'replica',
      )
      const primaryOnly = build(['app-service-1', 'sql-database-2'], ['app-service-1->sql-database-2'])

      expect(passes(readsOffloaded, withCache)).toBe(true)
      expect(passes(readsOffloaded, withReplica)).toBe(true)
      expect(passes(readsOffloaded, primaryOnly)).toBe(false)
    })
  })

  describe('custom predicates', () => {
    const check: Predicate = { type: 'custom', name: 'all-connected' }

    it('"all-connected" passes when every node is joined to the others, whichever way the edges point', () => {
      const design = build(['client-1', 'app-service-2', 'analytics-3'], ['client-1->app-service-2', 'analytics-3->app-service-2'])

      expect(passes(check, design)).toBe(true)
    })

    it('"all-connected" fails when a node stands apart', () => {
      expect(passes(check, build(['client-1', 'app-service-2', 'cache-3'], ['client-1->app-service-2']))).toBe(false)
    })

    it('"all-connected" fails with fewer than two nodes, which connect nothing', () => {
      expect(passes(check, build([]))).toBe(false)
      expect(passes(check, build(['client-1']))).toBe(false)
    })
  })
})

describe('evaluateDesign scoring', () => {
  const stage = {
    rules: [
      rule('client', { type: 'node', node: 'client' }, 4),
      rule('cache', { type: 'node', node: 'cache' }, 2),
      rule('queue', { type: 'node', node: 'message-queue' }, 2),
    ],
  }
  const clientAndCache = build(['client-1', 'cache-2'])

  it('earns the weight of every passing Rule and counts the failing ones', () => {
    const evaluation = evaluateDesign(stage, clientAndCache, {})

    expect(evaluation).toMatchObject({ score: 6, maxScore: 8, totalWeight: 8, failingCount: 1 })
    expect(evaluation.rules.map(({ ruleId, passed, points }) => [ruleId, passed, points])).toEqual([
      ['client', true, 4],
      ['cache', true, 2],
      ['queue', false, 0],
    ])
  })

  it.each([
    [0, 4],
    [1, 3],
    [2, 2],
    [3, 1],
  ])('caps a Rule at its weight × (1, 0.75, 0.5, 0.25) once %i Hint tiers are open', (tiers, points) => {
    const evaluation = evaluateDesign(stage, clientAndCache, { client: tiers })

    expect(evaluation.rules[0]).toMatchObject({ hintsOpened: tiers, maxPoints: points, points })
    expect(evaluation.score).toBe(points + 2)
    expect(evaluation.maxScore).toBe(points + 4)
    expect(evaluation.totalWeight).toBe(8)
  })

  it('lowers the attainable points of a failing Rule too', () => {
    const evaluation = evaluateDesign(stage, clientAndCache, { queue: 2 })

    expect(evaluation.rules[2]).toMatchObject({ passed: false, maxPoints: 1, points: 0 })
    expect(evaluation.maxScore).toBe(7)
  })

  it('reports how many Hint tiers each Rule still has', () => {
    const evaluation = evaluateDesign(stage, clientAndCache, { client: 1, queue: 3 })

    expect(evaluation.rules.map((result) => result.hintsAvailable)).toEqual([2, 3, 0])
  })

  it.each([4, -1, 1.5])('refuses Hint usage of %s tiers', (tiers) => {
    expect(() => evaluateDesign(stage, clientAndCache, { client: tiers })).toThrow(RangeError)
  })

  it('ignores Hint usage of Rules the Stage does not have', () => {
    expect(evaluateDesign(stage, clientAndCache, { removed: 3 }).maxScore).toBe(8)
  })
})

describe('Hints', () => {
  const stage = {
    rules: [rule('client', { type: 'node', node: 'client' }), rule('cache', { type: 'node', node: 'cache' }), rule('queue', { type: 'node', node: 'message-queue' })],
  }

  it('open one tier at a time per Rule, up to the full explanation', () => {
    let usage = openNextHint({}, stage, 'cache')
    expect(usage).toEqual({ cache: 1 })
    usage = openNextHint(usage, stage, 'cache')
    usage = openNextHint(usage, stage, 'queue')
    usage = openNextHint(usage, stage, 'cache')
    expect(usage).toEqual({ cache: 3, queue: 1 })

    expect(() => openNextHint(usage, stage, 'cache')).toThrow(RangeError)
    expect(() => openNextHint(usage, stage, 'unknown')).toThrow(RangeError)
  })

  it('are offered for each failing Rule, showing the tiers opened so far', () => {
    const evaluation = evaluateDesign(stage, build(['client-1']), { cache: 2 })

    expect(problemHints(stage, evaluation)).toEqual([
      { ruleId: 'cache', opened: ['Sual?', 'İşarə.'], canOpenMore: true },
      { ruleId: 'queue', opened: [], canOpenMore: true },
    ])
  })
})

describe('level-0 feedback', () => {
  const stage = {
    rules: [rule('client', { type: 'node', node: 'client' }, 3), rule('cache', { type: 'node', node: 'cache' }), rule('queue', { type: 'node', node: 'message-queue' })],
  }

  it('shows only the score and how many Rules fail', () => {
    const feedback = levelZeroFeedback(evaluateDesign(stage, build(['client-1']), { client: 1 }))

    expect(feedback).toEqual({ score: 2.25, maxScore: 4.25, totalWeight: 5, failingCount: 2 })
  })
})
