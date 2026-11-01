import { useMemo, type ComponentType, type ReactNode } from 'react'
import { lessonParts, type ConceptSimulationId } from '../../core/concept-simulations/embed'
import type { Lesson } from '../../core/content/catalog'
import { catalog } from '../catalog'
import { PRIMER_PROSE_CLASS, PrimerMarkdown } from '../PrimerMarkdown'
import { CacheSimulation } from './CacheSimulation'
import { ConsistentHashingSimulation } from './ConsistentHashingSimulation'
import { LoadBalancerSimulation } from './LoadBalancerSimulation'

const SIMULATIONS: Record<ConceptSimulationId, ComponentType> = {
  'load-balancer': LoadBalancerSimulation,
  'consistent-hashing': ConsistentHashingSimulation,
  cache: CacheSimulation,
}

/**
 * The Lesson's primer text with its Concept Simulations, each right after the section it illustrates.
 * `codeBlocks` replace code blocks of the whole text, keyed by where they start in it.
 */
export function LessonText({ lesson, codeBlocks }: { lesson: Lesson; codeBlocks?: ReadonlyMap<number, ReactNode> }) {
  const parts = useMemo(() => lessonParts(lesson, catalog.conceptSimulations), [lesson])
  return parts.map(({ start, text, simulations }) => (
    // Keyed by Lesson too, so a simulation starts afresh in the next Lesson rather than keeping its settings.
    <div key={`${lesson.id} ${start}`}>
      <div lang="en" className={`${PRIMER_PROSE_CLASS} mt-8`}>
        <PrimerMarkdown text={text} codeBlocks={codeBlocks && shift(codeBlocks, start, text.body.length)} />
      </div>
      {simulations.map((simulationId) => {
        const Simulation = SIMULATIONS[simulationId]
        return <Simulation key={simulationId} />
      })}
    </div>
  ))
}

/** The code blocks inside the stretch of the text from `start`, keyed by where they start in the stretch. */
function shift(codeBlocks: ReadonlyMap<number, ReactNode>, start: number, length: number): ReadonlyMap<number, ReactNode> {
  return new Map([...codeBlocks].filter(([offset]) => offset >= start && offset < start + length).map(([offset, node]) => [offset - start, node]))
}
