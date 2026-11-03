import { useId, useMemo, useRef, useState } from 'react'
import {
  CAP_MODES,
  SIDE_NODES,
  simulateCap,
  totalsOf,
  type CapInput,
  type CapLogEntry,
  type CapMode,
  type CapTick,
  type CapTotals,
  type Side,
} from '../../core/concept-simulations/cap'
import { RELATED_LESSONS } from '../../core/concept-simulations/embed'
import { generateRequests } from '../../core/concept-simulations/requests'
import { formatInteger, t, tRich, type StringKey } from '../i18n'
import { Choice, Control, LessonLink, Metric, newSeed, percent, PlaybackBar, seriesColor, SimulationFrame, TimelineChart, usePlayback, type TimelineEvent } from './shared'

// The CAP Concept Simulation: the Core run for the chosen mode and partition, played back tick by tick,
// with both sides of the cluster and the latest requests as they are at the tick shown. The network is
// cut and healed right after the tick shown, so it can be done while the run plays, without restarting it.

const MODE_NAMES: Record<CapMode, StringKey> = { cp: 'optionCp', ap: 'optionAp' }

const MODE_HINTS: Record<CapMode, StringKey> = { cp: 'capModeCpHint', ap: 'capModeApHint' }

const SIDE_NAMES: Record<Side, StringKey> = { majority: 'capSideMajority', minority: 'capSideMinority' }

const TICKS = 40
const TICK_MS = 100
const RATE = 30
const WRITE_SHARE = 0.4
const KEY_COUNT = 4
const LOG_ROWS = 8
/** Where a cut goes when the run has been played to its end. */
const DEFAULT_CUT_TICK = 10

const COLORS = { ok: seriesColor(2), stale: seriesColor(3), rejected: seriesColor(7), divergent: seriesColor(4) }

/** When the network is cut, in ticks from 0: from `from` up to `to`, or to the end of the run. */
interface Cut {
  from: number
  to?: number
}

const isCutAt = (cut: Cut | undefined, tick: number) => cut !== undefined && cut.from <= tick && (cut.to === undefined || tick < cut.to)

/** The share of requests answered, or a dash before the first request. */
const answeredShare = (totals: CapTotals) => {
  const requests = totals.reads + totals.writes
  return requests > 0 ? percent(requests - totals.rejectedReads - totals.rejectedWrites, requests) : '–'
}

export function CapSimulation() {
  const [mode, setMode] = useState<CapMode>('cp')
  const [cut, setCut] = useState<Cut>()
  const [seed, setSeed] = useState(1)
  const requests = useMemo(
    () => generateRequests({ rate: RATE, writeShare: WRITE_SHARE, keyCount: KEY_COUNT, duration: TICKS * TICK_MS, seed }),
    [seed],
  )
  const settings: Omit<CapInput, 'mode'> = useMemo(
    () => ({
      requests,
      partition: cut && { start: cut.from * TICK_MS, ...(cut.to !== undefined && { end: cut.to * TICK_MS }) },
      keyCount: KEY_COUNT,
      tickMs: TICK_MS,
      ticks: TICKS,
    }),
    [requests, cut],
  )
  const result = useMemo(() => simulateCap({ ...settings, mode }), [settings, mode])
  const chartsRef = useRef<HTMLDivElement>(null)
  // Cutting or healing does not restart the playback, so the run plays on with the network cut or whole.
  const playback = usePlayback(`${mode} ${seed}`, TICKS, chartsRef)
  const ids = { mode: useId(), network: useId() }
  const shownIndex = playback.tick - 1
  const shownCut = isCutAt(cut, shownIndex)
  /** The tick a cut or a heal goes at, right after the tick shown; none once the run has been played to its end. */
  const nextTick = playback.tick < TICKS ? playback.tick : undefined
  const canHeal = cut !== undefined && cut.to === undefined && nextTick !== undefined && nextTick > cut.from

  /** Cuts the network, heals it, or once it has been healed (or can no longer be) takes the cut away. */
  const changeNetwork = () => {
    if (!cut) setCut({ from: nextTick ?? DEFAULT_CUT_TICK })
    else if (canHeal) setCut({ ...cut, to: nextTick })
    else setCut(undefined)
  }
  const networkAction: StringKey = !cut ? 'capCut' : canHeal ? 'capHeal' : 'capRemoveCut'

  const events: TimelineEvent[] = cut ? [{ key: 'cut', label: t('capEventCut'), from: cut.from, to: (cut.to ?? TICKS) - 1 }] : []

  return (
    <SimulationFrame
      title={t('capTitle')}
      description={t('capDescription', { majority: SIDE_NODES.majority, minority: SIDE_NODES.minority })}
      related={RELATED_LESSONS.cap}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Control
          label={t('capMode')}
          hint={tRich(MODE_HINTS[mode], {
            strong: <LessonLink lessonId="strong-consistency" />,
            eventual: <LessonLink lessonId="eventual-consistency" />,
          })}
          labelId={ids.mode}
        >
          <Choice labelledBy={ids.mode} options={CAP_MODES} value={mode} onChange={setMode} name={(option) => t(MODE_NAMES[option])} />
        </Control>

        <Control
          label={t('capNetwork')}
          hint={tRich('capNetworkHint', {
            majority: SIDE_NODES.majority,
            minority: SIDE_NODES.minority,
            tick: DEFAULT_CUT_TICK + 1,
            availability: <LessonLink lessonId="availability-patterns" />,
          })}
          labelId={ids.network}
        >
          <button
            type="button"
            onClick={changeNetwork}
            className={`min-h-11 rounded border px-3 text-sm sm:min-h-8 ${!cut ? 'border-danger/60 text-danger hover:bg-danger/10' : 'border-border text-text hover:border-text-muted'}`}
          >
            {t(networkAction)}
          </button>
          <p className="mt-2 text-sm text-text">
            {!cut
              ? t('capNetworkWhole')
              : cut.to === undefined
                ? t('capNetworkCutFrom', { from: cut.from + 1 })
                : t('capNetworkCutBetween', { from: cut.from + 1, to: cut.to })}
          </p>
        </Control>
      </div>

      <PlaybackBar playback={playback} total={TICKS} onRerun={() => setSeed(newSeed)} />
      <p className="mt-1 text-xs text-text-muted">
        {t('capTickHint', { ms: TICK_MS, rate: RATE, percent: formatInteger(WRITE_SHARE * 100), keys: KEY_COUNT })}
      </p>

      <Cluster mode={mode} cut={shownCut} tick={result.ticks[shownIndex]} />
      <Metrics mode={mode} ticks={result.ticks.slice(0, playback.tick)} />

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div ref={chartsRef}>
          <TimelineChart
            title={t('capRequestsTitle')}
            hint={t('capRequestsHint')}
            total={TICKS}
            shown={playback.tick}
            series={[
              { key: 'ok', label: t('capSeriesOk'), color: COLORS.ok, values: result.ticks.map((tick) => tick.reads + tick.writes - tick.rejectedReads - tick.rejectedWrites - tick.staleReads) },
              { key: 'stale', label: t('capSeriesStale'), color: COLORS.stale, values: result.ticks.map((tick) => tick.staleReads) },
              { key: 'rejected', label: t('capSeriesRejected'), color: COLORS.rejected, values: result.ticks.map((tick) => tick.rejectedReads + tick.rejectedWrites) },
            ]}
            events={events}
            formatValue={formatInteger}
          />
          <TimelineChart
            title={t('capDivergenceTitle')}
            hint={t('capDivergenceHint')}
            total={TICKS}
            shown={playback.tick}
            series={[{ key: 'divergent', label: t('capSeriesDivergent'), color: COLORS.divergent, values: result.ticks.map((tick) => tick.divergentKeys) }]}
            events={events}
            formatValue={formatInteger}
          />
        </div>
        <RequestLog entries={result.log.filter((entry) => entry.time < playback.tick * TICK_MS).slice(-LOG_ROWS).reverse()} />
      </div>
      <ModeTable settings={settings} current={mode} />
    </SimulationFrame>
  )
}

/** Both sides of the cluster at the end of the tick shown: whether they can reach each other, and their keys. */
function Cluster({ mode, cut, tick }: { mode: CapMode; cut: boolean; tick: CapTick }) {
  const differs = (key: number) => tick.versions.majority[key] !== tick.versions.minority[key]
  const sideNote = (side: Side) =>
    !cut ? t('capSideConnected') : mode === 'ap' ? t('capSideAnswers') : side === 'majority' ? t('capSideQuorum') : t('capSideNoQuorum')
  return (
    <figure className="mt-4">
      <figcaption className="text-sm font-medium text-text">{t('capClusterTitle')}</figcaption>
      <p className="text-xs text-text-muted">{t('capClusterHint')}</p>
      <div className="mt-2 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {(['majority', 'minority'] as const).map((side, i) => (
          <div key={side} className={`${i === 1 ? 'sm:order-3' : ''} rounded border border-border bg-surface-raised/50 p-3 text-sm`}>
            <p className="font-medium text-text">{t(SIDE_NAMES[side], { count: SIDE_NODES[side] })}</p>
            <p className={`mt-1 text-xs ${cut && mode === 'cp' && side === 'minority' ? 'text-danger' : 'text-text-muted'}`}>{sideNote(side)}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('capKeysLabel')}>
              {tick.versions[side].map((version, key) => (
                <li
                  key={key}
                  className={`rounded border px-1.5 py-0.5 text-xs tabular-nums ${differs(key) ? 'border-warning/60 text-warning' : 'border-border text-text'}`}
                >
                  {t('capKeyVersion', { key: key + 1, version })}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p
          className={`flex items-center justify-center px-2 text-sm sm:order-2 ${cut ? 'text-danger' : 'text-text-muted'}`}
          aria-label={cut ? t('capLinkCut') : t('capLinkWhole')}
        >
          <span aria-hidden>{cut ? '— ✕ —' : '———'}</span>
        </p>
      </div>
      {tick.divergentKeys > 0 && <p className="mt-2 text-xs text-warning">{t('capDivergentNow', { count: tick.divergentKeys })}</p>}
    </figure>
  )
}

/** The latest requests up to the tick shown, the newest first. */
function RequestLog({ entries }: { entries: CapLogEntry[] }) {
  return (
    <figure>
      <figcaption className="text-sm font-medium text-text">{t('capLogTitle')}</figcaption>
      <p className="text-xs text-text-muted">{t('capLogHint', { count: LOG_ROWS })}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs text-text-muted">
            <tr>
              {(['capColumnTime', 'capColumnSide', 'capColumnRequest', 'capColumnOutcome'] as const).map((key) => (
                <th key={key} className="py-1 pr-3 font-normal">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-text">
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="py-1 text-text-muted">
                  {t('capLogEmpty')}
                </td>
              </tr>
            )}
            {entries.map((entry, i) => (
              <tr key={`${entry.time} ${i}`} className="border-t border-border">
                <td className="py-1 pr-3 whitespace-nowrap text-text-muted">{t('capTime', { ms: formatInteger(entry.time) })}</td>
                <td className="py-1 pr-3">{t(entry.side === 'majority' ? 'capLogMajority' : 'capLogMinority')}</td>
                <td className="py-1 pr-3">{requestText(entry)}</td>
                <td className="py-1 pr-3">
                  <Outcome entry={entry} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

function requestText({ kind, key, version, outcome }: CapLogEntry): string {
  if (outcome === 'rejected') return t(kind === 'write' ? 'capRequestWriteRejected' : 'capRequestReadRejected', { key: key + 1 })
  return t(kind === 'write' ? 'capRequestWrite' : 'capRequestRead', { key: key + 1, version: version! })
}

function Outcome({ entry }: { entry: CapLogEntry }) {
  if (entry.outcome === 'rejected') return <span className="text-danger">{t('capOutcomeRejected')}</span>
  if (entry.outcome === 'stale') return <span className="text-warning">{t('capOutcomeStale', { latest: entry.latest! })}</span>
  return <span className="text-success">{t('capOutcomeOk')}</span>
}

/** The metrics over the ticks played so far, each with what it means in the chosen mode. */
function Metrics({ mode, ticks }: { mode: CapMode; ticks: CapTick[] }) {
  const totals = totalsOf(ticks)
  const { reads, writes, rejectedReads, rejectedWrites, staleReads, conflicts, mostDivergentKeys } = totals
  const requests = reads + writes
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label={t('capMetricAvailability')} value={answeredShare(totals)}>
        {t('capMetricAvailabilityNote', { answered: requests - rejectedReads - rejectedWrites, requests, writes: rejectedWrites, reads: rejectedReads })}
      </Metric>
      <Metric label={t('capMetricStale')} value={formatInteger(staleReads)}>
        {mode === 'cp' ? t('capMetricStaleCpNote') : t('capMetricStaleApNote', { reads })}
      </Metric>
      <Metric label={t('capMetricDivergent')} value={formatInteger(ticks.at(-1)?.divergentKeys ?? 0)}>
        {t(mode === 'cp' ? 'capMetricDivergentCpNote' : 'capMetricDivergentApNote', { most: mostDivergentKeys })}
      </Metric>
      <Metric label={t('capMetricConflicts')} value={formatInteger(conflicts)}>
        {mode === 'cp' ? t('capMetricConflictsCpNote') : t('capMetricConflictsApNote')}
      </Metric>
    </dl>
  )
}

/** Both modes' whole run on the same requests and partition. */
function ModeTable({ settings, current }: { settings: Omit<CapInput, 'mode'>; current: CapMode }) {
  const rows = useMemo(() => CAP_MODES.map((mode) => ({ mode, totals: simulateCap({ ...settings, mode }).totals })), [settings])
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer py-3 text-text sm:py-1">{t('capCompareTitle')}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="text-text-muted">
            <tr>
              {(['capColumnMode', 'capColumnAvailability', 'capColumnRejected', 'capColumnStale', 'capColumnDivergent', 'capColumnConflicts'] as const).map((key) => (
                <th key={key} className="py-1 pr-3 font-normal">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-text">
            {rows.map(({ mode, totals }) => (
              <tr key={mode} aria-current={mode === current || undefined} className={`border-t border-border ${mode === current ? 'text-accent' : ''}`}>
                <td className="py-1 pr-3">{t(MODE_NAMES[mode])}</td>
                <td className="py-1 pr-3">{answeredShare(totals)}</td>
                <td className="py-1 pr-3">{formatInteger(totals.rejectedReads + totals.rejectedWrites)}</td>
                <td className="py-1 pr-3">{formatInteger(totals.staleReads)}</td>
                <td className="py-1 pr-3">{formatInteger(totals.mostDivergentKeys)}</td>
                <td className="py-1 pr-3">{formatInteger(totals.conflicts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
