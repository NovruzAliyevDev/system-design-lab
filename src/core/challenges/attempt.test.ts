import { describe, expect, it } from 'vitest'
import { addNode, emptyDesign } from '../design/design'
import {
  attemptScore,
  bestAttemptScore,
  challengeScore,
  finishStage,
  newAttempt,
  openStageCount,
  readAttempt,
  stageScore,
  stageWork,
  updateStage,
  type Attempt,
  type StageInput,
} from './attempt'
import type { Challenge, DeepDiveStage, DesignStage, EstimationStage, RequirementsStage } from './challenge'

const hints = ['Sual?', 'İşarə.', 'İzah.']

const withCache = addNode(emptyDesign(), 'cache', { x: 0, y: 0 }, 'Cache').design
const withClient = addNode(emptyDesign(), 'client', { x: 0, y: 0 }, 'Client').design

const requirements: RequirementsStage = {
  id: 'requirements',
  type: 'requirements',
  prompt: 'Seçin.',
  weight: 1,
  items: [
    { section: 'use-case', text: 'A', correct: true, explanation: 'a' },
    { section: 'use-case', text: 'B', correct: true, explanation: 'b' },
    { section: 'constraint', text: 'C', correct: false, explanation: 'c' },
  ],
}

const estimation: EstimationStage = {
  id: 'estimation',
  type: 'estimation',
  prompt: 'Hesablayın.',
  weight: 1,
  inputs: { writesPerMonth: 10_000_000, readsPerMonth: 100_000_000, bytesPerWrite: 1_271 },
  explanation: 'İzah.',
  questions: [
    { id: 'writes', quantity: 'writeQps', prompt: 'Yazma?', referenceValue: 4 },
    { id: 'reads', quantity: 'readQps', prompt: 'Oxuma?', referenceValue: 40 },
  ],
}

const load = { readQps: 40, writeQps: 4, requestBytes: 1_000 }

const highLevel: DesignStage = {
  id: 'high-level-design',
  type: 'high-level-design',
  prompt: 'Qurun.',
  weight: 4,
  rules: [
    { id: 'client', weight: 3, description: 'Client', hints, check: { type: 'node', node: 'client' } },
    { id: 'cache', weight: 1, description: 'Cache', hints, check: { type: 'node', node: 'cache' } },
  ],
  referenceSolution: withClient,
  loadProfile: load,
}

const deepDive: DeepDiveStage = {
  id: 'deep-dive',
  type: 'deep-dive',
  prompt: 'Seçin.',
  weight: 2,
  questions: [
    {
      type: 'multiple-choice',
      prompt: 'X?',
      options: [
        { text: 'Bəli', correct: true, explanation: 'b' },
        { text: 'Xeyr', correct: false, explanation: 'x' },
      ],
    },
    {
      type: 'multiple-choice',
      prompt: 'Y?',
      options: [
        { text: 'Bəli', correct: false, explanation: 'b' },
        { text: 'Xeyr', correct: true, explanation: 'x' },
      ],
    },
  ],
}

const scaling: DesignStage = { ...highLevel, id: 'scaling', type: 'scaling', weight: 2 }

const challenge: Challenge = {
  id: 'pastebin',
  title: 'Pastebin',
  kind: 'architecture',
  source: 'primer',
  lessonIds: [],
  loadProfile: load,
  stages: [requirements, estimation, highLevel, deepDive, scaling],
}

const start = new Date('2026-10-26T09:00:00Z')
const later = new Date('2026-10-26T09:30:00Z')

/** Finishes every Stage in order, entering `inputs` first where given. */
function solve(attempt: Attempt, inputs: Record<string, StageInput>, gaveUp: string[] = []): Attempt {
  return challenge.stages.reduce((current, stage) => {
    const entered = inputs[stage.id] ? updateStage(challenge, current, stage.id, inputs[stage.id]) : current
    return finishStage(challenge, entered, stage.id, later, { gaveUp: gaveUp.includes(stage.id) })
  }, attempt)
}

describe('challengeScore', () => {
  it('weights each Stage score by its weight', () => {
    // (1×1 + 1×0.5 + 4×0.75 + 2×0 + 2×1) / 10
    const scores = { requirements: 1, estimation: 0.5, 'high-level-design': 0.75, 'deep-dive': 0, scaling: 1 }

    expect(challengeScore(challenge, scores)).toBeCloseTo(0.65, 10)
  })

  it('counts a Stage without a score as 0', () => {
    expect(challengeScore(challenge, { 'high-level-design': 1 })).toBeCloseTo(0.4, 10)
  })

  it('is 1 only when every Stage scores 1', () => {
    const all = Object.fromEntries(challenge.stages.map((stage) => [stage.id, 1]))

    expect(challengeScore(challenge, all)).toBe(1)
  })
})

describe('bestAttemptScore', () => {
  const start = new Date('2026-10-26T10:00:00Z')
  const finished = (score: number): Attempt => ({ ...newAttempt(start), finishedAt: start.toISOString(), score })

  it('is the best score of the finished Attempts, ignoring the unfinished ones', () => {
    expect(bestAttemptScore([finished(0.4), finished(0.9), newAttempt(start)])).toBe(0.9)
    expect(bestAttemptScore([finished(0)])).toBe(0)
  })

  it('is undefined until an Attempt is finished', () => {
    expect(bestAttemptScore([])).toBeUndefined()
    expect(bestAttemptScore([newAttempt(start)])).toBeUndefined()
  })
})

describe('stageScore', () => {
  it('grades the requirements checklist like a multi-select question: a distractor cancels a right pick', () => {
    expect(stageScore(requirements, { type: 'requirements', chosen: [0, 1], notes: '' }).score).toBe(1)
    expect(stageScore(requirements, { type: 'requirements', chosen: [0], notes: '' }).score).toBe(0.5)
    expect(stageScore(requirements, { type: 'requirements', chosen: [0, 2], notes: '' }).score).toBe(0)
  })

  it('gives estimation the share of answers within a factor of 2 of the reference; unanswered questions fail', () => {
    expect(stageScore(estimation, { type: 'estimation', answers: { writes: 8, reads: 20 } }).score).toBe(1)
    expect(stageScore(estimation, { type: 'estimation', answers: { writes: 9 } }).score).toBe(0)
    expect(stageScore(estimation, { type: 'estimation', answers: { writes: 3 } }).score).toBe(0.5)
  })

  it('scores a Design by its Evaluation, Hint caps included', () => {
    const both = addNode(withClient, 'cache', { x: 0, y: 200 }, 'Cache').design

    expect(stageScore(highLevel, { type: 'high-level-design', design: both, hintUsage: {} })).toMatchObject({ score: 1, evaluation: { score: 4 } })
    expect(stageScore(highLevel, { type: 'high-level-design', design: both, hintUsage: { client: 1 } }).score).toBeCloseTo(3.25 / 4, 10)
    expect(stageScore(highLevel, { type: 'high-level-design', design: withCache, hintUsage: {} }).score).toBe(0.25)
  })

  it('averages the deep-dive questions', () => {
    expect(stageScore(deepDive, { type: 'deep-dive', answers: [[0], [0]] }).score).toBe(0.5)
    expect(stageScore(deepDive, { type: 'deep-dive', answers: [[0], []] }).score).toBe(0.5)
  })
})

describe('an Attempt', () => {
  it('starts in practice mode with no work, the first Stage open', () => {
    const attempt = newAttempt(start)

    expect(attempt).toEqual({ mode: 'practice', startedAt: '2026-10-26T09:00:00.000Z', stages: {} })
    expect(openStageCount(challenge, attempt)).toBe(1)
    expect(stageWork(challenge, attempt, 'requirements')).toEqual({ type: 'requirements', chosen: [], notes: '' })
    expect(stageWork(challenge, attempt, 'deep-dive')).toEqual({ type: 'deep-dive', answers: [[], []] })
  })

  it('opens the next Stage once one is finished, and records the Stage score then', () => {
    const entered = updateStage(challenge, newAttempt(start), 'requirements', { type: 'requirements', chosen: [0, 1], notes: 'Anonim.' })
    const finished = finishStage(challenge, entered, 'requirements', later)

    expect(openStageCount(challenge, entered)).toBe(1)
    expect(openStageCount(challenge, finished)).toBe(2)
    expect(finished.stages.requirements).toEqual({
      type: 'requirements',
      chosen: [0, 1],
      notes: 'Anonim.',
      outcome: { finishedAt: '2026-10-26T09:30:00.000Z', gaveUp: false, score: 1 },
    })
  })

  it('scores a Stage given up as 0, keeping what was entered', () => {
    const entered = updateStage(challenge, newAttempt(start), 'requirements', { type: 'requirements', chosen: [0, 1], notes: '' })
    const gaveUp = finishStage(challenge, entered, 'requirements', later, { gaveUp: true })

    expect(gaveUp.stages.requirements.outcome).toEqual({ finishedAt: '2026-10-26T09:30:00.000Z', gaveUp: true, score: 0 })
    expect(gaveUp.stages.requirements).toMatchObject({ chosen: [0, 1] })
  })

  it('records the Evaluation of a design Stage when it is finished', () => {
    const attempt = solve(newAttempt(start), { 'high-level-design': { type: 'high-level-design', design: withClient, hintUsage: { cache: 2 } } })

    expect(attempt.stages['high-level-design'].outcome).toMatchObject({ score: 0.75, evaluation: { score: 3, failingCount: 1 } })
  })

  it('starts the Scaling Stage from the high-level Design', () => {
    const attempt = solve(newAttempt(start), { 'high-level-design': { type: 'high-level-design', design: withCache, hintUsage: { cache: 1 } } })

    expect(stageWork(challenge, attempt, 'scaling')).toMatchObject({ type: 'scaling', design: withCache, hintUsage: {} })
  })

  it('refuses work on a Stage that is not open yet or already over', () => {
    const input: StageInput = { type: 'deep-dive', answers: [[0], [1]] }
    expect(() => updateStage(challenge, newAttempt(start), 'deep-dive', input)).toThrow(/not open/)

    const finished = finishStage(challenge, newAttempt(start), 'requirements', later)
    expect(() => updateStage(challenge, finished, 'requirements', { type: 'requirements', chosen: [], notes: '' })).toThrow(/over/)
    expect(() => finishStage(challenge, finished, 'requirements', later)).toThrow(/over/)
  })

  it('refuses input of another Stage type', () => {
    expect(() => updateStage(challenge, newAttempt(start), 'requirements', { type: 'deep-dive', answers: [] })).toThrow(/requirements/)
  })

  it('is finished with its Challenge score once its last Stage is over', () => {
    const untouched = solve(newAttempt(start), {})
    expect(untouched.finishedAt).toBe('2026-10-26T09:30:00.000Z')

    const attempt = solve(
      newAttempt(start),
      {
        requirements: { type: 'requirements', chosen: [0, 1], notes: '' },
        estimation: { type: 'estimation', answers: { writes: 4, reads: 40 } },
        'high-level-design': { type: 'high-level-design', design: withClient, hintUsage: {} },
        'deep-dive': { type: 'deep-dive', answers: [[0], [1]] },
      },
      ['scaling'],
    )

    // (1×1 + 1×1 + 4×0.75 + 2×1 + 2×0) / 10
    expect(attempt.score).toBeCloseTo(0.7, 10)
    expect(attemptScore(challenge, attempt)).toBeCloseTo(0.7, 10)
    expect(attemptScore(challenge, newAttempt(start))).toBe(0)
  })

  it('can start from the last Attempt: its inputs and opened Hints, without outcomes', () => {
    const last = solve(newAttempt(start), {
      requirements: { type: 'requirements', chosen: [0], notes: 'Qeyd' },
      'high-level-design': { type: 'high-level-design', design: withClient, hintUsage: { cache: 3 } },
    })
    const retry = newAttempt(later, last)

    expect(retry.startedAt).toBe('2026-10-26T09:30:00.000Z')
    expect(retry.finishedAt).toBeUndefined()
    expect(retry.score).toBeUndefined()
    expect(retry.stages.requirements).toEqual({ type: 'requirements', chosen: [0], notes: 'Qeyd' })
    expect(retry.stages['high-level-design']).toEqual({ type: 'high-level-design', design: withClient, hintUsage: { cache: 3 } })
    expect(openStageCount(challenge, retry)).toBe(1)
  })
})

describe('readAttempt', () => {
  const finished = solve(newAttempt(start), {
    requirements: { type: 'requirements', chosen: [0], notes: 'Qeyd' },
    estimation: { type: 'estimation', answers: { writes: 4 } },
    'high-level-design': { type: 'high-level-design', design: withClient, hintUsage: { cache: 1 } },
    'deep-dive': { type: 'deep-dive', answers: [[0], []] },
  })

  it('reads back a stored Attempt unchanged', () => {
    expect(readAttempt(JSON.parse(JSON.stringify(finished)))).toEqual(finished)
  })

  it.each([
    ['an unknown mode', { ...finished, mode: 'exam' }],
    ['a start that is not a timestamp', { ...finished, startedAt: 'yesterday' }],
    ['a score outside 0 to 1', { ...finished, score: 2 }],
    ['an unknown Stage input type', { ...finished, stages: { x: { type: 'review' } } }],
    ['a checklist pick that is not an index', { ...finished, stages: { requirements: { type: 'requirements', chosen: ['A'], notes: '' } } }],
    ['an estimate that is not a number', { ...finished, stages: { estimation: { type: 'estimation', answers: { writes: '4' } } } }],
    ['an invalid Design', { ...finished, stages: { s: { type: 'scaling', design: { nodes: 'x' }, hintUsage: {} } } }],
    ['too many Hint tiers', { ...finished, stages: { s: { type: 'scaling', design: emptyDesign(), hintUsage: { a: 4 } } } }],
    ['an outcome without a score', { ...finished, stages: { r: { type: 'requirements', chosen: [], notes: '', outcome: { finishedAt: start.toISOString(), gaveUp: false } } } }],
  ])('rejects %s', (_, value) => {
    expect(readAttempt(value)).toBeUndefined()
  })
})
