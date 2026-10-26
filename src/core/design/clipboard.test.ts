import { describe, expect, it } from 'vitest'
import { copyElements, pasteElements } from './clipboard'
import { addNode, addZone, connect, emptyDesign, readDesign, renameNode, type Design } from './design'

/** A client → load balancer → web server chain, with the web server in a zone. */
function chain(): Design {
  let design = addNode(emptyDesign(), 'client', { x: 0, y: 0 }, 'Client').design
  design = addNode(design, 'load-balancer', { x: 250, y: 0 }, 'LB').design
  design = addNode(design, 'web-server', { x: 500, y: 0 }, 'Web').design
  design = renameNode(design, 'web-server-1', 'Web (AZ a)')
  design = connect(connect(design, 'client-1', 'load-balancer-1'), 'load-balancer-1', 'web-server-1')
  return addZone(design, { x: 450, y: -50 }, { width: 300, height: 200 }, 'AZ').design
}

describe('copy and paste', () => {
  it('copies the selected Nodes with the Edges between them, but not Edges to Nodes left behind', () => {
    const copied = copyElements(chain(), { nodeIds: ['load-balancer-1', 'web-server-1'] })

    expect(copied.nodes.map((node) => node.id)).toEqual(['load-balancer-1', 'web-server-1'])
    expect(copied.edges.map((edge) => edge.id)).toEqual(['load-balancer-1->web-server-1'])
  })

  it('pastes copies with fresh ids, shifted by the offset, keeping labels, config and the Edges between them', () => {
    const design = chain()
    const copied = copyElements(design, { nodeIds: ['load-balancer-1', 'web-server-1'] })

    const pasted = pasteElements(design, copied, { x: 0, y: 400 })

    expect(pasted.nodeIds).toEqual(['load-balancer-2', 'web-server-2'])
    expect(pasted.design.nodes.slice(3)).toEqual([
      { ...design.nodes[1], id: 'load-balancer-2', position: { x: 250, y: 400 } },
      { ...design.nodes[2], id: 'web-server-2', position: { x: 500, y: 400 } },
    ].map(({ zoneId: _, ...node }) => node))
    expect(pasted.design.edges.at(-1)).toMatchObject({ id: 'load-balancer-2->web-server-2', source: 'load-balancer-2', target: 'web-server-2' })
    expect(readDesign(pasted.design).problems).toEqual([])
  })

  it('copies a zone with everything in it, and pastes it as a new zone holding the copies', () => {
    const design = chain()
    const copied = copyElements(design, { zoneIds: ['zone-1'] })

    expect(copied.nodes.map((node) => node.id)).toEqual(['web-server-1'])

    const pasted = pasteElements(design, copied, { x: 0, y: 400 })

    expect(pasted.zoneIds).toEqual(['zone-2'])
    expect(pasted.design.zones[1]).toEqual({ id: 'zone-2', label: 'AZ', position: { x: 450, y: 350 }, size: { width: 300, height: 200 } })
    expect(pasted.design.nodes.find((node) => node.id === 'web-server-2')?.zoneId).toBe('zone-2')
    expect(readDesign(pasted.design).problems).toEqual([])
  })

  it('leaves the Nodes of the original zone in it when the pasted zone lands over them', () => {
    const design = chain()

    const pasted = pasteElements(design, copyElements(design, { zoneIds: ['zone-1'] }), { x: 40, y: 40 })

    expect(pasted.design.nodes.find((node) => node.id === 'web-server-1')?.zoneId).toBe('zone-1')
    expect(pasted.design.nodes.find((node) => node.id === 'web-server-2')?.zoneId).toBe('zone-2')
  })

  it('pastes the same copy again and again, numbering each paste after the last', () => {
    const copied = copyElements(chain(), { nodeIds: ['web-server-1'] })

    const once = pasteElements(chain(), copied, { x: 40, y: 40 })
    const twice = pasteElements(once.design, copied, { x: 80, y: 80 })

    expect(twice.nodeIds).toEqual(['web-server-3'])
    expect(twice.design.nodes).toHaveLength(5)
  })

  it('pastes into another Design than the one copied from', () => {
    const copied = copyElements(chain(), { nodeIds: ['client-1', 'load-balancer-1'] })

    const pasted = pasteElements(emptyDesign(), copied, { x: 0, y: 0 })

    expect(pasted.nodeIds).toEqual(['client-1', 'load-balancer-1'])
    expect(pasted.design.edges.map((edge) => edge.id)).toEqual(['client-1->load-balancer-1'])
  })
})
