import { bestAttemptScore } from '../challenges/attempt'
import type { Catalog } from '../content/catalog'
import { MATURE_INTERVAL_DAYS } from '../flashcards/queue'
import type { CardState } from '../flashcards/scheduler'
import type { Progress } from '../progress/progress'
import { findTopic, skillTreeLayers, topicItems, type SkillTopic } from './skill-tree'

/**
 * How much each signal counts toward a topic's Mastery; they add up to 1. Reading counts least: it
 * shows a topic was covered, not understood. Quizzes and Challenges check understanding and its use
 * in a design; Flashcards show it is remembered. A topic without quizzes, cards or Challenges leaves
 * those signals out and shares the weight among the rest, so it can still reach full Mastery.
 */
export const MASTERY_WEIGHTS = { reading: 0.2, quizzes: 0.3, flashcards: 0.2, challenges: 0.3 } as const

export type MasterySignal = keyof typeof MASTERY_WEIGHTS

/** The Mastery from which a topic counts as mastered: its dependent topics are no longer recommended later. */
export const MASTERED_AT = 0.8

export interface TopicMastery {
  /** From 0 to 1. */
  mastery: number
  mastered: boolean
  /**
   * Each signal the topic has, from 0 to 1:
   * - reading: the share of its Lessons read;
   * - quizzes: the mean best score of its quizzes;
   * - flashcards: the mean maturity of its cards, a card's interval up to the one at which it is mature
   *   (none while new or learning);
   * - challenges: the mean best score of the finished Attempts of its Challenges, the required ones
   *   counting 0 until finished (see `TopicChallenge`).
   */
  signals: Partial<Record<MasterySignal, number>>
  /** The share of the Mastery each of those signals carries; they add up to 1. */
  weights: Partial<Record<MasterySignal, number>>
}

export type MasteryProgress = Pick<Progress, 'reading' | 'quizzes' | 'flashcards' | 'challenges'>

export type MasteryCatalog = Pick<Catalog, 'skillTree' | 'quizzes' | 'decks' | 'challenges'>

/** The Mastery of every topic of the Skill Tree, keyed by topic id. */
export function computeMastery(progress: MasteryProgress, catalog: MasteryCatalog): Record<string, TopicMastery> {
  return Object.fromEntries(catalog.skillTree.map((topic) => [topic.id, topicMastery(progress, catalog, topic)]))
}

function topicMastery(progress: MasteryProgress, catalog: MasteryCatalog, topic: SkillTopic): TopicMastery {
  const { lessonIds, quizzes, cards, challenges } = topicItems(catalog, topic)
  const challengeScores = challenges.flatMap(({ challenge, required }) => {
    const best = bestAttemptScore(progress.challenges.attempts[challenge.id] ?? [])
    return best !== undefined ? [best] : required ? [0] : []
  })
  const all: Record<MasterySignal, number | undefined> = {
    reading: mean(lessonIds.map((lessonId) => (Object.hasOwn(progress.reading.readLessons, lessonId) ? 1 : 0))),
    quizzes: mean(quizzes.map((quiz) => progress.quizzes.results[quiz.id]?.bestScore ?? 0)),
    flashcards: mean(cards.map((card) => maturity(progress.flashcards.cards[card.id]))),
    challenges: mean(challengeScores),
  }
  const present = (Object.entries(all) as [MasterySignal, number | undefined][]).flatMap(([signal, value]) =>
    value === undefined ? [] : [[signal, value] as const],
  )
  const totalWeight = present.reduce((sum, [signal]) => sum + MASTERY_WEIGHTS[signal], 0)
  const weights = present.map(([signal]) => [signal, round(MASTERY_WEIGHTS[signal] / totalWeight)] as const)
  // Rounded so that full signals give exactly 1, whatever the floating-point sum of the weights.
  const mastery = round(present.reduce((sum, [signal, value]) => sum + MASTERY_WEIGHTS[signal] * value, 0) / totalWeight)
  return { mastery, mastered: mastery >= MASTERED_AT, signals: Object.fromEntries(present), weights: Object.fromEntries(weights) }
}

function maturity(state: CardState | undefined): number {
  return state?.phase === 'review' ? Math.min(1, state.intervalDays / MATURE_INTERVAL_DAYS) : 0
}

/** The mean of the values; undefined when there are none, so the signal is left out. */
function mean(values: number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/** The prerequisites of a topic not yet mastered. A topic with any is "recommended later", but stays open. */
export function unmetPrerequisites(topic: SkillTopic, mastery: Readonly<Record<string, TopicMastery>>): string[] {
  return topic.prerequisiteIds.filter((id) => !mastery[id]?.mastered)
}

/**
 * The topic to study next: the first one not yet mastered, layer by layer down the Skill Tree, so its
 * prerequisites are all mastered. Undefined once every topic is mastered.
 */
export function suggestNextTopic(topics: readonly SkillTopic[], mastery: Readonly<Record<string, TopicMastery>>): SkillTopic | undefined {
  const next = skillTreeLayers(topics)
    .flat()
    .find((id) => !mastery[id]?.mastered)
  return next === undefined ? undefined : findTopic(topics, next)
}
