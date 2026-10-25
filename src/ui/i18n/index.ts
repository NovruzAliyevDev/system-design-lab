import { az } from './az'

export type StringKey = keyof typeof az

/** Looks up a UI string and fills `{name}` placeholders from `params`. */
export function t(key: StringKey, params: Record<string, string | number> = {}): string {
  return az[key].replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}
