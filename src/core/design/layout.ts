import { contains, NODE_SIZE, zoneArea, type Design, type DesignNode, type DesignZone, type Position } from './design'

// Auto-layout for the Design Canvas. Requests flow from left to right: each Node sits one column
// after the furthest Node sending it requests. Zones become horizontal bands stacked from top to
// bottom, so every Node stays in its zone and zones never overlap.

const COLUMN_PITCH = NODE_SIZE.width + 96
const ROW_PITCH = NODE_SIZE.height + 40
/** Room inside a zone box around what it holds, and above it for the zone's label. */
const ZONE_PADDING = 24
const ZONE_HEADER = 40
/** Space between the Nodes of a band and the zones inside it, and between those zones. */
const BAND_GAP = 32

/** A zone, or the canvas outside every zone (`zone` undefined), with what it holds directly. */
interface Band {
  zone?: DesignZone
  nodes: DesignNode[]
  children: Band[]
  /** The number of rows its own Nodes need: the most it has in one column. */
  rows: number
  /** Whether a Node is in it or in a zone inside it. */
  occupied: boolean
  height: number
  /** Where its box starts, once the bands are stacked. */
  top: number
}

/** Moves the Nodes and zone boxes of a Design into a tidy left-to-right layout; nothing else changes. */
export function autoLayout(design: Design): Design {
  const columns = columnsOf(design)
  const root = buildBands(design, columns)

  const positions = new Map<string, Position>()
  const rowTops = new Map<Band, number>()
  placeBands(root, 0, rowTops)
  // Column by column, each Node takes the rows of its band in the order of where its senders are.
  const lastColumn = Math.max(0, ...columns.values())
  for (let column = 0; column <= lastColumn; column++) {
    for (const [band, top] of rowTops) {
      const inColumn = band.nodes.filter((node) => columns.get(node.id) === column)
      const keyed = inColumn.map((node, i) => ({ node, key: barycentre(design, node, positions), i }))
      keyed.sort((a, b) => a.key - b.key || a.i - b.i)
      keyed.forEach(({ node }, row) => positions.set(node.id, { x: column * COLUMN_PITCH, y: top + row * ROW_PITCH }))
    }
  }

  const zones = new Map<string, DesignZone>()
  boxZones(root, positions, zones)
  return {
    nodes: design.nodes.map((node) => ({ ...node, position: positions.get(node.id)! })),
    edges: design.edges,
    zones: design.zones.map((zone) => zones.get(zone.id)!),
    classes: design.classes,
    relations: design.relations,
  }
}

/**
 * The column of each Node: one after the furthest of its senders, 0 for a Node nothing sends to.
 * Edges that close a cycle are left out, so that a cycle still gets columns.
 */
function columnsOf(design: Design): Map<string, number> {
  const outgoing = new Map<string, string[]>(design.nodes.map((node) => [node.id, []]))
  for (const edge of design.edges) outgoing.get(edge.source)!.push(edge.target)

  // A depth-first walk: an Edge back to a Node still on the walk closes a cycle.
  const state = new Map<string, 'walking' | 'done'>()
  const forward: [string, string][] = []
  const walk = (id: string) => {
    state.set(id, 'walking')
    for (const target of outgoing.get(id)!) {
      if (state.get(target) === 'walking') continue
      forward.push([id, target])
      if (!state.has(target)) walk(target)
    }
    state.set(id, 'done')
  }
  for (const node of design.nodes) if (!state.has(node.id)) walk(node.id)

  // Longest paths over the forward Edges, which form no cycle, in topological order.
  const columns = new Map(design.nodes.map((node) => [node.id, 0]))
  const incoming = new Map(design.nodes.map((node) => [node.id, 0]))
  for (const [, target] of forward) incoming.set(target, incoming.get(target)! + 1)
  const ready = design.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id)
  while (ready.length > 0) {
    const id = ready.shift()!
    for (const [source, target] of forward) {
      if (source !== id) continue
      columns.set(target, Math.max(columns.get(target)!, columns.get(id)! + 1))
      incoming.set(target, incoming.get(target)! - 1)
      if (incoming.get(target) === 0) ready.push(target)
    }
  }
  return columns
}

/** The bands of a Design as a tree: zones inside the smallest zone around them, the rest on the canvas. */
function buildBands(design: Design, columns: Map<string, number>): Band {
  const bands = new Map<string | undefined, Band>([[undefined, emptyBand()]])
  for (const zone of design.zones) bands.set(zone.id, emptyBand(zone))
  for (const [i, zone] of design.zones.entries()) bands.get(parentOf(design.zones, i))!.children.push(bands.get(zone.id)!)
  for (const node of design.nodes) bands.get(node.zoneId)!.nodes.push(node)

  const root = bands.get(undefined)!
  measure(root, columns)
  return root
}

function emptyBand(zone?: DesignZone): Band {
  return { zone, nodes: [], children: [], rows: 0, occupied: false, height: 0, top: 0 }
}

/**
 * The smallest zone wholly around the zone at `index`. Of two identical boxes the earlier holds the
 * later, as the later is drawn on top; of equal candidates the later is the closer one.
 */
function parentOf(zones: DesignZone[], index: number): string | undefined {
  const zone = zones[index]
  let parent: DesignZone | undefined
  for (const [i, candidate] of zones.entries()) {
    if (i === index || !contains(candidate, zone) || (contains(zone, candidate) && i > index)) continue
    if (!parent || zoneArea(candidate) <= zoneArea(parent)) parent = candidate
  }
  return parent?.id
}

/** Sorts each band's zones by where they were, top first, and works out the rows and heights. */
function measure(band: Band, columns: Map<string, number>): void {
  band.children.sort((a, b) => a.zone!.position.y - b.zone!.position.y)
  for (const child of band.children) measure(child, columns)
  const perColumn = new Map<number, number>()
  for (const node of band.nodes) perColumn.set(columns.get(node.id)!, (perColumn.get(columns.get(node.id)!) ?? 0) + 1)
  band.rows = Math.max(0, ...perColumn.values())
  band.occupied = band.nodes.length > 0 || band.children.some((child) => child.occupied)
  // A zone with no Nodes keeps its size.
  if (band.zone && !band.occupied) band.height = band.zone.size.height
  else band.height = contentHeight(band) + (band.zone ? ZONE_HEADER + ZONE_PADDING : 0)
}

/** The height of a band's own rows and the zones inside it, stacked with gaps between. */
function contentHeight(band: Band): number {
  const items = [...(band.rows > 0 ? [(band.rows - 1) * ROW_PITCH + NODE_SIZE.height] : []), ...band.children.map((child) => child.height)]
  return items.reduce((sum, height) => sum + height, 0) + BAND_GAP * Math.max(0, items.length - 1)
}

/** Stacks the bands from `top` down and notes where each band's first row of Nodes goes. */
function placeBands(band: Band, top: number, rowTops: Map<Band, number>): void {
  band.top = top
  // An empty zone keeps the zones inside it where they are in it.
  if (band.zone && !band.occupied) return
  let cursor = top + (band.zone ? ZONE_HEADER : 0)
  if (band.rows > 0) {
    rowTops.set(band, cursor)
    cursor += (band.rows - 1) * ROW_PITCH + NODE_SIZE.height + BAND_GAP
  }
  for (const child of band.children) {
    placeBands(child, cursor, rowTops)
    cursor += child.height + BAND_GAP
  }
}

/** Where a Node's senders are, on average, top to bottom; a Node with none keeps its own height. */
function barycentre(design: Design, node: DesignNode, positions: Map<string, Position>): number {
  const senders = design.edges.flatMap((edge) => (edge.target === node.id && positions.has(edge.source) ? [positions.get(edge.source)!.y] : []))
  if (senders.length === 0) return node.position.y
  return senders.reduce((sum, y) => sum + y, 0) / senders.length
}

/**
 * Fits each zone box around what it holds, bottom up, with padding and room for its label. A zone
 * with no Nodes keeps its size at the left edge, and the empty zones inside it move along with it.
 */
function boxZones(band: Band, positions: Map<string, Position>, zones: Map<string, DesignZone>): { left: number; right: number } | undefined {
  const zone = band.zone
  if (zone && !band.occupied) {
    shiftZones(band, { x: -zone.position.x, y: band.top - zone.position.y }, zones)
    return { left: 0, right: zone.size.width }
  }
  const extents = [
    ...band.nodes.map((node) => ({ left: positions.get(node.id)!.x, right: positions.get(node.id)!.x + NODE_SIZE.width })),
    ...band.children.flatMap((child) => boxZones(child, positions, zones) ?? []),
  ]
  if (!zone) return undefined
  const left = Math.min(...extents.map((extent) => extent.left)) - ZONE_PADDING
  const right = Math.max(...extents.map((extent) => extent.right)) + ZONE_PADDING
  zones.set(zone.id, { ...zone, position: { x: left, y: band.top }, size: { width: right - left, height: band.height } })
  return { left, right }
}

/** Moves a band's zone and every zone inside it by `offset`, keeping their sizes. */
function shiftZones(band: Band, offset: Position, zones: Map<string, DesignZone>): void {
  const { position } = band.zone!
  zones.set(band.zone!.id, { ...band.zone!, position: { x: position.x + offset.x, y: position.y + offset.y } })
  for (const child of band.children) shiftZones(child, offset, zones)
}
