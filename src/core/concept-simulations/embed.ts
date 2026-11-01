import type { Lesson, LessonReference, PrimerText } from '../content/catalog'
import { isRecord, isText } from '../content/validation'

/** The Concept Simulations the app has; each is a UI over its Core simulation. */
export const CONCEPT_SIMULATION_IDS = ['load-balancer', 'consistent-hashing', 'cache', 'replication', 'cap'] as const

export type ConceptSimulationId = (typeof CONCEPT_SIMULATION_IDS)[number]

/**
 * The Lessons a simulation's explanations link to, beyond the ones it is shown in: what it shows is
 * explained there (replication lag is eventual consistency, say). Every Lesson linked inside an explanation
 * is listed too, so the catalog test catches a Lesson the primer no longer has.
 */
export const RELATED_LESSONS: Partial<Record<ConceptSimulationId, readonly string[]>> = {
  replication: ['availability-patterns', 'fail-over', 'consistency-patterns', 'eventual-consistency', 'strong-consistency'],
  cap: ['consistency-patterns', 'weak-consistency', 'eventual-consistency', 'strong-consistency', 'availability-patterns'],
}

/** A Concept Simulation shown in a Lesson, as authored. */
export interface ConceptSimulationEmbed {
  simulationId: ConceptSimulationId
  lessonId: string
  /**
   * The anchor of a heading inside the Lesson: the simulation is shown where that heading's section ends,
   * right after what it illustrates. Without it, the simulation is shown at the end of the Lesson.
   */
  afterSection?: string
}

/** A stretch of a Lesson's text and the simulations shown after it. */
export interface LessonPart {
  /** Where the stretch starts in the Lesson's text. */
  start: number
  text: PrimerText
  simulations: ConceptSimulationId[]
}

const EMBED_FIELDS = new Set<string>(['simulationId', 'lessonId', 'afterSection'])

/**
 * Checks authored embeds against their schema, the simulations the app has and the Lessons (and their
 * headings) they are shown in. A simulation is shown at most once per Lesson. Returns the embeds in
 * authored order, or every problem found.
 */
export function validateConceptSimulations(
  input: unknown,
  lessons: readonly Lesson[],
): { embeds: ConceptSimulationEmbed[]; problems: string[] } {
  if (!Array.isArray(input)) return { embeds: [], problems: ['Concept Simulations: must be a list of embeds'] }

  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  const embeds: ConceptSimulationEmbed[] = []
  const problems: string[] = []
  /** `<Lesson id> <simulation id>` of each embed seen. */
  const seen = new Set<string>()
  input.forEach((item: unknown, i) => {
    if (!isRecord(item)) return void problems.push(`Concept Simulation #${i + 1}: must be an object`)
    const simulationId = CONCEPT_SIMULATION_IDS.find((id) => id === item.simulationId)
    if (!simulationId) {
      const known = CONCEPT_SIMULATION_IDS.map((id) => `"${id}"`).join(', ')
      return void problems.push(`Concept Simulation #${i + 1}: unknown simulation "${String(item.simulationId)}" (known: ${known})`)
    }
    const problem = (message: string) => problems.push(`${simulationName(simulationId)}: ${message}`)
    const before = problems.length

    for (const field of Object.keys(item)) if (!EMBED_FIELDS.has(field)) problem(`unknown field "${field}"`)
    const { lessonId, afterSection } = item
    const lesson = isText(lessonId) ? lessonsById.get(lessonId) : undefined
    if (!isText(lessonId)) problem('"lessonId" must be a Lesson id')
    else if (!lesson) problem(`unknown Lesson id "${lessonId}"`)
    else if (seen.has(`${lessonId} ${simulationId}`)) problem(`already embedded in Lesson "${lessonId}"`)
    else seen.add(`${lessonId} ${simulationId}`)
    if (lesson && afterSection !== undefined && !lesson.headingAnchors.some((heading) => heading.anchor === afterSection)) {
      problem(`"afterSection" must be a heading inside Lesson "${lesson.id}", not "${String(afterSection)}"`)
    }

    if (problems.length > before) return
    embeds.push({ simulationId, lessonId: lessonId as string, ...(afterSection !== undefined && { afterSection: afterSection as string }) })
  })
  return { embeds, problems }
}

/** The Lessons authored embeds reference, read leniently so that a broken embed still names its Lesson. */
export function conceptSimulationLessonReferences(input: unknown): LessonReference[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item: unknown) => {
    if (!isRecord(item) || !isText(item.simulationId) || !isText(item.lessonId)) return []
    return [{ referrer: simulationName(item.simulationId), lessonId: item.lessonId }]
  })
}

/** The simulations shown in a Lesson, in authored order. */
export function conceptSimulationsOfLesson(embeds: readonly ConceptSimulationEmbed[], lessonId: string): ConceptSimulationId[] {
  return embeds.filter((embed) => embed.lessonId === lessonId).map((embed) => embed.simulationId)
}

/**
 * The Lesson's text split where the sections its simulations follow end, each stretch with the simulations
 * shown after it; simulations placed at no section follow the last stretch. One stretch when none is inside.
 */
export function lessonParts(lesson: Lesson, embeds: readonly ConceptSimulationEmbed[]): LessonPart[] {
  const ownEmbeds = embeds.filter((embed) => embed.lessonId === lesson.id)
  const ends = new Map<number, ConceptSimulationId[]>()
  for (const embed of ownEmbeds) {
    const end = embed.afterSection === undefined ? lesson.body.length : sectionEnd(lesson, embed.afterSection)
    ends.set(end, [...(ends.get(end) ?? []), embed.simulationId])
  }
  if (!ends.has(lesson.body.length)) ends.set(lesson.body.length, [])

  let start = 0
  return [...ends.keys()]
    .sort((a, b) => a - b)
    .map((end) => {
      const part = {
        start,
        text: {
          body: lesson.body.slice(start, end),
          headingAnchors: lesson.headingAnchors
            .filter((heading) => heading.offset >= start && heading.offset < end)
            .map((heading) => ({ ...heading, offset: heading.offset - start })),
        },
        simulations: ends.get(end)!,
      }
      start = end
      return part
    })
}

/** Where the section of the heading ends in the text: at the next heading of its level or above, or the end. */
function sectionEnd(text: PrimerText, anchor: string): number {
  const index = text.headingAnchors.findIndex((heading) => heading.anchor === anchor)
  if (index === -1) return text.body.length
  const level = headingLevel(text, text.headingAnchors[index].offset)
  const next = text.headingAnchors.slice(index + 1).find((heading) => headingLevel(text, heading.offset) <= level)
  return next?.offset ?? text.body.length
}

/** The level of the ATX heading starting at `offset` (`#### Sharding` is 4). */
function headingLevel(text: PrimerText, offset: number): number {
  return /^#{1,6}/.exec(text.body.slice(offset, offset + 6))?.[0].length ?? 6
}

function simulationName(simulationId: string): string {
  return `Concept Simulation "${simulationId}"`
}
