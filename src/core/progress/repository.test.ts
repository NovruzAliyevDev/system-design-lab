import { describe, expect, it } from 'vitest'
import { createInMemoryProgressRepository } from './repository'

const NOW = new Date('2026-10-25T12:00:00Z')

const cardState = {
  phase: 'review',
  step: 0,
  intervalDays: 3,
  ease: 2.35,
  due: '2026-10-28T12:00:00.000Z',
  reps: 4,
  lapses: 1,
} as const

describe('ProgressRepository', () => {
  it('round-trips all progress through export and import without loss', async () => {
    const source = createInMemoryProgressRepository()
    await source.put('reading', { readLessons: { cache: '2026-10-20T08:00:00.000Z', 'load-balancer': '2026-10-21T09:30:00.000Z' } })
    await source.put('settings', { theme: 'light' })
    await source.put('flashcards', { cards: { 'system-design/1482325088071': cardState } })
    const exported = await source.exportAll(NOW)

    const target = createInMemoryProgressRepository()
    await target.importAll(JSON.stringify(exported), NOW)

    expect(await target.exportAll(NOW)).toEqual(exported)
    expect(await target.get('reading')).toEqual({
      readLessons: { cache: '2026-10-20T08:00:00.000Z', 'load-balancer': '2026-10-21T09:30:00.000Z' },
    })
    expect(await target.get('settings')).toEqual({ theme: 'light' })
    expect(await target.get('flashcards')).toEqual({ cards: { 'system-design/1482325088071': cardState } })
  })

  it('starts empty, with the dark theme', async () => {
    const repository = createInMemoryProgressRepository()

    expect(await repository.get('reading')).toEqual({ readLessons: {} })
    expect(await repository.get('settings')).toEqual({ theme: 'dark' })
    expect(await repository.get('flashcards')).toEqual({ cards: {} })
    expect(await repository.getAll()).toEqual({ reading: { readLessons: {} }, settings: { theme: 'dark' }, flashcards: { cards: {} } })
  })

  it('resets one area and keeps the others', async () => {
    const repository = createInMemoryProgressRepository()
    await repository.put('reading', { readLessons: { dns: '2026-10-22T10:00:00.000Z' } })
    await repository.put('settings', { theme: 'light' })

    await repository.reset('reading')

    expect(await repository.get('reading')).toEqual({ readLessons: {} })
    expect(await repository.get('settings')).toEqual({ theme: 'light' })
  })

  it('resets every area at once', async () => {
    const repository = createInMemoryProgressRepository()
    await repository.put('reading', { readLessons: { dns: '2026-10-22T10:00:00.000Z' } })
    await repository.put('settings', { theme: 'light' })
    await repository.put('flashcards', { cards: { 'system-design/1': cardState } })

    await repository.reset()

    expect(await repository.get('reading')).toEqual({ readLessons: {} })
    expect(await repository.get('settings')).toEqual({ theme: 'dark' })
    expect(await repository.get('flashcards')).toEqual({ cards: {} })
  })

  it('backs up the current progress before a valid import replaces it', async () => {
    const repository = createInMemoryProgressRepository()
    await repository.put('reading', { readLessons: { dns: '2026-10-22T10:00:00.000Z' } })
    const before = await repository.exportAll(new Date('2026-10-24T00:00:00Z'))

    const other = createInMemoryProgressRepository()
    await other.put('reading', { readLessons: { cdn: '2026-10-23T07:00:00.000Z' } })
    await repository.importAll(JSON.stringify(await other.exportAll(NOW)), NOW)

    expect(await repository.get('reading')).toEqual({ readLessons: { cdn: '2026-10-23T07:00:00.000Z' } })
    expect(await repository.latestBackup()).toEqual({ ...before, exportedAt: NOW.toISOString() })
  })

  it('migrates a v0 export, which listed read Lessons without times and had no settings', async () => {
    const v0Export = { schemaVersion: 0, exportedAt: '2026-01-15T18:00:00.000Z', readLessons: ['cache', 'dns'] }
    const repository = createInMemoryProgressRepository()

    await repository.importAll(JSON.stringify(v0Export), NOW)

    expect(await repository.exportAll(NOW)).toEqual({
      schemaVersion: 2,
      exportedAt: NOW.toISOString(),
      progress: {
        // v0 did not record when a Lesson was read; the export time is the latest it can have been.
        reading: { readLessons: { cache: '2026-01-15T18:00:00.000Z', dns: '2026-01-15T18:00:00.000Z' } },
        settings: { theme: 'dark' },
        flashcards: { cards: {} },
      },
    })
  })

  it('migrates a v1 export, which had no Flashcards', async () => {
    const v1Export = {
      schemaVersion: 1,
      exportedAt: '2026-10-20T18:00:00.000Z',
      progress: { reading: { readLessons: { cache: '2026-10-19T08:00:00.000Z' } }, settings: { theme: 'light' } },
    }
    const repository = createInMemoryProgressRepository()

    await repository.importAll(JSON.stringify(v1Export), NOW)

    expect(await repository.getAll()).toEqual({ ...v1Export.progress, flashcards: { cards: {} } })
  })

  it('rejects a v0 export whose read Lessons are not ids', async () => {
    const repository = createInMemoryProgressRepository()
    const v0Export = { schemaVersion: 0, exportedAt: '2026-01-15T18:00:00.000Z', readLessons: [7] }

    await expect(repository.importAll(JSON.stringify(v0Export), NOW)).rejects.toMatchObject({ reason: 'malformed' })
  })

  const validProgress = {
    reading: { readLessons: { cache: '2026-10-20T08:00:00.000Z' } },
    settings: { theme: 'dark' },
    flashcards: { cards: { 'system-design/1': cardState } },
  }
  const withCard = (card: unknown) =>
    JSON.stringify({ schemaVersion: 2, exportedAt: NOW.toISOString(), progress: { ...validProgress, flashcards: { cards: { 'system-design/1': card } } } })

  it.each([
    ['not JSON', '{"schemaVersion": 1,', 'not-json'],
    ['not an object', '42', 'malformed'],
    ['missing schemaVersion', JSON.stringify({ progress: validProgress }), 'malformed'],
    ['a newer schemaVersion', JSON.stringify({ schemaVersion: 99, exportedAt: NOW.toISOString(), progress: validProgress }), 'unsupported-version'],
    ['a missing area', JSON.stringify({ schemaVersion: 1, exportedAt: NOW.toISOString(), progress: { reading: validProgress.reading } }), 'malformed'],
    ['no flashcards area', JSON.stringify({ schemaVersion: 2, exportedAt: NOW.toISOString(), progress: { ...validProgress, flashcards: undefined } }), 'malformed'],
    ['a card state of an unknown phase', withCard({ ...cardState, phase: 'mastered' }), 'malformed'],
    ['a card state without a due time', withCard({ ...cardState, due: 'soon' }), 'malformed'],
    ['a card state with a negative interval', withCard({ ...cardState, intervalDays: -1 }), 'malformed'],
    ['a card state that is not an object', withCard(3), 'malformed'],
    [
      'a read time that is not a timestamp',
      JSON.stringify({ schemaVersion: 1, exportedAt: NOW.toISOString(), progress: { ...validProgress, reading: { readLessons: { cache: true } } } }),
      'malformed',
    ],
    [
      'an unknown theme',
      JSON.stringify({ schemaVersion: 1, exportedAt: NOW.toISOString(), progress: { ...validProgress, settings: { theme: 'sepia' } } }),
      'malformed',
    ],
  ])('rejects a file with %s and leaves progress unchanged', async (_, fileText, reason) => {
    const repository = createInMemoryProgressRepository()
    await repository.put('reading', { readLessons: { dns: '2026-10-22T10:00:00.000Z' } })
    await repository.put('settings', { theme: 'light' })
    const before = await repository.exportAll(NOW)

    await expect(repository.importAll(fileText, NOW)).rejects.toMatchObject({ name: 'InvalidProgressFileError', reason })

    expect(await repository.exportAll(NOW)).toEqual(before)
    expect(await repository.latestBackup()).toBeUndefined()
  })
})
