// Authored Concept Simulation embeds: which interactive simulation each Lesson shows, at its end or right
// after one of its sections (`afterSection`, a heading anchor inside the Lesson). The
// Content Pipeline validates them when it builds the catalog: an unknown simulation, Lesson or heading fails
// the build. The simulations themselves are Core code; their Azerbaijani explanations are UI strings.
import type { ConceptSimulationEmbed } from '../src/core/concept-simulations/embed'

export const conceptSimulations: ConceptSimulationEmbed[] = [
  { simulationId: 'load-balancer', lessonId: 'load-balancer' },
  // Sharding is a section of the RDBMS Lesson, where the primer suggests consistent hashing for rebalancing.
  { simulationId: 'consistent-hashing', lessonId: 'relational-database-management-system-rdbms', afterSection: 'sharding' },
  // Hit/miss and eviction where the cache is introduced; the write strategies after the Lesson that compares them.
  { simulationId: 'cache', lessonId: 'cache' },
  { simulationId: 'cache', lessonId: 'when-to-update-the-cache' },
]
