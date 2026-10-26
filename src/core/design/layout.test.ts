import { describe, expect, it } from 'vitest'
import type { ComponentType } from './components'
import { addNode, addZone, connect, emptyDesign, NODE_SIZE, nodeCentre, readDesign, zoneAt, type Design, type DesignZone, type Position } from './design'
import { autoLayout } from './layout'

/** A Design with one Node per `[type, centre]`, connected by `edges` given as `source>target`. */
function build(nodes: [ComponentType, Position][], edges: string[] = []): Design {
  let design = emptyDesign()
  for (const [componentType, centre] of nodes) {
    design = addNode(design, componentType, { x: centre.x - NODE_SIZE.width / 2, y: centre.y - NODE_SIZE.height / 2 }, componentType).design
  }
  for (const edge of edges) {
    const [source, target] = edge.split('>')
    design = connect(design, source, target)
  }
  return design
}

const positionOf = (design: Design, nodeId: string) => design.nodes.find((node) => node.id === nodeId)!.position

function overlap(a: Position, b: Position): boolean {
  return Math.abs(a.x - b.x) < NODE_SIZE.width && Math.abs(a.y - b.y) < NODE_SIZE.height
}

function boxesOverlap(a: DesignZone, b: DesignZone): boolean {
  return (
    a.position.x < b.position.x + b.size.width &&
    b.position.x < a.position.x + a.size.width &&
    a.position.y < b.position.y + b.size.height &&
    b.position.y < a.position.y + a.size.height
  )
}

function inside(outer: DesignZone, inner: DesignZone): boolean {
  return (
    inner.position.x > outer.position.x &&
    inner.position.y > outer.position.y &&
    inner.position.x + inner.size.width < outer.position.x + outer.size.width &&
    inner.position.y + inner.size.height < outer.position.y + outer.size.height
  )
}

/** A jumbled three-tier design: client → LB → two web servers → cache and database, plus a lone DNS. */
function jumbled(): Design {
  return build(
    [
      ['sql-database', { x: 0, y: 0 }],
      ['web-server', { x: 40, y: 500 }],
      ['client', { x: 900, y: 300 }],
      ['load-balancer', { x: 300, y: 20 }],
      ['web-server', { x: 600, y: 600 }],
      ['cache', { x: 10, y: 30 }],
      ['dns', { x: 700, y: 700 }],
    ],
    [
      'client-1>load-balancer-1',
      'load-balancer-1>web-server-1',
      'load-balancer-1>web-server-2',
      'web-server-1>cache-1',
      'web-server-2>cache-1',
      'web-server-1>sql-database-1',
      'web-server-2>sql-database-1',
    ],
  )
}

describe('auto-layout', () => {
  it('lays the request flow out from left to right, one column per step', () => {
    const design = autoLayout(jumbled())

    for (const edge of design.edges) {
      expect(positionOf(design, edge.source).x, edge.id).toBeLessThan(positionOf(design, edge.target).x)
    }
    expect(positionOf(design, 'web-server-1').x).toBe(positionOf(design, 'web-server-2').x)
  })

  it('leaves no two Nodes on top of each other', () => {
    const design = autoLayout(jumbled())

    for (const [i, a] of design.nodes.entries()) {
      for (const b of design.nodes.slice(i + 1)) expect(overlap(a.position, b.position), `${a.id} and ${b.id}`).toBe(false)
    }
  })

  it('changes only positions and zone boxes', () => {
    const before = jumbled()
    const after = autoLayout(before)

    expect(after.edges).toEqual(before.edges)
    expect(after.nodes.map(({ position: _, ...node }) => node)).toEqual(before.nodes.map(({ position: _, ...node }) => node))
    expect(readDesign(after).problems).toEqual([])
  })

  it('gives the same layout every time', () => {
    expect(autoLayout(jumbled())).toEqual(autoLayout(jumbled()))
    expect(autoLayout(autoLayout(jumbled()))).toEqual(autoLayout(jumbled()))
  })

  it('lays out a Design with a cycle', () => {
    const design = autoLayout(build([['app-service', { x: 0, y: 0 }], ['message-queue', { x: 0, y: 0 }]], ['app-service-1>message-queue-1', 'message-queue-1>app-service-1']))

    expect(overlap(positionOf(design, 'app-service-1'), positionOf(design, 'message-queue-1'))).toBe(false)
  })

  it('keeps every Node in its zone, keeps sibling zones apart and nested zones inside their region', () => {
    // A region holding two availability zones, each with a web server and a database.
    let design = build(
      [
        ['client', { x: 0, y: 300 }],
        ['load-balancer', { x: 250, y: 300 }],
        ['web-server', { x: 600, y: 100 }],
        ['sql-database', { x: 900, y: 100 }],
        ['web-server', { x: 600, y: 500 }],
        ['sql-database', { x: 900, y: 500 }],
      ],
      [
        'client-1>load-balancer-1',
        'load-balancer-1>web-server-1',
        'load-balancer-1>web-server-2',
        'web-server-1>sql-database-1',
        'web-server-2>sql-database-2',
        'web-server-1>sql-database-2',
      ],
    )
    design = addZone(design, { x: 150, y: -50 }, { width: 1000, height: 750 }, 'Region').design
    design = addZone(design, { x: 450, y: 0 }, { width: 600, height: 200 }, 'AZ a').design
    design = addZone(design, { x: 450, y: 400 }, { width: 600, height: 200 }, 'AZ b').design
    const zonesBefore = design.nodes.map((node) => node.zoneId)

    const laidOut = autoLayout(design)
    const [region, a, b] = laidOut.zones

    expect(laidOut.nodes.map((node) => node.zoneId)).toEqual(zonesBefore)
    for (const node of laidOut.nodes) expect(zoneAt(laidOut, nodeCentre(node.position)), node.id).toBe(node.zoneId)
    expect(boxesOverlap(a, b)).toBe(false)
    expect(inside(region, a)).toBe(true)
    expect(inside(region, b)).toBe(true)
  })

  it('keeps an empty zone clear of the Nodes', () => {
    let design = build([['client', { x: 100, y: 100 }], ['web-server', { x: 400, y: 100 }]], ['client-1>web-server-1'])
    design = addZone(design, { x: 1000, y: 1000 }, { width: 300, height: 200 }, 'Spare').design

    const laidOut = autoLayout(design)

    for (const node of laidOut.nodes) expect(zoneAt(laidOut, nodeCentre(node.position))).toBeUndefined()
    expect(laidOut.zones[0].size).toEqual({ width: 300, height: 200 })
  })
})
