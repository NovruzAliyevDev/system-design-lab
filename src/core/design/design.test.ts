import { describe, expect, it } from 'vitest'
import { componentDefinition, configProblem, defaultConfig, isFieldApplicable, PALETTE, paletteGlossaryProblems } from './components'
import {
  addNode,
  addZone,
  connect,
  deserializeDesign,
  emptyDesign,
  InvalidDesignError,
  moveElements,
  moveNodes,
  moveZone,
  NODE_SIZE,
  nodeCentre,
  readDesign,
  removeElements,
  renameNode,
  renameZone,
  serializeDesign,
  setNodeConfig,
  setNodeNotes,
  setNodeSimulation,
  nodeSimulation,
  setZoneBounds,
  updateEdge,
  zoneAt,
  ZONE_MIN_SIZE,
  type Design,
  type Position,
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
    zones: [{ id: 'us-east-1a', label: 'us-east-1a', position: { x: 160, y: -40 }, size: { width: 260, height: 160 } }],
    classes: [],
    relations: [],
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

const withZone = (change: Record<string, unknown>) => {
  const design = sampleDesign()
  return { ...design, zones: design.zones.map((zone) => ({ ...zone, ...change })) }
}

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
    expect(deserializeDesign(serializeDesign(emptyDesign()))).toEqual({ nodes: [], edges: [], zones: [], classes: [], relations: [] })
  })

  it('reads a Design stored before zones existed as one without zones', () => {
    const { zones: _, ...stored } = sampleDesign()
    const nodes = stored.nodes.map(({ zoneId: __, ...node }) => node)

    expect(readDesign({ ...stored, nodes }).design?.zones).toEqual([])
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
    ['a zone id that names no zone', withNode({ zoneId: 'eu-west-1a' })],
    ['zones that are not a list', { ...sampleDesign(), zones: {} }],
    ['a zone without an id', withZone({ id: '' })],
    ['two zones with one id', { ...sampleDesign(), zones: [...sampleDesign().zones, sampleDesign().zones[0]] }],
    ['a zone label over 80 characters', withZone({ label: 'x'.repeat(81) })],
    ['a zone without a size', withZone({ size: undefined })],
    ['a zone of no width', withZone({ size: { width: 0, height: 100 } })],
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

  it('name a Glossary Term explaining every palette component, and report the ones a Glossary lacks', () => {
    const termIds = PALETTE.map((componentType) => componentDefinition(componentType).glossaryTermId)

    expect(componentDefinition('load-balancer').glossaryTermId).toBe('load-balancer')
    expect(new Set(termIds).size).toBe(PALETTE.length)
    expect(paletteGlossaryProblems(termIds.map((id) => ({ id })))).toEqual([])
    expect(paletteGlossaryProblems(termIds.filter((id) => id !== 'cache').map((id) => ({ id })))).toEqual([
      'Component type "cache": no Glossary Term "cache" explains it',
    ])
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


/** A Node's top-left corner that puts its centre on `point`. */
const nodeAt = (point: Position): Position => ({ x: point.x - NODE_SIZE.width / 2, y: point.y - NODE_SIZE.height / 2 })

const zoneOf = (design: Design, nodeId: string) => design.nodes.find((node) => node.id === nodeId)?.zoneId

/** Two web servers, centred on (100, 100) and (500, 100). */
function twoServers(): Design {
  let design = addNode(emptyDesign(), 'web-server', nodeAt({ x: 100, y: 100 }), 'Web').design
  design = addNode(design, 'web-server', nodeAt({ x: 500, y: 100 }), 'Web').design
  return design
}

describe('zones', () => {
  it('adds a zone box with a numbered id and label, and puts the Nodes whose centre it covers in it', () => {
    const first = addZone(twoServers(), { x: 0, y: 0 }, { width: 300, height: 200 }, 'Zone')
    const second = addZone(first.design, { x: 400, y: 0 }, { width: 300, height: 200 }, 'Zone')

    expect(first.zoneId).toBe('zone-1')
    expect(second.zoneId).toBe('zone-2')
    expect(second.design.zones).toEqual([
      { id: 'zone-1', label: 'Zone', position: { x: 0, y: 0 }, size: { width: 300, height: 200 } },
      { id: 'zone-2', label: 'Zone 2', position: { x: 400, y: 0 }, size: { width: 300, height: 200 } },
    ])
    expect(zoneOf(second.design, 'web-server-1')).toBe('zone-1')
    expect(zoneOf(second.design, 'web-server-2')).toBe('zone-2')
  })

  it('keeps a zone at least the minimum size', () => {
    const { design } = addZone(emptyDesign(), { x: 0, y: 0 }, { width: 10, height: 10 }, 'Zone')

    expect(design.zones[0].size).toEqual(ZONE_MIN_SIZE)
  })

  it('puts a Node in the innermost zone around its centre, e.g. an availability zone inside a region', () => {
    let design = addZone(twoServers(), { x: -100, y: -100 }, { width: 800, height: 400 }, 'Region').design
    design = addZone(design, { x: 0, y: 0 }, { width: 300, height: 200 }, 'AZ').design

    expect(zoneOf(design, 'web-server-1')).toBe('zone-2')
    expect(zoneOf(design, 'web-server-2')).toBe('zone-1')
    expect(zoneAt(design, { x: 100, y: 100 })).toBe('zone-2')
    expect(zoneAt(design, { x: 1000, y: 100 })).toBeUndefined()
  })

  it('assigns a Node to the zone it is added in or moved into, and takes it out when moved out', () => {
    const zoned = addZone(emptyDesign(), { x: 0, y: 0 }, { width: 300, height: 200 }, 'Zone').design
    const added = addNode(zoned, 'cache', nodeAt({ x: 150, y: 100 }), 'Cache')

    expect(zoneOf(added.design, 'cache-1')).toBe('zone-1')

    const movedOut = moveNodes(added.design, { 'cache-1': nodeAt({ x: 600, y: 100 }) })
    expect(zoneOf(movedOut, 'cache-1')).toBeUndefined()
    expect(movedOut.nodes[0]).not.toHaveProperty('zoneId')

    expect(zoneOf(moveNodes(movedOut, { 'cache-1': nodeAt({ x: 50, y: 50 }) }), 'cache-1')).toBe('zone-1')
  })

  it('resizes a zone and reassigns the Nodes it now covers or no longer covers', () => {
    const { design } = addZone(twoServers(), { x: 0, y: 0 }, { width: 300, height: 200 }, 'Zone')

    const grown = setZoneBounds(design, 'zone-1', { x: 0, y: 0 }, { width: 700, height: 200 })
    expect(grown.zones[0].size).toEqual({ width: 700, height: 200 })
    expect(zoneOf(grown, 'web-server-2')).toBe('zone-1')

    const moved = setZoneBounds(grown, 'zone-1', { x: 300, y: 0 }, { width: 400, height: 200 })
    expect(zoneOf(moved, 'web-server-1')).toBeUndefined()
    expect(zoneOf(moved, 'web-server-2')).toBe('zone-1')
  })

  it('moves a zone together with its Nodes and the zones inside it', () => {
    let design = addZone(twoServers(), { x: -100, y: -100 }, { width: 400, height: 400 }, 'Region').design
    design = addZone(design, { x: -50, y: -50 }, { width: 300, height: 200 }, 'AZ').design

    const moved = moveZone(design, 'zone-1', { x: 900, y: -100 })

    expect(moved.zones.map((zone) => zone.position)).toEqual([
      { x: 900, y: -100 },
      { x: 950, y: -50 },
    ])
    expect(nodeCentre(moved.nodes[0].position)).toEqual({ x: 1100, y: 100 })
    expect(zoneOf(moved, 'web-server-1')).toBe('zone-2')
    // The server outside the region stays where it was.
    expect(nodeCentre(moved.nodes[1].position)).toEqual({ x: 500, y: 100 })
  })

  it('moves a selection of zones and Nodes together, each to where it was dragged', () => {
    let design = addZone(twoServers(), { x: 0, y: 0 }, { width: 300, height: 200 }, 'AZ').design
    design = addNode(design, 'cache', nodeAt({ x: 900, y: 100 }), 'Cache').design

    // The zone, the server in it and the lone cache were all selected and dragged 100 down.
    const moved = moveElements(design, {
      'zone-1': { x: 0, y: 100 },
      'web-server-1': nodeAt({ x: 100, y: 200 }),
      'cache-1': nodeAt({ x: 900, y: 200 }),
    })

    expect(moved.zones[0].position).toEqual({ x: 0, y: 100 })
    expect(moved.nodes.map((node) => nodeCentre(node.position))).toEqual([
      { x: 100, y: 200 },
      { x: 500, y: 100 },
      { x: 900, y: 200 },
    ])
    expect(zoneOf(moved, 'web-server-1')).toBe('zone-1')
    // Dragged alone, the zone still takes its Nodes along.
    expect(nodeCentre(moveElements(design, { 'zone-1': { x: 0, y: 100 } }).nodes[0].position)).toEqual({ x: 100, y: 200 })
  })

  it('renames a zone, and refuses a label over 80 characters', () => {
    const { design } = addZone(emptyDesign(), { x: 0, y: 0 }, { width: 300, height: 200 }, 'Zone')

    expect(renameZone(design, 'zone-1', 'eu-west-1a').zones[0].label).toBe('eu-west-1a')
    expect(() => renameZone(design, 'zone-1', 'x'.repeat(81))).toThrow(RangeError)
    expect(() => renameZone(design, 'zone-9', 'AZ')).toThrow(RangeError)
  })

  it('removes a zone box but keeps its Nodes, which fall to the zone around it', () => {
    let design = addZone(twoServers(), { x: -100, y: -100 }, { width: 800, height: 400 }, 'Region').design
    design = addZone(design, { x: 0, y: 0 }, { width: 300, height: 200 }, 'AZ').design

    const removed = removeElements(design, { zoneIds: ['zone-2'] })

    expect(removed.zones.map((zone) => zone.id)).toEqual(['zone-1'])
    expect(removed.nodes).toHaveLength(2)
    expect(zoneOf(removed, 'web-server-1')).toBe('zone-1')
  })

  it('numbers a new zone after the highest in use', () => {
    let design = addZone(emptyDesign(), { x: 0, y: 0 }, ZONE_MIN_SIZE, 'Zone').design
    design = addZone(design, { x: 0, y: 0 }, ZONE_MIN_SIZE, 'Zone').design
    design = removeElements(design, { zoneIds: ['zone-1'] })

    expect(addZone(design, { x: 0, y: 0 }, ZONE_MIN_SIZE, 'Zone').zoneId).toBe('zone-3')
  })
})

describe('simulation settings of a Node', () => {
  const design = addNode(addNode(emptyDesign(), 'cache', { x: 0, y: 0 }, 'Cache').design, 'client', { x: 0, y: 100 }, 'Users').design

  it('start from the component defaults, which a Node can override one by one', () => {
    expect(nodeSimulation(design.nodes[0])).toEqual({ ...componentDefinition('cache').simulation })
    const tuned = setNodeSimulation(setNodeSimulation(design, 'cache-1', 'capacityQps', 80_000), 'cache-1', 'hitRatio', 0.95)

    expect(tuned.nodes[0].simulation).toEqual({ capacityQps: 80_000, hitRatio: 0.95 })
    expect(nodeSimulation(tuned.nodes[0])).toMatchObject({ capacityQps: 80_000, hitRatio: 0.95, baseLatencyMs: 0.501, monthlyCostUsd: 100 })
  })

  it('go back to the default when cleared', () => {
    const tuned = setNodeSimulation(design, 'cache-1', 'monthlyCostUsd', 5)

    expect(setNodeSimulation(tuned, 'cache-1', 'monthlyCostUsd', undefined).nodes[0]).not.toHaveProperty('simulation')
  })

  it('refuses values that make no sense, and settings a component does not have', () => {
    expect(() => setNodeSimulation(design, 'cache-1', 'capacityQps', 0)).toThrow(RangeError)
    expect(() => setNodeSimulation(design, 'cache-1', 'baseLatencyMs', -1)).toThrow(RangeError)
    expect(() => setNodeSimulation(design, 'cache-1', 'monthlyCostUsd', Number.NaN)).toThrow(RangeError)
    expect(() => setNodeSimulation(design, 'cache-1', 'hitRatio', 1.5)).toThrow(RangeError)
    expect(() => setNodeSimulation(addNode(design, 'web-server', { x: 0, y: 0 }, 'Web').design, 'web-server-1', 'hitRatio', 0.5)).toThrow(RangeError)
    expect(() => setNodeSimulation(design, 'client-1', 'capacityQps', 10)).toThrow(RangeError)
  })

  it('are kept when the Design is stored and read back, and checked when read', () => {
    const tuned = setNodeSimulation(design, 'cache-1', 'hitRatio', 0.5)
    const stored = JSON.parse(serializeDesign(tuned))

    expect(deserializeDesign(serializeDesign(tuned))).toEqual(tuned)
    stored.nodes[0].simulation = { hitRatio: 2 }
    expect(readDesign(stored).problems).toEqual(['node 1: simulation "hitRatio": not-a-share'])
  })
})
