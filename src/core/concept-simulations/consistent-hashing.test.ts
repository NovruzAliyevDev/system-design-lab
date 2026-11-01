import { describe, expect, it } from 'vitest'
import { generateKeys, rebalance } from './consistent-hashing'

const keys = generateKeys(10_000, 3)
const four = ['node-a', 'node-b', 'node-c', 'node-d']
const five = [...four, 'node-e']

describe('consistent hashing simulation', () => {
  it('adding a fifth node moves about 1/5 of the keys on the ring, but most keys under modulo hashing', () => {
    const result = rebalance({ keys, before: four, after: five, virtualNodes: 100 })

    expect(result.ringMoved / keys.length).toBeGreaterThan(0.15)
    expect(result.ringMoved / keys.length).toBeLessThan(0.25)
    expect(result.moduloMoved / keys.length).toBeGreaterThan(0.75)
    // Ideally only the new node's share moves: one key in five.
    expect(result.idealShare).toBe(0.2)
  })

  it('moves keys on the ring only to an added node, or only off a removed node', () => {
    const added = rebalance({ keys, before: four, after: five, virtualNodes: 100 })
    const removed = rebalance({ keys, before: five, after: four, virtualNodes: 100 })
    const moved = (result: typeof added) => result.keys.filter(({ ring }) => ring.moved)

    expect(new Set(moved(added).map(({ ring }) => ring.after))).toEqual(new Set(['node-e']))
    expect(new Set(moved(removed).map(({ ring }) => ring.before))).toEqual(new Set(['node-e']))
    expect(removed.ringMoved).toBe(added.ringMoved)
    expect(moved(added)).toHaveLength(added.ringMoved)
  })

  it('spreads keys more evenly over the nodes with more virtual nodes', () => {
    const imbalance = (virtualNodes: number) => {
      const counts = Object.values(rebalance({ keys, before: four, after: four, virtualNodes }).keysPerNode)
      return Math.max(...counts) / Math.min(...counts)
    }

    expect(imbalance(1)).toBeGreaterThan(2)
    expect(imbalance(200)).toBeLessThan(1.3)
  })

  it('moves no keys when the nodes stay the same, and chooses the same keys for the same seed', () => {
    const unchanged = rebalance({ keys, before: four, after: [...four], virtualNodes: 10 })

    expect([unchanged.ringMoved, unchanged.moduloMoved]).toEqual([0, 0])
    expect(generateKeys(50, 3)).toEqual(keys.slice(0, 50))
    expect(generateKeys(50, 4)).not.toEqual(keys.slice(0, 50))
  })
})
