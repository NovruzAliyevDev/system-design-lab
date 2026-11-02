import { describe, expect, it } from 'vitest'
import { addClass, emptyDesign, relate, updateClass, updateRelation, type ClassKind, type Design, type DesignClass, type RelationKind } from '../design/design'
import { evaluateDesign, type Predicate } from './rules'

/** Whether a Design passes a single Rule with this check. */
function passes(check: Predicate, design: Design): boolean {
  return evaluateDesign({ rules: [{ id: 'r', weight: 1, description: 'r', hints: ['?', '.', '!'], check }] }, design, {}).rules[0].passed
}

type ClassSpec = Partial<Pick<DesignClass, 'kind' | 'fields' | 'methods'>> & { name: string }

/**
 * A UML Design of the classes given, `class-1` onwards in order, and relations between them by index:
 * `[0, 1, 'composition', '1', '*']` relates the first class to the second.
 */
function uml(classes: ClassSpec[], relations: [number, number, RelationKind, string?, string?][] = []): Design {
  let design = emptyDesign()
  for (const spec of classes) {
    const added = addClass(design, { x: 0, y: 0 }, 'Class')
    design = updateClass(added.design, added.classId, spec)
  }
  for (const [from, to, kind, sourceMultiplicity, targetMultiplicity] of relations) {
    const [source, target] = [`class-${from + 1}`, `class-${to + 1}`]
    design = relate(design, source, target, kind)
    design = updateRelation(design, `${source}->${target}`, { sourceMultiplicity, targetMultiplicity } as never)
  }
  return design
}

const lruCache = uml(
  [
    { name: 'Node', fields: ['results', 'next', 'prev'] },
    { name: 'LinkedList', fields: ['head', 'tail'], methods: ['move_to_front(node)', 'append_to_front(node)', 'remove_from_tail()'] },
    { name: 'Cache', fields: ['MAX_SIZE', 'size', 'lookup: dict', 'linked_list'], methods: ['get(query)', 'set(results, query)'] },
  ],
  [
    [2, 1, 'composition', '1', '1'],
    [1, 0, 'aggregation', '1', '*'],
    [2, 0, 'association', '1', '*'],
  ],
)

describe('UML predicates', () => {
  describe('class exists', () => {
    it('finds a class by a name pattern, whole and ignoring case', () => {
      expect(passes({ type: 'class', class: { name: '(lru)?cache' } }, lruCache)).toBe(true)
      expect(passes({ type: 'class', class: { name: 'linked_?list' } }, lruCache)).toBe(true)
      // `list` does not match `LinkedList` in part.
      expect(passes({ type: 'class', class: { name: 'list' } }, lruCache)).toBe(false)
    })

    it('finds a class by its role, the members it has, whatever it is named', () => {
      const renamed = updateClass(lruCache, 'class-3', { name: 'QueryResults' })

      expect(passes({ type: 'class', class: { methods: ['get', 'set'] } }, renamed)).toBe(true)
      expect(passes({ type: 'class', class: { methods: ['get', 'evict'] } }, renamed)).toBe(false)
      expect(passes({ type: 'class', class: { fields: ['head', 'tail'], methods: ['remove_from_tail'] } }, renamed)).toBe(true)
    })

    it('counts the classes of a kind within bounds', () => {
      const shapes = uml([
        { name: 'Shape', kind: 'abstract' },
        { name: 'Drawable', kind: 'interface' },
        { name: 'Circle' },
        { name: 'Square' },
      ])
      const of = (kind: ClassKind, min?: number, max?: number): Predicate => ({ type: 'class', class: { kind }, min, max })

      expect(passes(of('abstract'), shapes)).toBe(true)
      expect(passes(of('interface'), lruCache)).toBe(false)
      expect(passes(of('class', 2, 2), shapes)).toBe(true)
      expect(passes(of('class', 3), shapes)).toBe(false)
      expect(passes({ type: 'class', class: {}, max: 3 }, shapes)).toBe(false)
      expect(passes({ type: 'class', class: { kind: ['abstract', 'interface'] }, min: 2 }, shapes)).toBe(true)
    })
  })

  describe('has a field or method', () => {
    it('passes when a matching class has the member, matched by its name before any type or parameters', () => {
      expect(passes({ type: 'member', class: { name: 'cache' }, method: 'get' }, lruCache)).toBe(true)
      expect(passes({ type: 'member', class: { name: 'cache' }, field: 'lookup' }, lruCache)).toBe(true)
      expect(passes({ type: 'member', class: { name: 'cache' }, field: 'max_?size' }, lruCache)).toBe(true)
    })

    it('fails when the member is missing, of the other sort, or on another class', () => {
      expect(passes({ type: 'member', class: { name: 'cache' }, method: 'lookup' }, lruCache)).toBe(false)
      expect(passes({ type: 'member', class: { name: 'node' }, method: 'get' }, lruCache)).toBe(false)
      expect(passes({ type: 'member', class: { name: 'node' }, field: 'prev' }, lruCache)).toBe(true)
      expect(passes({ type: 'member', class: { name: 'queue' }, field: 'head' }, lruCache)).toBe(false)
    })
  })

  describe('relation between classes', () => {
    it('passes for a relation of the kind from a matching class to a matching class, in that direction', () => {
      expect(passes({ type: 'relation', from: { name: 'cache' }, to: { name: 'linkedlist' }, kind: 'composition' }, lruCache)).toBe(true)
      expect(passes({ type: 'relation', from: { name: 'linkedlist' }, to: { name: 'cache' }, kind: 'composition' }, lruCache)).toBe(false)
      expect(passes({ type: 'relation', from: { name: 'cache' }, to: { name: 'linkedlist' }, kind: 'inheritance' }, lruCache)).toBe(false)
    })

    it('accepts any of several kinds, or any kind when none is given', () => {
      const holds: Predicate = { type: 'relation', from: { name: 'linkedlist' }, to: { name: 'node' }, kind: ['composition', 'aggregation'] }

      expect(passes(holds, lruCache)).toBe(true)
      expect(passes({ type: 'relation', from: { name: 'cache' }, to: { name: 'node' } }, lruCache)).toBe(true)
      expect(passes({ type: 'relation', from: { name: 'node' }, to: { name: 'cache' } }, lruCache)).toBe(false)
    })

    it('tells inheritance from implementation, subclass to superclass', () => {
      const shapes = uml(
        [{ name: 'Shape', kind: 'abstract' }, { name: 'Drawable', kind: 'interface' }, { name: 'Circle' }],
        [
          [2, 0, 'inheritance'],
          [2, 1, 'implementation'],
        ],
      )

      expect(passes({ type: 'relation', from: { name: 'circle' }, to: { kind: 'abstract' }, kind: 'inheritance' }, shapes)).toBe(true)
      expect(passes({ type: 'relation', from: { name: 'circle' }, to: { kind: 'interface' }, kind: 'inheritance' }, shapes)).toBe(false)
      expect(passes({ type: 'relation', from: { name: 'circle' }, to: { kind: 'interface' }, kind: 'implementation' }, shapes)).toBe(true)
    })
  })

  describe('multiplicity', () => {
    it('passes when the relation has the multiplicity at each end it is asked for', () => {
      const many: Predicate = { type: 'relation', from: { name: 'linkedlist' }, to: { name: 'node' }, fromMultiplicity: '1', toMultiplicity: ['*', '1..*'] }

      expect(passes(many, lruCache)).toBe(true)
      expect(passes({ ...many, toMultiplicity: '1' }, lruCache)).toBe(false)
      expect(passes({ ...many, fromMultiplicity: '0..1' }, lruCache)).toBe(false)
    })

    it('fails when the end has no multiplicity given', () => {
      const bare = uml([{ name: 'LinkedList' }, { name: 'Node' }], [[0, 1, 'aggregation']])

      expect(passes({ type: 'relation', from: { name: 'linkedlist' }, to: { name: 'node' }, toMultiplicity: '*' }, bare)).toBe(false)
      expect(passes({ type: 'relation', from: { name: 'linkedlist' }, to: { name: 'node' } }, bare)).toBe(true)
    })
  })

  it('combines with all-of, any-of and not like architecture predicates', () => {
    const cacheHasBoth: Predicate = {
      type: 'all-of',
      predicates: [
        { type: 'member', class: { name: 'cache' }, method: 'get' },
        { type: 'member', class: { name: 'cache' }, method: 'set' },
      ],
    }

    expect(passes(cacheHasBoth, lruCache)).toBe(true)
    expect(passes({ type: 'not', predicate: cacheHasBoth }, lruCache)).toBe(false)
  })
})
