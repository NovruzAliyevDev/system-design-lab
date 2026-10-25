import type { Code } from 'mdast'
import type { Lesson } from './catalog'
import { parseMarkdown } from './markdown'

/** A row of the primer's "Powers of two table". */
export interface PowerOfTwo {
  power: number
  /** 2^power. Every row of the table fits a double exactly. */
  exactValue: number
  /** The primer's rounded name of the value, e.g. "1 thousand". */
  approxValue?: string
  /** The value as a byte size, e.g. "1 KB". */
  bytes?: string
}

/** A row of the primer's "Latency numbers every programmer should know". */
export interface LatencyNumber {
  operation: string
  nanoseconds: number
  /** The primer's comparison, e.g. "20x L2 cache, 200x L1 cache". */
  note?: string
}

/** A table the primer writes as a code block in a Lesson, as structured rows. */
export interface AppendixTable<Row> {
  lessonId: string
  /** Offset in the Lesson's body where the code block with the table starts. */
  offset: number
  rows: Row[]
}

/** A table is missing only when its Lesson is (test catalogs); the Content Pipeline requires both. */
export interface Appendix {
  powersOfTwo?: AppendixTable<PowerOfTwo>
  latencyNumbers?: AppendixTable<LatencyNumber>
}

const POWERS_OF_TWO_LESSON = 'powers-of-two-table'
const LATENCY_NUMBERS_LESSON = 'latency-numbers-every-programmer-should-know'

/** e.g. `10                           1024   1 thousand           1 KB` */
const POWER_ROW = /^(\d+)\s+([\d,]+)(?:\s+(.*?))?\s*$/
const BYTES = /(\d+ [KMGTPE]?B)$/
/** e.g. `Main memory reference                      100   ns                      20x L2 cache, 200x L1 cache` */
const LATENCY_ROW = /^(.+?)\s+([\d,.]+)\s+ns(?:\s+[\d,.]+\s+us)?(?:\s+[\d,.]+\s+ms)?(?:\s+(.*?))?\s*$/

/**
 * Reads the appendix tables out of their Lessons. The primer writes them as aligned plain text,
 * so a Lesson whose table cannot be read fails the build, rather than losing rows quietly.
 */
export function extractAppendix(lessons: Lesson[]): Appendix {
  return {
    powersOfTwo: extractTable(lessons, POWERS_OF_TWO_LESSON, (lines) =>
      lines.filter((line) => /^\d/.test(line)).map(parsePowerOfTwo),
    ),
    latencyNumbers: extractTable(lessons, LATENCY_NUMBERS_LESSON, (lines) => {
      // The table runs to the first blank line; the "Notes" block after it defines the units.
      const end = lines.findIndex((line) => line.trim() === '')
      return lines
        .slice(0, end === -1 ? undefined : end)
        .filter((line) => /\d\s+ns\b/.test(line))
        .map(parseLatencyNumber)
    }),
  }
}

function extractTable<Row>(
  lessons: Lesson[],
  lessonId: string,
  parseRows: (lines: string[]) => Row[],
): AppendixTable<Row> | undefined {
  const lesson = lessons.find((candidate) => candidate.id === lessonId)
  if (!lesson) return undefined
  const code = parseMarkdown(lesson.body).children.find((node): node is Code => node.type === 'code')
  if (!code) throw new Error(`Appendix: Lesson "${lessonId}" has no table`)
  const rows = parseRows(code.value.split('\n'))
  if (rows.length === 0) throw new Error(`Appendix: the table in Lesson "${lessonId}" has no rows`)
  return { lessonId, offset: code.position!.start.offset!, rows }
}

function parsePowerOfTwo(line: string): PowerOfTwo {
  const match = POWER_ROW.exec(line)
  const power = Number(match?.[1])
  const exactValue = parseNumber(match?.[2])
  if (!match || exactValue !== 2 ** power) throw new Error(`Appendix: cannot read the powers of two row "${line}"`)
  const rest = match[3] ?? ''
  const bytes = BYTES.exec(rest)?.[1]
  const approxValue = (bytes ? rest.slice(0, -bytes.length) : rest).trim()
  return { power, exactValue, ...(approxValue && { approxValue }), ...(bytes && { bytes }) }
}

function parseLatencyNumber(line: string): LatencyNumber {
  const match = LATENCY_ROW.exec(line)
  const nanoseconds = parseNumber(match?.[2])
  if (!match || Number.isNaN(nanoseconds)) throw new Error(`Appendix: cannot read the latency row "${line}"`)
  const note = match[3]?.trim()
  return { operation: match[1].trim(), nanoseconds, ...(note && { note }) }
}

function parseNumber(text: string | undefined): number {
  return text === undefined ? NaN : Number(text.replaceAll(',', ''))
}

const DURATION_UNITS: [string, number][] = [
  ['s', 1e9],
  ['ms', 1e6],
  ['µs', 1e3],
  ['ns', 1],
]

/** A duration in nanoseconds, in the largest unit that keeps it at least 1 (e.g. "150 µs"). */
export function formatDuration(nanoseconds: number): string {
  const [unit, size] = DURATION_UNITS.find(([, size]) => nanoseconds >= size) ?? DURATION_UNITS.at(-1)!
  return `${Number((nanoseconds / size).toPrecision(3))} ${unit}`
}
