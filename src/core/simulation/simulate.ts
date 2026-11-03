import type { ComponentType } from '../design/components'
import { contains, nodeSimulation, type Design, type DesignEdge, type DesignNode } from '../design/design'
import { mulberry32 } from '../random'
import { meanSojournMs, mmcQueue, sampleSojourn, utilisationAtMeanFactor, type Queue } from './queueing'

// The Traffic Simulation: steady load pushed through a Design, deterministic and explainable.
// Traffic enters at the clients and each Node passes on what it serves, by what kind of component it is.
// Realistic mode routes the same traffic, then models each Node as an M/M/c queue and draws requests through
// them one by one, with seeded randomness, for the spread of their latency.

/** The traffic the clients send, shared evenly among the clients connected to something. */
export interface LoadProfile {
  readQps: number
  writeQps: number
  /** What each request carries, for the bandwidth through each Node. */
  requestBytes: number
}

/**
 * A Chaos Scenario: part of the Design broken on purpose, applied before routing. Ids the Design does
 * not have are ignored, and clients, which stand for the users, never go down.
 * - `node-down`: the Nodes serve nothing; requests needing them fail, and deferred work for them waits.
 *   A primary with replicas configured loses only its primary copy: it takes no writes, and its replicas
 *   serve the reads.
 * - `zone-down`: every Node in the zones, or in a zone inside one of them, is down.
 * - `cache-cold`: the caches (or CDNs) are cold or flushed and answer no reads themselves.
 * - `partition`: the network between the two sides is cut, and so is every Edge joining them, either way.
 *   Requests along a cut Edge fail; deferred work along it waits as the target's backlog.
 * A load balancer and a reader of replicas route around what is down or cut while some target is left
 * (failover); reads meant for a primary go back to it when none of its replicas is left; a cache-aside
 * cache that is down or cut off is skipped for the database beside it. A rate limiter that can reach none
 * of its counter stores fails closed (rejects every request) or open (lets every request through unchecked).
 */
export type ChaosScenario =
  | { type: 'node-down'; nodeIds: readonly string[] }
  | { type: 'zone-down'; zoneIds: readonly string[] }
  | { type: 'cache-cold'; nodeIds: readonly string[] }
  | { type: 'partition'; sides: readonly [readonly string[], readonly string[]] }

export type ChaosType = ChaosScenario['type']

export const CHAOS_TYPES: readonly ChaosType[] = ['node-down', 'zone-down', 'cache-cold', 'partition']

/**
 * - `simple`: a Node's latency is its base latency × 1 / (1 − ρ), and a request's is the mean over the ways it goes.
 * - `realistic`: each Node is an M/M/c queue, its instances the servers and its base latency the mean service
 *   time; requests are drawn through the queues for their percentiles. Routing, load, utilisation, errors
 *   and cost are simple mode's.
 */
export type SimulationMode = 'simple' | 'realistic'

export const SIMULATION_MODES: readonly SimulationMode[] = ['simple', 'realistic']

export type RequestKind = 'read' | 'write'

export const REQUEST_KINDS: readonly RequestKind[] = ['read', 'write']

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
   * It is capacity × instances, except that each copy of a primary with replicas serves a share of the reads,
   * a fan-out service's capacity counts every copy it sends: `fanOut` along each Edge out, for each request,
   * and a transcoder's counts every rendition it encodes: `renditions` for each upload.
   */
  capacityQps?: number
  /** ρ = load ÷ capacity; 0 for a client. */
  utilisation: number
  /**
   * Base latency × 1 / (1 − ρ), at most `LATENCY_CAP` times the base. In realistic mode, the mean time a
   * request spends in the Node's M/M/c queue, also at most `LATENCY_CAP` times the base.
   */
  latencyMs: number
  /** Realistic mode only: the mean time a request waits in the Node's queue before an instance serves it. */
  queueingDelayMs?: number
  monthlyCostUsd: number
  /** ρ ≥ 1. */
  overloaded: boolean
  /** Taken down by the Chaos Scenario: it serves nothing, and its capacity, utilisation and latency are 0. */
  down: boolean
  /**
   * A primary with replicas configured whose primary copy the Chaos Scenario took down: it drops every
   * write, and its capacity, utilisation and latency are its replicas' serving the reads.
   */
  primaryDown: boolean
  /** A cache (or CDN) the Chaos Scenario made cold: it answers no reads itself. */
  cold: boolean
  /** Reached only through a queue or an asynchronous Edge, so its excess waits instead of failing requests. */
  deferred: boolean
  /** The excess of the requests in the request path, which fail. */
  droppedQps: number
  /** The excess of deferred work, which piles up. */
  backlogQps: number
  /** For a rate limiter: the requests it rejects at once (HTTP 429), over its limit or with no counter to check. They fail. */
  throttledQps: number
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
  /**
   * The share of client requests that fail, from 0 to 1: a request fails when any Node it needs drops it,
   * or an Edge it needs is cut.
   */
  errorRate: number
  /** The same, per kind with traffic. */
  errorRateByKind: Partial<Record<RequestKind, number>>
  /** Requests dropped by Nodes, and those in the request path sent along cut Edges. */
  droppedQps: number
  /** Requests rate limiters reject on purpose: they fail too, though no Node is short of capacity for them. */
  throttledQps: number
  /** The Edges the Chaos Scenario's partition cuts. */
  cutEdgeIds: string[]
  monthlyCostUsd: number
  /** Node ids with load, most utilised first. */
  bottlenecks: string[]
  /**
   * Realistic mode only: per kind with traffic, the percentiles of the latency of the requests drawn, those
   * that fail included, as in the mean.
   */
  latencyPercentilesMs?: Partial<Record<RequestKind, LatencyPercentiles>>
  /** Realistic mode only: per kind with traffic, the mean time a request drawn waits in queues, all of them together. */
  queueingDelayMs?: Partial<Record<RequestKind, number>>
}

export interface LatencyPercentiles {
  p50Ms: number
  p95Ms: number
  p99Ms: number
}

/** A Node's latency grows with its load up to this many times its base latency. */
export const LATENCY_CAP = 10

/** At most this many request paths are listed. */
export const MAX_PATHS = 100

/** The requests of each kind realistic mode draws through the Design. */
export const REALISTIC_SAMPLES = 10_000

/** The seed realistic mode draws its requests with unless given another. */
const DEFAULT_SEED = 1

/** Components that keep data: they answer reads themselves and pass on only writes (replication, indexing). */
const STORAGE: ReadonlySet<ComponentType> = new Set(['sql-database', 'nosql-store', 'object-store', 'search-index', 'geo-index', 'trie', 'data-warehouse'])
/** Storage a cache beside it (cache-aside) takes reads off: the databases, and a trie. */
const CACHE_ASIDE_STORES: ReadonlySet<ComponentType> = new Set(['sql-database', 'nosql-store', 'trie'])
const QUEUES: ReadonlySet<ComponentType> = new Set(['message-queue', 'task-queue'])
/** Where a rate limiter keeps the counters it checks requests against, e.g. Redis. */
const COUNTER_STORES: ReadonlySet<ComponentType> = new Set(['cache', 'nosql-store'])

interface Route {
  edge: DesignEdge
  /** The share of what the Node serves of a kind that goes along the Edge. */
  fraction: number
  /** Routes of one group are alternatives (a load balancer's targets, a primary's replicas); others are calls a request makes. */
  group?: string
}

export function simulate(design: Design, load: LoadProfile, scenario?: ChaosScenario, mode: SimulationMode = 'simple', seed = DEFAULT_SEED): SimulationResult {
  const graph = graphOf(design, scenario)
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
  /** Node id → the share of its requests of each kind in the request path that it serves. */
  const servedShare = new Map<string, Record<RequestKind, number>>()
  /** Requests in the request path sent along cut Edges, which never arrive. */
  let cutQps = 0
  /** Node id → deferred work sent to it along cut Edges, which waits for it as backlog. */
  const stranded = new Map<string, number>()
  /** Realistic mode: Node id → its queue; none for a Node that is down or serves nothing itself, e.g. a client. */
  const queues = new Map<string, Queue>()

  for (const node of graph.order) {
    const flow = inflow.get(node.id)!
    const state = graph.down.has(node.id) ? 'down' : graph.primaryDown.has(node.id) ? 'primary-down' : 'up'
    const { metrics, served: shares, checked = shares } = nodeMetrics(node, flow, load.requestBytes, state, limitOf(node, graph), sendsPerRequest(node, graph))
    const queue = mode === 'realistic' ? queueOf(node, metrics) : undefined
    if (queue) queues.set(node.id, queue)
    nodes[node.id] = {
      ...metrics,
      ...(queue && { latencyMs: meanSojournMs(queue), queueingDelayMs: queue.meanWaitMs }),
      cold: graph.cold.has(node.id) && nodeSimulation(node)?.hitRatio !== undefined,
      backlogQps: metrics.backlogQps + (stranded.get(node.id) ?? 0),
    }
    servedShare.set(node.id, shares)
    const outputs = outputsPerRequestOf(node)
    for (const kind of REQUEST_KINDS) {
      for (const { edge, fraction } of routesOf(node, kind)) {
        // A rate limiter checks its counters for every request it serves, those it rejects too.
        // A fan-out service sends each request it serves on as several copies, a transcoder as its renditions.
        const sent = (isCounterEdge(edge, graph) ? checked[kind] : shares[kind]) * fraction * outputs
        // Work handed to a queue, or along an asynchronous Edge, is deferred from then on.
        const sync = edge.mode === 'sync' && !QUEUES.has(node.componentType)
        add(edges[edge.id], kind, qpsOf(flow.all, kind) * sent)
        if (graph.cut.has(edge.id)) {
          const syncQps = sync ? qpsOf(flow.sync, kind) * sent : 0
          cutQps += syncQps
          stranded.set(edge.target, (stranded.get(edge.target) ?? 0) + qpsOf(flow.all, kind) * sent - syncQps)
          continue
        }
        const target = inflow.get(edge.target)!
        add(target.all, kind, qpsOf(flow.all, kind) * sent)
        if (sync) add(target.sync, kind, qpsOf(flow.sync, kind) * sent)
      }
    }
  }

  /** The Edges a request waits on: not to a queue's consumer, nor asynchronous ones; none from a Node that is down. */
  const callsOf = (node: DesignNode, kind: RequestKind) =>
    QUEUES.has(node.componentType) || graph.down.has(node.id) ? [] : routesOf(node, kind).filter(({ edge }) => edge.mode === 'sync')

  // The expected latency and success of a request reaching a Node, with the calls it makes from there.
  const expected = new Map<string, { latencyMs: number; success: number }>()
  const expect = (node: DesignNode, kind: RequestKind): { latencyMs: number; success: number } => {
    const key = `${kind}:${node.id}`
    const known = expected.get(key)
    if (known) return known
    // A Node that is down answers nothing and calls nothing.
    const calls = callsOf(node, kind)
    let latencyMs = nodes[node.id].latencyMs
    const failures = new Map<string, number>()
    for (const { edge, fraction, group } of calls) {
      // A call along a cut Edge fails at once.
      const next = graph.cut.has(edge.id) ? { latencyMs: 0, success: 0 } : expect(graph.byId.get(edge.target)!, kind)
      latencyMs += fraction * next.latencyMs
      const groupKey = group ?? edge.id
      failures.set(groupKey, (failures.get(groupKey) ?? 0) + fraction * (1 - next.success))
    }
    const success = [...failures.values()].reduce((product, failure) => product * (1 - failure), servedShare.get(node.id)?.[kind] ?? 1)
    const result = { latencyMs, success }
    expected.set(key, result)
    return result
  }

  // Realistic mode: requests drawn one by one from the clients, through the queue of each Node they reach.
  /** Kind and Node id → the calls a request makes from the Node, those of one group together as alternatives. */
  const callGroups = new Map<string, Route[][]>()
  const callGroupsOf = (node: DesignNode, kind: RequestKind): Route[][] => {
    const key = `${kind}:${node.id}`
    let groups = callGroups.get(key)
    if (!groups) {
      const byGroup = new Map<string, Route[]>()
      for (const route of callsOf(node, kind)) {
        const groupKey = route.group ?? route.edge.id
        byGroup.set(groupKey, [...(byGroup.get(groupKey) ?? []), route])
      }
      groups = [...byGroup.values()]
      callGroups.set(key, groups)
    }
    return groups
  }
  /** Adds the time a request reaching the Node spends there, and in the calls it makes from there. */
  const draw = (node: DesignNode, kind: RequestKind, random: () => number, total: { latencyMs: number; waitMs: number }) => {
    const queue = queues.get(node.id)
    if (queue) {
      const { latencyMs, waitMs } = sampleSojourn(queue, random)
      total.latencyMs += latencyMs
      total.waitMs += waitMs
    }
    const groups = callGroupsOf(node, kind)
    if (groups.length === 0) return
    // A cache answers a hit itself; on a miss each call goes on by its share of the misses.
    const hit = hitRatioOf(node, kind, graph)
    if (hit > 0 && random() < hit) return
    for (const routes of groups) {
      // At most one of a group's alternatives, by their shares. A call along a cut Edge fails at once.
      let left = random() * (1 - hit)
      const taken = routes.find(({ fraction }) => (left -= fraction) < 0)
      if (taken && !graph.cut.has(taken.edge.id)) draw(graph.byId.get(taken.edge.target)!, kind, random, total)
    }
  }
  const drawRequests = (kind: RequestKind) => {
    // Each kind from its own stream, so that the load of one leaves the other's draws as they were.
    const random = mulberry32(seed + REQUEST_KINDS.indexOf(kind))
    const latencies: number[] = []
    let waitMs = 0
    for (let i = 0; i < REALISTIC_SAMPLES; i++) {
      const total = { latencyMs: 0, waitMs: 0 }
      draw(clients[Math.floor(random() * clients.length)], kind, random, total)
      latencies.push(total.latencyMs)
      waitMs += total.waitMs
    }
    latencies.sort((a, b) => a - b)
    const percentile = (p: number) => latencies[Math.ceil(p * latencies.length) - 1]
    return {
      meanLatencyMs: latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length,
      percentiles: { p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99) },
      queueingDelayMs: waitMs / latencies.length,
    }
  }
  const latencyPercentilesMs: Partial<Record<RequestKind, LatencyPercentiles>> = {}
  const queueingDelayMs: Partial<Record<RequestKind, number>> = {}

  const meanLatencyMs: Partial<Record<RequestKind, number>> = {}
  const errorRateByKind: Partial<Record<RequestKind, number>> = {}
  let failed = 0
  const paths: RequestPath[] = []
  for (const kind of REQUEST_KINDS) {
    const qps = kind === 'read' ? load.readQps : load.writeQps
    if (qps <= 0 || clients.length === 0) continue
    const perClient = clients.map((client) => expect(client, kind))
    const drawn = mode === 'realistic' ? drawRequests(kind) : undefined
    meanLatencyMs[kind] = drawn ? drawn.meanLatencyMs : perClient.reduce((sum, { latencyMs }) => sum + latencyMs, 0) / clients.length
    if (drawn) {
      latencyPercentilesMs[kind] = drawn.percentiles
      queueingDelayMs[kind] = drawn.queueingDelayMs
    }
    const errorRate = 1 - perClient.reduce((sum, { success }) => sum + success, 0) / clients.length
    errorRateByKind[kind] = errorRate
    failed += qps * errorRate
    for (const client of clients) walk(client, [client.id], 1 / clients.length, 0, 1)

    function walk(node: DesignNode, nodeIds: string[], share: number, latencyMs: number, success: number) {
      if (paths.length >= MAX_PATHS * 4) return
      const pathLatency = latencyMs + nodes[node.id].latencyMs
      const pathSuccess = success * (servedShare.get(node.id)?.[kind] ?? 1)
      const end = (endShare: number, errorRate = 1 - pathSuccess) => {
        if (endShare > 0) paths.push({ kind, nodeIds, share: endShare, latencyMs: pathLatency, errorRate })
      }
      const calls = callsOf(node, kind)
      if (calls.length === 0) return end(share)
      // A cache answers its hits itself; only the misses go on.
      const hit = hitRatioOf(node, kind, graph)
      if (hit > 0) end(share * hit)
      for (const { edge, fraction } of calls) {
        if (fraction <= 0) continue
        // A path along a cut Edge ends where it is cut, every request on it failing.
        if (graph.cut.has(edge.id)) end(share * fraction, 1)
        else walk(graph.byId.get(edge.target)!, [...nodeIds, edge.target], share * fraction, pathLatency, pathSuccess)
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
    errorRateByKind,
    droppedQps: metrics.reduce((sum, [, node]) => sum + node.droppedQps, cutQps),
    throttledQps: metrics.reduce((sum, [, node]) => sum + node.throttledQps, 0),
    cutEdgeIds: design.edges.filter((edge) => graph.cut.has(edge.id)).map((edge) => edge.id),
    monthlyCostUsd: metrics.reduce((sum, [, node]) => sum + node.monthlyCostUsd, 0),
    bottlenecks: metrics
      .filter(([nodeId, node]) => node.loadQps > 0 && !node.down && graph.byId.get(nodeId)!.componentType !== 'client')
      .sort(([, a], [, b]) => b.utilisation - a.utilisation)
      .map(([nodeId]) => nodeId),
    ...(mode === 'realistic' && { latencyPercentilesMs, queueingDelayMs }),
  }
}

/**
 * A Node's M/M/c queue in realistic mode: its instances are the servers, each serving a request in its base
 * latency on average. Its ρ is simple mode's, load ÷ capacity: capacity and base latency are set apart (a
 * server works on several requests at once), so the queue keeps that ρ and takes its time from the base
 * latency. It is modelled at most as busy as takes a request `LATENCY_CAP` times the base on average,
 * simple mode's cap; beyond, the queue would grow without end, and an overloaded Node drops its excess instead.
 */
function queueOf(node: DesignNode, metrics: NodeMetrics): Queue | undefined {
  const settings = nodeSimulation(node)
  if (!settings || metrics.down) return undefined
  const servers = instancesOf(node)
  return mmcQueue(servers, Math.min(metrics.utilisation, utilisationAtMeanFactor(servers, LATENCY_CAP)), settings.baseLatencyMs)
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

/** Whether the Chaos Scenario took a Node down, or only the primary copy of a primary with replicas configured. */
type NodeState = 'up' | 'down' | 'primary-down'

/**
 * A Node's metrics, and the share of the requests of each kind reaching it that it serves. `limitQps` is
 * the most requests a second it lets through, of all kinds together: a rate limiter's, or else Infinity.
 * A rate limiter also gives the share it checks before rejecting what is over its limit (`checked`).
 * `sends` is what one request costs its capacity: more than one for a fan-out service or a transcoder.
 */
function nodeMetrics(
  node: DesignNode,
  flow: { all: Traffic; sync: Traffic },
  requestBytes: number,
  state: NodeState,
  limitQps: number,
  sends: number,
): { metrics: NodeMetrics; served: Record<RequestKind, number>; checked?: Record<RequestKind, number> } {
  const { readQps, writeQps } = flow.all
  const loadQps = readQps + writeQps
  const traffic = { readQps, writeQps, loadQps, bandwidthBytesPerSecond: loadQps * requestBytes }
  const healthy = { overloaded: false, down: false, primaryDown: false, cold: false }
  const settings = nodeSimulation(node)
  if (!settings) {
    return {
      metrics: { ...traffic, ...healthy, utilisation: 0, latencyMs: 0, monthlyCostUsd: 0, deferred: false, droppedQps: 0, backlogQps: 0, throttledQps: 0 },
      served: { read: 1, write: 1 },
    }
  }
  const instances = instancesOf(node)
  const copies = copiesOf(node)
  const monthlyCostUsd = settings.monthlyCostUsd * instances * copies
  const syncQps = flow.sync.readQps + flow.sync.writeQps
  const deferred = loadQps > 0 && syncQps === 0
  // A fan-out service's capacity is in the copies it sends, a transcoder's in the renditions it encodes:
  // it serves that many times fewer requests.
  const perCopy = (settings.capacityQps * instances) / sends
  const latencyAt = (utilisation: number) => settings.baseLatencyMs * (utilisation >= 1 ? LATENCY_CAP : Math.min(LATENCY_CAP, 1 / (1 - utilisation)))

  if (state === 'down') {
    // It still costs. The requests reaching it fail, and deferred work waits for it.
    return {
      metrics: {
        ...traffic,
        ...healthy,
        down: true,
        capacityQps: 0,
        utilisation: 0,
        latencyMs: 0,
        monthlyCostUsd,
        deferred,
        droppedQps: syncQps,
        backlogQps: loadQps - syncQps,
        throttledQps: 0,
      },
      served: { read: 0, write: 0 },
    }
  }
  if (state === 'primary-down') {
    // Its replicas share the reads; every write fails, or waits when deferred.
    const capacityQps = perCopy * (copies - 1)
    const utilisation = readQps / capacityQps
    const read = utilisation < 1 ? 1 : 1 / utilisation
    const unserved = (traffic: Traffic) => traffic.writeQps + traffic.readQps * (1 - read)
    const droppedQps = unserved(flow.sync)
    return {
      metrics: {
        ...traffic,
        ...healthy,
        primaryDown: true,
        overloaded: utilisation >= 1,
        capacityQps,
        utilisation,
        latencyMs: latencyAt(utilisation),
        monthlyCostUsd,
        deferred,
        droppedQps,
        backlogQps: unserved(flow.all) - droppedQps,
        throttledQps: 0,
      },
      served: { read, write: 0 },
    }
  }

  // Each copy of a primary with replicas serves a share of the reads and applies every write.
  const utilisation = (readQps / copies + writeQps) / perCopy
  const overloaded = utilisation >= 1
  const excess = overloaded ? loadQps - loadQps / utilisation : 0
  // The excess falls on requests in the request path and on deferred work alike, by their shares.
  const droppedQps = loadQps === 0 ? 0 : (excess * syncQps) / loadQps
  // Of what it serves, a rate limiter lets through up to its limit and rejects the rest.
  const allowedQps = loadQps - excess
  const throttledQps = Math.max(0, allowedQps - limitQps)
  const checked = overloaded ? 1 / utilisation : 1
  const served = checked * (throttledQps > 0 ? limitQps / allowedQps : 1)
  return {
    metrics: {
      ...traffic,
      ...healthy,
      capacityQps: loadQps > 0 ? loadQps / utilisation : perCopy * copies,
      utilisation,
      latencyMs: latencyAt(utilisation),
      monthlyCostUsd,
      overloaded,
      deferred,
      droppedQps,
      backlogQps: excess - droppedQps,
      throttledQps,
    },
    served: { read: served, write: served },
    checked: { read: checked, write: checked },
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
 * - a cache (or CDN) passes on only its misses;
 * - under a Chaos Scenario, a load balancer and a reader of replicas leave out what is down or cut while
 *   some target is left, a cache-aside cache that is down or cut off is skipped, a primary does not
 *   replicate to a replica it cannot reach, and a rate limiter failing open skips the counter stores it
 *   cannot reach.
 */
function routes(node: DesignNode, kind: RequestKind, graph: Graph): Route[] {
  const targetOf = (edge: DesignEdge) => graph.byId.get(edge.target)!
  /** Not cut, to a target that is up. */
  const available = (edge: DesignEdge) => !graph.cut.has(edge.id) && !graph.down.has(edge.target)
  if (STORAGE.has(node.componentType) && kind === 'read') return []
  let eligible = (graph.outgoing.get(node.id) ?? []).filter(
    (edge) => (edge.traffic === 'both' || edge.traffic === kind) && targetOf(edge).componentType !== 'client',
  )
  if (kind === 'write') {
    const replicates = (target: DesignNode) => roleOf(node) === 'primary' && STORAGE.has(node.componentType) && target.componentType === node.componentType
    // A replica that is down or cut off catches up later: replicating to it fails no write.
    eligible = eligible.filter((edge) => roleOf(targetOf(edge)) !== 'replica' || (replicates(targetOf(edge)) && available(edge)))
  }
  if (node.componentType === 'rate-limiter' && configOf(node).failMode === 'open') {
    eligible = eligible.filter((edge) => !isCounterEdge(edge, graph) || writable(edge, graph))
  }
  // A cache beside a database (cache-aside) that is down or cut off is skipped: the database answers instead.
  if (eligible.some((edge) => CACHE_ASIDE_STORES.has(targetOf(edge).componentType))) {
    eligible = eligible.filter((edge) => targetOf(edge).componentType !== 'cache' || available(edge))
  }

  let result: Route[]
  if (node.componentType === 'load-balancer') {
    // It sends nothing along what is down or cut while some target is left.
    const targets = eligible.some(available) ? eligible.filter(available) : eligible
    const leastConnections = configOf(node).algorithm === 'least-connections'
    const weights = targets.map((edge) => (leastConnections ? capacityOf(targetOf(edge), graph) : 1))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    result = targets.map((edge, i) => ({ edge, fraction: total > 0 ? weights[i] / total : 0, group: 'load-balancer' }))
  } else if (kind === 'read') {
    const edgeTo = new Map(eligible.map((edge) => [edge.target, edge]))
    const groups = replicaGroups(eligible.map(targetOf), graph, (target) => available(edgeTo.get(target.id)!))
    const caches = eligible.map(targetOf).filter((target) => target.componentType === 'cache')
    const missesBeside = 1 - Math.max(0, ...caches.map((cache) => hitRatioOf(cache, 'read', graph)))
    result = eligible.flatMap((edge): Route[] => {
      const target = targetOf(edge)
      const missShare = CACHE_ASIDE_STORES.has(target.componentType) ? missesBeside : 1
      if (groups.primaries.has(target.id)) return []
      const group = groups.groupOf.get(target.id)
      if (group === null) return []
      if (group) return [{ edge, fraction: missShare / group.size, group: group.name }]
      return [{ edge, fraction: missShare }]
    })
  } else {
    result = eligible.map((edge) => ({ edge, fraction: 1 }))
  }

  const hit = hitRatioOf(node, kind, graph)
  return hit > 0 ? result.map((route) => ({ ...route, fraction: route.fraction * (1 - hit) })) : result
}

/**
 * Among the targets a Node reads from, the primaries whose reads its replicas take, and the replica
 * groups that share them. A primary's replicas are those it replicates to; replicas no reached primary
 * replicates to stand in for the other primaries of their type.
 *
 * Only `available` replicas share the reads (failover); the others are in no group (`null`), and get none.
 * When none of a group is available, its reads go back to its primaries; with no primary to go back to,
 * the group keeps them all, and they fail.
 */
function replicaGroups(
  targets: DesignNode[],
  graph: Graph,
  available: (target: DesignNode) => boolean,
): { primaries: Set<string>; groupOf: Map<string, { name: string; size: number } | null> } {
  const primaries = new Set<string>()
  const groupOf = new Map<string, { name: string; size: number } | null>()
  const reached = new Set(targets.map((target) => target.id))
  const replicas = targets.filter((target) => roleOf(target) === 'replica')
  const claimed = new Set<string>()
  /** Sets the group of `members`, which take the reads of `owners`. */
  const group = (name: string, members: DesignNode[], owners: DesignNode[]) => {
    const left = members.filter(available)
    const sharing = left.length > 0 ? left : owners.length > 0 ? [] : members
    for (const member of members) groupOf.set(member.id, sharing.includes(member) ? { name, size: sharing.length } : null)
    if (sharing.length > 0) for (const owner of owners) primaries.add(owner.id)
  }
  for (const primary of targets.filter((target) => roleOf(target) === 'primary')) {
    const own = (graph.outgoing.get(primary.id) ?? []).map((edge) => edge.target).filter((id) => reached.has(id) && roleOf(graph.byId.get(id)!) === 'replica')
    if (own.length === 0) continue
    for (const id of own) claimed.add(id)
    group(`replicas:${primary.id}`, own.map((id) => graph.byId.get(id)!), [primary])
  }
  const unclaimed = replicas.filter((replica) => !claimed.has(replica.id))
  for (const type of new Set(unclaimed.map((replica) => replica.componentType))) {
    const owners = targets.filter((target) => target.componentType === type && roleOf(target) === 'primary' && !primaries.has(target.id) && !claimedBy(target))
    group(
      `replicas:${type}`,
      unclaimed.filter((replica) => replica.componentType === type),
      owners,
    )
  }
  return { primaries, groupOf }

  /** Whether the primary has replicas of its own among the targets, so that its reads are theirs. */
  function claimedBy(primary: DesignNode): boolean {
    return (graph.outgoing.get(primary.id) ?? []).some((edge) => reached.has(edge.target) && roleOf(graph.byId.get(edge.target)!) === 'replica')
  }
}

/** Whether an Edge leads from a rate limiter to one of its counter stores. */
function isCounterEdge(edge: DesignEdge, graph: Graph): boolean {
  return graph.byId.get(edge.source)!.componentType === 'rate-limiter' && COUNTER_STORES.has(graph.byId.get(edge.target)!.componentType)
}

/** Whether writes can go along an Edge: it is not cut, and its target is up, its primary copy too. */
function writable(edge: DesignEdge, graph: Graph): boolean {
  return !graph.cut.has(edge.id) && !graph.down.has(edge.target) && !graph.primaryDown.has(edge.target)
}

/**
 * The most requests a second a Node lets through: a rate limiter's limit, or else Infinity. A rate limiter
 * that can update none of its counter stores cannot count: failing closed it lets nothing through, failing
 * open everything. One without a counter store counts in its own memory.
 */
function limitOf(node: DesignNode, graph: Graph): number {
  if (node.componentType !== 'rate-limiter') return Infinity
  const counters = (graph.outgoing.get(node.id) ?? []).filter((edge) => isCounterEdge(edge, graph))
  if (counters.length > 0 && !counters.some((edge) => writable(edge, graph))) return configOf(node).failMode === 'open' ? Infinity : 0
  const { limitQps } = configOf(node)
  return typeof limitQps === 'number' ? limitQps : Infinity
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

/**
 * The components that send each request they serve on as several outputs along each Edge out: the config
 * field counting them, and whether each Edge's outputs cost capacity (a fan-out service's copies, each sent)
 * or only one Edge's do (a transcoder's renditions, each encoded once, however many Edges they are written along).
 */
const MULTI_OUTPUT: Partial<Record<ComponentType, { field: 'fanOut' | 'renditions'; costPerEdge: boolean }>> = {
  'fan-out': { field: 'fanOut', costPerEdge: true },
  transcoder: { field: 'renditions', costPerEdge: false },
}

/** The outputs a Node sends each request it serves on as, along each Edge out: one, except for `MULTI_OUTPUT`. */
function outputsPerRequestOf(node: DesignNode): number {
  const multi = MULTI_OUTPUT[node.componentType]
  const outputs = multi && configOf(node)[multi.field]
  return typeof outputs === 'number' ? outputs : 1
}

/** What one request costs a Node's capacity: its outputs, along each of its Edges out when each Edge's cost. */
function sendsPerRequest(node: DesignNode, graph: Graph): number {
  const outputs = outputsPerRequestOf(node)
  if (outputs === 1 || !MULTI_OUTPUT[node.componentType]?.costPerEdge) return outputs
  return outputs * Math.max(1, (graph.outgoing.get(node.id) ?? []).length)
}

/** A primary with replicas keeps a copy on each. */
function copiesOf(node: DesignNode): number {
  const { role, replicas } = configOf(node)
  return role === 'primary' && typeof replicas === 'number' ? 1 + replicas : 1
}

/** The requests a second a Node serves, all its instances together. */
function capacityOf(node: DesignNode, graph: Graph): number {
  return ((nodeSimulation(node)?.capacityQps ?? 0) * instancesOf(node)) / sendsPerRequest(node, graph)
}

/** The share of reads a cache answers itself; none for writes, other Nodes or a cold cache. */
function hitRatioOf(node: DesignNode, kind: RequestKind, graph: Graph): number {
  return kind === 'read' && !graph.cold.has(node.id) ? (nodeSimulation(node)?.hitRatio ?? 0) : 0
}

interface Graph {
  byId: Map<string, DesignNode>
  /** Node id → its Edges out, without those closing a cycle. */
  outgoing: Map<string, DesignEdge[]>
  /** Every Node after each Node sending to it, from the clients on; Nodes no client reaches come last. */
  order: DesignNode[]
  /** By the Chaos Scenario: the Nodes down, the primaries with replicas configured that lost their primary copy, the caches cold and the Edges cut. */
  down: ReadonlySet<string>
  primaryDown: ReadonlySet<string>
  cold: ReadonlySet<string>
  cut: ReadonlySet<string>
}

/** What a Chaos Scenario breaks. */
function chaosOf(design: Design, scenario: ChaosScenario | undefined): Pick<Graph, 'down' | 'primaryDown' | 'cold' | 'cut'> {
  const none = { down: new Set<string>(), primaryDown: new Set<string>(), cold: new Set<string>(), cut: new Set<string>() }
  const notClient = (ids: Iterable<string>) => {
    const named = new Set(ids)
    return new Set(design.nodes.filter((node) => node.componentType !== 'client' && named.has(node.id)).map((node) => node.id))
  }
  switch (scenario?.type) {
    case undefined:
      return none
    case 'node-down': {
      const named = notClient(scenario.nodeIds)
      const withReplicas = new Set(design.nodes.filter((node) => named.has(node.id) && STORAGE.has(node.componentType) && copiesOf(node) > 1).map((node) => node.id))
      return { ...none, down: new Set([...named].filter((id) => !withReplicas.has(id))), primaryDown: withReplicas }
    }
    case 'zone-down': {
      const named = design.zones.filter((zone) => scenario.zoneIds.includes(zone.id))
      const zoneIds = new Set(design.zones.filter((zone) => named.some((outer) => outer === zone || contains(outer, zone))).map((zone) => zone.id))
      return { ...none, down: notClient(design.nodes.filter((node) => node.zoneId !== undefined && zoneIds.has(node.zoneId)).map((node) => node.id)) }
    }
    case 'cache-cold':
      return { ...none, cold: new Set(scenario.nodeIds) }
    case 'partition': {
      const [a, b] = scenario.sides.map((side) => new Set(side))
      const crosses = (edge: DesignEdge) => (a.has(edge.source) && b.has(edge.target)) || (b.has(edge.source) && a.has(edge.target))
      return { ...none, cut: new Set(design.edges.filter(crosses).map((edge) => edge.id)) }
    }
  }
}

/**
 * The Design as a graph traffic follows, broken by the Chaos Scenario: an Edge closing a cycle is left
 * out, so traffic follows a cycle once.
 */
function graphOf(design: Design, scenario: ChaosScenario | undefined): Graph {
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
  return { byId, outgoing, order: finished.reverse().map((nodeId) => byId.get(nodeId)!), ...chaosOf(design, scenario) }
}
