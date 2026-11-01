import { describe, expect, it } from 'vitest'
import type { Attempt } from '../challenges/attempt'
import { stageActivities } from './activity'

describe('stageActivities', () => {
  const started: Attempt = {
    mode: 'practice',
    startedAt: '2026-11-01T08:00:00.000Z',
    stages: { requirements: { type: 'requirements', chosen: [0], notes: '' } },
  }
  const requirementsOver: Attempt = {
    ...started,
    stages: {
      requirements: { type: 'requirements', chosen: [0], notes: '', outcome: { finishedAt: '2026-11-01T08:10:00.000Z', gaveUp: false, score: 1 } },
      estimation: { type: 'estimation', answers: {} },
    },
  }

  it('records each Stage that is over in the new Attempt but was not before, when it ended', () => {
    expect(stageActivities('pastebin', started, requirementsOver)).toEqual([
      { kind: 'challenge-stage', at: '2026-11-01T08:10:00.000Z', challengeId: 'pastebin', stageId: 'requirements' },
    ])
    expect(stageActivities('pastebin', undefined, requirementsOver)).toHaveLength(1)
  })

  it('records nothing when the input of an open Stage changes', () => {
    const typing: Attempt = { ...requirementsOver, stages: { ...requirementsOver.stages, estimation: { type: 'estimation', answers: { qps: 4 } } } }

    expect(stageActivities('pastebin', requirementsOver, typing)).toEqual([])
  })
})
