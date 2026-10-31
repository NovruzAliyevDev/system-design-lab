import { describe, expect, it } from 'vitest'
import type { Attempt } from '../challenges/attempt'
import type { Challenge } from '../challenges/challenge'
import type { Flashcard } from '../flashcards/deck'
import type { CardState } from '../flashcards/scheduler'
import { emptyProgress, type Progress } from '../progress/progress'
import type { Quiz } from '../quizzes/quiz'
import { computeMastery, unmetPrerequisites, type MasteryCatalog } from './mastery'
import type { SkillTopic } from './skill-tree'

const NOW = '2026-11-01T10:00:00.000Z'

const database: SkillTopic = { id: 'database', title: 'Database', lessonIds: ['database', 'nosql'], prerequisiteIds: [] }
const cache: SkillTopic = { id: 'cache', title: 'Cache', lessonIds: ['cache'], prerequisiteIds: ['database'] }

const quiz = (id: string, lessonId: string) => ({ id, lessonId, questions: [] }) as Quiz
const card = (id: string, lessonIds: string[]): Flashcard => ({ id, front: id, back: id, lessonIds })
const challenge = (id: string, lessonIds: string[]) => ({ id, lessonIds }) as unknown as Challenge

/** Database has a quiz, two cards and a Challenge; Cache has its Lesson alone. */
const catalog: MasteryCatalog = {
  skillTree: [database, cache],
  quizzes: [quiz('nosql-quiz', 'nosql')],
  decks: [{ id: 'deck', title: 'Deck', sourceUrl: '', cards: [card('sql', ['database']), card('nosql', ['nosql'])] }],
  challenges: [challenge('pastebin', ['nosql'])],
}

function progressWith(change: (progress: Progress) => void): Progress {
  const progress = emptyProgress()
  change(progress)
  return progress
}

const inReview = (intervalDays: number): CardState => ({ phase: 'review', step: 0, intervalDays, ease: 2.5, due: NOW, reps: 3, lapses: 0 })
const learning: CardState = { phase: 'learning', step: 1, intervalDays: 0, ease: 2.5, due: NOW, reps: 1, lapses: 0 }
const attempt = (score?: number): Attempt => ({
  mode: 'practice',
  startedAt: NOW,
  stages: {},
  ...(score === undefined ? {} : { finishedAt: NOW, score }),
})

describe('computeMastery', () => {
  it('is 0 for every topic before any progress, with the weights of the signals each topic has', () => {
    const mastery = computeMastery(emptyProgress(), catalog)

    expect(mastery.database).toEqual({
      mastery: 0,
      mastered: false,
      signals: { reading: 0, quizzes: 0, flashcards: 0, challenges: 0 },
      weights: { reading: 0.2, quizzes: 0.3, flashcards: 0.2, challenges: 0.3 },
    })
    expect(mastery.cache).toEqual({ mastery: 0, mastered: false, signals: { reading: 0 }, weights: { reading: 1 } })
  })

  it('counts the share of Lessons read', () => {
    const { database: topic } = computeMastery(progressWith((p) => (p.reading.readLessons = { nosql: NOW })), catalog)

    expect(topic.signals.reading).toBe(0.5)
    expect(topic.mastery).toBeCloseTo(0.1)
  })

  it("counts each quiz's best score", () => {
    const progress = progressWith((p) => (p.quizzes.results = { 'nosql-quiz': { bestScore: 0.75, lastAttemptAt: NOW } }))

    const { database: topic } = computeMastery(progress, catalog)

    expect(topic.signals.quizzes).toBe(0.75)
    expect(topic.mastery).toBeCloseTo(0.225)
  })

  it("counts each card's maturity: its interval up to 21 days, nothing while new or learning", () => {
    const at = (sql: CardState | undefined, nosql: CardState | undefined) =>
      computeMastery(
        progressWith((p) => (p.flashcards.cards = { ...(sql && { sql }), ...(nosql && { nosql }) })),
        catalog,
      ).database

    expect(at(inReview(21), inReview(60)).signals.flashcards).toBe(1)
    expect(at(inReview(7), undefined).signals.flashcards).toBeCloseTo(1 / 6)
    expect(at(learning, learning).signals.flashcards).toBe(0)
    expect(at(inReview(21), inReview(21)).mastery).toBeCloseTo(0.2)
  })

  it("counts each Challenge's best finished Attempt; an unfinished one counts for nothing", () => {
    const withAttempts = (attempts: Attempt[]) => computeMastery(progressWith((p) => (p.challenges.attempts = { pastebin: attempts })), catalog).database

    expect(withAttempts([attempt(0.9), attempt(0.4), attempt()]).signals.challenges).toBe(0.9)
    expect(withAttempts([attempt()]).signals.challenges).toBe(0)
    expect(withAttempts([attempt(1)]).mastery).toBeCloseTo(0.3)
  })

  it('combines the signals by their weights', () => {
    const progress = progressWith((p) => {
      p.reading.readLessons = { database: NOW, nosql: NOW }
      p.quizzes.results = { 'nosql-quiz': { bestScore: 0.5, lastAttemptAt: NOW } }
      p.flashcards.cards = { sql: inReview(21), nosql: inReview(21) }
      p.challenges.attempts = { pastebin: [attempt(0.8)] }
    })

    const { database: topic } = computeMastery(progress, catalog)

    expect(topic.signals).toEqual({ reading: 1, quizzes: 0.5, flashcards: 1, challenges: 0.8 })
    // 0.2 + 0.3 × 0.5 + 0.2 + 0.3 × 0.8
    expect(topic.mastery).toBeCloseTo(0.79)
    expect(topic.mastered).toBe(false)
  })

  it('reaches full mastery when every signal is full', () => {
    const progress = progressWith((p) => {
      p.reading.readLessons = { database: NOW, nosql: NOW }
      p.quizzes.results = { 'nosql-quiz': { bestScore: 1, lastAttemptAt: NOW } }
      p.flashcards.cards = { sql: inReview(30), nosql: inReview(21) }
      p.challenges.attempts = { pastebin: [attempt(1)] }
    })

    expect(computeMastery(progress, catalog).database).toMatchObject({ mastery: 1, mastered: true })
  })

  it('gives a topic without quizzes, cards or Challenges full mastery from the remaining signals', () => {
    const quizOnly: SkillTopic = { id: 'quiz-only', title: 'Quiz only', lessonIds: ['cache-2'], prerequisiteIds: [] }
    const withQuizOnly: MasteryCatalog = { ...catalog, skillTree: [...catalog.skillTree, quizOnly], quizzes: [...catalog.quizzes, quiz('cache-2-quiz', 'cache-2')] }
    const progress = progressWith((p) => {
      p.reading.readLessons = { cache: NOW, 'cache-2': NOW }
      p.quizzes.results = { 'cache-2-quiz': { bestScore: 1, lastAttemptAt: NOW } }
    })

    const mastery = computeMastery(progress, withQuizOnly)

    expect(mastery.cache).toMatchObject({ mastery: 1, mastered: true, signals: { reading: 1 } })
    expect(mastery['quiz-only']).toMatchObject({ mastery: 1, mastered: true, signals: { reading: 1, quizzes: 1 }, weights: { reading: 0.4, quizzes: 0.6 } })
  })

  it('counts a topic mastered from 80% up', () => {
    const readingAndQuiz: MasteryCatalog = { skillTree: [database], quizzes: [quiz('nosql-quiz', 'nosql')], decks: [], challenges: [] }
    // Reading 0.4 of the weight, the quiz 0.6.
    const withQuizScore = (bestScore: number) =>
      computeMastery(
        progressWith((p) => {
          p.reading.readLessons = { database: NOW, nosql: NOW }
          p.quizzes.results = { 'nosql-quiz': { bestScore, lastAttemptAt: NOW } }
        }),
        readingAndQuiz,
      ).database

    expect(withQuizScore(2 / 3)).toMatchObject({ mastery: 0.8, mastered: true })
    expect(withQuizScore(0.6)).toMatchObject({ mastered: false })
  })

  describe('a Challenge that practises several topics', () => {
    // Twitter practises Database and Cache. Cache is the further one: Database is its prerequisite.
    const twoTopics: MasteryCatalog = { ...catalog, challenges: [challenge('pastebin', ['nosql']), challenge('twitter', ['database', 'cache'])] }
    const masteryWith = (attempts: Progress['challenges']['attempts']) =>
      computeMastery(progressWith((p) => (p.challenges.attempts = attempts)), twoTopics)

    it('counts fully toward the furthest topic it practises', () => {
      expect(masteryWith({}).cache.signals).toEqual({ reading: 0, challenges: 0 })
      expect(masteryWith({ twitter: [attempt(0.6)] }).cache.signals.challenges).toBe(0.6)
    })

    it("counts toward the topics before it only once finished, so they can be mastered first", () => {
      const readingOnly: MasteryCatalog = { ...twoTopics, quizzes: [], decks: [], challenges: [challenge('twitter', ['database', 'cache'])] }
      const read = progressWith((p) => (p.reading.readLessons = { database: NOW, nosql: NOW }))

      expect(computeMastery(read, readingOnly).database).toMatchObject({ mastery: 1, mastered: true, signals: { reading: 1 } })
      expect(masteryWith({}).database.signals.challenges).toBe(0)
      expect(masteryWith({ pastebin: [attempt(1)], twitter: [attempt()] }).database.signals.challenges).toBe(1)
      expect(masteryWith({ pastebin: [attempt(1)], twitter: [attempt(0.6)] }).database.signals.challenges).toBeCloseTo(0.8)
    })
  })
})

describe('unmetPrerequisites', () => {
  it('lists the prerequisites not yet mastered, so the topic is recommended later', () => {
    const fresh = computeMastery(emptyProgress(), catalog)
    const read = computeMastery(
      progressWith((p) => {
        p.reading.readLessons = { database: NOW, nosql: NOW }
        p.quizzes.results = { 'nosql-quiz': { bestScore: 1, lastAttemptAt: NOW } }
        p.flashcards.cards = { sql: inReview(21), nosql: inReview(21) }
        p.challenges.attempts = { pastebin: [attempt(1)] }
      }),
      catalog,
    )

    expect(unmetPrerequisites(cache, fresh)).toEqual(['database'])
    expect(unmetPrerequisites(cache, read)).toEqual([])
    expect(unmetPrerequisites(database, fresh)).toEqual([])
  })
})
