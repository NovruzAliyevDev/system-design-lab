import { describe, expect, it } from 'vitest'
import { queryTable } from './table-query'

const rows = [
  { operation: 'Main memory reference', nanoseconds: 100, note: '20x L2 cache' },
  { operation: 'L1 cache reference', nanoseconds: 0.5 },
  { operation: 'HDD seek', nanoseconds: 10_000_000, note: '20x datacenter roundtrip' },
  { operation: 'L2 cache reference', nanoseconds: 7, note: '14x L1 cache' },
]
const text = (row: (typeof rows)[number]) => [row.operation, row.note].join(' ')
const operations = (result: typeof rows) => result.map((row) => row.operation)

describe('queryTable', () => {
  it('keeps the primer order when nothing is asked', () => {
    expect(queryTable(rows, { filter: '' }, text)).toEqual(rows)
  })

  it('keeps the rows whose text contains every word of the filter, ignoring case', () => {
    expect(operations(queryTable(rows, { filter: 'CACHE l1' }, text))).toEqual(['L1 cache reference', 'L2 cache reference'])
    expect(operations(queryTable(rows, { filter: '  ' }, text))).toHaveLength(4)
  })

  it('sorts by a numeric column in either direction', () => {
    expect(operations(queryTable(rows, { filter: '', sort: { column: 'nanoseconds', direction: 'ascending' } }, text))).toEqual([
      'L1 cache reference',
      'L2 cache reference',
      'Main memory reference',
      'HDD seek',
    ])
    expect(
      operations(queryTable(rows, { filter: '', sort: { column: 'nanoseconds', direction: 'descending' } }, text))[0],
    ).toBe('HDD seek')
  })

  it('sorts text alphabetically and puts rows without a value last in both directions', () => {
    const byNote = (direction: 'ascending' | 'descending') =>
      operations(queryTable(rows, { filter: '', sort: { column: 'note', direction } }, text))

    expect(byNote('ascending')).toEqual(['L2 cache reference', 'HDD seek', 'Main memory reference', 'L1 cache reference'])
    expect(byNote('descending')).toEqual(['Main memory reference', 'HDD seek', 'L2 cache reference', 'L1 cache reference'])
  })
})
