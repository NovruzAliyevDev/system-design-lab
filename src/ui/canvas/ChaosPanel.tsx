import { useId, useState, type ReactElement } from 'react'
import { chaosScenarioOf, type ChaosTask } from '../../core/challenges/rules'
import { nodeSimulation, type Design, type DesignNode } from '../../core/design/design'
import { CHAOS_TYPES, type ChaosScenario, type ChaosType } from '../../core/simulation/simulate'
import { t, type StringKey } from '../i18n'
import { componentName } from './componentText'

// The Chaos Scenario the Traffic Simulation runs under: a Stage's Chaos tasks, or, beside a Design that
// can be picked from, one broken by hand.

/** No scenario, a Chaos task by id, or a scenario type broken by hand. */
type Choice = { kind: 'none' } | { kind: 'task'; taskId: string } | { kind: 'custom'; type: ChaosType }

type Side = 'a' | 'b'

/** What the learner picked by hand, kept per scenario type while they switch between them. */
interface Picks {
  /** For `node-down` and `cache-cold`. */
  nodeIds: Record<'node-down' | 'cache-cold', string[]>
  zoneId: string
  sides: Record<string, Side>
}

const TYPE_LABELS: Record<ChaosType, StringKey> = {
  'node-down': 'chaosNodeDown',
  'zone-down': 'chaosZoneDown',
  'cache-cold': 'chaosCacheCold',
  partition: 'chaosPartition',
}

const fieldClass = 'mt-1 min-h-11 rounded border border-border bg-surface-raised px-2 text-sm text-text sm:min-h-8'

/**
 * The scenario picker, with the scenario it describes for a Design. The Stage's Chaos tasks apply to any
 * Design; a scenario broken by hand can be picked only beside the `design` it picks from.
 */
export function useChaosControls(tasks: readonly ChaosTask[], design?: Design): { scenarioFor(design: Design): ChaosScenario | undefined; controls: ReactElement } {
  const [choice, setChoice] = useState<Choice>({ kind: 'none' })
  const [picks, setPicks] = useState<Picks>({ nodeIds: { 'node-down': [], 'cache-cold': [] }, zoneId: '', sides: {} })

  function scenarioFor(target: Design): ChaosScenario | undefined {
    switch (choice.kind) {
      case 'none':
        return undefined
      case 'task': {
        const task = tasks.find((candidate) => candidate.id === choice.taskId)
        return task && chaosScenarioOf(task.scenario, target)
      }
      case 'custom':
        return customScenario(choice.type, picks)
    }
  }

  const controls = <ChaosControls tasks={tasks} design={design} choice={choice} picks={picks} onChoice={setChoice} onPicks={setPicks} />
  return { scenarioFor, controls }
}

function customScenario(type: ChaosType, picks: Picks): ChaosScenario {
  switch (type) {
    case 'node-down':
    case 'cache-cold':
      return { type, nodeIds: picks.nodeIds[type] }
    case 'zone-down':
      return { type, zoneIds: picks.zoneId ? [picks.zoneId] : [] }
    case 'partition': {
      const side = (wanted: Side) => Object.entries(picks.sides).flatMap(([nodeId, picked]) => (picked === wanted ? [nodeId] : []))
      return { type, sides: [side('a'), side('b')] }
    }
  }
}

function choiceValue(choice: Choice): string {
  return choice.kind === 'none' ? 'none' : choice.kind === 'task' ? `task:${choice.taskId}` : choice.type
}

function ChaosControls(props: {
  tasks: readonly ChaosTask[]
  design?: Design
  choice: Choice
  picks: Picks
  onChoice(choice: Choice): void
  onPicks(picks: Picks): void
}) {
  const { tasks, design, choice, picks, onChoice, onPicks } = props
  const id = useId()
  const task = choice.kind === 'task' ? tasks.find((candidate) => candidate.id === choice.taskId) : undefined
  if (tasks.length === 0 && !design) return null

  function choose(value: string) {
    if (value === 'none') onChoice({ kind: 'none' })
    else if (value.startsWith('task:')) onChoice({ kind: 'task', taskId: value.slice('task:'.length) })
    else onChoice({ kind: 'custom', type: value as ChaosType })
  }

  return (
    <section aria-labelledby={`${id}-title`} className="mb-3 rounded border border-border p-3">
      <h2 id={`${id}-title`} className="text-sm font-semibold text-text">
        {t('chaosTitle')}
      </h2>
      <p className="mt-1 text-xs text-text-muted">{t('chaosDescription')}</p>
      <label htmlFor={`${id}-scenario`} className="mt-2 block text-xs text-text-muted">
        {t('chaosScenario')}
      </label>
      <select id={`${id}-scenario`} className={`${fieldClass} max-w-full`} value={choiceValue(choice)} onChange={(event) => choose(event.target.value)}>
        <option value="none">{t('chaosNone')}</option>
        {tasks.map((candidate) => (
          <option key={candidate.id} value={`task:${candidate.id}`}>
            {t('chaosTask', { prompt: candidate.prompt })}
          </option>
        ))}
        {design && CHAOS_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(TYPE_LABELS[type])}
          </option>
        ))}
      </select>
      {task && <p className="mt-2 text-sm text-warning">{task.prompt}</p>}
      {choice.kind === 'custom' && design && <CustomPicks type={choice.type} design={design} picks={picks} onPicks={onPicks} />}
    </section>
  )
}

/** Picks the Nodes, the zone or the two sides a scenario broken by hand applies to. */
function CustomPicks({ type, design, picks, onPicks }: { type: ChaosType; design: Design; picks: Picks; onPicks(picks: Picks): void }) {
  const id = useId()
  const nodeName = (node: DesignNode) => node.label || componentName(node.componentType)
  // Clients stand for the users and never go down, though a partition can cut them off.
  const servers = design.nodes.filter((node) => node.componentType !== 'client')
  const empty = (key: StringKey) => <p className="mt-2 text-xs text-text-muted">{t(key)}</p>

  if (type === 'node-down' || type === 'cache-cold') {
    const candidates = type === 'node-down' ? servers : servers.filter((node) => nodeSimulation(node)?.hitRatio !== undefined)
    if (candidates.length === 0) return empty(type === 'node-down' ? 'chaosNoNodes' : 'chaosNoCaches')
    const picked = new Set(picks.nodeIds[type])
    const toggle = (nodeId: string, on: boolean) => {
      const next = on ? [...picked, nodeId] : [...picked].filter((pickedId) => pickedId !== nodeId)
      onPicks({ ...picks, nodeIds: { ...picks.nodeIds, [type]: next } })
    }
    return (
      <fieldset className="mt-2">
        <legend className="text-xs text-text-muted">{t(type === 'node-down' ? 'chaosPickNodes' : 'chaosPickCaches')}</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {candidates.map((node) => (
            <label key={node.id} className="flex items-center gap-1.5 text-sm text-text">
              <input type="checkbox" checked={picked.has(node.id)} onChange={(event) => toggle(node.id, event.target.checked)} />
              {nodeName(node)}
            </label>
          ))}
        </div>
      </fieldset>
    )
  }

  if (type === 'zone-down') {
    if (design.zones.length === 0) return empty('chaosNoZones')
    return (
      <div className="mt-2">
        <label htmlFor={`${id}-zone`} className="block text-xs text-text-muted">
          {t('chaosPickZone')}
        </label>
        <select id={`${id}-zone`} className={fieldClass} value={picks.zoneId} onChange={(event) => onPicks({ ...picks, zoneId: event.target.value })}>
          <option value="">{t('chaosPickZoneNone')}</option>
          {design.zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (design.nodes.length < 2) return empty('chaosNoNodes')
  const setSide = (nodeId: string, side: string) => {
    const { [nodeId]: _, ...others } = picks.sides
    onPicks({ ...picks, sides: side === 'a' || side === 'b' ? { ...others, [nodeId]: side } : others })
  }
  return (
    <fieldset className="mt-2">
      <legend className="text-xs text-text-muted">{t('chaosPartitionHelp')}</legend>
      <div className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {design.nodes.map((node) => (
          <label key={node.id} className="flex items-center justify-between gap-2 text-sm text-text">
            <span className="truncate">{nodeName(node)}</span>
            <select
              aria-label={t('chaosSideOf', { node: nodeName(node) })}
              className={fieldClass}
              value={picks.sides[node.id] ?? ''}
              onChange={(event) => setSide(node.id, event.target.value)}
            >
              <option value="">{t('chaosSideNone')}</option>
              <option value="a">{t('chaosSideA')}</option>
              <option value="b">{t('chaosSideB')}</option>
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
