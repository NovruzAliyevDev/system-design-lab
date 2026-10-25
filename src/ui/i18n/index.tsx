import { Fragment, type ReactNode } from 'react'
import { az } from './az'

export type StringKey = keyof typeof az

const PLACEHOLDER = /\{(\w+)\}/g

/** Looks up a UI string and fills `{name}` placeholders from `params`. */
export function t(key: StringKey, params: Record<string, string | number> = {}): string {
  return az[key].replace(PLACEHOLDER, (match, name: string) => (name in params ? String(params[name]) : match))
}

// Numbers and dates as the UI language writes them. Formatted by hand because browsers' `az` locale
// data differs (some fall back to English); Azerbaijani writes a decimal comma and day.month.year.

/** A number with at most one decimal, e.g. "3,7". */
export function formatDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return String(rounded).replace('.', ',')
}

/** A number as written in Azerbaijani, unrounded, e.g. "0,501". */
export function formatNumber(value: number): string {
  return String(value).replace('.', ',')
}

/** A whole number with its thousands grouped by spaces, e.g. "50 000". */
export function formatInteger(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** A date in the local time zone, e.g. "26.10.2026". */
export function formatDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

/** Like `t`, but placeholders can be filled with elements such as links. */
export function tRich(key: StringKey, params: Record<string, ReactNode>): ReactNode {
  return az[key].split(PLACEHOLDER).map((part, i) =>
    // `split` with a capture group alternates text (even indexes) and placeholder names (odd indexes).
    i % 2 === 0 ? part : <Fragment key={i}>{params[part] ?? `{${part}}`}</Fragment>,
  )
}
