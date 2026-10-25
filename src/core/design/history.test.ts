import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, commit, createHistory, endMerge, redo, undo, MAX_UNDO_STEPS } from './history'

describe('edit history', () => {
  it('undoes and redoes changes in order', () => {
    let history = createHistory('a')
    history = commit(history, 'b')
    history = commit(history, 'c')

    history = undo(history)
    expect(history.present).toBe('b')
    history = undo(history)
    expect(history.present).toBe('a')
    expect(canUndo(history)).toBe(false)

    history = redo(history)
    expect(history.present).toBe('b')
    history = redo(history)
    expect(history.present).toBe('c')
    expect(canRedo(history)).toBe(false)
  })

  it('does nothing when there is nothing to undo or redo', () => {
    const history = createHistory('a')

    expect(undo(history)).toBe(history)
    expect(redo(history)).toBe(history)
  })

  it('forgets the undone changes once a new change is made', () => {
    let history = commit(commit(createHistory('a'), 'b'), 'c')
    history = undo(history)
    history = commit(history, 'd')

    expect(canRedo(history)).toBe(false)
    expect(undo(history).present).toBe('b')
  })

  it('merges consecutive changes with the same key into one step, such as typing a label', () => {
    let history = createHistory('')
    history = commit(history, 'R', 'label:cache-1')
    history = commit(history, 'Re', 'label:cache-1')
    history = commit(history, 'Red', 'label:cache-1')

    expect(history.present).toBe('Red')
    expect(undo(history).present).toBe('')
  })

  it('starts a new step when the key changes, or after an undo', () => {
    let history = createHistory('')
    history = commit(history, 'R', 'label:cache-1')
    history = commit(history, 'R!', 'notes:cache-1')
    expect(undo(history).present).toBe('R')

    history = undo(history)
    history = commit(history, 'Re', 'label:cache-1')
    history = commit(history, 'Red', 'label:cache-1')
    expect(history.present).toBe('Red')
    expect(undo(history).present).toBe('R')
  })

  it('starts a new step after the merging edit ends, such as leaving the field and coming back', () => {
    let history = createHistory('')
    history = commit(history, 'R', 'label:cache-1')
    history = endMerge(history)
    history = commit(history, 'Re', 'label:cache-1')

    expect(undo(history).present).toBe('R')
    expect(endMerge(createHistory('a'))).toEqual(createHistory('a'))
  })

  it(`keeps at most ${MAX_UNDO_STEPS} steps`, () => {
    let history = createHistory(0)
    for (let i = 1; i <= MAX_UNDO_STEPS + 10; i++) history = commit(history, i)

    while (canUndo(history)) history = undo(history)

    expect(history.present).toBe(10)
  })
})
