import { useId, useMemo, useState, type ReactElement } from 'react'
import type { Design } from '../../core/design/design'
import {
  REALISTIC_SAMPLES,
  REQUEST_KINDS,
  SIMULATION_MODES,
  simulate,
  type ChaosScenario,
  type LoadProfile,
  type RequestPath,
  type SimulationMode,
  type SimulationResult,
} from '../../core/simulation/simulate'
import { parseDecimal } from '../EstimationSteps'
import { formatDecimal, formatInteger, formatNumber, t } from '../i18n'

// The Traffic Simulation around a canvas: the Load Profile with its slider above, the summary below.

/** The Load Profile as typed: requests per second and the request size in KB. */
export interface LoadDraft {
  read: string
  write: string
  requestKb: string
}

export const DEFAULT_LOAD: LoadDraft = { read: '1000', write: '100', requestKb: '1' }

/** The fields describing a Load Profile, e.g. a Challenge Stage's. */
export function draftOf({ readQps, writeQps, requestBytes }: LoadProfile): LoadDraft {
  return { read: String(readQps), write: String(writeQps), requestKb: String(requestBytes / 1_000) }
}

/** The Load Profile the fields describe; undefined while one is not a number of at least 0. */
export function loadProfileOf(draft: LoadDraft): LoadProfile | undefined {
  const [readQps, writeQps, requestKb] = [draft.read, draft.write, draft.requestKb].map(parseDecimal)
  if ([readQps, writeQps, requestKb].some((value) => value === undefined || value < 0)) return undefined
  return { readQps: readQps!, writeQps: writeQps!, requestBytes: requestKb! * 1_000 }
}

/**
 * The Load Profile being typed, starting from `initial`, and the simulation mode, with the controls that
 * change them; `profile` is set only while the simulation is on.
 */
export function useLoadControls(initial: LoadDraft): { profile: LoadProfile | undefined; mode: SimulationMode; controls: ReactElement } {
  const [draft, setDraft] = useState(initial)
  const [simulating, setSimulating] = useState(false)
  const [mode, setMode] = useState<SimulationMode>('simple')
  const profile = simulating ? loadProfileOf(draft) : undefined
  const controls = (
    <LoadControls draft={draft} simulating={simulating} mode={mode} onChange={setDraft} onToggle={() => setSimulating((on) => !on)} onModeChange={setMode} />
  )
  return { profile, mode, controls }
}

/**
 * The Traffic Simulation of a Design under a Load Profile, and a Chaos Scenario if any, in a mode, computed
 * again only when one of them changes; none without a Design and a Load Profile.
 */
export function useSimulation(
  design: Design | undefined,
  profile: LoadProfile | undefined,
  scenario?: ChaosScenario,
  mode: SimulationMode = 'simple',
): SimulationResult | undefined {
  // Scenarios are built anew on every render, so they are compared by content.
  const scenarioKey = JSON.stringify(scenario ?? null)
  return useMemo(
    () => (design && profile ? simulate(design, profile, scenario, mode) : undefined),
    [design, profile?.readQps, profile?.writeQps, profile?.requestBytes, scenarioKey, mode],
  )
}

/** The slider's range of total load, 100 to 100,000 requests per second, on a log scale. */
const SLIDER_MIN = 2
const SLIDER_MAX = 5

const fieldClass = 'mt-1 w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100'

const formatSignificant = (ms: number) => formatNumber(Number(ms.toPrecision(3)))
const formatMs = (ms: number) => t('trafficMs', { ms: formatSignificant(ms) })
const formatPercent = (share: number) => formatDecimal(share * 100)

const MODE_LABELS = { simple: 'trafficModeSimple', realistic: 'trafficModeRealistic' } as const

export function LoadControls(props: {
  draft: LoadDraft
  simulating: boolean
  mode: SimulationMode
  onChange(draft: LoadDraft): void
  onToggle(): void
  onModeChange(mode: SimulationMode): void
}) {
  const { draft, simulating, mode, onChange, onToggle, onModeChange } = props
  const id = useId()
  const profile = loadProfileOf(draft)
  const total = profile ? profile.readQps + profile.writeQps : 0

  /** Scales reads and writes to a new total, keeping their mix. */
  function slide(exponent: number) {
    const next = Math.round(10 ** exponent)
    const readShare = profile && total > 0 ? profile.readQps / total : 1
    const read = Math.round(next * readShare)
    onChange({ ...draft, read: String(read), write: String(next - read) })
  }

  const field = (key: keyof LoadDraft, label: string) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="block text-xs text-zinc-400">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        inputMode="decimal"
        className={fieldClass}
        value={draft[key]}
        onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
      />
    </div>
  )

  return (
    <section aria-labelledby={`${id}-title`} className="mb-3 rounded border border-zinc-800 p-3">
      <h2 id={`${id}-title`} className="text-sm font-semibold text-zinc-100">
        {t('trafficTitle')}
      </h2>
      <p className="mt-1 text-xs text-zinc-400">{t('trafficDescription')}</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        {field('read', t('trafficReadQps'))}
        {field('write', t('trafficWriteQps'))}
        {field('requestKb', t('trafficRequestKb'))}
        <div className="min-w-56 flex-1">
          <label htmlFor={`${id}-slider`} className="block text-xs text-zinc-400">
            {t('trafficLoad', { qps: formatInteger(total) })}
          </label>
          <input
            id={`${id}-slider`}
            type="range"
            aria-label={t('trafficLoadSlider')}
            aria-valuetext={t('trafficQps', { qps: formatInteger(total) })}
            className="mt-2 w-full"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={0.01}
            value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Math.log10(Math.max(total, 1))))}
            onChange={(event) => slide(Number(event.target.value))}
          />
        </div>
        <button
          type="button"
          aria-pressed={simulating}
          className={simulating ? 'rounded border border-sky-500 bg-sky-500/15 px-3 py-1.5 text-sm text-zinc-50' : 'rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500'}
          onClick={onToggle}
        >
          {simulating ? t('trafficStop') : t('trafficStart')}
        </button>
      </div>
      <fieldset className="mt-3">
        <legend className="text-xs text-zinc-400">{t('trafficMode')}</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {SIMULATION_MODES.map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-sm text-zinc-200">
              <input type="radio" name={`${id}-mode`} value={option} checked={mode === option} onChange={() => onModeChange(option)} />
              {t(MODE_LABELS[option])}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          {mode === 'simple' ? t('trafficModeSimpleHelp') : t('trafficModeRealisticHelp', { samples: formatInteger(REALISTIC_SAMPLES) })}
        </p>
      </fieldset>
      {!profile && (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {t('trafficInvalid')}
        </p>
      )}
    </section>
  )
}

/**
 * End-to-end latency, error rates, cost, the bottlenecks and each request path; under a Chaos Scenario,
 * what it broke and the paths that fail. `label` tells summaries on one page apart.
 */
export function SimulationSummary({ design, result, label = t('trafficSummary') }: { design: Design; result: SimulationResult; label?: string }) {
  const nodeLabel = (nodeId: string) => design.nodes.find((node) => node.id === nodeId)?.label || nodeId
  const hasClient = design.nodes.some((node) => node.componentType === 'client')
  const { read, write } = result.meanLatencyMs
  const errorStat = (name: string, rate: number) => ({ name, value: t('trafficPercent', { percent: formatPercent(rate) }), bad: rate > 0 })
  const { read: readErrors, write: writeErrors } = result.errorRateByKind
  const stats: { name: string; value: string; bad?: boolean }[] = [
    ...(read !== undefined ? [{ name: t('trafficMeanRead'), value: formatMs(read) }] : []),
    ...(write !== undefined ? [{ name: t('trafficMeanWrite'), value: formatMs(write) }] : []),
    // Realistic mode only: the spread of the requests drawn, and how long they wait in queues.
    ...REQUEST_KINDS.flatMap((kind) => {
      const percentiles = result.latencyPercentilesMs?.[kind]
      const waitMs = result.queueingDelayMs?.[kind]
      if (!percentiles || waitMs === undefined) return []
      const { p50Ms, p95Ms, p99Ms } = percentiles
      return [
        {
          name: t(kind === 'read' ? 'trafficPercentilesRead' : 'trafficPercentilesWrite'),
          value: t('trafficPercentilesMs', { p50: formatSignificant(p50Ms), p95: formatSignificant(p95Ms), p99: formatSignificant(p99Ms) }),
        },
        { name: t(kind === 'read' ? 'trafficQueueingRead' : 'trafficQueueingWrite'), value: formatMs(waitMs) },
      ]
    }),
    errorStat(t('trafficErrorRate'), result.errorRate),
    // Per kind only when there are both, or it would repeat the overall rate.
    ...(readErrors !== undefined && writeErrors !== undefined ? [errorStat(t('trafficReadErrors'), readErrors), errorStat(t('trafficWriteErrors'), writeErrors)] : []),
    { name: t('trafficDropped'), value: t('trafficQps', { qps: formatInteger(result.droppedQps) }), bad: result.droppedQps > 0 },
    ...(result.throttledQps > 0 ? [{ name: t('trafficThrottled'), value: t('trafficQps', { qps: formatInteger(result.throttledQps) }) }] : []),
    { name: t('trafficCost'), value: t('trafficUsd', { usd: formatInteger(result.monthlyCostUsd) }) },
  ]
  const paths = [...result.paths].sort((a, b) => b.share - a.share)
  // The paths failing the most requests first.
  const failing = paths.filter((path) => path.errorRate > 0).sort((a, b) => b.share * b.errorRate - a.share * a.errorRate)
  const broken = [
    ...Object.entries(result.nodes).flatMap(([nodeId, metrics]) => {
      const node = nodeLabel(nodeId)
      if (metrics.down) return [t('trafficBrokenNode', { node })]
      if (metrics.primaryDown) return [t('trafficBrokenPrimary', { node })]
      return metrics.cold ? [t('trafficBrokenCold', { node })] : []
    }),
    ...result.cutEdgeIds.flatMap((edgeId) => {
      const edge = design.edges.find((candidate) => candidate.id === edgeId)
      return edge ? [t('trafficBrokenEdge', { source: nodeLabel(edge.source), target: nodeLabel(edge.target) })] : []
    }),
  ]
  const pathItem = (path: RequestPath) => (
    <li key={`${path.kind}:${path.nodeIds.join('>')}`}>
      <span className="text-zinc-500">{t(path.kind === 'read' ? 'trafficPathRead' : 'trafficPathWrite')}:</span> {path.nodeIds.map(nodeLabel).join(' → ')} ·{' '}
      {formatMs(path.latencyMs)} · {t('trafficPathShare', { percent: formatPercent(path.share) })}
      {path.errorRate > 0 && <span className="text-rose-300"> · {t('trafficPathErrors', { percent: formatPercent(path.errorRate) })}</span>}
    </li>
  )

  return (
    <section aria-label={label} className="mt-3 rounded border border-zinc-800 p-3 text-sm">
      <h2 className="font-semibold text-zinc-100">{label}</h2>
      {!hasClient && <p className="mt-1 text-xs text-amber-300">{t('trafficNoClient')}</p>}
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map(({ name, value, bad }) => (
          <div key={name}>
            <dt className="text-xs text-zinc-500">{name}</dt>
            <dd className={bad ? 'text-rose-300' : 'text-zinc-100'}>{value}</dd>
          </div>
        ))}
      </dl>
      {broken.length > 0 && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold text-zinc-300">{t('trafficBroken')}</h3>
            <ul className="mt-1 space-y-0.5 text-xs text-rose-300">
              {broken.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
          {failing.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-300">{t('trafficFailingPaths')}</h3>
              <ul className="mt-1 space-y-0.5 text-xs text-zinc-300">{failing.slice(0, 8).map(pathItem)}</ul>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold text-zinc-300">{t('trafficBottlenecks')}</h3>
          {result.bottlenecks.length === 0 ? (
            <p className="mt-1 text-xs text-zinc-500">{t('trafficNoBottleneck')}</p>
          ) : (
            <ol className="mt-1 space-y-0.5 text-xs">
              {result.bottlenecks.slice(0, 5).map((nodeId) => {
                const metrics = result.nodes[nodeId]
                return (
                  <li key={nodeId} className={metrics.overloaded ? 'text-rose-300' : 'text-zinc-300'}>
                    {nodeLabel(nodeId)}: {t('trafficPercent', { percent: formatPercent(metrics.utilisation) })}
                    {metrics.overloaded && ` · ${t('nodeOverloaded')}`}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-300">{t('trafficPaths')}</h3>
          <ul className="mt-1 space-y-0.5 text-xs text-zinc-300">{paths.slice(0, 8).map(pathItem)}</ul>
        </div>
      </div>
    </section>
  )
}
