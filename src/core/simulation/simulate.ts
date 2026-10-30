import type { ComponentType } from '../design/components'
import { nodeSimulation, type Design, type DesignEdge, type DesignNode } from '../design/design'

// The Traffic Simulation, simple mode: steady load pushed through a Design, deterministic and explainable.
// Traffic enters at the clients and each Node passes on what it serves, by what kind of component it is.

/** The traffic the clients send, shared evenly among the clients connected to something. */
export interface LoadProfile {
  readQps: number
  writeQps: number
  /** What each request carries, for the bandwidth through each Node. */
  requestBytes: number
}

/** A Chaos Scenario applied before routing. Accepted but not used yet: Chaos Scenarios join with their ticket. */
export type ChaosScenario = Record<string, never>

/** Only the simple model so far; a realistic queueing model comes later behind the same signature. */
export type SimulationMode = 'simple'

export type RequestKind = 'read' | 'write'

const KINDS: RequestKind[] = ['read', 'write']

/** Requests per second of each kind, e.g. along an Edge. */
export interface Traffic {
  readQps: number
  writeQps: number
}

export interface NodeMetrics extends Traffic {
  /** Requests reaching the Node: reads plus writes. */
  loadQps: number
  /**
   * What the Node serves before it is overloaded, for this mix of reads and writes; none for a client.
   * It is capacity × instances, except that each copy of a primary with replicas serves a share of the reads.
   */
  capacityQps?: number
  /** ρ = load ÷ capacity; 0 for a client. */
  utilisation: number
  /** Base latency × 1 / (1 − ρ), at most `LATENCY_CAP` times the base. */
  latencyMs: number
  monthlyCostUsd: number
  /** ρ ≥ 1. */
  overloaded: boolean
  /** Reached only through a queue or an asynchronous Edge, so its excess waits instead of failing requests. */
  deferred: boolean
  /** The excess of the requests in the request path, which fail. */
  droppedQps: number
  /** The excess of deferred work, which piles up. */
  backlogQps: number
  bandwidthBytesPerSecond: number
}

/** The way one kind of request goes from a client until it is answered, or handed to a queue. */
export interface RequestPath {
  kind: RequestKind
  nodeIds: string[]
  /** The share of that kind's requests that takes this path. Requests calling several Nodes take several paths. */
  share: number
  /** The sum of the latencies of the Nodes on it. */
  latencyMs: number
  /** The share of requests on it that some Node drops. */
  errorRate: number
}

export interface SimulationResult {
  /** Node id → its metrics; every Node of the Design has some. */
  nodes: Record<string, NodeMetrics>
  /** Edge id → the requests along it. */
  edges: Record<string, Traffic>
  /** The paths with the largest shares first, at most `MAX_PATHS`. */
  paths: RequestPath[]
  /**
   * Per kind with traffic, how long a request takes on average: the calls it makes one after another add
   * up, and each of the alternatives it may take (a load balancer's targets, a cache hit or miss) counts
   * by its share.
   */
  meanLatencyMs: Partial<Record<RequestKind, number>>
  /** The share of client requests that fail, from 0 to 1: a request fails when any Node it needs drops it. */
  errorRate: number
  droppedQps: number
  monthlyCostUsd: number
  /** Node ids with load, most utilised first. */
  bottlenecks: string[]
}

/** A Node's latency grows with its load up to this many times its base latency. */
export const LATENCY_CAP = 10

/** At most this many request paths are listed. */
export const MAX_PATHS = 100

/** Components that keep data: they answer reads themselves and pass on only writes (replication, indexing). */
const STORAGE: ReadonlySet<ComponentType> = new Set(['sql-database', 'nosql-store', 'object-store', 'search-index', 'data-warehouse'])
/** Storage a cache beside it (cache-aside) takes reads off. */
const DATABASES: ReadonlySet<ComponentType> = new Set(['sql-database', 'nosql-store'])
const QUEUES: ReadonlySet<ComponentType> = new Set(['message-queue', 'task-queue'])

interface Route {
  edge: DesignEdge
  /** The share of what the Node serves of a kind that goes along the Edge. */
  fraction: number
  /** Routes of one group are alternatives (a load balancer's targets, a primary's replicas); others are calls a request makes. */
  group?: string
}

export function simulate(design: Design, load: LoadProfile, _scenario?: ChaosScenario, _mode: SimulationMode = 'simple'): SimulationResult {
  const graph = graphOf(design)
  const routesOf = (node: DesignNode, kind: RequestKind) => routes(node, kind, graph)
  // A client connected to nothing sends nothing.
  const clients = design.nodes.filter((node) => node.componentType === 'client' && (graph.outgoing.get(node.id) ?? []).length > 0)

  const inflow = new Map(design.nodes.map((node) => [node.id, { all: noTraffic(), sync: noTraffic() }]))
  for (const client of clients) {
    const sent = { readQps: load.readQps / clients.length, writeQps: load.writeQps / clients.length }
    inflow.set(client.id, { all: sent, sync: { ...sent } })
  }

  const nodes: Record<string, NodeMetrics> = {}
  const edges: Record<string, Traffic> = Object.fromEntries(design.edges.map((edge) => [edge.id, noTraffic()]))
  /** Node id → the share of its requests in the request path that it serves. */
  const servedShare = new Map<string, number>()

  for (const node of graph.order) {
    const flow = inflow.get(node.id)!
    const metrics = nodeMetrics(node, flow, load.requestBytes)
    nodes[node.id] = metrics
    const served = metrics.utilisation < 1 ? 1 : 1 / metrics.utilisation
    servedShare.set(node.id, served)
    for (const kind of KINDS) {
      for (const { edge, fraction } of routesOf(node, kind)) {
        // Work handed to a queue, or along an asynchronous Edge, is deferred from then on.
        const sync = edge.mode === 'sync' && !QUEUES.has(node.componentType)
        const target = inflow.get(edge.target)!
        add(target.all, kind, qpsOf(flow.all, kind) * served * fraction)
        if (sync) add(target.sync, kind, qpsOf(flow.sync, kind) * served * fraction)
        add(edges[edge.id], kind, qpsOf(flow.all, kind) * served * fraction)
      }
    }
  }

  /** The Edges a request waits on: not to a queue's consumer, nor asynchronous ones. */
  const callsOf = (node: DesignNode, kind: RequestKind) => (QUEUES.has(node.componentType) ? [] : routesOf(node, kind).filter(({ edge }) => edge.mode === 'sync'))

  // The expected latency and success of a request reaching a Node, with the calls it makes from there.
  const expected = new Map<string, { latencyMs: number; success: number }>()
  const expect = (node: DesignNode, kind: RequestKind): { latencyMs: number; success: number } => {
    const key = `${kind}:${node.id}`
    const known = expected.get(key)
    if (known) return known
    const calls = callsOf(node, kind)
    let latencyMs = nodes[node.id].latencyMs
    const failures = new Map<string, number>()
    for (const { edge, fraction, group } of calls) {
      const next = expect(graph.byId.get(edge.target)!, kind)
      latencyMs += fraction * next.latencyMs
      const groupKey = group ?? edge.id
      failures.set(groupKey, (failures.get(groupKey) ?? 0) + fraction * (1 - next.success))
    }
    const success = [...failures.values()].reduce((product, failure) => product * (1 - failure), servedShare.get(node.id) ?? 1)
    const result = { latencyMs, success }
    expected.set(key, result)
    return result
  }

  const meanLatencyMs: Partial<Record<RequestKind, number>> = {}
  let failed = 0
  const paths: RequestPath[] = []
  for (const kind of KINDS) {
    const qps = kind === 'read' ? load.readQps : load.writeQps
    if (qps <= 0 || clients.length === 0) continue
    const perClient = clients.map((client) => expect(client, kind))
    meanLatencyMs[kind] = perClient.reduce((sum, { latencyMs }) => sum + latencyMs, 0) / clients.length
    failed += qps * (1 - perClient.reduce((sum, { success }) => sum + success, 0) / clients.length)
    for (const client of clients) walk(client, [client.id], 1 / clients.length, 0, 1)

    function walk(node: DesignNode, nodeIds: string[], share: number, latencyMs: number, success: number) {
      if (paths.length >= MAX_PATHS * 4) return
      const pathLatency = latencyMs + nodes[node.id].latencyMs
      const pathSuccess = success * (servedShare.get(node.id) ?? 1)
      const end = (endShare: number) => {
        if (endShare > 0) paths.push({ kind, nodeIds, share: endShare, latencyMs: pathLatency, errorRate: 1 - pathSuccess })
      }
      const calls = callsOf(node, kind)
      if (calls.length === 0) return end(share)
      // A cache answers its hits itself; only the misses go on.
      const hit = hitRatioOf(node, kind)
      if (hit > 0) end(share * hit)
      for (const { edge, fraction } of calls) {
        if (fraction > 0) walk(graph.byId.get(edge.target)!, [...nodeIds, edge.target], share * fraction, pathLatency, pathSuccess)
      }
    }
  }

  const metrics = Object.entries(nodes)
  const totalQps = load.readQps + load.writeQps
  return {
    nodes,
    edges,
    paths: paths.sort((a, b) => b.share - a.share).slice(0, MAX_PATHS),
    meanLatencyMs,
    errorRate: totalQps === 0 ? 0 : failed / totalQps,
    droppedQps: metrics.reduce((sum, [, node]) => sum + node.droppedQps, 0),
    monthlyCostUsd: metrics.reduce((sum, [, node]) => sum + node.monthlyCostUsd, 0),
    bottlenecks: metrics
      .filter(([nodeId, node]) => node.loadQps > 0 && graph.byId.get(nodeId)!.componentType !== 'client')
      .sort(([, a], [, b]) => b.utilisation - a.utilisation)
      .map(([nodeId]) => nodeId),
  }
}

function noTraffic(): Traffic {
  return { readQps: 0, writeQps: 0 }
}

function qpsOf(traffic: Traffic, kind: RequestKind): number {
  return kind === 'read' ? traffic.readQps : traffic.writeQps
}

function add(traffic: Traffic, kind: RequestKind, qps: number): void {
  if (kind === 'read') traffic.readQps += qps
  else traffic.writeQps += qps
}

function nodeMetrics(node: DesignNode, flow: { all: Traffic; sync: Traffic }, requestBytes: number): NodeMetrics {
  const { readQps, writeQps } = flow.all
  const loadQps = readQps + writeQps
  const traffic = { readQps, writeQps, loadQps, bandwidthBytesPerSecond: loadQps * requestBytes }
  const settings = nodeSimulation(node)
  if (!settings) {
    return { ...traffic, utilisation: 0, latencyMs: 0, monthlyCostUsd: 0, overloaded: false, deferred: false, droppedQps: 0, backlogQps: 0 }
  }
  const instances = instancesOf(node)
  const copies = copiesOf(node)
  const perCopy = settings.capacityQps * instances
  // Each copy of a primary with replicas serves a share of the reads and applies every write.
  const utilisation = (readQps / copies + writeQps) / perCopy
  const overloaded = utilisation >= 1
  const syncQps = flow.sync.readQps + flow.sync.writeQps
  const excess = overloaded ? loadQps - loadQps / utilisation : 0
  // The excess falls on requests in the request path and on deferred work alike, by their shares.
  const droppedQps = loadQps === 0 ? 0 : (excess * syncQps) / loadQps
  return {
    ...traffic,
    capacityQps: loadQps > 0 ? loadQps / utilisation : perCopy * copies,
    utilisation,
    latencyMs: settings.baseLatencyMs * (overloaded ? LATENCY_CAP : Math.min(LATENCY_CAP, 1 / (1 - utilisation))),
    monthlyCostUsd: settings.monthlyCostUsd * instances * copies,
    overloaded,
    deferred: loadQps > 0 && syncQps === 0,
    droppedQps,
    backlogQps: excess - droppedQps,
  }
}

/**
 * Where a Node sends what it serves of a kind, and what share along each Edge:
 * - only along Edges that carry the kind, and never back to a client;
 * - storage answers reads itself, and writes go to a replica only from its primary;
 * - a load balancer splits across its targets, evenly or, with least connections, by their capacity;
 * - other Nodes call each target, except that reads meant for a primary go to its replicas (those it
 *   replicates to, or else any of its type) when the Node reaches some, split evenly; and a cache beside a
 *   database (cache-aside) leaves the database only its misses;
 * - a cache passes on only its misses.
 */
function routes(node: DesignNode, kind: RequestKind, graph: Graph): Route[] {
  const targetOf = (edge: DesignEdge) => graph.byId.get(edge.target)!
  if (STORAGE.has(node.componentType) && kind === 'read') return []
  let eligible = (graph.outgoing.get(node.id) ?? []).filter(
    (edge) => (edge.traffic === 'both' || edge.traffic === kind) && targetOf(edge).componentType !== 'client',
  )
  if (kind === 'write') {
    const replicates = (target: DesignNode) => roleOf(node) === 'primary' && STORAGE.has(node.componentType) && target.componentType === node.componentType
    eligible = eligible.filter((edge) => roleOf(targetOf(edge)) !== 'replica' || replicates(targetOf(edge)))
  }

  let result: Route[]
  if (node.componentType === 'load-balancer') {
    const leastConnections = configOf(node).algorithm === 'least-connections'
    const weights = eligible.map((edge) => (leastConnections ? capacityOf(targetOf(edge)) : 1))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    result = eligible.map((edge, i) => ({ edge, fraction: total > 0 ? weights[i] / total : 0, group: 'load-balancer' }))
  } else if (kind === 'read') {
    const groups = replicaGroups(eligible.map(targetOf), graph)
    const caches = eligible.map(targetOf).filter((target) => target.componentType === 'cache')
    const missesBeside = 1 - Math.max(0, ...caches.map((cache) => hitRatioOf(cache, 'read')))
    result = eligible.flatMap((edge): Route[] => {
      const target = targetOf(edge)
      const missShare = DATABASES.has(target.componentType) ? missesBeside : 1
      if (groups.primaries.has(target.id)) return []
      const group = groups.groupOf.get(target.id)
      if (group) return [{ edge, fraction: missShare / group.size, group: group.name }]
      return [{ edge, fraction: missShare }]
    })
  } else {
    result = eligible.map((edge) => ({ edge, fraction: 1 }))
  }

  const hit = hitRatioOf(node, kind)
  return hit > 0 ? result.map((route) => ({ ...route, fraction: route.fraction * (1 - hit) })) : result
}

/**
 * Among the targets a Node reads from, the primaries whose reads its replicas take, and the replica
 * groups that share them. A primary's replicas are those it replicates to; replicas no reached primary
 * replicates to stand in for the other primaries of their type.
 */
function replicaGroups(targets: DesignNode[], graph: Graph): { primaries: Set<string>; groupOf: Map<string, { name: string; size: number }> } {
  const primaries = new Set<string>()
  const groupOf = new Map<string, { name: string; size: number }>()
  const reached = new Set(targets.map((target) => target.id))
  const replicas = targets.filter((target) => roleOf(target) === 'replica')
  const claimed = new Set<string>()
  for (const primary of targets.filter((target) => roleOf(target) === 'primary')) {
    const own = (graph.outgoing.get(primary.id) ?? []).map((edge) => edge.target).filter((id) => reached.has(id) && roleOf(graph.byId.get(id)!) === 'replica')
    if (own.length === 0) continue
    primaries.add(primary.id)
    for (const id of own) {
      claimed.add(id)
      groupOf.set(id, { name: `replicas:${primary.id}`, size: own.length })
    }
  }
  const unclaimed = replicas.filter((replica) => !claimed.has(replica.id))
  for (const type of new Set(unclaimed.map((replica) => replica.componentType))) {
    const ofType = unclaimed.filter((replica) => replica.componentType === type)
    for (const replica of ofType) groupOf.set(replica.id, { name: `replicas:${type}`, size: ofType.length })
    for (const primary of targets) if (primary.componentType === type && roleOf(primary) === 'primary' && !primaries.has(primary.id)) primaries.add(primary.id)
  }
  return { primaries, groupOf }
}

function configOf(node: DesignNode): Record<string, unknown> {
  return node.config
}

function roleOf(node: DesignNode): unknown {
  return configOf(node).role
}

function instancesOf(node: DesignNode): number {
  const { instances } = configOf(node)
  return typeof instances === 'number' ? instances : 1
}

/** A primary with replicas keeps a copy on each. */
function copiesOf(node: DesignNode): number {
  const { role, replicas } = configOf(node)
  return role === 'primary' && typeof replicas === 'number' ? 1 + replicas : 1
}

function capacityOf(node: DesignNode): number {
  return (nodeSimulation(node)?.capacityQps ?? 0) * instancesOf(node)
}

/** The share of reads a cache answers itself; none for writes or other Nodes. */
function hitRatioOf(node: DesignNode, kind: RequestKind): number {
  return kind === 'read' ? (nodeSimulation(node)?.hitRatio ?? 0) : 0
}

interface Graph {
  byId: Map<string, DesignNode>
  /** Node id → its Edges out, without those closing a cycle. */
  outgoing: Map<string, DesignEdge[]>
  /** Every Node after each Node sending to it, from the clients on; Nodes no client reaches come last. */
  order: DesignNode[]
}

/** The Design as a graph traffic follows: an Edge closing a cycle is left out, so traffic follows a cycle once. */
function graphOf(design: Design): Graph {
  const byId = new Map(design.nodes.map((node) => [node.id, node]))
  const all = new Map<string, DesignEdge[]>()
  for (const edge of design.edges) all.set(edge.source, [...(all.get(edge.source) ?? []), edge])
  const state = new Map<string, 'visiting' | 'done'>()
  const finished: string[] = []
  const backEdges = new Set<string>()
  const visit = (nodeId: string) => {
    state.set(nodeId, 'visiting')
    for (const edge of all.get(nodeId) ?? []) {
      const seen = state.get(edge.target)
      if (seen === 'visiting') backEdges.add(edge.id)
      else if (seen === undefined) visit(edge.target)
    }
    state.set(nodeId, 'done')
    finished.push(nodeId)
  }
  for (const node of design.nodes) if (node.componentType === 'client' && !state.has(node.id)) visit(node.id)
  for (const node of design.nodes) if (!state.has(node.id)) visit(node.id)
  const outgoing = new Map([...all].map(([source, edges]) => [source, edges.filter((edge) => !backEdges.has(edge.id))]))
  return { byId, outgoing, order: finished.reverse().map((nodeId) => byId.get(nodeId)!) }
}
