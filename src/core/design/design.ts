import { isRecord } from '../content/validation'
import {
  componentDefinition,
  configProblem,
  defaultConfig,
  isComponentType,
  isFieldApplicable,
  type ComponentConfig,
  type ComponentType,
} from './components'

// A Design is a graph of Nodes (components) and Edges (data flow), shared by the Design Canvas, the
// Rule Engine and the Traffic Simulation. It knows nothing of how a canvas draws it.

export interface Position {
  x: number
  y: number
}

interface NodeBase<T extends ComponentType> {
  /** Unique within the Design; Edges refer to it. */
  id: string
  componentType: T
  config: ComponentConfig<T>
  label: string
  notes: string
  /** The zone or region box the Node is in, if any. */
  zoneId?: string
  /** Where the canvas draws it. Rules and the simulation ignore it. */
  position: Position
}

/** A component in a Design, with the config of its type. */
export type DesignNode = { [T in ComponentType]: NodeBase<T> }[ComponentType]

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

export interface Design {
  nodes: DesignNode[]
  edges: DesignEdge[]
}

export const LABEL_MAX_LENGTH = 80
export const NOTES_MAX_LENGTH = 2000

export function emptyDesign(): Design {
  return { nodes: [], edges: [] }
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
  const prefix = `${componentType}-`
  const numbers = design.nodes.map((node) => (node.id.startsWith(prefix) ? Number(node.id.slice(prefix.length)) : 0))
  const number = Math.max(0, ...numbers.filter(Number.isInteger)) + 1
  const nodeId = `${prefix}${number}`
  const node = {
    id: nodeId,
    componentType,
    label: number === 1 ? baseLabel : `${baseLabel} ${number}`,
    notes: '',
    config: defaultConfig(componentType),
    position,
  } as DesignNode
  return { design: { ...design, nodes: [...design.nodes, node] }, nodeId }
}

export function moveNodes(design: Design, positions: Record<string, Position>): Design {
  return mapNodes(design, (node) => (Object.hasOwn(positions, node.id) ? { ...node, position: positions[node.id] } : node))
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
  const edge: DesignEdge = { id: `${source}->${target}`, source, target, mode: 'sync', traffic: 'both' }
  return { ...design, edges: [...design.edges, edge] }
}

export function updateEdge(design: Design, edgeId: string, change: Partial<Pick<DesignEdge, 'mode' | 'traffic'>>): Design {
  if (!design.edges.some((edge) => edge.id === edgeId)) throw new RangeError(`No edge ${edgeId}.`)
  return { ...design, edges: design.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...change } : edge)) }
}

/** Removes Nodes with every Edge touching them, and Edges on their own. */
export function removeElements(design: Design, { nodeIds = [], edgeIds = [] }: { nodeIds?: string[]; edgeIds?: string[] }): Design {
  const removedNodes = new Set(nodeIds)
  const removedEdges = new Set(edgeIds)
  return {
    nodes: design.nodes.filter((node) => !removedNodes.has(node.id)),
    edges: design.edges.filter(
      (edge) => !removedEdges.has(edge.id) && !removedNodes.has(edge.source) && !removedNodes.has(edge.target),
    ),
  }
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
  const problems: string[] = []
  const nodeIds = new Set<string>()
  const nodes = value.nodes.flatMap((item: unknown, i): DesignNode[] => {
    const node = readNode(item, (message) => problems.push(`node ${i + 1}: ${message}`))
    if (!node) return []
    if (nodeIds.has(node.id)) problems.push(`node ${i + 1}: its id "${node.id}" is already used`)
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

  return problems.length > 0 ? { problems } : { design: { nodes, edges }, problems }
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
  if (!isRecord(position) || !Number.isFinite(position.x) || !Number.isFinite(position.y)) fail('"position" must be a point')
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
  } as DesignNode
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}
