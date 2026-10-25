import { Fragment, type ReactNode } from 'react'
import { az } from './az'

export type StringKey = keyof typeof az

const PLACEHOLDER = /\{(\w+)\}/g

/** Looks up a UI string and fills `{name}` placeholders from `params`. */
export function t(key: StringKey, params: Record<string, string | number> = {}): string {
  return az[key].replace(PLACEHOLDER, (match, name: string) => (name in params ? String(params[name]) : match))
}

/** Like `t`, but placeholders can be filled with elements such as links. */
export function tRich(key: StringKey, params: Record<string, ReactNode>): ReactNode {
  return az[key].split(PLACEHOLDER).map((part, i) =>
    // `split` with a capture group alternates text (even indexes) and placeholder names (odd indexes).
    i % 2 === 0 ? part : <Fragment key={i}>{params[part] ?? `{${part}}`}</Fragment>,
  )
}
