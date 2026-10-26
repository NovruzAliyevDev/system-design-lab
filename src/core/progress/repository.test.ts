import { describe, expect, it } from 'vitest'
import type { Attempt } from '../challenges/attempt'
import type { Design } from '../design/design'
import { createInMemoryProgressRepository, createProgressRepository } from './repository'

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

const quizResult = { bestScore: 0.75, lastAttemptAt: '2026-10-25T10:00:00.000Z' }

const sandboxDesign = {
  nodes: [
    { id: 'client-1', componentType: 'client', label: 'Client', notes: '', config: {}, position: { x: 0, y: 0 } },
    {
      id: 'cache-1',
      componentType: 'cache',
      label: 'Redis',
      notes: 'Hot pastes.',
      config: { strategy: 'write-through', eviction: 'lfu', instances: 2 },
      position: { x: 200, y: 40 },
    },
  ],
  edges: [{ id: 'client-1->cache-1', source: 'client-1', target: 'cache-1', mode: 'sync', traffic: 'read' }],
  zones: [],
} as const satisfies Design

/** A v7 finished high-level design Stage, after two Hint tiers of one Rule. */
const legacyStageWork = { design: sandboxDesign, hintUsage: { 'separate-apis': 2 }, finishedAt: '2026-10-25T11:00:00.000Z' }

/** An Attempt in progress: the requirements over, the estimation entered but not finished. */
const attempt = {
  mode: 'practice',
  startedAt: '2026-10-25T10:00:00.000Z',
  stages: {
    requirements: {
      type: 'requirements',
      chosen: [0, 2],
      notes: 'Anonim istifadəçilər.',
      outcome: { finishedAt: '2026-10-25T10:10:00.000Z', gaveUp: false, score: 0.5 },
    },
    estimation: { type: 'estimation', answers: { 'write-qps': 4 } },
  },
} as const satisfies Attempt

/** A finished Attempt with a design Stage and its recorded Evaluation. */
const finishedAttempt = {
  mode: 'practice',
  startedAt: '2026-10-24T10:00:00.000Z',
  finishedAt: '2026-10-24T11:00:00.000Z',
  score: 0.25,
  stages: {
    'high-level-design': {
      type: 'high-level-design',
      design: sandboxDesign,
      hintUsage: { 'separate-apis': 2 },
      outcome: {
        finishedAt: '2026-10-24T11:00:00.000Z',
        gaveUp: false,
        score: 0.25,
        evaluation: {
          score: 1,
          maxScore: 3,
          totalWeight: 4,
          failingCount: 1,
          rules: [
            { ruleId: 'client', passed: true, weight: 1, hintsOpened: 0, hintsAvailable: 3, maxPoints: 1, points: 1 },
            { ruleId: 'separate-apis', passed: false, weight: 3, hintsOpened: 2, hintsAvailable: 1, maxPoints: 1.5, points: 0 },
          ],
        },
      },
    },
  },
} as const satisfies Attempt

const challengeWork = { attempts: { pastebin: [finishedAttempt, attempt] } }

describe('ProgressRepository', () => {
  it('round-trips all progress through export and import without loss', async () => {
    const source = createInMemoryProgressRepository()
    await source.put('reading', { readLessons: { cache: '2026-10-20T08:00:00.000Z', 'load-balancer': '2026-10-21T09:30:00.000Z' } })
    await source.put('settings', { theme: 'light', newCardsPerDay: 5, canvasStyle: 'sketch' })
    await source.put('flashcards', { cards: { 'system-design/1482325088071': cardState } })
    await source.put('quizzes', { results: { 'cache-basics': quizResult } })
    await source.put('designs', { drafts: { sandbox: sandboxDesign } })
    await source.put('challenges', challengeWork)
    const exported = await source.exportAll(NOW)

    const target = createInMemoryProgressRepository()
    await target.importAll(JSON.stringify(exported), NOW)

    expect(await target.exportAll(NOW)).toEqual(exported)
    expect(await target.get('reading')).toEqual({
      readLessons: { cache: '2026-10-20T08:00:00.000Z', 'load-balancer': '2026-10-21T09:30:00.000Z' },
    })
    expect(await target.get('settings')).toEqual({ theme: 'light', newCardsPerDay: 5, canvasStyle: 'sketch' })
    expect(await target.get('flashcards')).toEqual({ cards: { 'system-design/1482325088071': cardState } })
    expect(await target.get('quizzes')).toEqual({ results: { 'cache-basics': quizResult } })
    expect(await target.get('designs')).toEqual({ drafts: { sandbox: sandboxDesign } })
    expect(await target.get('challenges')).toEqual(challengeWork)
  })

  it('starts empty, with the dark theme and 20 new cards a day', async () => {
    const repository = createInMemoryProgressRepository()

    expect(await repository.get('reading')).toEqual({ readLessons: {} })
    expect(await repository.get('settings')).toEqual({ theme: 'dark', newCardsPerDay: 20, canvasStyle: 'clean' })
    expect(await repository.get('flashcards')).toEqual({ cards: {} })
    expect(await repository.get('quizzes')).toEqual({ results: {} })
    expect(await repository.get('designs')).toEqual({ drafts: {} })
    expect(await repository.get('challenges')).toEqual({ attempts: {} })
    expect(await repository.getAll()).toEqual({
      reading: { readLessons: {} },
      settings: { theme: 'dark', newCardsPerDay: 20, canvasStyle: 'clean' },
      flashcards: { cards: {} },
      quizzes: { results: {} },
      designs: { drafts: {} },
      challenges: { attempts: {} },
    })
  })

  it('fills in the defaults of fields added since an area was stored', async () => {
    const repository = createProgressRepository({
      get: async (key) => (key === 'area:settings' ? { theme: 'light' } : undefined),
      putAll: async () => {},
    })

    expect(await repository.get('settings')).toEqual({ theme: 'light', newCardsPerDay: 20, canvasStyle: 'clean' })
  })

  it('resets one area and keeps the others', async () => {
    const repository = createInMemoryProgressRepository()
    await repository.put('reading', { readLessons: { dns: '2026-10-22T10:00:00.000Z' } })
    await repository.put('settings', { theme: 'light', newCardsPerDay: 20, canvasStyle: 'clean' })

    await repository.reset('reading')

    expect(await repository.get('reading')).toEqual({ readLessons: {} })
    expect(await repository.get('settings')).toEqual({ theme: 'light', newCardsPerDay: 20, canvasStyle: 'clean' })
  })

  it('resets every area at once', async () => {
    const repository = createInMemoryProgressRepository()
    await repository.put('reading', { readLessons: { dns: '2026-10-22T10:00:00.000Z' } })
    await repository.put('settings', { theme: 'light', newCardsPerDay: 20, canvasStyle: 'clean' })
    await repository.put('flashcards', { cards: { 'system-design/1': cardState } })
    await repository.put('quizzes', { results: { 'cache-basics': quizResult } })
    await repository.put('designs', { drafts: { sandbox: sandboxDesign } })
    await repository.put('challenges', challengeWork)

    await repository.reset()

    expect(await repository.get('reading')).toEqual({ readLessons: {} })
    expect(await repository.get('settings')).toEqual({ theme: 'dark', newCardsPerDay: 20, canvasStyle: 'clean' })
    expect(await repository.get('flashcards')).toEqual({ cards: {} })
    expect(await repository.get('quizzes')).toEqual({ results: {} })
    expect(await repository.get('designs')).toEqual({ drafts: {} })
    expect(await repository.get('challenges')).toEqual({ attempts: {} })
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
      schemaVersion: 8,
      exportedAt: NOW.toISOString(),
      progress: {
        // v0 did not record when a Lesson was read; the export time is the latest it can have been.
        reading: { readLessons: { cache: '2026-01-15T18:00:00.000Z', dns: '2026-01-15T18:00:00.000Z' } },
        settings: { theme: 'dark', newCardsPerDay: 20, canvasStyle: 'clean' },
        flashcards: { cards: {} },
        quizzes: { results: {} },
        designs: { drafts: {} },
        challenges: { attempts: {} },
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

    expect(await repository.getAll()).toEqual({
      reading: v1Export.progress.reading,
      settings: { theme: 'light', newCardsPerDay: 20, canvasStyle: 'clean' },
      flashcards: { cards: {} },
      quizzes: { results: {} },
      designs: { drafts: {} },
      challenges: { attempts: {} },
    })
  })

  it('migrates a v2 export, which had no daily new-card limit', async () => {
    const v2Export = {
      schemaVersion: 2,
      exportedAt: '2026-10-25T18:00:00.000Z',
      progress: { reading: { readLessons: {} }, settings: { theme: 'light' }, flashcards: { cards: { 'system-design/1': cardState } } },
    }
    const repository = createInMemoryProgressRepository()

    await repository.importAll(JSON.stringify(v2Export), NOW)

    expect(await repository.getAll()).toEqual({
      ...v2Export.progress,
      settings: { theme: 'light', newCardsPerDay: 20, canvasStyle: 'clean' },
      quizzes: { results: {} },
      designs: { drafts: {} },
      challenges: { attempts: {} },
    })
  })

  it('migrates a v3 export, which had no quiz results', async () => {
    const v3Export = {
      schemaVersion: 3,
      exportedAt: '2026-10-26T18:00:00.000Z',
      progress: {
        reading: { readLessons: { cache: '2026-10-26T08:00:00.000Z' } },
        settings: { theme: 'dark', newCardsPerDay: 10 },
        flashcards: { cards: { 'system-design/1': cardState } },
      },
    }
    const repository = createInMemoryProgressRepository()

    await repository.importAll(JSON.stringify(v3Export), NOW)

    expect(await repository.getAll()).toEqual({
      ...v3Export.progress,
      settings: { ...v3Export.progress.settings, canvasStyle: 'clean' },
      quizzes: { results: {} },
      designs: { drafts: {} },
      challenges: { attempts: {} },
    })
  })

  it('migrates a v4 export, which had no Designs', async () => {
    const v4Export = {
      schemaVersion: 4,
      exportedAt: '2026-10-26T20:00:00.000Z',
      progress: {
        reading: { readLessons: { cache: '2026-10-26T08:00:00.000Z' } },
        settings: { theme: 'dark', newCardsPerDay: 10 },
        flashcards: { cards: { 'system-design/1': cardState } },
        quizzes: { results: { 'cache-basics': quizResult } },
      },
    }
    const repository = createInMemoryProgressRepository()

    await repository.importAll(JSON.stringify(v4Export), NOW)

    expect(await repository.getAll()).toEqual({
      ...v4Export.progress,
      settings: { ...v4Export.progress.settings, canvasStyle: 'clean' },
      designs: { drafts: {} },
      challenges: { attempts: {} },
    })
  })

  it('migrates a v5 export, which had no Challenge work', async () => {
    const { challenges: _, ...v5Progress } = validProgress
    const v5Export = { schemaVersion: 5, exportedAt: '2026-10-26T20:00:00.000Z', progress: v5Progress }
    const repository = createInMemoryProgressRepository()

    await repository.importAll(JSON.stringify(v5Export), NOW)

    expect(await repository.getAll()).toEqual({ ...v5Export.progress, challenges: { attempts: {} } })
  })

  it('migrates a v6 export, which had no canvas style, to the clean one', async () => {
    const v6Export = {
      schemaVersion: 6,
      exportedAt: '2026-10-26T21:00:00.000Z',
      progress: { ...v7Progress, settings: { theme: 'light', newCardsPerDay: 7 } },
    }
    const repository = createInMemoryProgressRepository()

    await repository.importAll(JSON.stringify(v6Export), NOW)

    expect(await repository.get('settings')).toEqual({ theme: 'light', newCardsPerDay: 7, canvasStyle: 'clean' })
  })

  it('migrates a v7 export, whose high-level design work becomes an Attempt in progress started at the export', async () => {
    const v7Export = { schemaVersion: 7, exportedAt: '2026-10-26T08:00:00.000Z', progress: v7Progress }
    const repository = createInMemoryProgressRepository()

    await repository.importAll(JSON.stringify(v7Export), NOW)

    // Stages now come before the high-level design, so the work is open again until they are over.
    expect(await repository.get('challenges')).toEqual({
      attempts: {
        pastebin: [
          {
            mode: 'practice',
            startedAt: '2026-10-26T08:00:00.000Z',
            stages: { 'high-level-design': { type: 'high-level-design', design: sandboxDesign, hintUsage: { 'separate-apis': 2 } } },
          },
        ],
      },
    })
  })

  it('reads Challenge work stored before Attempts as an Attempt in progress started when it is read', async () => {
    const repository = createProgressRepository(
      {
        get: async (key) => (key === 'area:challenges' ? { stages: { 'pastebin/high-level-design': legacyStageWork } } : undefined),
        putAll: async () => {},
      },
      () => NOW,
    )

    expect(await repository.get('challenges')).toEqual({
      attempts: {
        pastebin: [
          {
            mode: 'practice',
            startedAt: NOW.toISOString(),
            stages: { 'high-level-design': { type: 'high-level-design', design: sandboxDesign, hintUsage: { 'separate-apis': 2 } } },
          },
        ],
      },
    })
  })

  it('reads a stored Design draft with the config fields it lacks filled in', async () => {
    const [client, cache] = sandboxDesign.nodes
    const stored = { ...sandboxDesign, nodes: [client, { ...cache, config: { strategy: 'write-through' } }] }
    const file = { schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, designs: { drafts: { sandbox: stored } } } }
    const repository = createInMemoryProgressRepository()

    await repository.importAll(JSON.stringify(file), NOW)

    const { drafts } = await repository.get('designs')
    expect(drafts.sandbox.nodes[1].config).toEqual({ strategy: 'write-through', eviction: 'lru', instances: 1 })
  })

  it('keeps when each card was started', async () => {
    const started = { ...cardState, introduced: '2026-10-20T08:00:00.000Z' }
    const source = createInMemoryProgressRepository()
    await source.put('flashcards', { cards: { 'system-design/1': started } })
    const target = createInMemoryProgressRepository()

    await target.importAll(JSON.stringify(await source.exportAll(NOW)), NOW)

    expect(await target.get('flashcards')).toEqual({ cards: { 'system-design/1': started } })
  })

  it('rejects a v0 export whose read Lessons are not ids', async () => {
    const repository = createInMemoryProgressRepository()
    const v0Export = { schemaVersion: 0, exportedAt: '2026-01-15T18:00:00.000Z', readLessons: [7] }

    await expect(repository.importAll(JSON.stringify(v0Export), NOW)).rejects.toMatchObject({ reason: 'malformed' })
  })

  const validProgress = {
    reading: { readLessons: { cache: '2026-10-20T08:00:00.000Z' } },
    settings: { theme: 'dark', newCardsPerDay: 20, canvasStyle: 'clean' },
    flashcards: { cards: { 'system-design/1': cardState } },
    quizzes: { results: { 'cache-basics': quizResult } },
    designs: { drafts: { sandbox: sandboxDesign } },
    challenges: challengeWork,
  }
  const v7Progress = { ...validProgress, challenges: { stages: { 'pastebin/high-level-design': legacyStageWork } } }
  const withStageWork = (work: unknown) =>
    JSON.stringify({ schemaVersion: 7, exportedAt: NOW.toISOString(), progress: { ...v7Progress, challenges: { stages: { 'pastebin/high-level-design': work } } } })
  const withAttempt = (value: unknown) =>
    JSON.stringify({ schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, challenges: { attempts: { pastebin: [value] } } } })
  const withDraft = (draft: unknown) =>
    JSON.stringify({ schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, designs: { drafts: { sandbox: draft } } } })
  const withSettings = (settings: unknown) => JSON.stringify({ schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, settings } })
  const withCard = (card: unknown) =>
    JSON.stringify({ schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, flashcards: { cards: { 'system-design/1': card } } } })
  const withQuizResult = (result: unknown) =>
    JSON.stringify({ schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, quizzes: { results: { 'cache-basics': result } } } })

  it.each([
    ['not JSON', '{"schemaVersion": 1,', 'not-json'],
    ['not an object', '42', 'malformed'],
    ['missing schemaVersion', JSON.stringify({ progress: validProgress }), 'malformed'],
    ['a newer schemaVersion', JSON.stringify({ schemaVersion: 99, exportedAt: NOW.toISOString(), progress: validProgress }), 'unsupported-version'],
    ['a missing area', JSON.stringify({ schemaVersion: 1, exportedAt: NOW.toISOString(), progress: { reading: validProgress.reading } }), 'malformed'],
    ['no flashcards area', JSON.stringify({ schemaVersion: 3, exportedAt: NOW.toISOString(), progress: { ...validProgress, flashcards: undefined } }), 'malformed'],
    ['no quizzes area', JSON.stringify({ schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, quizzes: undefined } }), 'malformed'],
    ['no designs area', JSON.stringify({ schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, designs: undefined } }), 'malformed'],
    ['no challenges area', JSON.stringify({ schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, challenges: undefined } }), 'malformed'],
    ['v7 Stage work whose Design is not a Design', withStageWork({ ...legacyStageWork, design: { nodes: [] } }), 'malformed'],
    ['v7 Stage work with more than three Hint tiers open', withStageWork({ ...legacyStageWork, hintUsage: { 'separate-apis': 4 } }), 'malformed'],
    ['v7 Stage work with a fractional Hint count', withStageWork({ ...legacyStageWork, hintUsage: { 'separate-apis': 1.5 } }), 'malformed'],
    ['v7 Stage work that is not an object', withStageWork('done'), 'malformed'],
    ['v7 Challenge work keyed by something other than a Challenge and Stage', JSON.stringify({ schemaVersion: 7, exportedAt: NOW.toISOString(), progress: { ...v7Progress, challenges: { stages: { pastebin: legacyStageWork } } } }), 'malformed'],
    ['no list of Attempts', JSON.stringify({ schemaVersion: 8, exportedAt: NOW.toISOString(), progress: { ...validProgress, challenges: { attempts: { pastebin: attempt } } } }), 'malformed'],
    ['an Attempt that is not one', withAttempt({ ...attempt, mode: 'exam' }), 'malformed'],
    ['an Attempt whose score is above 1', withAttempt({ ...finishedAttempt, score: 1.2 }), 'malformed'],
    ['a Design draft that is not a Design', withDraft({ nodes: 'none' }), 'malformed'],
    ['a Design draft with an edge to a missing node', withDraft({ ...sandboxDesign, nodes: [sandboxDesign.nodes[0]] }), 'malformed'],
    [
      'a Design draft with an invalid config value',
      withDraft({ ...sandboxDesign, nodes: [sandboxDesign.nodes[0], { ...sandboxDesign.nodes[1], config: { instances: -3 } }] }),
      'malformed',
    ],
    ['a best quiz score above 1', withQuizResult({ ...quizResult, bestScore: 1.5 }), 'malformed'],
    ['a negative best quiz score', withQuizResult({ ...quizResult, bestScore: -0.1 }), 'malformed'],
    ['a best quiz score that is not a number', withQuizResult({ ...quizResult, bestScore: '80%' }), 'malformed'],
    ['a last quiz attempt that is not a timestamp', withQuizResult({ ...quizResult, lastAttemptAt: 'yesterday' }), 'malformed'],
    ['a quiz result that is not an object', withQuizResult(0.5), 'malformed'],
    ['a card state of an unknown phase', withCard({ ...cardState, phase: 'mastered' }), 'malformed'],
    ['a card state without a due time', withCard({ ...cardState, due: 'soon' }), 'malformed'],
    ['a card state with a negative interval', withCard({ ...cardState, intervalDays: -1 }), 'malformed'],
    ['a card state that is not an object', withCard(3), 'malformed'],
    ['a card state with a start time that is not a timestamp', withCard({ ...cardState, introduced: 'today' }), 'malformed'],
    ['a negative daily new-card limit', withSettings({ theme: 'dark', newCardsPerDay: -1 }), 'malformed'],
    ['a fractional daily new-card limit', withSettings({ theme: 'dark', newCardsPerDay: 2.5 }), 'malformed'],
    ['a daily new-card limit above 999', withSettings({ theme: 'dark', newCardsPerDay: 1000 }), 'malformed'],
    ['no daily new-card limit', withSettings({ theme: 'dark', canvasStyle: 'clean' }), 'malformed'],
    ['an unknown canvas style', withSettings({ theme: 'dark', newCardsPerDay: 20, canvasStyle: 'pastel' }), 'malformed'],
    ['no canvas style', withSettings({ theme: 'dark', newCardsPerDay: 20 }), 'malformed'],
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
    await repository.put('settings', { theme: 'light', newCardsPerDay: 20, canvasStyle: 'clean' })
    const before = await repository.exportAll(NOW)

    await expect(repository.importAll(fileText, NOW)).rejects.toMatchObject({ name: 'InvalidProgressFileError', reason })

    expect(await repository.exportAll(NOW)).toEqual(before)
    expect(await repository.latestBackup()).toBeUndefined()
  })
})
