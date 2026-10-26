import { contains, edgeId, nextNumber, placeInZones, type Design, type DesignNode, type DesignZone, type ElementIds, type Position } from './design'

// Copy and paste on the Design Canvas. What is copied is a Design of its own, so it can be pasted
// into any Design, as often as the learner likes.

/**
 * The selected Nodes and zones as a Design of their own. A zone comes with everything in it: its
 * Nodes and the zones wholly inside it. Edges come along when both their ends do.
 */
export function copyElements(design: Design, { nodeIds = [], zoneIds = [] }: Omit<ElementIds, 'edgeIds'>): Design {
  const selectedZones = design.zones.filter((zone) => zoneIds.includes(zone.id))
  const zones = design.zones.filter((zone) => selectedZones.some((selected) => selected === zone || contains(selected, zone)))
  const copiedZoneIds = new Set(zones.map((zone) => zone.id))
  const nodes = design.nodes.filter((node) => nodeIds.includes(node.id) || (node.zoneId !== undefined && copiedZoneIds.has(node.zoneId)))
  const copiedNodeIds = new Set(nodes.map((node) => node.id))
  const edges = design.edges.filter((edge) => copiedNodeIds.has(edge.source) && copiedNodeIds.has(edge.target))
  return { nodes, edges, zones }
}

/**
 * Adds copies of what `copyElements` copied, moved by `offset`. Each copy gets a fresh id, numbered
 * like an added one, and keeps its label and config. Copied Nodes go in the zone they land in; the
 * Nodes already there keep theirs, even under a pasted copy of their zone.
 */
export function pasteElements(
  design: Design,
  copied: Design,
  offset: Position,
): { design: Design; nodeIds: string[]; zoneIds: string[] } {
  const shift = ({ x, y }: Position): Position => ({ x: x + offset.x, y: y + offset.y })

  const zones: DesignZone[] = []
  for (const zone of copied.zones) {
    zones.push({ ...zone, id: `zone-${nextNumber([...design.zones, ...zones], 'zone')}`, position: shift(zone.position) })
  }

  const newIds = new Map<string, string>()
  const nodes: DesignNode[] = []
  for (const node of copied.nodes) {
    const id = `${node.componentType}-${nextNumber([...design.nodes, ...nodes], node.componentType)}`
    newIds.set(node.id, id)
    nodes.push({ ...node, id, position: shift(node.position) })
  }

  const edges = copied.edges.map((edge) => {
    const source = newIds.get(edge.source)!
    const target = newIds.get(edge.target)!
    return { ...edge, id: edgeId(source, target), source, target }
  })

  return {
    design: placeInZones(
      { nodes: [...design.nodes, ...nodes], edges: [...design.edges, ...edges], zones: [...design.zones, ...zones] },
      new Set(nodes.map((node) => node.id)),
    ),
    nodeIds: nodes.map((node) => node.id),
    zoneIds: zones.map((zone) => zone.id),
  }
}
