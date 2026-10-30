import { describe, expect, it } from 'vitest'
import { addNode, emptyDesign } from '../design/design'
import { finishStage, newAttempt, readAttempt, updateStage, type Attempt } from './attempt'
import type { Challenge, DesignStage, Stage } from './challenge'
import { assessInterview, averageRating, defaultInterviewPlan, interviewClock, startMockInterview, type SelfAssessmentInput } from './mock-interview'

const hints = ['Sual?', 'İşarə.', 'İzah.']
const withClient = addNode(emptyDesign(), 'client', { x: 0, y: 0 }, 'Client').design

const load = { readQps: 40, writeQps: 4, requestBytes: 1_000 }

const highLevel: DesignStage = {
  id: 'high-level-design',
  type: 'high-level-design',
  prompt: 'Qurun.',
  weight: 4,
  rules: [{ id: 'client', weight: 1, description: 'Client', hints, check: { type: 'node', node: 'client' } }],
  referenceSolution: withClient,
  loadProfile: load,
}

const stages: Stage[] = [
  { id: 'requirements', type: 'requirements', prompt: 'Seçin.', weight: 1, items: [{ section: 'use-case', text: 'A', correct: true, explanation: 'a' }] },
  {
    id: 'estimation',
    type: 'estimation',
    prompt: 'Hesablayın.',
    weight: 1,
    inputs: { writesPerMonth: 10_000_000, readsPerMonth: 100_000_000, bytesPerWrite: 1_271 },
    explanation: 'İzah.',
    questions: [{ id: 'writes', quantity: 'writeQps', prompt: 'Yazma?', referenceValue: 4 }],
  },
  highLevel,
  {
    id: 'deep-dive',
    type: 'deep-dive',
    prompt: 'Seçin.',
    weight: 2,
    questions: [{ type: 'multiple-choice', prompt: 'X?', options: [{ text: 'Bəli', correct: true, explanation: 'b' }, { text: 'Xeyr', correct: false, explanation: 'x' }] }],
  },
  { ...highLevel, id: 'scaling', type: 'scaling', weight: 2 },
]

const challenge: Challenge = { id: 'pastebin', title: 'Pastebin', kind: 'architecture', source: 'primer', lessonIds: [], loadProfile: load, stages }

const start = new Date('2026-10-30T09:00:00Z')
const minutesLater = (minutes: number) => new Date(start.getTime() + minutes * 60_000)

const ratings: SelfAssessmentInput['ratings'] = { communication: 4, scoping: 3, estimation: 5, design: 4, 'trade-offs': 2, scaling: 3 }

/** Finishes the Stages in order, each the given minutes after the start. */
function finishAt(attempt: Attempt, minutes: number[]): Attempt {
  return minutes.reduce((current, at, i) => finishStage(challenge, current, stages[i].id, minutesLater(at)), attempt)
}

describe('defaultInterviewPlan', () => {
  it('gives a 45-minute interview time boxes by Stage type: 5, 5, 15, 10 and 10 minutes', () => {
    expect(defaultInterviewPlan(challenge)).toEqual({
      minutes: 45,
      timeBoxes: { requirements: 5, estimation: 5, 'high-level-design': 15, 'deep-dive': 10, scaling: 10 },
    })
  })

  it('scales the time boxes to another length in whole minutes that add up to it', () => {
    const { timeBoxes } = defaultInterviewPlan(challenge, 60)

    expect(timeBoxes).toEqual({ requirements: 7, estimation: 7, 'high-level-design': 20, 'deep-dive': 13, scaling: 13 })
  })

  it('gives every Stage at least a minute, and rounds a length to whole minutes', () => {
    expect(Object.values(defaultInterviewPlan(challenge, 3).timeBoxes)).toEqual([1, 1, 1, 1, 1])
    const { minutes, timeBoxes } = defaultInterviewPlan(challenge, 45.4)
    expect(minutes).toBe(45.4)
    expect(timeBoxes).toEqual(defaultInterviewPlan(challenge, 45).timeBoxes)
  })

  it('shares the time among the Stages a Challenge has', () => {
    const short: Challenge = { ...challenge, stages: [stages[0], highLevel] }

    expect(defaultInterviewPlan(short, 40).timeBoxes).toEqual({ requirements: 10, 'high-level-design': 30 })
  })
})

describe('a Mock Interview', () => {
  it('is an Attempt in mock interview mode that keeps its plan', () => {
    const plan = { minutes: 30, timeBoxes: { requirements: 3, estimation: 3, 'high-level-design': 12, 'deep-dive': 6, scaling: 6 } }

    expect(startMockInterview(challenge, plan, start)).toEqual({ mode: 'mock-interview', startedAt: start.toISOString(), stages: {}, interview: plan })
  })

  it('needs a positive length and a positive time box for every Stage', () => {
    const plan = defaultInterviewPlan(challenge)

    expect(() => startMockInterview(challenge, { ...plan, minutes: 0 }, start)).toThrow(RangeError)
    expect(() => startMockInterview(challenge, { ...plan, timeBoxes: { ...plan.timeBoxes, scaling: -1 } }, start)).toThrow(RangeError)
    const { scaling: _, ...missingOne } = plan.timeBoxes
    expect(() => startMockInterview(challenge, { ...plan, timeBoxes: missingOne }, start)).toThrow(RangeError)
  })

  it('refuses to open Hints, as an interviewer gives none', () => {
    const interview = finishAt(startMockInterview(challenge, defaultInterviewPlan(challenge), start), [1, 2])
    const opened = { type: 'high-level-design' as const, design: withClient, hintUsage: { client: 1 } }

    expect(() => updateStage(challenge, interview, 'high-level-design', opened)).toThrow(RangeError)
    expect(updateStage(challenge, interview, 'high-level-design', { ...opened, hintUsage: {} }).stages['high-level-design']).toMatchObject({ design: withClient })
    expect(updateStage(challenge, finishAt(newAttempt(start), [1, 2]), 'high-level-design', opened).stages['high-level-design']).toMatchObject({ hintUsage: { client: 1 } })
  })
})

describe('interviewClock', () => {
  const interview = startMockInterview(challenge, defaultInterviewPlan(challenge), start)

  it('counts down from the start, so a reload finds the time where it was', () => {
    const clock = interviewClock(challenge, interview, minutesLater(3))

    expect(clock).toMatchObject({ totalMs: 45 * 60_000, elapsedMs: 3 * 60_000, remainingMs: 42 * 60_000, overtime: false, running: true })
  })

  it("times each Stage from the end of the one before, against the Stage's time box", () => {
    const clock = interviewClock(challenge, finishAt(interview, [4, 12]), minutesLater(20))

    expect(clock.stages).toEqual([
      { stageId: 'requirements', state: 'over', elapsedMs: 4 * 60_000, timeBoxMs: 5 * 60_000, overTimeBox: false },
      { stageId: 'estimation', state: 'over', elapsedMs: 8 * 60_000, timeBoxMs: 5 * 60_000, overTimeBox: true },
      { stageId: 'high-level-design', state: 'current', elapsedMs: 8 * 60_000, timeBoxMs: 15 * 60_000, overTimeBox: false },
      { stageId: 'deep-dive', state: 'upcoming', elapsedMs: 0, timeBoxMs: 10 * 60_000, overTimeBox: false },
      { stageId: 'scaling', state: 'upcoming', elapsedMs: 0, timeBoxMs: 10 * 60_000, overTimeBox: false },
    ])
  })

  it('runs into overtime without ending the interview', () => {
    const clock = interviewClock(challenge, finishAt(interview, [5]), minutesLater(50))

    expect(clock).toMatchObject({ remainingMs: -5 * 60_000, overtime: true, running: true })
    expect(clock.stages[1]).toMatchObject({ state: 'current', overTimeBox: true })
  })

  it('stops when the last Stage is over', () => {
    const clock = interviewClock(challenge, finishAt(interview, [5, 10, 25, 35, 44]), minutesLater(90))

    expect(clock).toMatchObject({ elapsedMs: 44 * 60_000, remainingMs: 60_000, overtime: false, running: false })
    expect(clock.stages.every((stage) => stage.state === 'over')).toBe(true)
  })

  it('has no clock for a practice Attempt', () => {
    expect(() => interviewClock(challenge, newAttempt(start), start)).toThrow(RangeError)
  })
})

describe('assessInterview', () => {
  const finished = finishAt(startMockInterview(challenge, defaultInterviewPlan(challenge), start), [5, 10, 25, 35, 44])

  it('records the self-assessment beside the automatic scores', () => {
    const assessed = assessInterview(finished, { ratings, notes: 'Miqyaslamada tələsdim.' }, minutesLater(46))

    expect(assessed.selfAssessment).toEqual({ ratings, notes: 'Miqyaslamada tələsdim.', assessedAt: minutesLater(46).toISOString() })
    expect(assessed.score).toBe(finished.score)
  })

  it('averages the ratings', () => {
    expect(averageRating(ratings)).toBe(3.5)
  })

  it('rates every criterion from 1 to 5', () => {
    expect(() => assessInterview(finished, { ratings: { ...ratings, scaling: 6 }, notes: '' }, minutesLater(46))).toThrow(RangeError)
    expect(() => assessInterview(finished, { ratings: { ...ratings, design: 2.5 }, notes: '' }, minutesLater(46))).toThrow(RangeError)
    const { scoping: _, ...missingOne } = ratings
    expect(() => assessInterview(finished, { ratings: missingOne as typeof ratings, notes: '' }, minutesLater(46))).toThrow(RangeError)
  })

  it('waits for the end of a Mock Interview', () => {
    const unfinished = finishAt(startMockInterview(challenge, defaultInterviewPlan(challenge), start), [5])

    expect(() => assessInterview(unfinished, { ratings, notes: '' }, minutesLater(46))).toThrow(RangeError)
    expect(() => assessInterview(finishAt(newAttempt(start), [5, 10, 25, 35, 44]), { ratings, notes: '' }, minutesLater(46))).toThrow(RangeError)
  })
})

describe('readAttempt of a Mock Interview', () => {
  const finished = finishAt(startMockInterview(challenge, defaultInterviewPlan(challenge), start), [5, 10, 25, 35, 44])
  const assessed = assessInterview(finished, { ratings, notes: '' }, minutesLater(46))

  it('reads back its plan and self-assessment unchanged', () => {
    expect(readAttempt(JSON.parse(JSON.stringify(assessed)))).toEqual(assessed)
  })

  it('rejects one without a valid plan or with an invalid self-assessment', () => {
    const { interview: _, ...withoutPlan } = assessed

    expect(readAttempt(withoutPlan)).toBeUndefined()
    expect(readAttempt({ ...assessed, interview: { minutes: 45, timeBoxes: { requirements: 'five' } } })).toBeUndefined()
    expect(readAttempt({ ...assessed, selfAssessment: { ...assessed.selfAssessment, ratings: { ...ratings, design: 0 } } })).toBeUndefined()
    expect(readAttempt({ ...assessed, interview: { minutes: 45, timeBoxes: {} } })).toBeUndefined()
  })

  it('rejects what a Mock Interview cannot hold: opened Hints, and a self-assessment on a practice Attempt', () => {
    const highLevelWork = { type: 'high-level-design', design: withClient, hintUsage: { client: 1 } }

    expect(readAttempt({ ...assessed, stages: { ...assessed.stages, 'high-level-design': highLevelWork } })).toBeUndefined()
    expect(readAttempt({ ...finishAt(newAttempt(start), [5]), selfAssessment: assessed.selfAssessment })).toBeUndefined()
  })
})
