import { describe, expect, it } from 'vitest'
import type { ComponentType } from '../design/components'
import { addNode, connect, emptyDesign, setNodeConfig, setNodeSimulation, updateEdge, type Design, type EdgeMode, type EdgeTraffic } from '../design/design'
import { simulate, type LoadProfile } from './simulate'

/** Adds Nodes of the given types, numbered per type (`web-server-1`, `web-server-2`, …). */
function nodes(...types: ComponentType[]): Design {
  return types.reduce((design, type) => addNode(design, type, { x: 0, y: 0 }, type).design, emptyDesign())
}

/** Connects `source → target` for each pair, carrying both reads and writes unless told otherwise. */
function edges(design: Design, ...pairs: [string, string, { traffic?: EdgeTraffic; mode?: EdgeMode }?][]): Design {
  return pairs.reduce((current, [source, target, options]) => {
    const connected = connect(current, source, target)
    return options ? updateEdge(connected, `${source}->${target}`, options) : connected
  }, design)
}

const load = (readQps: number, writeQps: number, requestBytes = 1_000): LoadProfile => ({ readQps, writeQps, requestBytes })

// Defaults per instance, from the component palette: a web server serves 1,000 QPS in 0.52 ms for $70 a month,
// a SQL database 1,000 QPS in 1.1 ms for $250, a cache 50,000 QPS in 0.501 ms for $100 with 80% hits,
// a load balancer 20,000 QPS in 0.5 ms for $25, a task queue worker 200 QPS.

describe('a single server', () => {
  const design = edges(nodes('client', 'web-server'), ['client-1', 'web-server-1'])

  it('under capacity: utilisation is load over capacity, and latency grows by 1 / (1 − ρ)', () => {
    const result = simulate(design, load(300, 200))

    expect(result.nodes['web-server-1']).toMatchObject({ readQps: 300, writeQps: 200, loadQps: 500, capacityQps: 1_000, utilisation: 0.5, overloaded: false, droppedQps: 0 })
    expect(result.nodes['web-server-1'].latencyMs).toBeCloseTo(1.04, 9)
    expect(result.errorRate).toBe(0)
    expect(result.monthlyCostUsd).toBe(70)
  })

  it('over capacity: is overloaded, drops the excess as errors and caps its latency at 10 times the base', () => {
    const result = simulate(design, load(1_500, 500))

    expect(result.nodes['web-server-1']).toMatchObject({ loadQps: 2_000, utilisation: 2, overloaded: true, droppedQps: 1_000 })
    expect(result.nodes['web-server-1'].latencyMs).toBeCloseTo(5.2, 9)
    expect(result.droppedQps).toBe(1_000)
    expect(result.errorRate).toBe(0.5)
  })

  it('scales its capacity and cost with its instances', () => {
    const result = simulate(setNodeConfig(design, 'web-server-1', 'instances', 4), load(1_500, 500))

    expect(result.nodes['web-server-1']).toMatchObject({ capacityQps: 4_000, utilisation: 0.5, overloaded: false })
    expect(result.monthlyCostUsd).toBe(280)
  })

  it('uses the capacity, latency and cost set on the Node', () => {
    let tuned = setNodeSimulation(design, 'web-server-1', 'capacityQps', 2_500)
    tuned = setNodeSimulation(tuned, 'web-server-1', 'baseLatencyMs', 2)
    tuned = setNodeSimulation(tuned, 'web-server-1', 'monthlyCostUsd', 10)
    const result = simulate(tuned, load(1_500, 500))

    expect(result.nodes['web-server-1'].utilisation).toBe(0.8)
    expect(result.nodes['web-server-1'].latencyMs).toBeCloseTo(10, 9)
    expect(result.monthlyCostUsd).toBe(10)
  })

  it('passes on only what it serves', () => {
    const chain = edges(nodes('client', 'web-server', 'sql-database'), ['client-1', 'web-server-1'], ['web-server-1', 'sql-database-1'])

    expect(simulate(chain, load(2_000, 0)).nodes['sql-database-1'].readQps).toBe(1_000)
  })

  it('moves the load profile’s bytes with each request', () => {
    expect(simulate(design, load(300, 200, 2_000)).nodes['web-server-1'].bandwidthBytesPerSecond).toBe(1_000_000)
  })
})

describe('end-to-end latency per request path', () => {
  it('adds up the latency of each Node on the way', () => {
    const design = edges(nodes('client', 'web-server', 'sql-database'), ['client-1', 'web-server-1'], ['web-server-1', 'sql-database-1'])
    const result = simulate(design, load(400, 100))

    // Web server: ρ 0.5 → 1.04 ms; database: ρ 0.5 → 2.2 ms.
    expect(result.paths).toHaveLength(2)
    expect(result.paths[0]).toMatchObject({ kind: 'read', nodeIds: ['client-1', 'web-server-1', 'sql-database-1'], share: 1, errorRate: 0 })
    expect(result.paths[0].latencyMs).toBeCloseTo(3.24, 9)
    expect(result.meanLatencyMs.read).toBeCloseTo(3.24, 9)
    expect(result.meanLatencyMs.write).toBeCloseTo(3.24, 9)
  })

  it('adds up the calls a request makes, and weights a cache-aside miss by its share', () => {
    const design = edges(
      nodes('client', 'app-service', 'cache', 'sql-database'),
      ['client-1', 'app-service-1'],
      ['app-service-1', 'cache-1'],
      ['app-service-1', 'sql-database-1'],
    )
    const result = simulate(setNodeConfig(design, 'app-service-1', 'instances', 4), load(1_000, 0))

    // App: ρ 0.5 → 3 ms; cache: ρ 0.02; database: 200 misses, ρ 0.2. Every read asks the cache, a fifth the database too.
    expect(result.meanLatencyMs.read).toBeCloseTo(3 + 0.501 / 0.98 + 0.2 * (1.1 / 0.8), 9)
  })

  it('fails a request when any Node it needs drops it', () => {
    const design = edges(
      nodes('client', 'app-service', 'sql-database', 'nosql-store'),
      ['client-1', 'app-service-1'],
      ['app-service-1', 'sql-database-1'],
      ['app-service-1', 'nosql-store-1'],
    )
    const result = simulate(setNodeConfig(design, 'app-service-1', 'instances', 10), load(2_000, 0))

    // The SQL database serves half its 2,000 reads; the key-value store serves all.
    expect(result.errorRate).toBeCloseTo(0.5, 9)
  })

  it('sends nothing from a client connected to nothing', () => {
    const design = edges(nodes('client', 'client', 'web-server'), ['client-1', 'web-server-1'])
    const result = simulate(design, load(1_500, 0))

    expect(result.nodes['web-server-1']).toMatchObject({ readQps: 1_500, overloaded: true })
    expect(result.paths.map((path) => path.nodeIds)).toEqual([['client-1', 'web-server-1']])
  })

  it('splits the traffic of several clients evenly', () => {
    const design = edges(nodes('client', 'client', 'web-server'), ['client-1', 'web-server-1'], ['client-2', 'web-server-1'])
    const result = simulate(design, load(600, 0))

    expect(result.nodes['client-1'].readQps).toBe(300)
    expect(result.nodes['web-server-1'].readQps).toBe(600)
    expect(result.paths.map((path) => path.share)).toEqual([0.5, 0.5])
  })
})

describe('a load balancer', () => {
  const design = edges(
    nodes('client', 'load-balancer', 'web-server', 'web-server'),
    ['client-1', 'load-balancer-1'],
    ['load-balancer-1', 'web-server-1'],
    ['load-balancer-1', 'web-server-2'],
  )

  it('splits evenly with round robin', () => {
    const result = simulate(design, load(1_600, 0))

    expect(result.nodes['load-balancer-1'].utilisation).toBe(0.08)
    expect(result.nodes['web-server-1']).toMatchObject({ readQps: 800, utilisation: 0.8 })
    expect(result.nodes['web-server-2']).toMatchObject({ readQps: 800, utilisation: 0.8 })
    expect(result.nodes['web-server-1'].latencyMs).toBeCloseTo(2.6, 9)
    expect(result.paths.map((path) => path.share)).toEqual([0.5, 0.5])
    expect(result.edges['load-balancer-1->web-server-1']).toEqual({ readQps: 800, writeQps: 0 })
  })

  it('splits by capacity with least connections', () => {
    let weighted = setNodeConfig(design, 'load-balancer-1', 'algorithm', 'least-connections')
    weighted = setNodeConfig(weighted, 'web-server-2', 'instances', 3)
    const result = simulate(weighted, load(1_600, 0))

    expect(result.nodes['web-server-1']).toMatchObject({ readQps: 400, utilisation: 0.4 })
    expect(result.nodes['web-server-2']).toMatchObject({ readQps: 1_200, utilisation: 0.4 })
  })
})

describe('a cache', () => {
  it('forwards only its misses (1 − hit ratio) to the database behind it', () => {
    const design = edges(
      nodes('client', 'app-service', 'cache', 'sql-database'),
      ['client-1', 'app-service-1'],
      ['app-service-1', 'cache-1'],
      ['cache-1', 'sql-database-1'],
    )
    const result = simulate(setNodeConfig(design, 'app-service-1', 'instances', 4), load(1_000, 100))

    expect(result.nodes['cache-1']).toMatchObject({ readQps: 1_000, writeQps: 100 })
    expect(result.nodes['sql-database-1']).toMatchObject({ readQps: expect.closeTo(200, 9), writeQps: 100, utilisation: expect.closeTo(0.3, 9) })
    // A hit ends at the cache; a miss goes on to the database.
    const reads = result.paths.filter((path) => path.kind === 'read')
    expect(reads.map((path) => [path.nodeIds.at(-1), path.share])).toEqual([
      ['cache-1', 0.8],
      ['sql-database-1', expect.closeTo(0.2, 9)],
    ])
  })

  it('beside the database (cache-aside), takes the hits off the database', () => {
    const design = edges(
      nodes('client', 'app-service', 'cache', 'sql-database'),
      ['client-1', 'app-service-1'],
      ['app-service-1', 'cache-1'],
      ['app-service-1', 'sql-database-1'],
    )
    const result = simulate(setNodeConfig(design, 'app-service-1', 'instances', 4), load(1_000, 100))

    expect(result.nodes['sql-database-1'].readQps).toBeCloseTo(200, 9)
    expect(result.nodes['sql-database-1'].writeQps).toBe(100)
  })

  it('uses the hit ratio set on the Node', () => {
    const design = edges(nodes('client', 'cache', 'sql-database'), ['client-1', 'cache-1'], ['cache-1', 'sql-database-1'])

    expect(simulate(setNodeSimulation(design, 'cache-1', 'hitRatio', 0.5), load(1_000, 0)).nodes['sql-database-1'].readQps).toBe(500)
  })

  it('beside storage other than a database, leaves it every read', () => {
    const design = edges(nodes('client', 'app-service', 'cache', 'object-store'), ['client-1', 'app-service-1'], ['app-service-1', 'cache-1'], ['app-service-1', 'object-store-1'])

    expect(simulate(design, load(100, 0)).nodes['object-store-1'].readQps).toBe(100)
  })
})

describe('replicas', () => {
  it('serve the reads while the primary takes the writes and replicates them', () => {
    let design = edges(
      nodes('client', 'app-service', 'sql-database', 'sql-database', 'sql-database'),
      ['client-1', 'app-service-1'],
      ['app-service-1', 'sql-database-1'],
      ['app-service-1', 'sql-database-2'],
      ['app-service-1', 'sql-database-3'],
      ['sql-database-1', 'sql-database-2'],
      ['sql-database-1', 'sql-database-3'],
    )
    design = setNodeConfig(design, 'app-service-1', 'instances', 4)
    design = setNodeConfig(setNodeConfig(design, 'sql-database-2', 'role', 'replica'), 'sql-database-3', 'role', 'replica')
    const result = simulate(design, load(1_000, 100))

    expect(result.nodes['sql-database-1']).toMatchObject({ readQps: 0, writeQps: 100 })
    expect(result.nodes['sql-database-2']).toMatchObject({ readQps: 500, writeQps: 100 })
    expect(result.nodes['sql-database-3']).toMatchObject({ readQps: 500, writeQps: 100 })
  })

  it('belong to the primary that replicates to them', () => {
    let design = edges(
      nodes('client', 'app-service', 'sql-database', 'sql-database', 'sql-database', 'sql-database'),
      ['client-1', 'app-service-1'],
      ['app-service-1', 'sql-database-1'],
      ['app-service-1', 'sql-database-2'],
      ['app-service-1', 'sql-database-3'],
      ['app-service-1', 'sql-database-4'],
      ['sql-database-1', 'sql-database-2'],
      ['sql-database-3', 'sql-database-4'],
    )
    design = setNodeConfig(design, 'app-service-1', 'instances', 4)
    design = setNodeConfig(setNodeConfig(design, 'sql-database-2', 'role', 'replica'), 'sql-database-4', 'role', 'replica')
    const result = simulate(design, load(400, 0))

    // Two separate databases, each read in full: their replicas do not share each other's reads.
    expect(result.nodes['sql-database-2'].readQps).toBe(400)
    expect(result.nodes['sql-database-4'].readQps).toBe(400)
    expect(result.nodes['sql-database-1'].readQps).toBe(0)
  })

  it('configured on a primary, share its reads and add to its cost', () => {
    let design = edges(nodes('client', 'sql-database'), ['client-1', 'sql-database-1'])
    design = setNodeConfig(design, 'sql-database-1', 'replicas', 3)
    const result = simulate(design, load(1_000, 100))

    // Each of the 4 copies serves a quarter of the reads and applies every write.
    expect(result.nodes['sql-database-1'].utilisation).toBeCloseTo(0.35, 9)
    // So for this mix it serves 1,100 ÷ 0.35 requests a second before it is overloaded.
    expect(result.nodes['sql-database-1'].capacityQps).toBeCloseTo(1_100 / 0.35, 6)
    expect(result.monthlyCostUsd).toBe(1_000)
  })
})

describe('a queue', () => {
  const design = edges(
    nodes('client', 'app-service', 'message-queue', 'task-queue'),
    ['client-1', 'app-service-1'],
    ['app-service-1', 'message-queue-1'],
    ['message-queue-1', 'task-queue-1'],
  )

  it('defers work to its consumer: an overloaded worker builds a backlog instead of failing requests', () => {
    const result = simulate(design, load(0, 300))

    expect(result.nodes['task-queue-1']).toMatchObject({ writeQps: 300, utilisation: 1.5, overloaded: true, deferred: true, droppedQps: 0, backlogQps: 100 })
    expect(result.errorRate).toBe(0)
    expect(result.droppedQps).toBe(0)
  })

  it('ends the request path: the consumer adds no latency', () => {
    const result = simulate(design, load(0, 100))

    expect(result.paths.map((path) => path.nodeIds)).toEqual([['client-1', 'app-service-1', 'message-queue-1']])
  })

  it('shares the excess of a Node reached both ways between dropped requests and backlog', () => {
    const design = edges(
      nodes('client', 'app-service', 'message-queue', 'web-server'),
      ['client-1', 'app-service-1'],
      ['client-1', 'message-queue-1'],
      ['app-service-1', 'web-server-1'],
      ['message-queue-1', 'web-server-1'],
    )
    const result = simulate(setNodeConfig(design, 'app-service-1', 'instances', 4), load(1_600, 0))

    // 3,200 requests for 1,000 of capacity: half the 2,200 excess comes in the request path, half through the queue.
    expect(result.nodes['web-server-1']).toMatchObject({ loadQps: 3_200, deferred: false, droppedQps: 1_100, backlogQps: 1_100 })
  })

  it('treats an asynchronous Edge the same way', () => {
    const async = edges(nodes('client', 'web-server', 'analytics'), ['client-1', 'web-server-1'], ['web-server-1', 'analytics-1', { mode: 'async' }])
    const result = simulate(async, load(100, 0))

    expect(result.nodes['analytics-1']).toMatchObject({ readQps: 100, deferred: true, backlogQps: 50 })
    expect(result.paths.map((path) => path.nodeIds)).toEqual([['client-1', 'web-server-1']])
  })
})

describe('routing by traffic', () => {
  it('sends reads and writes only along the Edges that carry them', () => {
    const design = edges(
      nodes('client', 'app-service', 'app-service'),
      ['client-1', 'app-service-1', { traffic: 'read' }],
      ['client-1', 'app-service-2', { traffic: 'write' }],
    )
    const result = simulate(design, load(300, 100))

    expect(result.nodes['app-service-1']).toMatchObject({ readQps: 300, writeQps: 0 })
    expect(result.nodes['app-service-2']).toMatchObject({ readQps: 0, writeQps: 100 })
  })

  it('stops at storage: a database does not pass reads on', () => {
    const design = edges(nodes('client', 'sql-database', 'data-warehouse'), ['client-1', 'sql-database-1'], ['sql-database-1', 'data-warehouse-1'])
    const result = simulate(design, load(50, 20))

    expect(result.nodes['data-warehouse-1']).toMatchObject({ readQps: 0, writeQps: 20 })
  })

  it('follows a cycle once', () => {
    const design = edges(nodes('client', 'web-server', 'app-service'), ['client-1', 'web-server-1'], ['web-server-1', 'app-service-1'], ['app-service-1', 'web-server-1'])

    expect(simulate(design, load(100, 0)).nodes['web-server-1'].readQps).toBe(100)
  })

  it('has no load without a client', () => {
    const result = simulate(nodes('web-server'), load(100, 100))

    expect(result.nodes['web-server-1'].loadQps).toBe(0)
    expect(result.paths).toEqual([])
    expect(result.meanLatencyMs).toEqual({})
    expect(result.errorRate).toBe(0)
  })
})

describe('the summary', () => {
  it('ranks bottlenecks by utilisation, most loaded first', () => {
    const design = edges(
      nodes('client', 'load-balancer', 'web-server', 'sql-database'),
      ['client-1', 'load-balancer-1'],
      ['load-balancer-1', 'web-server-1'],
      ['web-server-1', 'sql-database-1'],
    )
    const result = simulate(setNodeConfig(design, 'web-server-1', 'instances', 2), load(900, 0))

    expect(result.bottlenecks).toEqual(['sql-database-1', 'web-server-1', 'load-balancer-1'])
  })

  it('is the same every time', () => {
    const design = edges(nodes('client', 'cache', 'sql-database'), ['client-1', 'cache-1'], ['cache-1', 'sql-database-1'])

    expect(simulate(design, load(5_000, 500))).toEqual(simulate(design, load(5_000, 500)))
  })
})
