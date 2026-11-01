import { useId, useMemo, useRef, useState } from 'react'
import {
  REPLICATION_TOPOLOGIES,
  simulateReplication,
  totalsOf,
  type NodeRole,
  type NodeState,
  type ReplicationTick,
  type ReplicationTopology,
} from '../../core/concept-simulations/replication'
import { RELATED_LESSONS } from '../../core/concept-simulations/embed'
import { generateRequests } from '../../core/concept-simulations/requests'
import { formatInteger, t, tRich, type StringKey } from '../i18n'
import { Choice, Control, LessonLink, Metric, newSeed, PlaybackBar, seriesColor, SimulationFrame, TimelineChart, usePlayback, type TimelineEvent } from './shared'

// The replication Concept Simulation: the Core run for the chosen topology and lag, played back tick by
// tick, with the nodes as they are at the tick shown. The primary is killed right after the tick shown, so
// it can be killed while the run plays, without restarting it.

/** What the explanations say for each topology. */
const TOPOLOGY_TEXT: Record<
  ReplicationTopology,
  { name: StringKey; hint: StringKey; replicas: StringKey; failover: StringKey; killed: StringKey; event: StringKey; conflicts: StringKey }
> = {
  'primary-replica': {
    name: 'optionPrimaryReplica',
    hint: 'replicationTopologyPrimaryReplicaHint',
    replicas: 'replicationReplicasHint',
    failover: 'replicationFailurePromotedHint',
    killed: 'replicationKilledPromoted',
    event: 'replicationEventPromoted',
    conflicts: 'replicationMetricConflictsNoneNote',
  },
  'primary-primary': {
    name: 'optionPrimaryPrimary',
    hint: 'replicationTopologyPrimaryPrimaryHint',
    replicas: 'replicationReplicasNoneHint',
    failover: 'replicationFailureDetectedHint',
    killed: 'replicationKilledDetected',
    event: 'replicationEventDetected',
    conflicts: 'replicationMetricConflictsNote',
  },
}

const ROLE_NAMES: Record<NodeRole, StringKey> = { primary: 'replicationRolePrimary', replica: 'replicationRoleReplica', down: 'replicationRoleDown' }

const TICKS = 40
const TICK_MS = 100
const RATE = 50
const WRITE_SHARE = 0.3
const KEY_COUNT = 10
const FAILOVER_DELAY = 500
const LAG_RANGE = { min: 0, max: 1000, step: 50 }
const MAX_REPLICAS = 3
/** Where a kill goes when the run has been played to its end. */
const DEFAULT_KILL_TICK = 15

const COLORS = { fresh: seriesColor(2), stale: seriesColor(3), rejected: seriesColor(7), accepted: seriesColor(0), conflicts: seriesColor(4), lost: seriesColor(6) }

export function ReplicationSimulation() {
  const [topology, setTopology] = useState<ReplicationTopology>('primary-replica')
  const [replicas, setReplicas] = useState(2)
  const [lag, setLag] = useState(300)
  /** The tick (from 0) the primary dies at, if it is killed. */
  const [killTick, setKillTick] = useState<number>()
  const [seed, setSeed] = useState(1)
  const requests = useMemo(
    () => generateRequests({ rate: RATE, writeShare: WRITE_SHARE, keyCount: KEY_COUNT, duration: TICKS * TICK_MS, seed }),
    [seed],
  )
  const result = useMemo(
    () =>
      simulateReplication({
        topology,
        replicas,
        lag,
        failoverDelay: FAILOVER_DELAY,
        killPrimaryAt: killTick === undefined ? undefined : killTick * TICK_MS,
        requests,
        tickMs: TICK_MS,
        ticks: TICKS,
      }),
    [topology, replicas, lag, killTick, requests],
  )
  const chartsRef = useRef<HTMLDivElement>(null)
  // A kill does not restart the playback, so the run plays on with the primary dead.
  const playback = usePlayback(`${topology} ${replicas} ${lag} ${seed}`, TICKS, chartsRef)
  const ids = { topology: useId(), replicas: useId(), lag: useId(), failure: useId() }
  const shown = result.ticks[playback.tick - 1]
  const { failover } = result
  const text = TOPOLOGY_TEXT[topology]

  const events: TimelineEvent[] = []
  if (killTick !== undefined) events.push({ key: 'kill', label: t('replicationEventKilled'), from: killTick })
  if (failover && failover.recoveredAt / TICK_MS < TICKS) {
    events.push({ key: 'failover', label: t(text.event, { node: failover.takenOverBy + 1 }), from: failover.recoveredAt / TICK_MS })
  }

  return (
    <SimulationFrame
      title={t('replicationTitle')}
      description={t('replicationDescription')}
      related={RELATED_LESSONS.replication}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Control
          label={t('replicationTopology')}
          hint={t(text.hint)}
          labelId={ids.topology}
        >
          <Choice
            labelledBy={ids.topology}
            options={REPLICATION_TOPOLOGIES}
            value={topology}
            onChange={setTopology}
            name={(option) => t(TOPOLOGY_TEXT[option].name)}
          />
        </Control>

        <Control
          label={t('replicationReplicas')}
          hint={t(text.replicas)}
          labelId={ids.replicas}
        >
          {topology === 'primary-replica' ? (
            <>
              <input
                type="range"
                min={1}
                max={MAX_REPLICAS}
                value={replicas}
                aria-labelledby={ids.replicas}
                onChange={(event) => setReplicas(Number(event.target.value))}
                className="w-full"
              />
              <p className="text-sm text-zinc-300">{t('replicationReplicasValue', { count: replicas })}</p>
            </>
          ) : (
            <p className="text-sm text-zinc-300">{t('replicationReplicasNone')}</p>
          )}
        </Control>

        <Control
          label={t('replicationLag')}
          hint={tRich('replicationLagHint', {
            lag: formatInteger(lag),
            eventual: <LessonLink lessonId="eventual-consistency" />,
            strong: <LessonLink lessonId="strong-consistency" />,
          })}
          labelId={ids.lag}
        >
          <input
            type="range"
            min={LAG_RANGE.min}
            max={LAG_RANGE.max}
            step={LAG_RANGE.step}
            value={lag}
            aria-labelledby={ids.lag}
            aria-valuetext={t('replicationLagValue', { lag: formatInteger(lag) })}
            onChange={(event) => setLag(Number(event.target.value))}
            className="w-full"
          />
          <p className="text-sm text-zinc-300">{t('replicationLagValue', { lag: formatInteger(lag) })}</p>
        </Control>

        <Control
          label={t('replicationFailure')}
          hint={tRich(killTick === undefined ? 'replicationFailureHint' : text.failover, {
            delay: formatInteger(FAILOVER_DELAY),
            tick: DEFAULT_KILL_TICK + 1,
            failover: <LessonLink lessonId="fail-over" />,
          })}
          labelId={ids.failure}
        >
          {killTick === undefined ? (
            <button
              type="button"
              onClick={() => setKillTick(playback.tick < TICKS ? playback.tick : DEFAULT_KILL_TICK)}
              className="rounded border border-red-400/70 px-3 py-1 text-sm text-red-300 hover:bg-red-400/10"
            >
              {t('replicationKill')}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setKillTick(undefined)}
                className="rounded border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:border-zinc-500"
              >
                {t('replicationRestore')}
              </button>
              {failover && (
                <p className="mt-2 text-sm text-zinc-300">
                  {t(text.killed, { tick: killTick + 1, recovered: failover.recoveredAt / TICK_MS + 1, node: failover.takenOverBy + 1 })}
                </p>
              )}
            </>
          )}
        </Control>
      </div>

      <PlaybackBar playback={playback} total={TICKS} onRerun={() => setSeed(newSeed)} />
      <p className="mt-1 text-xs text-zinc-500">
        {t('replicationTickHint', { ms: TICK_MS, rate: RATE, percent: formatInteger(WRITE_SHARE * 100), keys: KEY_COUNT })}
      </p>

      <Nodes tick={shown} />
      <Metrics topology={topology} killed={killTick !== undefined && killTick < playback.tick} ticks={result.ticks.slice(0, playback.tick)} />

      <div ref={chartsRef} className="mt-4 grid gap-6 md:grid-cols-2">
        <TimelineChart
          title={t('replicationReadsTitle')}
          hint={t('replicationReadsHint')}
          total={TICKS}
          shown={playback.tick}
          series={[
            { key: 'fresh', label: t('replicationSeriesFresh'), color: COLORS.fresh, values: result.ticks.map((tick) => tick.reads - tick.staleReads - tick.rejectedReads) },
            { key: 'stale', label: t('replicationSeriesStale'), color: COLORS.stale, values: result.ticks.map((tick) => tick.staleReads) },
            { key: 'rejected', label: t('replicationSeriesRejected'), color: COLORS.rejected, values: result.ticks.map((tick) => tick.rejectedReads) },
          ]}
          events={events}
          formatValue={formatInteger}
        />
        <TimelineChart
          title={t('replicationWritesTitle')}
          hint={t('replicationWritesHint')}
          total={TICKS}
          shown={playback.tick}
          series={[
            { key: 'accepted', label: t('replicationSeriesAccepted'), color: COLORS.accepted, values: result.ticks.map((tick) => tick.writes - tick.rejectedWrites) },
            { key: 'rejected', label: t('replicationSeriesRejected'), color: COLORS.rejected, values: result.ticks.map((tick) => tick.rejectedWrites) },
            { key: 'lost', label: t('replicationSeriesLost'), color: COLORS.lost, values: result.ticks.map((tick) => tick.lostWrites) },
            ...(topology === 'primary-primary'
              ? [{ key: 'conflicts', label: t('replicationSeriesConflicts'), color: COLORS.conflicts, values: result.ticks.map((tick) => tick.conflicts) }]
              : []),
          ]}
          events={events}
          formatValue={formatInteger}
        />
      </div>
    </SimulationFrame>
  )
}

/** The nodes at the end of the tick shown: role, writes still on their way, and the stale reads they served. */
function Nodes({ tick }: { tick: ReplicationTick }) {
  return (
    <figure className="mt-4">
      <figcaption className="text-sm font-medium text-zinc-200">{t('replicationNodesTitle')}</figcaption>
      <p className="text-xs text-zinc-500">{t('replicationNodesHint')}</p>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tick.nodes.map((node, i) => (
          <NodeCard key={i} number={i + 1} node={node} />
        ))}
      </ul>
    </figure>
  )
}

function NodeCard({ number, node }: { number: number; node: NodeState }) {
  const down = node.role === 'down'
  const stale = node.staleReads > 0
  return (
    <li className={`rounded border p-3 text-sm ${down ? 'border-red-400/40 bg-red-400/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-100">{t('replicationNodeName', { number })}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            down ? 'bg-red-400/15 text-red-300' : node.role === 'primary' ? 'bg-sky-400/15 text-sky-300' : 'bg-zinc-700/50 text-zinc-300'
          }`}
        >
          {t(ROLE_NAMES[node.role])}
        </span>
      </div>
      {!down && (
        <>
          <p className="mt-2 text-zinc-300">{node.behind > 0 ? t('replicationNodeBehind', { count: node.behind }) : t('replicationNodeUpToDate')}</p>
          <p className={`mt-1 flex items-center gap-1.5 ${stale ? 'text-amber-300' : 'text-zinc-500'}`}>
            <span aria-hidden className={`size-2 rounded-full ${stale ? 'bg-amber-400' : 'bg-zinc-700'}`} />
            {stale ? t('replicationNodeStale', { count: node.staleReads }) : t('replicationNodeNoStale')}
          </p>
        </>
      )}
    </li>
  )
}

/** The metrics over the ticks played so far, each with what it means for the chosen topology. */
function Metrics({ topology, killed, ticks }: { topology: ReplicationTopology; killed: boolean; ticks: ReplicationTick[] }) {
  const { reads, writes, staleReads, longestStaleness, rejectedReads, rejectedWrites, conflicts, lostWrites } = totalsOf(ticks)
  const served = reads - rejectedReads
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label={t('replicationMetricStale')} value={formatInteger(staleReads)}>
        {staleReads > 0
          ? t('replicationMetricStaleNote', { served, stale: staleReads, longest: formatInteger(longestStaleness) })
          : t('replicationMetricStaleNoneNote', { served })}
      </Metric>
      <Metric label={t('replicationMetricRejected')} value={formatInteger(rejectedReads + rejectedWrites)}>
        {rejectedReads + rejectedWrites > 0
          ? t('replicationMetricRejectedNote', { writes: rejectedWrites, reads: rejectedReads, total: reads + writes })
          : t('replicationMetricRejectedNoneNote')}
      </Metric>
      <Metric label={t('replicationMetricLost')} value={formatInteger(lostWrites)}>
        {killed ? t('replicationMetricLostNote') : t('replicationMetricLostNoneNote')}
      </Metric>
      <Metric label={t('replicationMetricConflicts')} value={formatInteger(conflicts)}>
        {t(TOPOLOGY_TEXT[topology].conflicts)}
      </Metric>
    </dl>
  )
}
