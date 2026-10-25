import { describe, expect, it } from 'vitest'
import { componentDefinition, configProblem, defaultConfig, isFieldApplicable, PALETTE } from './components'
import {
  addNode,
  connect,
  deserializeDesign,
  emptyDesign,
  InvalidDesignError,
  moveNodes,
  readDesign,
  removeElements,
  renameNode,
  serializeDesign,
  setNodeConfig,
  setNodeNotes,
  updateEdge,
  type Design,
} from './design'

/** Client → load balancer → two web servers → cache-aside cache → SQL primary, with a queue and worker. */
function sampleDesign(): Design {
  return {
    nodes: [
      { id: 'client-1', componentType: 'client', label: 'Users', notes: '', config: {}, position: { x: 0, y: 0 } },
      {
        id: 'load-balancer-1',
        componentType: 'load-balancer',
        label: 'LB',
        notes: 'Active-passive pair.',
        config: { layer: 'l7', algorithm: 'least-connections', instances: 2 },
        zoneId: 'us-east-1a',
        position: { x: 200, y: 0 },
      },
      { id: 'web-server-1', componentType: 'web-server', label: 'Web', notes: '', config: { instances: 3 }, position: { x: 400, y: 0 } },
      {
        id: 'cache-1',
        componentType: 'cache',
        label: 'Memcached',
        notes: '',
        config: { strategy: 'cache-aside', eviction: 'lru', instances: 1 },
        position: { x: 600, y: -100 },
      },
      {
        id: 'sql-database-1',
        componentType: 'sql-database',
        label: 'MySQL',
        notes: '',
        config: { role: 'primary', replicas: 2, shardKey: 'user_id', instances: 1 },
        position: { x: 600, y: 100 },
      },
      { id: 'message-queue-1', componentType: 'message-queue', label: 'Queue', notes: '', config: { instances: 1 }, position: { x: 400, y: 200 } },
      { id: 'task-queue-1', componentType: 'task-queue', label: 'Workers', notes: '', config: { instances: 4 }, position: { x: 600, y: 200 } },
    ],
    edges: [
      { id: 'client-1->load-balancer-1', source: 'client-1', target: 'load-balancer-1', mode: 'sync', traffic: 'both' },
      { id: 'load-balancer-1->web-server-1', source: 'load-balancer-1', target: 'web-server-1', mode: 'sync', traffic: 'both' },
      { id: 'web-server-1->cache-1', source: 'web-server-1', target: 'cache-1', mode: 'sync', traffic: 'read' },
      { id: 'web-server-1->sql-database-1', source: 'web-server-1', target: 'sql-database-1', mode: 'sync', traffic: 'write' },
      { id: 'web-server-1->message-queue-1', source: 'web-server-1', target: 'message-queue-1', mode: 'async', traffic: 'write' },
      { id: 'message-queue-1->task-queue-1', source: 'message-queue-1', target: 'task-queue-1', mode: 'async', traffic: 'write' },
    ],
  }
}

/** The problems found reading a stored Design, or none. */
function problemsOf(value: unknown): string[] {
  return readDesign(value).problems
}

const withNode = (change: Record<string, unknown>) => {
  const design = sampleDesign()
  return { ...design, nodes: design.nodes.map((node) => (node.id === 'load-balancer-1' ? { ...node, ...change } : node)) }
}

const withLoadBalancerConfig = (config: Record<string, unknown>) =>
  withNode({ config: { layer: 'l7', algorithm: 'least-connections', instances: 2, ...config } })

const withEdge = (change: Record<string, unknown>) => {
  const design = sampleDesign()
  return { ...design, edges: design.edges.map((edge, i) => (i === 0 ? { ...edge, ...change } : edge)) }
}

describe('Design serialisation', () => {
  it('round-trips a Design through serialise and deserialise without loss', () => {
    const design = sampleDesign()

    expect(deserializeDesign(serializeDesign(design))).toEqual(design)
  })

  it('round-trips the empty Design', () => {
    expect(deserializeDesign(serializeDesign(emptyDesign()))).toEqual({ nodes: [], edges: [] })
  })

  it('fills in config fields a Design was stored without, from their defaults', () => {
    const stored = withNode({ config: { layer: 'l4' } })

    const { design } = readDesign(stored)

    expect(design?.nodes.find((node) => node.id === 'load-balancer-1')?.config).toEqual({
      layer: 'l4',
      algorithm: 'round-robin',
      instances: 1,
    })
  })

  it('rejects text that is not a Design', () => {
    expect(() => deserializeDesign('{"nodes": [')).toThrow(InvalidDesignError)
    expect(() => deserializeDesign('[]')).toThrow(InvalidDesignError)
  })

  it.each([
    ['nodes that are not a list', { nodes: {}, edges: [] }],
    ['an unknown component type', withNode({ componentType: 'mainframe' })],
    ['a node without an id', withNode({ id: '' })],
    ['two nodes with one id', { ...sampleDesign(), nodes: [...sampleDesign().nodes, sampleDesign().nodes[0]] }],
    ['a label that is not a string', withNode({ label: 7 })],
    ['a label over 80 characters', withNode({ label: 'x'.repeat(81) })],
    ['notes over 2000 characters', withNode({ notes: 'x'.repeat(2001) })],
    ['a position that is not a point', withNode({ position: { x: 'left', y: 0 } })],
    ['a zone id that is empty', withNode({ zoneId: '' })],
    ['an unknown option', withLoadBalancerConfig({ algorithm: 'random-ish' })],
    ['an instance count of 0', withLoadBalancerConfig({ instances: 0 })],
    ['a fractional instance count', withLoadBalancerConfig({ instances: 1.5 })],
    ['an instance count that is not a number', withLoadBalancerConfig({ instances: '2' })],
    ['an unknown config field', withLoadBalancerConfig({ colour: 'blue' })],
    [
      'read replicas on a replica',
      {
        ...sampleDesign(),
        nodes: sampleDesign().nodes.map((node) =>
          node.id === 'sql-database-1' ? { ...node, config: { role: 'replica', replicas: 2, shardKey: '', instances: 1 } } : node,
        ),
      },
    ],
    ['an edge to a missing node', withEdge({ target: 'nowhere' })],
    ['an edge from a node to itself', withEdge({ target: 'client-1' })],
    ['an unknown edge mode', withEdge({ mode: 'eventually' })],
    ['an unknown traffic kind', withEdge({ traffic: 'delete' })],
    ['two edges with one id', { ...sampleDesign(), edges: [...sampleDesign().edges, { ...sampleDesign().edges[1], id: sampleDesign().edges[0].id }] }],
  ])('rejects a Design with %s', (_, design) => {
    expect(problemsOf(design)).not.toEqual([])
    expect(() => deserializeDesign(JSON.stringify(design))).toThrow(InvalidDesignError)
  })
})

describe('config schemas', () => {
  it('give every palette component a default config that passes its own schema', () => {
    for (const componentType of PALETTE) {
      const config: Record<string, unknown> = defaultConfig(componentType)
      for (const [key, value] of Object.entries(config)) expect(configProblem(componentType, key, value)).toBeUndefined()
    }
  })

  it('reject values outside a field', () => {
    expect(configProblem('load-balancer', 'algorithm', 'hashing')).toBeUndefined()
    expect(configProblem('load-balancer', 'algorithm', 'random-ish')).toBe('not-an-option')
    expect(configProblem('load-balancer', 'instances', 0)).toBe('out-of-range')
    expect(configProblem('load-balancer', 'instances', 1001)).toBe('out-of-range')
    expect(configProblem('load-balancer', 'instances', 2.5)).toBe('not-an-integer')
    expect(configProblem('load-balancer', 'instances', '2')).toBe('not-an-integer')
    expect(configProblem('sql-database', 'replicas', -1)).toBe('out-of-range')
    expect(configProblem('sql-database', 'shardKey', 'x'.repeat(61))).toBe('too-long')
    expect(configProblem('sql-database', 'shardKey', 42)).toBe('not-text')
    expect(configProblem('client', 'instances', 1)).toBe('unknown-field')
  })

  it('reject read replicas on a node that is itself a replica', () => {
    const replica = { role: 'replica', replicas: 0, shardKey: '', instances: 1 }

    expect(configProblem('sql-database', 'replicas', 2, { ...replica, replicas: 2 })).toBe('not-applicable')
    expect(configProblem('sql-database', 'replicas', 0, replica)).toBeUndefined()
    expect(configProblem('sql-database', 'replicas', 2, { ...replica, role: 'primary' })).toBeUndefined()
    expect(isFieldApplicable(componentDefinition('nosql-store').config.replicas, { role: 'replica' })).toBe(false)
  })

  it('cover the configuration the primer teaches', () => {
    expect(Object.keys(defaultConfig('sql-database'))).toEqual(['role', 'replicas', 'shardKey', 'instances'])
    expect(componentDefinition('nosql-store').config.kind).toMatchObject({
      options: ['key-value', 'document', 'wide-column', 'graph'],
    })
    expect(componentDefinition('cache').config.strategy).toMatchObject({
      options: ['cache-aside', 'write-through', 'write-behind', 'refresh-ahead'],
    })
    expect(componentDefinition('load-balancer').config.layer).toMatchObject({ options: ['l4', 'l7'] })
  })

  it('give every component but the client a capacity, a base latency and a monthly cost per instance', () => {
    for (const componentType of PALETTE) {
      const { simulation } = componentDefinition(componentType)
      if (componentType === 'client') {
        expect(simulation).toBeUndefined()
        continue
      }
      expect(simulation?.capacityQps).toBeGreaterThan(0)
      expect(simulation?.baseLatencyMs).toBeGreaterThan(0)
      expect(simulation?.monthlyCostUsd).toBeGreaterThan(0)
    }
  })

  it("derive base latency from the primer's latency numbers", () => {
    const { simulation } = componentDefinition('sql-database')

    // One round trip within the datacenter (500 µs) and four random 4 KB SSD reads (150 µs each).
    expect(simulation?.latency).toEqual([
      { operation: 'Round trip within same datacenter', nanoseconds: 500_000, times: 1 },
      { operation: 'Read 4 KB randomly from SSD*', nanoseconds: 150_000, times: 4 },
    ])
    expect(simulation?.baseLatencyMs).toBe(1.1)
  })
})

describe('editing a Design', () => {
  it('adds a component with its default config, a numbered id and a unique label', () => {
    const first = addNode(emptyDesign(), 'cache', { x: 10, y: 20 }, 'Cache')
    const second = addNode(first.design, 'cache', { x: 30, y: 40 }, 'Cache')

    expect(first.nodeId).toBe('cache-1')
    expect(second.nodeId).toBe('cache-2')
    expect(second.design.nodes[1]).toEqual({
      id: 'cache-2',
      componentType: 'cache',
      label: 'Cache 2',
      notes: '',
      config: { strategy: 'cache-aside', eviction: 'lru', instances: 1 },
      position: { x: 30, y: 40 },
    })
  })

  it('numbers a new component after the highest number of its type in use', () => {
    let design = emptyDesign()
    for (let i = 0; i < 3; i++) design = addNode(design, 'web-server', { x: 0, y: 0 }, 'Web server').design
    design = removeElements(design, { nodeIds: ['web-server-1'] })

    const added = addNode(design, 'web-server', { x: 0, y: 0 }, 'Web server')

    expect(added.nodeId).toBe('web-server-4')
    expect(added.design.nodes.at(-1)?.label).toBe('Web server 4')
    expect(addNode(design, 'dns', { x: 0, y: 0 }, 'DNS').nodeId).toBe('dns-1')
  })

  it('connects two components with a synchronous edge carrying reads and writes', () => {
    const design = connect(sampleDesign(), 'cache-1', 'sql-database-1')

    expect(design.edges.at(-1)).toEqual({
      id: 'cache-1->sql-database-1',
      source: 'cache-1',
      target: 'sql-database-1',
      mode: 'sync',
      traffic: 'both',
    })
  })

  it('refuses an edge from a component to itself, a second edge between the same pair, or to a missing node', () => {
    expect(() => connect(sampleDesign(), 'cache-1', 'cache-1')).toThrow(RangeError)
    expect(() => connect(sampleDesign(), 'client-1', 'load-balancer-1')).toThrow(RangeError)
    expect(() => connect(sampleDesign(), 'client-1', 'nowhere')).toThrow(RangeError)
  })

  it('changes the mode and traffic kind of an edge', () => {
    const design = updateEdge(sampleDesign(), 'web-server-1->cache-1', { mode: 'async', traffic: 'write' })

    expect(design.edges.find((edge) => edge.id === 'web-server-1->cache-1')).toMatchObject({ mode: 'async', traffic: 'write' })
  })

  it('renames, annotates and moves components', () => {
    let design = renameNode(sampleDesign(), 'cache-1', 'Redis')
    design = setNodeNotes(design, 'cache-1', 'Hot pastes only.')
    design = moveNodes(design, { 'cache-1': { x: 1, y: 2 } })

    expect(design.nodes.find((node) => node.id === 'cache-1')).toMatchObject({
      label: 'Redis',
      notes: 'Hot pastes only.',
      position: { x: 1, y: 2 },
    })
  })

  it('changes a config value, and refuses an invalid one', () => {
    const design = setNodeConfig(sampleDesign(), 'sql-database-1', 'role', 'replica')

    expect(design.nodes.find((node) => node.id === 'sql-database-1')?.config).toMatchObject({ role: 'replica' })
    expect(() => setNodeConfig(sampleDesign(), 'sql-database-1', 'replicas', 99)).toThrow(RangeError)
    expect(() => setNodeConfig(sampleDesign(), 'sql-database-1', 'kind', 'graph')).toThrow(RangeError)
  })

  it('drops the read replicas of a database that becomes a replica, and refuses to add them back', () => {
    const design = setNodeConfig(sampleDesign(), 'sql-database-1', 'role', 'replica')

    expect(design.nodes.find((node) => node.id === 'sql-database-1')?.config).toMatchObject({ role: 'replica', replicas: 0 })
    expect(() => setNodeConfig(design, 'sql-database-1', 'replicas', 1)).toThrow(RangeError)
  })

  it('removes components together with their edges, and edges on their own', () => {
    const design = removeElements(sampleDesign(), { nodeIds: ['web-server-1'], edgeIds: ['message-queue-1->task-queue-1'] })

    expect(design.nodes.map((node) => node.id)).not.toContain('web-server-1')
    expect(design.edges.map((edge) => edge.id)).toEqual(['client-1->load-balancer-1'])
  })

  it('leaves the original Design unchanged', () => {
    const design = sampleDesign()
    const before = JSON.parse(JSON.stringify(design))

    renameNode(design, 'cache-1', 'Redis')
    setNodeConfig(design, 'cache-1', 'eviction', 'lfu')
    moveNodes(design, { 'cache-1': { x: 5, y: 5 } })
    removeElements(design, { nodeIds: ['cache-1'] })

    expect(design).toEqual(before)
  })
})
