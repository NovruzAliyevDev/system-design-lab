import { describe, expect, it } from 'vitest'
import {
  addClass,
  canRelate,
  deserializeDesign,
  emptyDesign,
  memberName,
  moveElements,
  readDesign,
  relate,
  removeElements,
  reverseRelation,
  serializeDesign,
  updateClass,
  updateRelation,
  type Design,
} from './design'

/** A UML Design of named classes, each `class-N` in order, and `a->b` relations of the kind given after a colon. */
function classes(names: string[], relations: string[] = []): Design {
  let design = emptyDesign()
  for (const name of names) {
    const added = addClass(design, { x: 0, y: 0 }, 'Class')
    design = updateClass(added.design, added.classId, { name })
  }
  for (const spec of relations) {
    const [pair, kind = 'association'] = spec.split(':')
    const [source, target] = pair.split('->')
    design = relate(design, source, target, kind as never)
  }
  return design
}

describe('UML classes', () => {
  it('adds classes numbered after the highest in use, named like added Nodes', () => {
    const first = addClass(emptyDesign(), { x: 10, y: 20 }, 'Class')
    const second = addClass(first.design, { x: 0, y: 0 }, 'Class')

    expect(first.classId).toBe('class-1')
    expect(second.design.classes).toEqual([
      { id: 'class-1', name: 'Class', kind: 'class', fields: [], methods: [], position: { x: 10, y: 20 } },
      { id: 'class-2', name: 'Class 2', kind: 'class', fields: [], methods: [], position: { x: 0, y: 0 } },
    ])
  })

  it('changes a class name, kind, fields and methods', () => {
    const { design, classId } = addClass(emptyDesign(), { x: 0, y: 0 }, 'Class')

    const changed = updateClass(design, classId, { name: 'Cache', kind: 'abstract', fields: ['size: int'], methods: ['get(query)'] })

    expect(changed.classes[0]).toMatchObject({ name: 'Cache', kind: 'abstract', fields: ['size: int'], methods: ['get(query)'] })
  })

  it('makes a class an enum, its fields the values', () => {
    const { design, classId } = addClass(emptyDesign(), { x: 0, y: 0 }, 'Class')

    const rank = updateClass(design, classId, { name: 'Rank', kind: 'enum', fields: ['OPERATOR', 'SUPERVISOR', 'DIRECTOR'] })

    expect(rank.classes[0]).toMatchObject({ name: 'Rank', kind: 'enum', fields: ['OPERATOR', 'SUPERVISOR', 'DIRECTOR'] })
    expect(deserializeDesign(serializeDesign(rank))).toEqual(rank)
  })

  it('refuses an over-long name or member, and an unknown class', () => {
    const { design, classId } = addClass(emptyDesign(), { x: 0, y: 0 }, 'Class')

    expect(() => updateClass(design, classId, { name: 'x'.repeat(81) })).toThrow(RangeError)
    expect(() => updateClass(design, classId, { fields: ['x'.repeat(121)] })).toThrow(RangeError)
    expect(() => updateClass(design, 'class-9', { name: 'Cache' })).toThrow(RangeError)
  })

  it('names a member by what comes before its type or parameters', () => {
    expect(memberName('get(query)')).toBe('get')
    expect(memberName('+ size: int')).toBe('size')
    expect(memberName('  MAX_SIZE ')).toBe('MAX_SIZE')
    expect(memberName('lookup : dict')).toBe('lookup')
    expect(memberName('-move_to_front(node): None')).toBe('move_to_front')
  })

  it('moves classes along with Nodes', () => {
    const design = classes(['Cache'])

    expect(moveElements(design, { 'class-1': { x: 50, y: 60 } }).classes[0].position).toEqual({ x: 50, y: 60 })
  })
})

describe('UML relations', () => {
  it('relates two classes once in each direction, never to an unknown class', () => {
    const design = classes(['Cache', 'LinkedList'], ['class-1->class-2:composition'])

    expect(design.relations).toEqual([{ id: 'class-1->class-2', source: 'class-1', target: 'class-2', kind: 'composition' }])
    expect(canRelate(design, 'class-1', 'class-2')).toBe(false)
    expect(canRelate(design, 'class-2', 'class-1')).toBe(true)
    expect(canRelate(design, 'class-1', 'class-9')).toBe(false)
    expect(() => relate(design, 'class-1', 'class-2', 'association')).toThrow(RangeError)
  })

  it('relates a class to itself once, e.g. a Node to the next one, and reverses it by swapping its multiplicities', () => {
    const linked = updateRelation(classes(['Node'], ['class-1->class-1']), 'class-1->class-1', { sourceMultiplicity: '1', targetMultiplicity: '0..1' })

    expect(canRelate(linked, 'class-1', 'class-1')).toBe(false)
    expect(reverseRelation(linked, 'class-1->class-1').relations).toEqual([
      { id: 'class-1->class-1', source: 'class-1', target: 'class-1', kind: 'association', sourceMultiplicity: '0..1', targetMultiplicity: '1' },
    ])
    expect(deserializeDesign(serializeDesign(linked))).toEqual(linked)
  })

  it('sets and clears the kind and the multiplicity at each end', () => {
    const design = classes(['LinkedList', 'Node'], ['class-1->class-2'])

    const set = updateRelation(design, 'class-1->class-2', { kind: 'aggregation', sourceMultiplicity: '1', targetMultiplicity: '*' })
    const cleared = updateRelation(set, 'class-1->class-2', { targetMultiplicity: undefined })

    expect(set.relations[0]).toMatchObject({ kind: 'aggregation', sourceMultiplicity: '1', targetMultiplicity: '*' })
    expect(cleared.relations[0]).toEqual({ id: 'class-1->class-2', source: 'class-1', target: 'class-2', kind: 'aggregation', sourceMultiplicity: '1' })
    expect(() => updateRelation(design, 'class-2->class-1', { kind: 'inheritance' })).toThrow(RangeError)
  })

  it('reverses a relation with its multiplicities, unless that direction is taken', () => {
    const design = updateRelation(classes(['Cache', 'Node'], ['class-1->class-2']), 'class-1->class-2', { sourceMultiplicity: '1', targetMultiplicity: '*' })

    const reversed = reverseRelation(design, 'class-1->class-2')

    expect(reversed.relations).toEqual([
      { id: 'class-2->class-1', source: 'class-2', target: 'class-1', kind: 'association', sourceMultiplicity: '*', targetMultiplicity: '1' },
    ])
    expect(() => reverseRelation(relate(design, 'class-2', 'class-1', 'association'), 'class-1->class-2')).toThrow(RangeError)
  })

  it('removes a class with every relation touching it, and a relation on its own', () => {
    const design = classes(['Cache', 'LinkedList', 'Node'], ['class-1->class-2', 'class-2->class-3', 'class-1->class-3'])

    const withoutList = removeElements(design, { nodeIds: ['class-2'] })
    const withoutRelation = removeElements(design, { edgeIds: ['class-1->class-3'] })

    expect(withoutList.classes.map((each) => each.id)).toEqual(['class-1', 'class-3'])
    expect(withoutList.relations.map((each) => each.id)).toEqual(['class-1->class-3'])
    expect(withoutRelation.relations.map((each) => each.id)).toEqual(['class-1->class-2', 'class-2->class-3'])
  })
})

describe('UML Design serialisation', () => {
  const design = updateRelation(
    updateClass(classes(['Cache', 'Node'], ['class-1->class-2:composition']), 'class-1', { kind: 'interface', fields: ['size'], methods: ['get(query)'] }),
    'class-1->class-2',
    { targetMultiplicity: '1..*' },
  )

  it('round-trips classes and relations', () => {
    expect(deserializeDesign(serializeDesign(design))).toEqual(design)
  })

  it('reads a Design stored before UML existed as one without classes or relations', () => {
    const { design: read } = readDesign({ nodes: [], edges: [], zones: [] })

    expect(read).toEqual(emptyDesign())
  })

  it('reports every problem of a stored class or relation', () => {
    const stored = JSON.parse(serializeDesign(design))
    const node = stored.classes[1]
    stored.classes.push({ ...node }, { ...node, id: 'class-4', kind: 'mixin' }, { ...node, id: 'class-5', fields: ['ok', 3] })
    stored.relations[0].kind = 'friendship'
    stored.relations[0].targetMultiplicity = 'many'
    stored.relations.push({ id: 'class-1->class-7', source: 'class-1', target: 'class-7', kind: 'association' })

    expect(readDesign(stored).problems).toEqual([
      'class 3: its id "class-2" is already used',
      'class 4: "kind" must be one of class, abstract, interface, enum',
      'class 5: "fields" must be a list of at most 30 texts of at most 120 characters',
      'relation 1: "kind" must be one of inheritance, implementation, composition, aggregation, association',
      'relation 1: "targetMultiplicity" must be one of 1, 0..1, *, 1..*',
      'relation 2: "target" must be the id of a class',
    ])
  })
})
