// Shape checks shared by the validators of authored content.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A non-empty string without surrounding whitespace. */
export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.trim() === value
}

/** A string `Date.parse` reads, as stored timestamps are. */
export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText)
}
