import type { Challenge } from '../challenges/challenge'
import type { Catalog, LessonReference } from '../content/catalog'
import { isRecord, isText, isTextList } from '../content/validation'
import type { Flashcard } from '../flashcards/deck'
import type { Quiz } from '../quizzes/quiz'

// The Skill Tree: the primer's topics as a graph, each topic a set of Lessons, with authored edges
// to the topics it is best learned after. The tree is soft-gated: prerequisites only recommend an order.

/** A node of the Skill Tree. */
export interface SkillTopic {
  id: string
  /** In Azerbaijani. */
  title: string
  /** The Lessons the topic covers, in reading order; a Lesson is in at most one topic. */
  lessonIds: string[]
  /** Topics best mastered before this one. */
  prerequisiteIds: string[]
}

/** Authored as the catalog keeps it. */
export type SkillTopicInput = SkillTopic

/** A Challenge that practises a topic, and how it counts toward the topic's Mastery. */
export interface TopicChallenge {
  challenge: Challenge
  /**
   * Whether it counts before it is finished, as a score of 0. It does toward the furthest topics it
   * practises: those that are not a prerequisite, directly or through others, of another topic it
   * practises. Toward the topics before them it counts once finished, so that they can be mastered
   * first, as the Skill Tree recommends.
   */
  required: boolean
}

/** The learning items of a topic: its Lessons, and what practises them. */
export interface TopicItems {
  lessonIds: string[]
  /** The quizzes shown in its Lessons. */
  quizzes: Quiz[]
  /** The cards linked to any of its Lessons, in Deck order. */
  cards: Flashcard[]
  /** The Challenges that practise any of its Lessons, in catalog order. */
  challenges: TopicChallenge[]
}

const TOPIC_FIELDS = new Set(['id', 'title', 'lessonIds', 'prerequisiteIds'])

/**
 * Checks the authored Skill Tree against its schema and the Lessons. Prerequisites must name known
 * topics and form no cycle. Returns the topics in authored order, or every problem found.
 */
export function validateSkillTree(input: unknown, lessonIds: ReadonlySet<string>): { topics: SkillTopic[]; problems: string[] } {
  if (!Array.isArray(input)) return { topics: [], problems: ['Skill Tree: must be a list of topics'] }

  const topics: SkillTopic[] = []
  const problems: string[] = []
  const ids = new Set<string>()
  /** Lesson id → the topic it is in. */
  const lessonTopics = new Map<string, string>()
  input.forEach((item: unknown, i) => {
    if (!isRecord(item) || !isText(item.id)) return problems.push(`Skill Tree topic #${i + 1}: must be an object with an "id"`)
    const { id, title, lessonIds: topicLessonIds, prerequisiteIds } = item
    const problem = (message: string) => problems.push(`${topicName(id)}: ${message}`)
    const before = problems.length

    // The rest of a second topic with the same id would only repeat the first one's problems.
    if (ids.has(id)) return problem('its id is already used by another topic')
    ids.add(id)
    for (const field of Object.keys(item)) if (!TOPIC_FIELDS.has(field)) problem(`unknown field "${field}"`)
    if (!isText(title)) problem('"title" must be a non-empty string')
    if (!isTextList(topicLessonIds)) problem('"lessonIds" must be a list of Lesson ids')
    else if (topicLessonIds.length === 0) problem('"lessonIds" must list at least one Lesson id')
    else {
      for (const lessonId of topicLessonIds) {
        if (!lessonIds.has(lessonId)) problem(`unknown Lesson id "${lessonId}"`)
        else if (lessonTopics.has(lessonId)) problem(`Lesson "${lessonId}" is already in topic "${lessonTopics.get(lessonId)}"`)
        else lessonTopics.set(lessonId, id)
      }
    }
    if (!isTextList(prerequisiteIds)) problem('"prerequisiteIds" must be a list of topic ids')
    else {
      const seen = new Set<string>()
      for (const prerequisiteId of prerequisiteIds) {
        if (prerequisiteId === id) problem('is its own prerequisite')
        else if (seen.has(prerequisiteId)) problem(`prerequisite "${prerequisiteId}" is listed twice`)
        seen.add(prerequisiteId)
      }
    }

    if (problems.length > before) return
    topics.push({ id, title: title as string, lessonIds: topicLessonIds as string[], prerequisiteIds: prerequisiteIds as string[] })
  })

  for (const topic of topics) {
    for (const prerequisiteId of topic.prerequisiteIds) {
      if (!ids.has(prerequisiteId)) problems.push(`${topicName(topic.id)}: unknown prerequisite topic "${prerequisiteId}"`)
    }
  }
  for (const cycle of findCycles(topics)) problems.push(`Skill Tree: prerequisites form a cycle: ${cycle.join(' → ')}`)
  return { topics, problems }
}

/** Each cycle of prerequisites once, as the topic ids along it with the first repeated at the end. */
function findCycles(topics: readonly SkillTopic[]): string[][] {
  const byId = new Map(topics.map((topic) => [topic.id, topic]))
  const done = new Set<string>()
  const cycles: string[][] = []
  const path: string[] = []
  const visit = (id: string) => {
    const onPath = path.indexOf(id)
    if (onPath !== -1) return void cycles.push([...path.slice(onPath), id])
    const topic = byId.get(id)
    if (!topic || done.has(id)) return
    path.push(id)
    for (const prerequisiteId of topic.prerequisiteIds) visit(prerequisiteId)
    path.pop()
    done.add(id)
  }
  for (const topic of topics) visit(topic.id)
  return cycles
}

/**
 * The topics by layer for drawing the tree: a topic without prerequisites is in the first layer,
 * any other one layer after its furthest prerequisite. Authored order within a layer. The topics
 * must form no cycle, as a valid Skill Tree does not.
 */
export function skillTreeLayers(topics: readonly SkillTopic[]): string[][] {
  const byId = new Map(topics.map((topic) => [topic.id, topic]))
  const depths = new Map<string, number>()
  const depthOf = (topic: SkillTopic): number => {
    let depth = depths.get(topic.id)
    if (depth === undefined) {
      const prerequisites = topic.prerequisiteIds.flatMap((id) => byId.get(id) ?? [])
      depth = Math.max(-1, ...prerequisites.map(depthOf)) + 1
      depths.set(topic.id, depth)
    }
    return depth
  }
  const layers: string[][] = []
  for (const topic of topics) (layers[depthOf(topic)] ??= []).push(topic.id)
  return layers
}

/** What there is to learn and practise in a topic of the catalog's Skill Tree. */
export function topicItems(catalog: Pick<Catalog, 'skillTree' | 'quizzes' | 'decks' | 'challenges'>, topic: SkillTopic): TopicItems {
  const lessons = new Set(topic.lessonIds)
  const covers = (lessonIds: readonly string[]) => lessonIds.some((lessonId) => lessons.has(lessonId))
  return {
    lessonIds: topic.lessonIds,
    quizzes: catalog.quizzes.filter((quiz) => lessons.has(quiz.lessonId)),
    cards: catalog.decks.flatMap((deck) => deck.cards).filter((card) => covers(card.lessonIds)),
    challenges: catalog.challenges
      .filter((challenge) => covers(challenge.lessonIds))
      .map((challenge) => ({ challenge, required: furthestTopicIds(catalog.skillTree, challenge).has(topic.id) })),
  }
}

/** The topics a Challenge practises that are not a prerequisite, directly or through others, of another one it practises. */
function furthestTopicIds(topics: readonly SkillTopic[], challenge: Challenge): Set<string> {
  const practised = topics.filter((topic) => topic.lessonIds.some((lessonId) => challenge.lessonIds.includes(lessonId)))
  const before = new Set(practised.flatMap((topic) => [...prerequisitesOf(topics, topic)]))
  return new Set(practised.map((topic) => topic.id).filter((id) => !before.has(id)))
}

/** Every topic a topic builds on: its prerequisites, theirs, and so on. */
function prerequisitesOf(topics: readonly SkillTopic[], topic: SkillTopic): Set<string> {
  const found = new Set<string>()
  const pending = [...topic.prerequisiteIds]
  while (pending.length > 0) {
    const id = pending.pop()!
    if (found.has(id)) continue
    found.add(id)
    pending.push(...(findTopic(topics, id)?.prerequisiteIds ?? []))
  }
  return found
}

/**
 * The Lesson ids the authored Skill Tree references, per topic. Malformed topics contribute what they
 * can: reporting them is `validateSkillTree`'s job.
 */
export function skillTreeLessonReferences(input: unknown): LessonReference[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item: unknown) => {
    if (!isRecord(item) || !isText(item.id) || !Array.isArray(item.lessonIds)) return []
    const referrer = topicName(item.id)
    return item.lessonIds.filter(isText).map((lessonId) => ({ referrer, lessonId }))
  })
}

export function findTopic(topics: readonly SkillTopic[], topicId: string): SkillTopic | undefined {
  return topics.find((topic) => topic.id === topicId)
}

function topicName(id: string): string {
  return `Skill Tree topic "${id}"`
}
