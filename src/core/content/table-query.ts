export type SortDirection = 'ascending' | 'descending'

export interface TableQuery<Row> {
  /** Words that must all appear in a row's text, in any case. */
  filter: string
  sort?: { column: keyof Row; direction: SortDirection }
}

/** The rows a table shows for a filter and sort; with neither, the rows in their own order. */
export function queryTable<Row>(rows: readonly Row[], query: TableQuery<Row>, textOf: (row: Row) => string): Row[] {
  const words = query.filter.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = rows.filter((row) => {
    const text = textOf(row).toLowerCase()
    return words.every((word) => text.includes(word))
  })
  const { sort } = query
  if (!sort) return shown
  const sign = sort.direction === 'ascending' ? 1 : -1
  // Array.prototype.sort is stable, so equal values keep the primer order.
  return shown.sort((a, b) => {
    const x = a[sort.column]
    const y = b[sort.column]
    // A row with no value sorts last whichever way the column is sorted.
    if (x === undefined || y === undefined) return Number(x === undefined) - Number(y === undefined)
    if (typeof x === 'number' && typeof y === 'number') return sign * (x - y)
    return sign * String(x).localeCompare(String(y), 'en')
  })
}
