import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { BALANCING_ALGORITHMS, simulateLoadBalancer, type BalancingAlgorithm, type LoadBalancerResult } from '../../core/concept-simulations/load-balancer'
import { formatDecimal, formatInteger, t, type StringKey } from '../i18n'
import { useMediaQuery } from '../useMediaQuery'
import { Control, newSeed, seriesColor, ShareBars, SimulationFrame } from './shared'

// The load balancer Concept Simulation: the Core run for the chosen settings, played back tick by tick.

const ALGORITHM_NAMES: Record<BalancingAlgorithm, StringKey> = {
  'round-robin': 'optionRoundRobin',
  'least-connections': 'optionLeastConnections',
  hashing: 'optionHashing',
}

const ALGORITHM_HINTS: Record<BalancingAlgorithm, StringKey> = {
  'round-robin': 'loadBalancerAlgorithmRoundRobinHint',
  'least-connections': 'loadBalancerAlgorithmLeastConnectionsHint',
  hashing: 'loadBalancerAlgorithmHashingHint',
}

const TICKS = 60
const MIN_SERVERS = 2
const MAX_SERVERS = 6
const MAX_SPEED = 5
const TICK_MS = 120
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export function LoadBalancerSimulation() {
  const [algorithm, setAlgorithm] = useState<BalancingAlgorithm>('round-robin')
  const [serverSpeeds, setServerSpeeds] = useState([1, 3, 5])
  const [arrivalRate, setArrivalRate] = useState(7)
  const [clientCount, setClientCount] = useState(20)
  const [seed, setSeed] = useState(1)
  const result = useMemo(
    () => simulateLoadBalancer({ algorithm, serverSpeeds, arrivalRate, clientCount, ticks: TICKS, seed }),
    [algorithm, serverSpeeds, arrivalRate, clientCount, seed],
  )
  const chartsRef = useRef<HTMLDivElement>(null)
  const playback = usePlayback(result, chartsRef)
  const capacity = serverSpeeds.reduce((sum, speed) => sum + speed, 0)
  const ids = { algorithm: useId(), rate: useId(), clients: useId(), tick: useId() }

  return (
    <SimulationFrame title={t('loadBalancerTitle')} description={t('loadBalancerDescription')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Control label={t('loadBalancerAlgorithm')} hint={t(ALGORITHM_HINTS[algorithm])} labelId={ids.algorithm}>
          <div role="radiogroup" aria-labelledby={ids.algorithm} className="flex flex-wrap gap-2">
            {BALANCING_ALGORITHMS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={algorithm === option}
                onClick={() => setAlgorithm(option)}
                className={`rounded border px-2 py-1 text-sm ${algorithm === option ? 'border-sky-400 text-sky-300' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
              >
                {t(ALGORITHM_NAMES[option])}
              </button>
            ))}
          </div>
        </Control>

        <Control label={t('loadBalancerServers')} hint={t('loadBalancerServersHint')}>
          <ul className="space-y-1">
            {serverSpeeds.map((speed, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: seriesColor(i) }} />
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 whitespace-nowrap text-zinc-300">{t('loadBalancerServerName', { number: i + 1 })}</span>
                  <input
                    type="range"
                    min={1}
                    max={MAX_SPEED}
                    value={speed}
                    aria-label={t('loadBalancerServerSpeed', { number: i + 1 })}
                    aria-valuetext={t('loadBalancerServerSpeedValue', { speed })}
                    onChange={(event) => setServerSpeeds((speeds) => speeds.map((old, j) => (j === i ? Number(event.target.value) : old)))}
                    className="min-w-0 flex-1"
                  />
                  <span className="shrink-0 whitespace-nowrap text-zinc-400 tabular-nums">{t('loadBalancerServerSpeedValue', { speed })}</span>
                </label>
                <button
                  type="button"
                  disabled={serverSpeeds.length <= MIN_SERVERS}
                  aria-label={t('loadBalancerRemoveServer', { number: i + 1 })}
                  onClick={() => setServerSpeeds((speeds) => speeds.filter((_, j) => j !== i))}
                  className="rounded px-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={serverSpeeds.length >= MAX_SERVERS}
            onClick={() => setServerSpeeds((speeds) => [...speeds, 2])}
            className="mt-2 rounded border border-zinc-700 px-2 py-0.5 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
          >
            + {t('loadBalancerAddServer')}
          </button>
        </Control>

        <Control label={t('loadBalancerArrivalRate')} hint={t('loadBalancerArrivalRateHint')} labelId={ids.rate}>
          <input
            type="range"
            min={1}
            max={MAX_SERVERS * MAX_SPEED}
            value={arrivalRate}
            aria-labelledby={ids.rate}
            onChange={(event) => setArrivalRate(Number(event.target.value))}
            className="w-full"
          />
          <p className="text-sm text-zinc-300">
            {t('loadBalancerArrivalRateValue', { rate: arrivalRate, percent: formatInteger((arrivalRate / capacity) * 100) })}
          </p>
        </Control>

        <Control label={t('loadBalancerClients')} hint={t('loadBalancerClientsHint')} labelId={ids.clients}>
          <input
            type="range"
            min={1}
            max={50}
            value={clientCount}
            aria-labelledby={ids.clients}
            onChange={(event) => setClientCount(Number(event.target.value))}
            className="w-full"
          />
          <p className="text-sm text-zinc-300">{t('loadBalancerClientsValue', { count: clientCount })}</p>
        </Control>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={playback.toggle}
          className="rounded border border-sky-400 px-3 py-1 text-sky-300 hover:bg-sky-400/10"
        >
          {playback.playing ? t('conceptSimulationPause') : t('conceptSimulationPlay')}
        </button>
        <label htmlFor={ids.tick} className="sr-only">
          {t('loadBalancerTick')}
        </label>
        <input
          id={ids.tick}
          type="range"
          min={1}
          max={TICKS}
          value={playback.tick}
          onChange={(event) => playback.seek(Number(event.target.value))}
          className="min-w-0 flex-1 basis-40"
        />
        <span className="text-zinc-400 tabular-nums">{t('loadBalancerTickValue', { tick: playback.tick, total: TICKS })}</span>
        <button
          type="button"
          title={t('conceptSimulationRerunHint')}
          onClick={() => setSeed(newSeed)}
          className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
        >
          {t('conceptSimulationRerun')}
        </button>
      </div>

      <div ref={chartsRef} className="mt-4 grid gap-6 md:grid-cols-2">
        <Distribution result={result} tick={playback.tick} />
        <QueueChart result={result} tick={playback.tick} />
      </div>
      <ServerTable result={result} speeds={serverSpeeds} />
    </SimulationFrame>
  )
}

/**
 * Plays the run from its first tick once the charts come into view, and again whenever the run changes.
 * With reduced motion the run is shown whole.
 */
function usePlayback(result: LoadBalancerResult, charts: RefObject<HTMLElement | null>) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION)
  const seen = useSeen(charts)
  const [tick, setTick] = useState(reducedMotion ? TICKS : 1)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (reducedMotion || !seen) return
    setTick(1)
    setPlaying(true)
  }, [result, reducedMotion, seen])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setTick((current) => {
        if (current >= TICKS) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [playing])

  return {
    tick,
    playing,
    toggle: () => {
      if (!playing && tick >= TICKS) setTick(1)
      setPlaying(!playing)
    },
    seek: (next: number) => {
      setPlaying(false)
      setTick(next)
    },
  }
}

/** Whether the element has come into view yet; it stays true once it has. */
function useSeen(target: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const element = target.current
    if (seen || !element) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSeen(true)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [target, seen])
  return seen
}

function Distribution({ result, tick }: { result: LoadBalancerResult; tick: number }) {
  const assigned = result.ticks[tick - 1]?.assigned ?? []
  return (
    <ShareBars
      title={t('loadBalancerDistributionTitle')}
      valueKey="loadBalancerDistributionValue"
      bars={assigned.map((count, i) => ({ key: String(i), label: t('loadBalancerServerName', { number: i + 1 }), count, color: seriesColor(i) }))}
    />
  )
}

const CHART = { width: 480, height: 200, left: 30, right: 8, top: 8, bottom: 20 }

/** Queue length per server over the ticks played so far, one line per server, with a crosshair on hover. */
function QueueChart({ result, tick }: { result: LoadBalancerResult; tick: number }) {
  const [hover, setHover] = useState<number>()
  const shown = result.ticks.slice(0, tick)
  // The y axis fits the whole run, so it stays still while the run plays, and ends on a round number.
  const longest = roundUp(Math.max(4, ...result.ticks.flatMap((entry) => entry.queueLengths)))
  const plotWidth = CHART.width - CHART.left - CHART.right
  const plotHeight = CHART.height - CHART.top - CHART.bottom
  const x = (index: number) => CHART.left + (index / Math.max(1, TICKS - 1)) * plotWidth
  const y = (length: number) => CHART.top + plotHeight - (length / longest) * plotHeight
  const serverCount = result.servers.length
  const hovered = hover !== undefined && hover < shown.length ? shown[hover] : undefined

  return (
    <figure>
      <figcaption className="text-sm font-medium text-zinc-200">{t('loadBalancerQueuesTitle')}</figcaption>
      <p className="text-xs text-zinc-500">{t('loadBalancerQueuesHint')}</p>
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          className="w-full"
          role="img"
          aria-label={t('loadBalancerQueuesTitle')}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect()
            const svgX = ((event.clientX - box.left) / box.width) * CHART.width
            const index = Math.round(((svgX - CHART.left) / plotWidth) * (TICKS - 1))
            setHover(Math.min(Math.max(index, 0), TICKS - 1))
          }}
          onPointerLeave={() => setHover(undefined)}
        >
          {[0, longest / 2, longest].map((value) => (
            <g key={value}>
              <line x1={CHART.left} x2={CHART.width - CHART.right} y1={y(value)} y2={y(value)} className="stroke-zinc-800" strokeWidth={1} />
              <text x={CHART.left - 4} y={y(value) + 3} textAnchor="end" className="fill-zinc-500 text-[10px]">
                {Math.round(value)}
              </text>
            </g>
          ))}
          <text x={CHART.left} y={CHART.height - 4} className="fill-zinc-500 text-[10px]">
            1
          </text>
          <text x={CHART.width - CHART.right} y={CHART.height - 4} textAnchor="end" className="fill-zinc-500 text-[10px]">
            {TICKS}
          </text>
          {Array.from({ length: serverCount }, (_, server) => (
            <polyline
              key={server}
              fill="none"
              stroke={seriesColor(server)}
              strokeWidth={2}
              strokeLinejoin="round"
              points={shown.map((entry, i) => `${x(i)},${y(entry.queueLengths[server])}`).join(' ')}
            />
          ))}
          {hovered && hover !== undefined && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={CHART.top} y2={CHART.top + plotHeight} className="stroke-zinc-500" strokeWidth={1} />
              {hovered.queueLengths.map((length, server) => (
                <circle key={server} cx={x(hover)} cy={y(length)} r={4} fill={seriesColor(server)} className="stroke-zinc-950" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hovered && hover !== undefined && (
          <div
            className="pointer-events-none absolute top-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap shadow"
            // Beside the crosshair, on the side with room.
            style={{
              left: `${(x(hover) / CHART.width) * 100}%`,
              transform: hover > TICKS / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
            }}
          >
            <p className="font-medium text-zinc-200">{t('loadBalancerQueueAt', { tick: hover + 1 })}</p>
            {hovered.queueLengths.map((length, server) => (
              <p key={server} className="flex items-center gap-1.5 text-zinc-300">
                <span aria-hidden className="size-2 rounded-full" style={{ background: seriesColor(server) }} />
                {t('loadBalancerServerName', { number: server + 1 })}: {t('loadBalancerQueueValue', { count: length })}
              </p>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-400">
        {result.servers.map((_, server) => (
          <li key={server} className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3" style={{ background: seriesColor(server) }} />
            {t('loadBalancerServerName', { number: server + 1 })}
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** Up to a multiple of 10 (of 2 up to 10), so the halfway gridline is a whole number too. */
function roundUp(value: number): number {
  const step = value > 10 ? 10 : 2
  return Math.ceil(value / step) * step
}

/** The whole run per server, also the chart's table view. */
function ServerTable({ result, speeds }: { result: LoadBalancerResult; speeds: number[] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-zinc-300">{t('loadBalancerTableTitle')}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="text-zinc-400">
            <tr>
              {(['loadBalancerColumnServer', 'loadBalancerColumnSpeed', 'loadBalancerColumnAssigned', 'loadBalancerColumnCompleted', 'loadBalancerColumnMaxQueue', 'loadBalancerColumnMeanQueue'] as const).map((key) => (
                <th key={key} className="py-1 pr-3 font-normal">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-zinc-200">
            {result.servers.map((server, i) => (
              <tr key={i} className="border-t border-zinc-800">
                <td className="py-1 pr-3">{t('loadBalancerServerName', { number: i + 1 })}</td>
                <td className="py-1 pr-3">{t('loadBalancerServerSpeedValue', { speed: speeds[i] })}</td>
                <td className="py-1 pr-3">{server.assigned}</td>
                <td className="py-1 pr-3">{server.completed}</td>
                <td className="py-1 pr-3">{server.maxQueue}</td>
                <td className="py-1 pr-3">{formatDecimal(server.meanQueue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
