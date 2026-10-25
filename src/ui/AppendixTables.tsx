import { useId, useState, type ReactNode } from 'react'
import { formatDuration, type AppendixTable, type LatencyNumber, type PowerOfTwo } from '../core/content/appendix'
import type { Lesson } from '../core/content/catalog'
import { queryTable, type TableQuery } from '../core/content/table-query'
import { catalog } from './catalog'
import { t, type StringKey } from './i18n'

interface Column<Row> {
  label: StringKey
  /** The field the column sorts by; a column without one does not sort. */
  sortBy?: keyof Row
  cell: (row: Row) => ReactNode
  numeric?: boolean
}

/** Numbers are shown the way the primer writes them. */
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

const POWER_COLUMNS: Column<PowerOfTwo>[] = [
  { label: 'powersPower', sortBy: 'power', cell: (row) => row.power, numeric: true },
  { label: 'powersExactValue', sortBy: 'exactValue', cell: (row) => numberFormat.format(row.exactValue), numeric: true },
  { label: 'powersApproxValue', cell: (row) => row.approxValue },
  { label: 'powersBytes', cell: (row) => row.bytes },
]

const LATENCY_COLUMNS: Column<LatencyNumber>[] = [
  { label: 'latencyOperation', sortBy: 'operation', cell: (row) => row.operation },
  { label: 'latencyNanoseconds', sortBy: 'nanoseconds', cell: (row) => numberFormat.format(row.nanoseconds), numeric: true },
  { label: 'latencyReadable', cell: (row) => formatDuration(row.nanoseconds), numeric: true },
  { label: 'latencyNote', cell: (row) => row.note },
]

function SortableTable<Row>({
  title,
  rows,
  columns,
  textOf,
}: {
  title: StringKey
  rows: Row[]
  columns: Column<Row>[]
  textOf: (row: Row) => string
}) {
  const [query, setQuery] = useState<TableQuery<Row>>({ filter: '' })
  const filterId = useId()
  const shown = queryTable(rows, query, textOf)

  function sortBy(column: keyof Row) {
    setQuery((current) => ({
      ...current,
      sort: {
        column,
        direction: current.sort?.column === column && current.sort.direction === 'ascending' ? 'descending' : 'ascending',
      },
    }))
  }

  return (
    <figure className="my-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={filterId} className="text-sm text-zinc-400">
          {t('tableFilter')}
        </label>
        <input
          id={filterId}
          type="search"
          value={query.filter}
          placeholder={t('tableFilterPlaceholder')}
          onChange={(event) => setQuery((current) => ({ ...current, filter: event.target.value }))}
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 sm:max-w-xs"
        />
        <span aria-live="polite" className="text-xs text-zinc-500">
          {t('tableRowsShown', { shown: shown.length, total: rows.length })}
        </span>
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <caption className="sr-only">{t(title)}</caption>
          <thead className="bg-zinc-900 text-left text-zinc-300">
            <tr>
              {columns.map((column) => {
                const direction = column.sortBy && query.sort?.column === column.sortBy ? query.sort.direction : undefined
                return (
                  <th
                    key={column.label}
                    scope="col"
                    aria-sort={direction ?? (column.sortBy ? 'none' : undefined)}
                    className={`px-3 py-2 font-medium whitespace-nowrap ${column.numeric ? 'text-right' : ''}`}
                  >
                    {column.sortBy ? (
                      <button
                        type="button"
                        title={t('tableSortBy', { column: t(column.label) })}
                        onClick={() => sortBy(column.sortBy!)}
                        className="inline-flex items-center gap-1 hover:text-zinc-50"
                      >
                        {t(column.label)}
                        <span aria-hidden className="text-xs text-zinc-500">
                          {direction === 'ascending' ? '▲' : direction === 'descending' ? '▼' : '↕'}
                        </span>
                      </button>
                    ) : (
                      t(column.label)
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          {/* Rows are primer content, in English. */}
          <tbody lang="en" className="divide-y divide-zinc-800 text-zinc-200">
            {shown.map((row, i) => (
              <tr key={i} className="hover:bg-zinc-900/60">
                {columns.map((column) => (
                  <td key={column.label} className={`px-3 py-1.5 ${column.numeric ? 'text-right font-mono whitespace-nowrap' : ''}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-3 py-4 text-sm text-zinc-500">{t('tableNoRows')}</p>}
      </div>
    </figure>
  )
}

function PowersOfTwoTable({ table }: { table: AppendixTable<PowerOfTwo> }) {
  return (
    <SortableTable
      title="powersTitle"
      rows={table.rows}
      columns={POWER_COLUMNS}
      textOf={(row) => [row.power, row.exactValue, numberFormat.format(row.exactValue), row.approxValue, row.bytes].join(' ')}
    />
  )
}

function LatencyNumbersTable({ table }: { table: AppendixTable<LatencyNumber> }) {
  return (
    <SortableTable
      title="latencyTitle"
      rows={table.rows}
      columns={LATENCY_COLUMNS}
      textOf={(row) => [row.operation, row.note].join(' ')}
    />
  )
}

/** The interactive tables a Lesson shows in place of the primer's plain-text tables, keyed by offset. */
export function appendixTablesOf(lesson: Lesson): ReadonlyMap<number, ReactNode> {
  const { powersOfTwo, latencyNumbers } = catalog.appendix
  const tables = new Map<number, ReactNode>()
  if (powersOfTwo?.lessonId === lesson.id) tables.set(powersOfTwo.offset, <PowersOfTwoTable table={powersOfTwo} />)
  if (latencyNumbers?.lessonId === lesson.id) tables.set(latencyNumbers.offset, <LatencyNumbersTable table={latencyNumbers} />)
  return tables
}
