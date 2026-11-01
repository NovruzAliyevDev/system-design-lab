import { useId, useMemo, useRef, useState } from 'react'
import { BALANCING_ALGORITHMS, simulateLoadBalancer, type BalancingAlgorithm, type LoadBalancerResult } from '../../core/concept-simulations/load-balancer'
import { formatDecimal, formatInteger, t, type StringKey } from '../i18n'
import { Choice, Control, newSeed, PlaybackBar, seriesColor, ShareBars, SimulationFrame, TimelineChart, usePlayback } from './shared'

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
  const playback = usePlayback(result, TICKS, chartsRef)
  const capacity = serverSpeeds.reduce((sum, speed) => sum + speed, 0)
  const ids = { algorithm: useId(), rate: useId(), clients: useId() }

  return (
    <SimulationFrame title={t('loadBalancerTitle')} description={t('loadBalancerDescription')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Control label={t('loadBalancerAlgorithm')} hint={t(ALGORITHM_HINTS[algorithm])} labelId={ids.algorithm}>
          <Choice labelledBy={ids.algorithm} options={BALANCING_ALGORITHMS} value={algorithm} onChange={setAlgorithm} name={(option) => t(ALGORITHM_NAMES[option])} />
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

      <PlaybackBar playback={playback} total={TICKS} onRerun={() => setSeed(newSeed)} />

      <div ref={chartsRef} className="mt-4 grid gap-6 md:grid-cols-2">
        <Distribution result={result} tick={playback.tick} />
        <QueueChart result={result} tick={playback.tick} />
      </div>
      <ServerTable result={result} speeds={serverSpeeds} />
    </SimulationFrame>
  )
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

/** Queue length per server over the ticks played so far. */
function QueueChart({ result, tick }: { result: LoadBalancerResult; tick: number }) {
  return (
    <TimelineChart
      title={t('loadBalancerQueuesTitle')}
      hint={t('loadBalancerQueuesHint')}
      total={TICKS}
      shown={tick}
      series={result.servers.map((_, server) => ({
        key: String(server),
        label: t('loadBalancerServerName', { number: server + 1 }),
        color: seriesColor(server),
        values: result.ticks.map((entry) => entry.queueLengths[server]),
      }))}
      formatValue={(count) => t('loadBalancerQueueValue', { count })}
    />
  )
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
