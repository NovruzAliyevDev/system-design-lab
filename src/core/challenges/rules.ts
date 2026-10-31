import { isRecord, isText } from '../content/validation'
import { componentDefinition, configProblem, isComponentType, type ComponentType, type ConfigValue } from '../design/components'
import { EDGE_MODES, type Design, type DesignEdge, type DesignNode, type EdgeMode } from '../design/design'
import {
  CHAOS_TYPES,
  REQUEST_KINDS,
  simulate,
  type ChaosScenario,
  type ChaosType,
  type LoadProfile,
  type NodeMetrics,
  type RequestKind,
  type SimulationResult,
  type Traffic,
} from '../simulation/simulate'

// The Rule Engine: checks a Design against a Challenge Stage's Rules. Rules are declarative,
// serialisable data built from a fixed set of predicates, so that they can be authored as content
// and validated at build time.

/** A config value a node must have: exactly this one, or any one of a list. */
export type ConfigMatch = ConfigValue | readonly ConfigValue[]

/** Nodes of a component type (or of any of several), optionally only those whose config matches. */
export type NodeSelector =
  | ComponentType
  | readonly ComponentType[]
  | { component: ComponentType | readonly ComponentType[]; config?: Readonly<Record<string, ConfigMatch>> }

export type Predicate =
  | NodePredicate
  | EdgePredicate
  | NoEdgePredicate
  | PathPredicate
  | ConfigPredicate
  | EdgeModePredicate
  | AllOfPredicate
  | AnyOfPredicate
  | NotPredicate
  | CustomPredicate
  | SimulationPredicate

/** Reads travel along edges carrying `read` or `both`; writes along `write` or `both`. */
export type TrafficKind = 'read' | 'write'

/** At least `min` and at most `max` (default any) nodes match; `min` defaults to 1, or 0 when `max` is 0. */
export interface NodePredicate {
  type: 'node'
  node: NodeSelector
  min?: number
  max?: number
}

/** An edge leads from a `from` node to a `to` node, carrying `traffic` when given. */
export interface EdgePredicate {
  type: 'edge'
  from: NodeSelector
  to: NodeSelector
  traffic?: TrafficKind
}

/** No edge leads from a `from` node straight to a `to` node. */
export interface NoEdgePredicate {
  type: 'no-edge'
  from: NodeSelector
  to: NodeSelector
}

/**
 * A `to` node can be reached from a `from` node along edges (carrying `traffic`, when given). With
 * `through`, every such path also passes a `through` node.
 */
export interface PathPredicate {
  type: 'path'
  from: NodeSelector
  to: NodeSelector
  through?: NodeSelector
  traffic?: TrafficKind
}

/** At least one node matches, and every matching node's `key` field `equals` a value or is `in` a set. */
export type ConfigPredicate = { type: 'config'; node: NodeSelector; key: string } & (
  | { equals: ConfigValue; in?: never }
  | { in: readonly ConfigValue[]; equals?: never }
)

/** There is an edge from a `from` node to a `to` node, and every such edge has `mode`. */
export interface EdgeModePredicate {
  type: 'edge-mode'
  from: NodeSelector
  to: NodeSelector
  mode: EdgeMode
}

export interface AllOfPredicate {
  type: 'all-of'
  predicates: readonly Predicate[]
}

/** Passes when any part does: how Rules accept equivalent designs. */
export interface AnyOfPredicate {
  type: 'any-of'
  predicates: readonly Predicate[]
}

export interface NotPredicate {
  type: 'not'
  predicate: Predicate
}

/** One of `CUSTOM_PREDICATES`, for checks the other predicates cannot express. */
export interface CustomPredicate {
  type: 'custom'
  name: string
}

/**
 * Simulated under its Stage's Load Profile, and under one of its Chaos tasks when `chaos` names it, the
 * Design meets every target given: each kind of request the load sends reaches some Node that is up, and
 * the mean latency per kind, the number of overloaded Nodes and the share of failing requests stay at
 * most their targets.
 */
export interface SimulationPredicate {
  type: 'simulation'
  /** The id of the Stage's Chaos task to simulate under. */
  chaos?: string
  maxLatencyMs?: Partial<Record<RequestKind, number>>
  maxOverloadedNodes?: number
  /** From 0 to 1: of all requests, or per kind. */
  maxErrorRate?: number | Partial<Record<RequestKind, number>>
}

/**
 * A Chaos Scenario as a Challenge authors it: the Nodes it breaks are picked by selectors, a Node matching
 * any of them, so that it applies to whatever Design the learner builds.
 * - `zone-down`: the zones holding a Node the selectors pick.
 * - `partition`: the network between the Nodes of one side and those of the other.
 */
export type ChaosTaskScenario =
  | { type: 'node-down'; nodes: readonly NodeSelector[] }
  | { type: 'zone-down'; zonesOf: readonly NodeSelector[] }
  | { type: 'cache-cold'; nodes: readonly NodeSelector[] }
  | { type: 'partition'; sides: readonly [readonly NodeSelector[], readonly NodeSelector[]] }

/** Part of the system broken on purpose in a Design Stage; Rules check simulation targets under it, e.g. that reads keep working. */
export interface ChaosTask {
  /** Unique within its Stage; `simulation` predicates name it. */
  id: string
  /** What breaks and what must keep working, in Azerbaijani. */
  prompt: string
  scenario: ChaosTaskScenario
}

/** The Chaos Scenario a Chaos task makes of a Design: its selectors resolved to the Design's Nodes and zones. */
export function chaosScenarioOf(scenario: ChaosTaskScenario, design: Design): ChaosScenario {
  const picked = (selectors: readonly NodeSelector[]) => design.nodes.filter((node) => selectors.some((selector) => matches(node, selector)))
  const pickedIds = (selectors: readonly NodeSelector[]) => picked(selectors).map((node) => node.id)
  switch (scenario.type) {
    case 'node-down':
    case 'cache-cold':
      return { type: scenario.type, nodeIds: pickedIds(scenario.nodes) }
    case 'zone-down':
      return { type: 'zone-down', zoneIds: [...new Set(picked(scenario.zonesOf).flatMap((node) => (node.zoneId === undefined ? [] : [node.zoneId])))] }
    case 'partition':
      return { type: 'partition', sides: [pickedIds(scenario.sides[0]), pickedIds(scenario.sides[1])] }
  }
}

/** Checks registered in code, by the name a `custom` predicate gives. */
export const CUSTOM_PREDICATES: Readonly<Record<string, (design: Design) => boolean>> = {
  /** There are at least two nodes, each joined to every other through edges, whichever way they point: nothing stands apart. */
  'all-connected': (design) => {
    if (design.nodes.length < 2) return false
    const neighbours = new Map(design.nodes.map((node) => [node.id, [] as string[]]))
    for (const edge of design.edges) {
      neighbours.get(edge.source)?.push(edge.target)
      neighbours.get(edge.target)?.push(edge.source)
    }
    return reachable([design.nodes[0].id], (id) => neighbours.get(id) ?? []).size === design.nodes.length
  },
  /** Some SQL or NoSQL database holds its data in shards: its shard key is set and it runs on more than one instance. */
  'sharded-database': (design) =>
    design.nodes.some((node) => {
      if (node.componentType !== 'sql-database' && node.componentType !== 'nosql-store') return false
      const { shardKey, instances } = node.config as Record<string, ConfigValue>
      return typeof shardKey === 'string' && shardKey.trim() !== '' && typeof instances === 'number' && instances > 1
    }),
}

export interface Rule {
  /** Unique within its Stage; Hint usage is stored by it. */
  id: string
  /** The points the Rule is worth when it passes and no Hint was opened. */
  weight: number
  /** What the Rule checks, in Azerbaijani; shown once the Stage is finished. */
  description: string
  /** Three tiers, opened one at a time: a Socratic question, a concrete pointer, the full explanation. */
  hints: readonly string[]
  check: Predicate
}

/** A Stage checked by Rules, e.g. a Challenge's high-level design. */
export interface RuledStage {
  rules: readonly Rule[]
  /** The load `simulation` predicates simulate the Design under. */
  loadProfile?: LoadProfile
  /** What `simulation` predicates can break while they simulate. */
  chaosTasks?: readonly ChaosTask[]
}

/** Rule id → how many of its Hint tiers have been opened (0 to 3). */
export type HintUsage = Readonly<Record<string, number>>

export interface RuleResult {
  ruleId: string
  passed: boolean
  weight: number
  hintsOpened: number
  /** The Hint tiers still closed. */
  hintsAvailable: number
  /** The points the Rule can still earn: its weight, capped by the Hints opened. */
  maxPoints: number
  points: number
}

export interface Evaluation {
  /** Points earned. */
  score: number
  /** The most points attainable with the Hints opened so far. */
  maxScore: number
  /** The sum of all Rule weights: the score of a passing Design that opened no Hint. */
  totalWeight: number
  /** In the order the Stage lists its Rules. */
  rules: RuleResult[]
  failingCount: number
}

/** The share of a Rule's weight it can still earn after 0, 1, 2 or 3 Hint tiers are opened. */
export const HINT_CAPS = [1, 0.75, 0.5, 0.25] as const

export const HINT_TIERS = HINT_CAPS.length - 1

export function evaluateDesign(stage: RuledStage, design: Design, hintUsage: HintUsage): Evaluation {
  const context = checkContext(design, stage)
  const rules = stage.rules.map((rule): RuleResult => {
    const passed = holds(rule.check, context)
    const hintsOpened = tiersOpened(hintUsage, rule.id)
    const maxPoints = rule.weight * HINT_CAPS[hintsOpened]
    return {
      ruleId: rule.id,
      passed,
      weight: rule.weight,
      hintsOpened,
      hintsAvailable: HINT_TIERS - hintsOpened,
      maxPoints,
      points: passed ? maxPoints : 0,
    }
  })
  return {
    score: sum(rules.map((result) => result.points)),
    maxScore: sum(rules.map((result) => result.maxPoints)),
    totalWeight: sum(rules.map((result) => result.weight)),
    rules,
    failingCount: rules.filter((result) => !result.passed).length,
  }
}

/** What the learner sees after a check, until the Stage is finished: no Rule is named. */
export interface LevelZeroFeedback {
  score: number
  maxScore: number
  totalWeight: number
  failingCount: number
}

export function levelZeroFeedback({ score, maxScore, totalWeight, failingCount }: Evaluation): LevelZeroFeedback {
  return { score, maxScore, totalWeight, failingCount }
}

/** The Hints of a failing Rule: the tiers opened so far, in order. */
export interface ProblemHints {
  ruleId: string
  opened: string[]
  canOpenMore: boolean
}

/** One entry per failing Rule, in the order the Stage lists them. */
export function problemHints(stage: RuledStage, evaluation: Evaluation): ProblemHints[] {
  return evaluation.rules.flatMap((result) => {
    const rule = stage.rules.find((candidate) => candidate.id === result.ruleId)
    if (result.passed || !rule) return []
    return [{ ruleId: rule.id, opened: rule.hints.slice(0, result.hintsOpened), canOpenMore: result.hintsAvailable > 0 }]
  })
}

/** Opens the next Hint tier of a Rule; throws a `RangeError` when the Stage has no such Rule or all its tiers are open. */
export function openNextHint(hintUsage: HintUsage, stage: RuledStage, ruleId: string): HintUsage {
  if (!stage.rules.some((rule) => rule.id === ruleId)) throw new RangeError(`No Rule ${ruleId}.`)
  const opened = tiersOpened(hintUsage, ruleId)
  if (opened >= HINT_TIERS) throw new RangeError(`Every Hint of ${ruleId} is open.`)
  return { ...hintUsage, [ruleId]: opened + 1 }
}

/** How many Hint tiers of a Rule are open; throws a `RangeError` when the usage is not a whole number from 0 to 3. */
function tiersOpened(hintUsage: HintUsage, ruleId: string): number {
  const opened = Object.hasOwn(hintUsage, ruleId) ? hintUsage[ruleId] : 0
  if (!Number.isInteger(opened) || opened < 0 || opened > HINT_TIERS) throw new RangeError(`Invalid Hint usage of ${ruleId}: ${opened}.`)
  return opened
}

/** What predicates check: the Design and its Traffic Simulation, simulated at most once per evaluation and Chaos task. */
interface CheckContext {
  design: Design
  /** Under the Chaos task with this id, when given. */
  simulation(chaos?: string): { load: LoadProfile; result: SimulationResult }
}

function checkContext(design: Design, { loadProfile, chaosTasks = [] }: RuledStage): CheckContext {
  /** Chaos task id, or undefined for none → the simulation. */
  const results = new Map<string | undefined, SimulationResult>()
  return {
    design,
    simulation(chaos) {
      if (!loadProfile) throw new RangeError('A simulation predicate needs its Stage to have a Load Profile.')
      const task = chaos === undefined ? undefined : chaosTasks.find((candidate) => candidate.id === chaos)
      if (chaos !== undefined && !task) throw new RangeError(`No Chaos task ${chaos}.`)
      let result = results.get(chaos)
      if (!result) {
        result = simulate(design, loadProfile, task && chaosScenarioOf(task.scenario, design))
        results.set(chaos, result)
      }
      return { load: loadProfile, result }
    },
  }
}

function holds(predicate: Predicate, context: CheckContext): boolean {
  const { design } = context
  switch (predicate.type) {
    case 'node': {
      const count = matching(design, predicate.node).length
      const max = predicate.max ?? Infinity
      return count >= (predicate.min ?? Math.min(1, max)) && count <= max
    }
    case 'edge':
      return edgesBetween(design, predicate.from, predicate.to).some((edge) => carries(edge, predicate.traffic))
    case 'no-edge':
      return edgesBetween(design, predicate.from, predicate.to).length === 0
    case 'path': {
      const targets = ids(matching(design, predicate.to))
      const reaches = (blocked: ReadonlySet<string>) =>
        [...reachableAlong(design, ids(matching(design, predicate.from)), predicate.traffic, blocked)].some((id) => targets.has(id))
      if (!reaches(new Set())) return false
      return predicate.through === undefined || !reaches(ids(matching(design, predicate.through)))
    }
    case 'config': {
      const nodes = matching(design, predicate.node)
      const allowed: readonly ConfigValue[] = predicate.in ?? [predicate.equals]
      return nodes.length > 0 && nodes.every((node) => allowed.includes((node.config as Record<string, ConfigValue>)[predicate.key]))
    }
    case 'edge-mode': {
      const edges = edgesBetween(design, predicate.from, predicate.to)
      return edges.length > 0 && edges.every((edge) => edge.mode === predicate.mode)
    }
    case 'all-of':
      return predicate.predicates.every((part) => holds(part, context))
    case 'any-of':
      return predicate.predicates.some((part) => holds(part, context))
    case 'not':
      return !holds(predicate.predicate, context)
    case 'custom': {
      const check = CUSTOM_PREDICATES[predicate.name]
      if (!check) throw new RangeError(`No custom predicate "${predicate.name}".`)
      return check(design)
    }
    case 'simulation':
      return meetsTargets(predicate, context.simulation(predicate.chaos))
  }
}

function meetsTargets(targets: SimulationPredicate, { load, result }: { load: LoadProfile; result: SimulationResult }): boolean {
  const servers = Object.values(result.nodes).filter((metrics) => metrics.capacityQps !== undefined && !metrics.down)
  const qpsOf = (traffic: Traffic, kind: RequestKind) => (kind === 'read' ? traffic.readQps : traffic.writeQps)
  // A primary whose primary copy is down serves reads only.
  const serves = (metrics: NodeMetrics, kind: RequestKind) => qpsOf(metrics, kind) > 0 && !(kind === 'write' && metrics.primaryDown)
  const { maxErrorRate } = targets
  for (const kind of REQUEST_KINDS) {
    if (qpsOf(load, kind) > 0 && !servers.some((metrics) => serves(metrics, kind))) return false
    const maxLatency = targets.maxLatencyMs?.[kind]
    if (maxLatency !== undefined && (result.meanLatencyMs[kind] ?? 0) > maxLatency) return false
    const maxKindErrors = typeof maxErrorRate === 'object' ? maxErrorRate[kind] : undefined
    if (maxKindErrors !== undefined && (result.errorRateByKind[kind] ?? 0) > maxKindErrors) return false
  }
  const overloaded = Object.values(result.nodes).filter((metrics) => metrics.overloaded).length
  if (targets.maxOverloadedNodes !== undefined && overloaded > targets.maxOverloadedNodes) return false
  return typeof maxErrorRate !== 'number' || result.errorRate <= maxErrorRate
}

/** Nodes reachable from `starts` along edges carrying `traffic`, never entering a `blocked` node. */
function reachableAlong(design: Design, starts: ReadonlySet<string>, traffic: TrafficKind | undefined, blocked: ReadonlySet<string>): Set<string> {
  const next = new Map<string, string[]>()
  for (const edge of design.edges) {
    if (!carries(edge, traffic) || blocked.has(edge.target)) continue
    next.set(edge.source, [...(next.get(edge.source) ?? []), edge.target])
  }
  return reachable([...starts].filter((id) => !blocked.has(id)), (id) => next.get(id) ?? [])
}

/** The nodes reached from `starts` by following `neighbours`, the starts included. */
function reachable(starts: string[], neighbours: (id: string) => readonly string[]): Set<string> {
  const seen = new Set(starts)
  const queue = [...starts]
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const neighbour of neighbours(id)) {
      if (seen.has(neighbour)) continue
      seen.add(neighbour)
      queue.push(neighbour)
    }
  }
  return seen
}

/** Edges leading from a node matching `from` to a node matching `to`. */
function edgesBetween(design: Design, from: NodeSelector, to: NodeSelector): DesignEdge[] {
  const sources = ids(matching(design, from))
  const targets = ids(matching(design, to))
  return design.edges.filter((edge) => sources.has(edge.source) && targets.has(edge.target))
}

function carries(edge: DesignEdge, traffic: TrafficKind | undefined): boolean {
  return traffic === undefined || edge.traffic === 'both' || edge.traffic === traffic
}

function ids(nodes: DesignNode[]): Set<string> {
  return new Set(nodes.map((node) => node.id))
}

function matching(design: Design, selector: NodeSelector): DesignNode[] {
  return design.nodes.filter((node) => matches(node, selector))
}

function matches(node: DesignNode, selector: NodeSelector): boolean {
  const { component, config = {} } = typeof selector === 'string' || Array.isArray(selector) ? { component: selector } : (selector as Exclude<NodeSelector, string | readonly string[]>)
  const types: readonly ComponentType[] = typeof component === 'string' ? [component] : component
  if (!types.includes(node.componentType)) return false
  const values = node.config as Record<string, ConfigValue>
  return Object.entries(config).every(([key, match]) => (Array.isArray(match) ? match : [match]).includes(values[key]))
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

const RULE_FIELDS = new Set(['id', 'weight', 'description', 'hints', 'check'])

/** The fields of each predicate type; validation refuses others. */
const PREDICATE_FIELDS: Record<Predicate['type'], ReadonlySet<string>> = {
  node: new Set(['type', 'node', 'min', 'max']),
  edge: new Set(['type', 'from', 'to', 'traffic']),
  'no-edge': new Set(['type', 'from', 'to']),
  path: new Set(['type', 'from', 'to', 'through', 'traffic']),
  config: new Set(['type', 'node', 'key', 'equals', 'in']),
  'edge-mode': new Set(['type', 'from', 'to', 'mode']),
  'all-of': new Set(['type', 'predicates']),
  'any-of': new Set(['type', 'predicates']),
  not: new Set(['type', 'predicate']),
  custom: new Set(['type', 'name']),
  simulation: new Set(['type', 'chaos', 'maxLatencyMs', 'maxOverloadedNodes', 'maxErrorRate']),
}

/**
 * Checks authored Rules against the Rule schema: known predicates, component types, config fields and
 * values, three Hint tiers each, unique ids, and only the Stage's `chaosTaskIds` named. Returns the Rules,
 * or undefined after reporting every problem.
 */
export function validateRules(input: unknown, problem: (message: string) => void, chaosTaskIds: ReadonlySet<string>): Rule[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return void problem('"rules" must list at least one Rule')
  let valid = true
  const ids = new Set<string>()
  input.forEach((item: unknown, i) => {
    const name = isRecord(item) && isText(item.id) ? `Rule "${item.id}"` : `Rule #${i + 1}`
    const fail = (message: string) => {
      valid = false
      problem(`${name}: ${message}`)
    }
    if (!isRecord(item)) return fail('must be an object')
    for (const field of Object.keys(item)) if (!RULE_FIELDS.has(field)) fail(`unknown field "${field}"`)
    if (!isText(item.id)) fail('"id" must be a non-empty string')
    else if (ids.has(item.id)) fail('its id is already used in the Stage')
    else ids.add(item.id)
    if (typeof item.weight !== 'number' || !Number.isFinite(item.weight) || item.weight <= 0) fail('"weight" must be a positive number')
    if (!isText(item.description)) fail('"description" must be a non-empty string')
    if (!Array.isArray(item.hints) || item.hints.length !== HINT_TIERS || !item.hints.every(isText)) {
      fail('"hints" must be three texts')
    }
    checkPredicate(item.check, (message) => fail(`check: ${message}`), chaosTaskIds)
  })
  return valid ? (input as Rule[]) : undefined
}

const CHAOS_TASK_FIELDS = new Set(['id', 'prompt', 'scenario'])

/** The fields of each Chaos task scenario type; validation refuses others. */
const CHAOS_SCENARIO_FIELDS: Record<ChaosType, ReadonlySet<string>> = {
  'node-down': new Set(['type', 'nodes']),
  'zone-down': new Set(['type', 'zonesOf']),
  'cache-cold': new Set(['type', 'nodes']),
  partition: new Set(['type', 'sides']),
}

/** Checks a Stage's authored Chaos tasks: unique ids, a prompt each and a known scenario of valid selectors. */
export function validateChaosTasks(input: unknown, problem: (message: string) => void): ChaosTask[] | undefined {
  if (!Array.isArray(input)) return void problem('"chaosTasks" must be a list of Chaos tasks')
  let valid = true
  const ids = new Set<string>()
  input.forEach((item: unknown, i) => {
    const name = isRecord(item) && isText(item.id) ? `Chaos task "${item.id}"` : `Chaos task #${i + 1}`
    const fail = (message: string) => {
      valid = false
      problem(`${name}: ${message}`)
    }
    if (!isRecord(item)) return fail('must be an object')
    for (const field of Object.keys(item)) if (!CHAOS_TASK_FIELDS.has(field)) fail(`unknown field "${field}"`)
    if (!isText(item.id)) fail('"id" must be a non-empty string')
    else if (ids.has(item.id)) fail('its id is already used in the Stage')
    else ids.add(item.id)
    if (!isText(item.prompt)) fail('"prompt" must be a non-empty string')
    checkChaosScenario(item.scenario, (message) => fail(`scenario: ${message}`))
  })
  return valid ? (input as ChaosTask[]) : undefined
}

function checkChaosScenario(value: unknown, fail: (message: string) => void): void {
  if (!isRecord(value)) return fail('must be an object')
  const type = CHAOS_TYPES.find((known) => known === value.type)
  if (!type) return fail(`"type" must be one of ${CHAOS_TYPES.join(', ')}`)
  for (const field of Object.keys(value)) if (!CHAOS_SCENARIO_FIELDS[type].has(field)) fail(`unknown field "${field}" in a ${type} scenario`)
  const checkSelectors = (field: string, selectors: unknown) => {
    if (!Array.isArray(selectors) || selectors.length === 0) return fail(`"${field}" must list at least one node selector`)
    for (const selector of selectors) checkSelector(selector, fail)
  }
  switch (type) {
    case 'node-down':
    case 'cache-cold':
      return checkSelectors('nodes', value.nodes)
    case 'zone-down':
      return checkSelectors('zonesOf', value.zonesOf)
    case 'partition':
      if (!Array.isArray(value.sides) || value.sides.length !== 2) return fail('"sides" must be two lists of node selectors')
      for (const side of value.sides) checkSelectors('sides', side)
  }
}

function checkPredicate(value: unknown, fail: (message: string) => void, chaosTaskIds: ReadonlySet<string>): void {
  if (!isRecord(value)) return fail('a predicate must be an object')
  const type = Object.hasOwn(PREDICATE_FIELDS, String(value.type)) ? (value.type as Predicate['type']) : undefined
  if (!type) return fail(`unknown predicate type "${String(value.type)}"`)
  for (const field of Object.keys(value)) if (!PREDICATE_FIELDS[type].has(field)) fail(`unknown field "${field}" in a ${type} predicate`)

  switch (type) {
    case 'node': {
      checkSelector(value.node, fail)
      const { min, max } = value
      const bounds = [min, max].filter((bound) => bound !== undefined)
      if (!bounds.every(isCount) || (bounds.length === 2 && (min as number) > (max as number))) fail('"min" and "max" must be whole numbers with min ≤ max')
      return
    }
    case 'edge':
    case 'no-edge':
    case 'path':
    case 'edge-mode':
      checkSelector(value.from, fail)
      checkSelector(value.to, fail)
      if (value.through !== undefined) checkSelector(value.through, fail)
      if (value.traffic !== undefined && value.traffic !== 'read' && value.traffic !== 'write') fail('"traffic" must be "read" or "write"')
      if (type === 'edge-mode' && !EDGE_MODES.includes(value.mode as EdgeMode)) fail(`"mode" must be one of ${EDGE_MODES.join(', ')}`)
      return
    case 'config': {
      const types = checkSelector(value.node, fail)
      if ((value.equals === undefined) === (value.in === undefined)) return fail('give either "equals" or "in"')
      if (value.in !== undefined && (!Array.isArray(value.in) || value.in.length === 0)) return fail('"in" must list at least one value')
      if (!isText(value.key)) return fail('"key" must be a config field')
      checkConfigValues(types, value.key, (value.in as unknown[] | undefined) ?? [value.equals], fail)
      return
    }
    case 'all-of':
    case 'any-of':
      if (!Array.isArray(value.predicates) || value.predicates.length === 0) return fail('"predicates" must list at least one predicate')
      for (const part of value.predicates) checkPredicate(part, fail, chaosTaskIds)
      return
    case 'not':
      return checkPredicate(value.predicate, fail, chaosTaskIds)
    case 'custom':
      if (!isText(value.name) || !Object.hasOwn(CUSTOM_PREDICATES, value.name)) fail(`no custom predicate "${String(value.name)}" is registered`)
      return
    case 'simulation': {
      const { chaos, maxLatencyMs, maxOverloadedNodes, maxErrorRate } = value
      if (chaos !== undefined && !(isText(chaos) && chaosTaskIds.has(chaos))) fail(`"chaos" names no Chaos task of the Stage: "${String(chaos)}"`)
      if ([maxLatencyMs, maxOverloadedNodes, maxErrorRate].every((target) => target === undefined)) return fail('a simulation predicate must set at least one target')
      const latencies = isRecord(maxLatencyMs) ? Object.entries(maxLatencyMs) : []
      const latenciesFit = latencies.length > 0 && latencies.every(([kind, ms]) => REQUEST_KINDS.includes(kind as RequestKind) && isPositive(ms))
      if (maxLatencyMs !== undefined && !latenciesFit) fail('"maxLatencyMs" must give positive numbers for "read" and "write" only')
      if (maxOverloadedNodes !== undefined && !isCount(maxOverloadedNodes)) fail('"maxOverloadedNodes" must be a whole number of at least 0')
      const perKind = isRecord(maxErrorRate) ? Object.entries(maxErrorRate) : undefined
      const ratesFit = perKind
        ? perKind.length > 0 && perKind.every(([kind, rate]) => REQUEST_KINDS.includes(kind as RequestKind) && isShare(rate))
        : isShare(maxErrorRate)
      if (maxErrorRate !== undefined && !ratesFit) fail('"maxErrorRate" must be a number from 0 to 1, or such numbers for "read" and "write" only')
      return
    }
  }
}

/** Checks a node selector; returns the component types it names. */
function checkSelector(value: unknown, fail: (message: string) => void): ComponentType[] {
  const { component, config, ...rest } = typeof value === 'string' || Array.isArray(value) ? { component: value } : isRecord(value) ? value : {}
  if (Object.keys(rest).length > 0) fail('a node selector has only "component" and "config"')
  const listed: unknown[] = typeof component === 'string' ? [component] : Array.isArray(component) ? component : []
  if (listed.length === 0) fail('a node selector must name at least one component type')
  const types = listed.filter((type): type is ComponentType => {
    if (isComponentType(type)) return true
    fail(`unknown component type "${String(type)}"`)
    return false
  })
  if (config === undefined) return types
  if (!isRecord(config)) {
    fail('the "config" of a node selector must be an object')
    return types
  }
  for (const [key, match] of Object.entries(config)) checkConfigValues(types, key, Array.isArray(match) ? match : [match], fail)
  return types
}

/** Every value fits the `key` field of every component type, so that a filter can match each of them. */
function checkConfigValues(types: ComponentType[], key: string, values: unknown[], fail: (message: string) => void): void {
  for (const type of types) {
    if (!Object.hasOwn(componentDefinition(type).config, key)) {
      fail(`${type} has no config field "${key}"`)
      continue
    }
    for (const value of values) {
      if (configProblem(type, key, value)) fail(`${JSON.stringify(value)} does not fit the ${type} config field "${key}"`)
    }
  }
}

function isCount(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0
}

function isShare(value: unknown): boolean {
  return typeof value === 'number' && value >= 0 && value <= 1
}

function isPositive(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
