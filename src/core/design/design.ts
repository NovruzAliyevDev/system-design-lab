import { isRecord } from '../content/validation'
import {
  componentDefinition,
  configProblem,
  defaultConfig,
  isComponentType,
  isFieldApplicable,
  type ComponentConfig,
  type ComponentType,
  type SimulationDefaults,
} from './components'

// A Design is a graph of Nodes (components) and Edges (data flow), shared by the Design Canvas, the
// Rule Engine and the Traffic Simulation. It knows nothing of how a canvas draws it. A UML Design, built
// on the UML Class Builder, keeps its classes and relations in lists of their own beside the Nodes and
// Edges (docs/adr/0001), so that it shares serialisation, history and storage with every other Design.

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/**
 * The box the canvas draws a Node in, from its position as the top-left corner. Zones take a Node in
 * by the centre of this box.
 */
export const NODE_SIZE: Size = { width: 176, height: 64 }

interface NodeBase<T extends ComponentType> {
  /** Unique within the Design; Edges refer to it. */
  id: string
  componentType: T
  config: ComponentConfig<T>
  label: string
  notes: string
  /** The innermost zone or region box around the Node's centre, if any. */
  zoneId?: string
  /** Where the canvas draws it. Rules and the simulation ignore it. */
  position: Position
  /** What the Traffic Simulation uses instead of the component defaults; absent when it uses them all. */
  simulation?: SimulationSettings
}

/** A component in a Design, with the config of its type. */
export type DesignNode = { [T in ComponentType]: NodeBase<T> }[ComponentType]

/** The numbers of the Traffic Simulation a Node can set for itself. */
export const SIMULATION_SETTINGS = ['capacityQps', 'baseLatencyMs', 'monthlyCostUsd', 'hitRatio'] as const
export type SimulationSetting = (typeof SIMULATION_SETTINGS)[number]
export type SimulationSettings = Partial<Record<SimulationSetting, number>>

export const EDGE_MODES = ['sync', 'async'] as const
export type EdgeMode = (typeof EDGE_MODES)[number]

/** What an Edge carries: reads, writes or both. */
export const EDGE_TRAFFIC = ['read', 'write', 'both'] as const
export type EdgeTraffic = (typeof EDGE_TRAFFIC)[number]

/** Requests flowing from `source` to `target`. */
export interface DesignEdge {
  id: string
  source: string
  target: string
  mode: EdgeMode
  traffic: EdgeTraffic
}

/** A box grouping Nodes, e.g. an availability zone, or a region with zones inside it. */
export interface DesignZone {
  id: string
  label: string
  /** The top-left corner. */
  position: Position
  size: Size
}

/**
 * Whether a class can be instantiated, must be subclassed, only declares methods for others to implement,
 * or is an enumeration, whose fields are its values.
 */
export const CLASS_KINDS = ['class', 'abstract', 'interface', 'enum'] as const
export type ClassKind = (typeof CLASS_KINDS)[number]

/** A class of a UML Design. */
export interface DesignClass {
  /** Unique within the Design, e.g. `class-2`; relations refer to it. */
  id: string
  name: string
  kind: ClassKind
  /** As the learner writes them, one per entry, e.g. `size: int`; Rules match the `memberName`. */
  fields: string[]
  methods: string[]
  /** Where the canvas draws it. Rules ignore it. */
  position: Position
}

/**
 * How the `source` class relates to the `target` class:
 * - `inheritance`: the source is a subclass of the target;
 * - `implementation`: the source implements the target interface;
 * - `composition`: the source is a whole the target part belongs to, and lives and dies with;
 * - `aggregation`: the source is a whole that holds target parts, which can exist without it;
 * - `association`: the source knows of and uses the target.
 */
export const RELATION_KINDS = ['inheritance', 'implementation', 'composition', 'aggregation', 'association'] as const
export type RelationKind = (typeof RELATION_KINDS)[number]

/** How many objects of the class at one end of a relation take part: exactly one, at most one, any number, at least one. */
export const MULTIPLICITIES = ['1', '0..1', '*', '1..*'] as const
export type Multiplicity = (typeof MULTIPLICITIES)[number]

/**
 * A relation between classes of a UML Design, at most one each way between two of them. A class can
 * relate to itself, e.g. a linked-list Node to the next one.
 */
export interface DesignRelation {
  id: string
  source: string
  target: string
  kind: RelationKind
  /** Set when the learner gives one. */
  sourceMultiplicity?: Multiplicity
  targetMultiplicity?: Multiplicity
}

export interface Design {
  nodes: DesignNode[]
  edges: DesignEdge[]
  zones: DesignZone[]
  /** A UML Design's Nodes. */
  classes: DesignClass[]
  /** A UML Design's Edges. */
  relations: DesignRelation[]
}

export const LABEL_MAX_LENGTH = 80
export const NOTES_MAX_LENGTH = 2000
export const ZONE_MIN_SIZE: Size = { width: 160, height: 100 }

export const MEMBER_MAX_LENGTH = 120
export const MAX_MEMBERS = 30

export function emptyDesign(): Design {
  return { nodes: [], edges: [], zones: [], classes: [], relations: [] }
}

/**
 * Adds a component with its default config. Its id numbers it after the highest of its type in use
 * (e.g. `cache-3`), and its label is `baseLabel`, numbered the same way when it is not the first.
 */
export function addNode(
  design: Design,
  componentType: ComponentType,
  position: Position,
  baseLabel: string,
): { design: Design; nodeId: string } {
  const number = nextNumber(design.nodes, componentType)
  const nodeId = `${componentType}-${number}`
  const node = {
    id: nodeId,
    componentType,
    label: number === 1 ? baseLabel : `${baseLabel} ${number}`,
    notes: '',
    config: defaultConfig(componentType),
    position,
  } as DesignNode
  return { design: placeInZones({ ...design, nodes: [...design.nodes, node] }), nodeId }
}

/** Moves Nodes, which then belong to the zone they were moved into, if any. */
export function moveNodes(design: Design, positions: Record<string, Position>): Design {
  return placeInZones(mapNodes(design, (node) => (Object.hasOwn(positions, node.id) ? { ...node, position: positions[node.id] } : node)))
}

/** The number after the highest id `<prefix>-N` in use, e.g. 3 when `cache-2` is the highest cache. */
export function nextNumber(items: readonly { id: string }[], prefix: string): number {
  const numbers = items.map((item) => (item.id.startsWith(`${prefix}-`) ? Number(item.id.slice(prefix.length + 1)) : 0))
  return Math.max(0, ...numbers.filter(Number.isInteger)) + 1
}

export function renameNode(design: Design, nodeId: string, label: string): Design {
  if (label.length > LABEL_MAX_LENGTH) throw new RangeError(`A label has at most ${LABEL_MAX_LENGTH} characters.`)
  return updateNode(design, nodeId, (node) => ({ ...node, label }))
}

export function setNodeNotes(design: Design, nodeId: string, notes: string): Design {
  if (notes.length > NOTES_MAX_LENGTH) throw new RangeError(`Notes have at most ${NOTES_MAX_LENGTH} characters.`)
  return updateNode(design, nodeId, (node) => ({ ...node, notes }))
}

/**
 * Sets one config field; throws a `RangeError` when the value does not fit the component type's schema.
 * Fields that stop applying (e.g. read replicas, once the node is a replica) go back to their defaults.
 */
export function setNodeConfig(design: Design, nodeId: string, key: string, value: unknown): Design {
  return updateNode(design, nodeId, (node) => {
    const config: Record<string, unknown> = { ...node.config, [key]: value }
    const problem = configProblem(node.componentType, key, value, config)
    if (problem) throw new RangeError(`${node.componentType} config "${key}": ${problem}.`)
    for (const [fieldKey, field] of Object.entries(componentDefinition(node.componentType).config)) {
      if (!isFieldApplicable(field, config)) config[fieldKey] = field.default
    }
    return { ...node, config } as DesignNode
  })
}

/** What the Traffic Simulation uses for a Node: its component's defaults with the Node's own settings; none for a client. */
export function nodeSimulation(node: DesignNode): SimulationDefaults | undefined {
  const defaults = componentDefinition(node.componentType).simulation
  return defaults && { ...defaults, ...node.simulation }
}

/**
 * Sets one simulation number of a Node, or clears it back to the default with `undefined`. Throws a
 * `RangeError` for a value that makes no sense, or a setting the component does not have.
 */
export function setNodeSimulation(design: Design, nodeId: string, key: SimulationSetting, value: number | undefined): Design {
  return updateNode(design, nodeId, (node) => {
    const { simulation: _, ...rest } = node
    const settings: SimulationSettings = { ...node.simulation }
    if (value === undefined) delete settings[key]
    else {
      const problem = simulationProblem(node.componentType, key, value)
      if (problem) throw new RangeError(`${node.componentType} simulation "${key}": ${problem}.`)
      settings[key] = value
    }
    return (Object.keys(settings).length === 0 ? rest : { ...rest, simulation: settings }) as DesignNode
  })
}

/** Why a value cannot be a simulation setting: one the component lacks, not a number, or out of its range. */
export type SimulationProblem = 'no-such-setting' | 'not-a-number' | 'not-positive' | 'negative' | 'not-a-share'

/** Why `value` cannot be the `key` simulation setting of a component type's Node, or undefined when it can. */
export function simulationProblem(componentType: ComponentType, key: string, value: unknown): SimulationProblem | undefined {
  const defaults = componentDefinition(componentType).simulation
  if (!defaults || !(SIMULATION_SETTINGS as readonly string[]).includes(key) || (key === 'hitRatio' && defaults.hitRatio === undefined)) {
    return 'no-such-setting'
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'not-a-number'
  // A hit ratio is a share; a cost may be 0; capacity and latency must be more than 0.
  if (key === 'hitRatio') return value >= 0 && value <= 1 ? undefined : 'not-a-share'
  if (key === 'monthlyCostUsd') return value >= 0 ? undefined : 'negative'
  return value > 0 ? undefined : 'not-positive'
}

/** Whether an Edge from `source` to `target` may be added: both exist, they differ and are not yet connected that way. */
export function canConnect(design: Design, source: string, target: string): boolean {
  const ids = new Set(design.nodes.map((node) => node.id))
  return (
    source !== target &&
    ids.has(source) &&
    ids.has(target) &&
    !design.edges.some((edge) => edge.source === source && edge.target === target)
  )
}

/** Adds a synchronous Edge carrying reads and writes; throws a `RangeError` when `canConnect` refuses it. */
export function connect(design: Design, source: string, target: string): Design {
  if (!canConnect(design, source, target)) throw new RangeError(`Cannot connect ${source} to ${target}.`)
  const edge: DesignEdge = { id: edgeId(source, target), source, target, mode: 'sync', traffic: 'both' }
  return { ...design, edges: [...design.edges, edge] }
}

/** The id of the Edge from `source` to `target`; there is at most one. */
export function edgeId(source: string, target: string): string {
  return `${source}->${target}`
}

export function updateEdge(design: Design, edgeId: string, change: Partial<Pick<DesignEdge, 'mode' | 'traffic'>>): Design {
  if (!design.edges.some((edge) => edge.id === edgeId)) throw new RangeError(`No edge ${edgeId}.`)
  return { ...design, edges: design.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...change } : edge)) }
}

export interface ElementIds {
  /** Nodes, or the classes of a UML Design. */
  nodeIds?: string[]
  /** Edges, or the relations of a UML Design. */
  edgeIds?: string[]
  zoneIds?: string[]
}

/**
 * Removes Nodes (and classes) with every Edge (and relation) touching them, Edges and relations on their
 * own, and zone boxes (but not the Nodes in them).
 */
export function removeElements(design: Design, { nodeIds = [], edgeIds = [], zoneIds = [] }: ElementIds): Design {
  const removedNodes = new Set(nodeIds)
  const removedEdges = new Set(edgeIds)
  const removedZones = new Set(zoneIds)
  const kept = (link: { id: string; source: string; target: string }) =>
    !removedEdges.has(link.id) && !removedNodes.has(link.source) && !removedNodes.has(link.target)
  return placeInZones({
    nodes: design.nodes.filter((node) => !removedNodes.has(node.id)),
    edges: design.edges.filter(kept),
    zones: design.zones.filter((zone) => !removedZones.has(zone.id)),
    classes: design.classes.filter((each) => !removedNodes.has(each.id)),
    relations: design.relations.filter(kept),
  })
}

/**
 * Adds a zone box of at least `ZONE_MIN_SIZE`. Its id numbers it after the highest in use (e.g. `zone-3`),
 * and its label is `baseLabel`, numbered the same way when it is not the first. The Nodes it covers move into it.
 */
export function addZone(design: Design, position: Position, size: Size, baseLabel: string): { design: Design; zoneId: string } {
  const number = nextNumber(design.zones, 'zone')
  const zone: DesignZone = {
    id: `zone-${number}`,
    label: number === 1 ? baseLabel : `${baseLabel} ${number}`,
    position,
    size: atLeastMinimum(size),
  }
  return { design: placeInZones({ ...design, zones: [...design.zones, zone] }), zoneId: zone.id }
}

export function renameZone(design: Design, zoneId: string, label: string): Design {
  if (label.length > LABEL_MAX_LENGTH) throw new RangeError(`A label has at most ${LABEL_MAX_LENGTH} characters.`)
  return updateZone(design, zoneId, (zone) => ({ ...zone, label }))
}

/** Moves or resizes a zone box alone, e.g. by a corner; Nodes join or leave it as it now covers them. */
export function setZoneBounds(design: Design, zoneId: string, position: Position, size: Size): Design {
  return placeInZones(updateZone(design, zoneId, (zone) => ({ ...zone, position, size: atLeastMinimum(size) })))
}

/** Moves a zone box with what is in it: its Nodes, and the zones wholly inside it with theirs. */
export function moveZone(design: Design, zoneId: string, position: Position): Design {
  const moving = design.zones.find((zone) => zone.id === zoneId)
  if (!moving) throw new RangeError(`No zone ${zoneId}.`)
  const zoneIds = new Set(design.zones.filter((zone) => zone === moving || contains(moving, zone)).map((zone) => zone.id))
  const shift = ({ x, y }: Position): Position => ({ x: x + position.x - moving.position.x, y: y + position.y - moving.position.y })
  return placeInZones({
    ...design,
    nodes: design.nodes.map((node) => (node.zoneId !== undefined && zoneIds.has(node.zoneId) ? { ...node, position: shift(node.position) } : node)),
    zones: design.zones.map((zone) => (zoneIds.has(zone.id) ? { ...zone, position: shift(zone.position) } : zone)),
  })
}

/**
 * Moves Nodes, zones and classes, by id, to where they were dragged together. A zone takes what is in it
 * along, so a Node or zone inside it that was dragged with it ends up where it was dragged too.
 */
export function moveElements(design: Design, positions: Record<string, Position>): Design {
  let next = design
  for (const zone of design.zones) if (Object.hasOwn(positions, zone.id)) next = moveZone(next, zone.id, positions[zone.id])
  const nodeIds = new Set(design.nodes.map((node) => node.id))
  next = moveNodes(next, Object.fromEntries(Object.entries(positions).filter(([id]) => nodeIds.has(id))))
  return { ...next, classes: next.classes.map((each) => (Object.hasOwn(positions, each.id) ? { ...each, position: positions[each.id] } : each)) }
}

/** The innermost (smallest) zone covering `point`; of equal ones the last added, which the canvas draws on top. */
export function zoneAt(design: Design, point: Position): string | undefined {
  let found: DesignZone | undefined
  for (const zone of design.zones) {
    if (covers(zone, point) && (!found || zoneArea(zone) <= zoneArea(found))) found = zone
  }
  return found?.id
}

export function nodeCentre(position: Position): Position {
  return { x: position.x + NODE_SIZE.width / 2, y: position.y + NODE_SIZE.height / 2 }
}

/** Puts every Node, or only the ones given, in the innermost zone around its centre, or in none. */
export function placeInZones(design: Design, nodeIds?: ReadonlySet<string>): Design {
  return mapNodes(design, (node) => {
    if (nodeIds && !nodeIds.has(node.id)) return node
    const zoneId = zoneAt(design, nodeCentre(node.position))
    if (zoneId === node.zoneId) return node
    const { zoneId: _, ...outside } = node
    return (zoneId === undefined ? outside : { ...outside, zoneId }) as DesignNode
  })
}

function covers({ position, size }: DesignZone, point: Position): boolean {
  return point.x >= position.x && point.x <= position.x + size.width && point.y >= position.y && point.y <= position.y + size.height
}

/** Whether `inner` lies wholly inside `outer`. */
export function contains(outer: DesignZone, inner: DesignZone): boolean {
  return covers(outer, inner.position) && covers(outer, { x: inner.position.x + inner.size.width, y: inner.position.y + inner.size.height })
}

export function zoneArea(zone: DesignZone): number {
  return zone.size.width * zone.size.height
}

function atLeastMinimum(size: Size): Size {
  return { width: Math.max(ZONE_MIN_SIZE.width, size.width), height: Math.max(ZONE_MIN_SIZE.height, size.height) }
}

/** Adds a class, `class-N` after the highest in use, named `baseName` and numbered the same way when it is not the first. */
export function addClass(design: Design, position: Position, baseName: string): { design: Design; classId: string } {
  const number = nextNumber(design.classes, 'class')
  const added: DesignClass = { id: `class-${number}`, name: number === 1 ? baseName : `${baseName} ${number}`, kind: 'class', fields: [], methods: [], position }
  return { design: { ...design, classes: [...design.classes, added] }, classId: added.id }
}

/** Changes a class; throws a `RangeError` for a name or member that is too long, too many members, or no such class. */
export function updateClass(design: Design, classId: string, change: Partial<Pick<DesignClass, 'name' | 'kind' | 'fields' | 'methods'>>): Design {
  if (!design.classes.some((each) => each.id === classId)) throw new RangeError(`No class ${classId}.`)
  if (change.name !== undefined && change.name.length > LABEL_MAX_LENGTH) throw new RangeError(`A class name has at most ${LABEL_MAX_LENGTH} characters.`)
  for (const members of [change.fields, change.methods]) {
    if (members !== undefined && !isMemberList(members)) {
      throw new RangeError(`A class has at most ${MAX_MEMBERS} fields and ${MAX_MEMBERS} methods of at most ${MEMBER_MAX_LENGTH} characters.`)
    }
  }
  return { ...design, classes: design.classes.map((each) => (each.id === classId ? { ...each, ...change } : each)) }
}

/**
 * The name Rules match a field or method by: what comes before its type or parameters, without a
 * visibility sign, e.g. `get` for `+ get(query): Node`.
 */
export function memberName(member: string): string {
  return member.trim().replace(/^[-+#~]\s*/, '').split(/[\s(:]/, 1)[0]
}

/** Whether a relation from the `source` class to the `target` class (maybe itself) may be added: both exist and are not yet related that way. */
export function canRelate(design: Design, source: string, target: string): boolean {
  const ids = new Set(design.classes.map((umlClass) => umlClass.id))
  return ids.has(source) && ids.has(target) && !design.relations.some((relation) => relation.source === source && relation.target === target)
}

/** Adds a relation without multiplicities; throws a `RangeError` when `canRelate` refuses it. */
export function relate(design: Design, source: string, target: string, kind: RelationKind): Design {
  if (!canRelate(design, source, target)) throw new RangeError(`Cannot relate ${source} to ${target}.`)
  return { ...design, relations: [...design.relations, { id: edgeId(source, target), source, target, kind }] }
}

/** Changes a relation's kind or multiplicities; a multiplicity given as `undefined` is cleared. */
export function updateRelation(
  design: Design,
  relationId: string,
  change: Partial<Pick<DesignRelation, 'kind' | 'sourceMultiplicity' | 'targetMultiplicity'>>,
): Design {
  return updateRelationWith(design, relationId, (relation) => {
    const next: DesignRelation = { ...relation, ...change }
    if (next.sourceMultiplicity === undefined) delete next.sourceMultiplicity
    if (next.targetMultiplicity === undefined) delete next.targetMultiplicity
    return next
  })
}

/**
 * Turns a relation round, its multiplicities with it, e.g. an inheritance drawn from the superclass;
 * throws when that way is taken. A class's relation to itself only swaps its multiplicities.
 */
export function reverseRelation(design: Design, relationId: string): Design {
  const relation = design.relations.find((candidate) => candidate.id === relationId)
  if (relation && design.relations.some((other) => other !== relation && other.source === relation.target && other.target === relation.source)) {
    throw new RangeError(`${relation.target} is already related to ${relation.source}.`)
  }
  return updateRelationWith(design, relationId, ({ source, target, kind, sourceMultiplicity, targetMultiplicity }) => ({
    id: edgeId(target, source),
    source: target,
    target: source,
    kind,
    ...(targetMultiplicity !== undefined && { sourceMultiplicity: targetMultiplicity }),
    ...(sourceMultiplicity !== undefined && { targetMultiplicity: sourceMultiplicity }),
  }))
}

function updateRelationWith(design: Design, relationId: string, change: (relation: DesignRelation) => DesignRelation): Design {
  if (!design.relations.some((each) => each.id === relationId)) throw new RangeError(`No relation ${relationId}.`)
  return { ...design, relations: design.relations.map((each) => (each.id === relationId ? change(each) : each)) }
}

function isMemberList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_MEMBERS && value.every((member) => typeof member === 'string' && member.length <= MEMBER_MAX_LENGTH)
}

function updateZone(design: Design, zoneId: string, change: (zone: DesignZone) => DesignZone): Design {
  if (!design.zones.some((zone) => zone.id === zoneId)) throw new RangeError(`No zone ${zoneId}.`)
  return { ...design, zones: design.zones.map((zone) => (zone.id === zoneId ? change(zone) : zone)) }
}

function updateNode(design: Design, nodeId: string, change: (node: DesignNode) => DesignNode): Design {
  if (!design.nodes.some((node) => node.id === nodeId)) throw new RangeError(`No node ${nodeId}.`)
  return mapNodes(design, (node) => (node.id === nodeId ? change(node) : node))
}

function mapNodes(design: Design, change: (node: DesignNode) => DesignNode): Design {
  return { ...design, nodes: design.nodes.map(change) }
}

export class InvalidDesignError extends Error {
  override name = 'InvalidDesignError'

  constructor(readonly problems: string[]) {
    super(`Invalid Design: ${problems.join('; ')}.`)
  }
}

export function serializeDesign(design: Design): string {
  return JSON.stringify(design)
}

/** Reads a serialised Design; throws `InvalidDesignError` listing every problem when it is not one. */
export function deserializeDesign(text: string): Design {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new InvalidDesignError(['the text is not JSON'])
  }
  const { design, problems } = readDesign(value)
  if (!design) throw new InvalidDesignError(problems)
  return design
}

/**
 * Checks a stored Design against the model and every component type's config schema. Config fields
 * added since the Design was stored get their defaults. Returns the Design, or every problem found.
 */
export function readDesign(value: unknown): { design?: Design; problems: string[] } {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return { problems: ['a Design must have lists of nodes and edges'] }
  }
  // Designs stored before zones existed have none.
  const storedZones = value.zones ?? []
  if (!Array.isArray(storedZones)) return { problems: ['the zones of a Design must be a list'] }
  const problems: string[] = []

  const zoneIds = new Set<string>()
  const zones = storedZones.flatMap((item: unknown, i): DesignZone[] => {
    const zone = readZone(item, (message) => problems.push(`zone ${i + 1}: ${message}`))
    if (!zone) return []
    if (zoneIds.has(zone.id)) problems.push(`zone ${i + 1}: its id "${zone.id}" is already used`)
    zoneIds.add(zone.id)
    return [zone]
  })

  const nodeIds = new Set<string>()
  const nodes = value.nodes.flatMap((item: unknown, i): DesignNode[] => {
    const node = readNode(item, (message) => problems.push(`node ${i + 1}: ${message}`))
    if (!node) return []
    if (nodeIds.has(node.id)) problems.push(`node ${i + 1}: its id "${node.id}" is already used`)
    if (node.zoneId !== undefined && !zoneIds.has(node.zoneId)) problems.push(`node ${i + 1}: its zone "${node.zoneId}" is not in the Design`)
    nodeIds.add(node.id)
    return [node]
  })

  const edgeIds = new Set<string>()
  const edges = value.edges.flatMap((item: unknown, i): DesignEdge[] => {
    const problem = (message: string) => problems.push(`edge ${i + 1}: ${message}`)
    if (!isRecord(item)) {
      problem('must be an object')
      return []
    }
    const { id, source, target, mode, traffic } = item
    const before = problems.length
    if (!isId(id)) problem('"id" must be a non-empty string')
    else if (edgeIds.has(id)) problem(`its id "${id}" is already used`)
    else edgeIds.add(id)
    if (!isId(source) || !nodeIds.has(source)) problem('"source" must be the id of a node')
    if (!isId(target) || !nodeIds.has(target)) problem('"target" must be the id of a node')
    else if (source === target) problem('must connect two different nodes')
    if (!EDGE_MODES.includes(mode as EdgeMode)) problem(`"mode" must be one of ${EDGE_MODES.join(', ')}`)
    if (!EDGE_TRAFFIC.includes(traffic as EdgeTraffic)) problem(`"traffic" must be one of ${EDGE_TRAFFIC.join(', ')}`)
    if (problems.length > before) return []
    return [{ id, source, target, mode, traffic } as DesignEdge]
  })

  // Designs stored before UML Designs existed have no classes or relations.
  const storedClasses = value.classes ?? []
  const storedRelations = value.relations ?? []
  if (!Array.isArray(storedClasses) || !Array.isArray(storedRelations)) return { problems: ['the classes and relations of a Design must be lists'] }

  const classIds = new Set<string>()
  const classes = storedClasses.flatMap((item: unknown, i): DesignClass[] => {
    const read = readClass(item, (message) => problems.push(`class ${i + 1}: ${message}`))
    if (!read) return []
    if (classIds.has(read.id)) problems.push(`class ${i + 1}: its id "${read.id}" is already used`)
    classIds.add(read.id)
    return [read]
  })

  const relationIds = new Set<string>()
  const relations = storedRelations.flatMap((item: unknown, i): DesignRelation[] => {
    const relation = readRelation(item, classIds, (message) => problems.push(`relation ${i + 1}: ${message}`))
    if (!relation) return []
    if (relationIds.has(relation.id)) problems.push(`relation ${i + 1}: its id "${relation.id}" is already used`)
    relationIds.add(relation.id)
    return [relation]
  })

  return problems.length > 0 ? { problems } : { design: { nodes, edges, zones, classes, relations }, problems }
}

function readClass(item: unknown, problem: (message: string) => void): DesignClass | undefined {
  if (!isRecord(item)) return void problem('must be an object')
  const { id, name, kind, fields, methods, position } = item
  let valid = true
  const fail = (message: string) => {
    valid = false
    problem(message)
  }
  if (!isId(id)) fail('"id" must be a non-empty string')
  if (typeof name !== 'string' || name.length > LABEL_MAX_LENGTH) fail(`"name" must be text of at most ${LABEL_MAX_LENGTH} characters`)
  if (!CLASS_KINDS.includes(kind as ClassKind)) fail(`"kind" must be one of ${CLASS_KINDS.join(', ')}`)
  for (const [field, members] of [['fields', fields], ['methods', methods]] as const) {
    if (!isMemberList(members)) fail(`"${field}" must be a list of at most ${MAX_MEMBERS} texts of at most ${MEMBER_MAX_LENGTH} characters`)
  }
  if (!isPoint(position)) fail('"position" must be a point')
  if (!valid) return undefined
  const point = position as Record<string, number>
  return { id, name, kind, fields: [...(fields as string[])], methods: [...(methods as string[])], position: { x: point.x, y: point.y } } as DesignClass
}

function readRelation(item: unknown, classIds: ReadonlySet<string>, problem: (message: string) => void): DesignRelation | undefined {
  if (!isRecord(item)) return void problem('must be an object')
  const { id, source, target, kind, sourceMultiplicity, targetMultiplicity } = item
  let valid = true
  const fail = (message: string) => {
    valid = false
    problem(message)
  }
  if (!isId(id)) fail('"id" must be a non-empty string')
  if (!isId(source) || !classIds.has(source)) fail('"source" must be the id of a class')
  if (!isId(target) || !classIds.has(target)) fail('"target" must be the id of a class')
  if (!RELATION_KINDS.includes(kind as RelationKind)) fail(`"kind" must be one of ${RELATION_KINDS.join(', ')}`)
  for (const [field, multiplicity] of [['sourceMultiplicity', sourceMultiplicity], ['targetMultiplicity', targetMultiplicity]] as const) {
    if (multiplicity !== undefined && !MULTIPLICITIES.includes(multiplicity as Multiplicity)) fail(`"${field}" must be one of ${MULTIPLICITIES.join(', ')}`)
  }
  if (!valid) return undefined
  return {
    id,
    source,
    target,
    kind,
    ...(sourceMultiplicity !== undefined && { sourceMultiplicity }),
    ...(targetMultiplicity !== undefined && { targetMultiplicity }),
  } as DesignRelation
}

function readZone(item: unknown, problem: (message: string) => void): DesignZone | undefined {
  if (!isRecord(item)) return void problem('must be an object')
  const { id, label, position, size } = item
  let valid = true
  const fail = (message: string) => {
    valid = false
    problem(message)
  }
  if (!isId(id)) fail('"id" must be a non-empty string')
  if (typeof label !== 'string' || label.length > LABEL_MAX_LENGTH) fail(`"label" must be text of at most ${LABEL_MAX_LENGTH} characters`)
  if (!isPoint(position)) fail('"position" must be a point')
  if (!isRecord(size) || !isPositive(size.width) || !isPositive(size.height)) fail('"size" must have a positive width and height')
  if (!valid) return undefined
  const point = position as Record<string, number>
  const extent = size as Record<string, number>
  return { id, label, position: { x: point.x, y: point.y }, size: { width: extent.width, height: extent.height } } as DesignZone
}

function isPoint(value: unknown): boolean {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y)
}

function isPositive(value: unknown): boolean {
  return Number.isFinite(value) && (value as number) > 0
}

function readNode(item: unknown, problem: (message: string) => void): DesignNode | undefined {
  if (!isRecord(item)) return void problem('must be an object')
  const { id, componentType, label, notes, zoneId, position } = item
  let valid = true
  const fail = (message: string) => {
    valid = false
    problem(message)
  }

  if (!isId(id)) fail('"id" must be a non-empty string')
  if (typeof label !== 'string' || label.length > LABEL_MAX_LENGTH) fail(`"label" must be text of at most ${LABEL_MAX_LENGTH} characters`)
  if (typeof notes !== 'string' || notes.length > NOTES_MAX_LENGTH) fail(`"notes" must be text of at most ${NOTES_MAX_LENGTH} characters`)
  if (zoneId !== undefined && !isId(zoneId)) fail('"zoneId" must be a non-empty string when set')
  if (!isPoint(position)) fail('"position" must be a point')
  if (!isComponentType(componentType)) return void fail(`unknown component type "${String(componentType)}"`)

  if (!isRecord(item.config)) fail('"config" must be an object')
  const stored = isRecord(item.config) ? item.config : {}
  // Fields of the schema in its order, so that a Design reads the same however it was stored.
  const config = Object.fromEntries(
    Object.keys(componentDefinition(componentType).config).map((key) => [
      key,
      Object.hasOwn(stored, key) ? stored[key] : defaultConfig(componentType)[key as keyof ComponentConfig],
    ]),
  )
  for (const [key, value] of Object.entries(stored)) {
    const fieldProblem = configProblem(componentType, key, value, config)
    if (fieldProblem) fail(`config "${key}": ${fieldProblem}`)
  }
  const { simulation } = item
  if (simulation !== undefined && !isRecord(simulation)) fail('"simulation" must be an object when set')
  const settings = isRecord(simulation) ? simulation : {}
  for (const [key, value] of Object.entries(settings)) {
    const settingProblem = simulationProblem(componentType, key, value)
    if (settingProblem) fail(`simulation "${key}": ${settingProblem}`)
  }
  if (!valid) return undefined

  const point = position as Record<string, number>
  return {
    id,
    componentType,
    config,
    label,
    notes,
    ...(zoneId !== undefined && { zoneId }),
    position: { x: point.x, y: point.y },
    // Settings in a fixed order, so that a Design reads the same however it was stored.
    ...(Object.keys(settings).length > 0 && {
      simulation: Object.fromEntries(SIMULATION_SETTINGS.filter((key) => Object.hasOwn(settings, key)).map((key) => [key, settings[key]])),
    }),
  } as DesignNode
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}
