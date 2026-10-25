/** Undo/redo over immutable states, such as a Design being edited. */
export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** The key of the last commit while it may still merge with the next one. */
  mergeKey?: string
}

export const MAX_UNDO_STEPS = 100

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/**
 * Makes `next` the present state as a new undo step. Consecutive commits with the same `mergeKey`
 * (e.g. each keystroke while renaming one Node) replace the present state instead, so they undo as one.
 */
export function commit<T>(history: History<T>, next: T, mergeKey?: string): History<T> {
  if (mergeKey !== undefined && mergeKey === history.mergeKey) return { ...history, present: next }
  return { past: [...history.past, history.present].slice(-MAX_UNDO_STEPS), present: next, future: [], mergeKey }
}

/** Ends merging, so that the next commit is a step of its own even with the same key (e.g. after leaving a field). */
export function endMerge<T>(history: History<T>): History<T> {
  if (history.mergeKey === undefined) return history
  return { past: history.past, present: history.present, future: history.future }
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history
  return { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] }
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) }
}

export function canUndo(history: History<unknown>): boolean {
  return history.past.length > 0
}

export function canRedo(history: History<unknown>): boolean {
  return history.future.length > 0
}
