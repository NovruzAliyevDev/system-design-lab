import { useId, useMemo, useRef, useState } from 'react'
import {
  CACHE_STRATEGIES,
  EVICTION_POLICIES,
  generateWorkload,
  REFRESH_AHEAD_AT,
  simulateCache,
  totalsOf,
  usesTtl,
  type CacheInput,
  type CacheStrategy,
  type CacheTick,
  type CacheTotals,
  type EvictionPolicy,
  type WorkloadDistribution,
} from '../../core/concept-simulations/cache'
import { formatInteger, t, type StringKey } from '../i18n'
import { Choice, Control, Metric, newSeed, percent, PlaybackBar, seriesColor, SimulationFrame, TimelineChart, usePlayback } from './shared'

// The cache Concept Simulation: the Core run for the chosen settings, played back tick by tick, with the
// metrics counted up to the tick shown and every strategy compared on the same workload.

const STRATEGY_NAMES: Record<CacheStrategy, StringKey> = {
  'cache-aside': 'optionCacheAside',
  'write-through': 'optionWriteThrough',
  'write-behind': 'optionWriteBehind',
  'refresh-ahead': 'optionRefreshAhead',
}

const STRATEGY_HINTS: Record<CacheStrategy, StringKey> = {
  'cache-aside': 'cacheStrategyCacheAsideHint',
  'write-through': 'cacheStrategyWriteThroughHint',
  'write-behind': 'cacheStrategyWriteBehindHint',
  'refresh-ahead': 'cacheStrategyRefreshAheadHint',
}

const EVICTION_NAMES: Record<EvictionPolicy, StringKey> = { lru: 'optionLru', lfu: 'optionLfu', fifo: 'optionFifo' }

const EVICTION_HINTS: Record<EvictionPolicy, StringKey> = {
  lru: 'cacheEvictionLruHint',
  lfu: 'cacheEvictionLfuHint',
  fifo: 'cacheEvictionFifoHint',
}

const DISTRIBUTIONS: readonly WorkloadDistribution[] = ['uniform', 'skewed']

const DISTRIBUTION_NAMES: Record<WorkloadDistribution, StringKey> = { uniform: 'optionUniform', skewed: 'optionSkewed' }

const DISTRIBUTION_HINTS: Record<WorkloadDistribution, StringKey> = {
  uniform: 'cacheWorkloadUniformHint',
  skewed: 'cacheWorkloadSkewedHint',
}

const TICKS = 40
const OPERATIONS_PER_TICK = 50
const KEY_COUNT = 100
const MAX_CAPACITY = 50
const MAX_WRITE_PERCENT = 50
const TTL_RANGE = { min: 10, max: 300 }
const FLUSH_RANGE = { min: 5, max: 200 }

/** The series' colour slots: reads on the left chart, the database on the right; none repeats. */
const COLORS = { hits: seriesColor(2), misses: seriesColor(1), stale: seriesColor(3), dbReads: seriesColor(0), dbWrites: seriesColor(4), unflushed: seriesColor(6) }

export function CacheSimulation() {
  const [strategy, setStrategy] = useState<CacheStrategy>('cache-aside')
  const [eviction, setEviction] = useState<EvictionPolicy>('lru')
  const [capacity, setCapacity] = useState(20)
  const [distribution, setDistribution] = useState<WorkloadDistribution>('skewed')
  const [writePercent, setWritePercent] = useState(20)
  const [ttl, setTtl] = useState(60)
  const [flushInterval, setFlushInterval] = useState(30)
  const [seed, setSeed] = useState(1)
  const operations = useMemo(
    () => generateWorkload({ distribution, keyCount: KEY_COUNT, writeShare: writePercent / 100, length: TICKS * OPERATIONS_PER_TICK, seed }),
    [distribution, writePercent, seed],
  )
  const settings: Omit<CacheInput, 'strategy'> = useMemo(
    () => ({ eviction, capacity, ttl, flushInterval, operations, operationsPerTick: OPERATIONS_PER_TICK }),
    [eviction, capacity, ttl, flushInterval, operations],
  )
  const result = useMemo(() => simulateCache({ ...settings, strategy }), [settings, strategy])
  const chartsRef = useRef<HTMLDivElement>(null)
  const playback = usePlayback(result, TICKS, chartsRef)
  const ids = { strategy: useId(), eviction: useId(), size: useId(), workload: useId(), writes: useId(), timing: useId() }

  return (
    <SimulationFrame title={t('cacheTitle')} description={t('cacheDescription')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Control
          label={t('cacheStrategy')}
          hint={t(STRATEGY_HINTS[strategy], { interval: flushInterval, percent: formatInteger(REFRESH_AHEAD_AT * 100) })}
          labelId={ids.strategy}
        >
          <Choice labelledBy={ids.strategy} options={CACHE_STRATEGIES} value={strategy} onChange={setStrategy} name={(option) => t(STRATEGY_NAMES[option])} />
        </Control>

        <Control label={t('fieldEviction')} hint={t(EVICTION_HINTS[eviction])} labelId={ids.eviction}>
          <Choice labelledBy={ids.eviction} options={EVICTION_POLICIES} value={eviction} onChange={setEviction} name={(option) => t(EVICTION_NAMES[option])} />
        </Control>

        <Control label={t('cacheSize')} hint={t('cacheSizeHint')} labelId={ids.size}>
          <input
            type="range"
            min={1}
            max={MAX_CAPACITY}
            value={capacity}
            aria-labelledby={ids.size}
            onChange={(event) => setCapacity(Number(event.target.value))}
            className="w-full"
          />
          <p className="text-sm text-text">
            {t('cacheSizeValue', { size: capacity, keys: KEY_COUNT, percent: formatInteger((capacity / KEY_COUNT) * 100) })}
          </p>
        </Control>

        <Control label={t('cacheWorkload')} hint={t(DISTRIBUTION_HINTS[distribution])} labelId={ids.workload}>
          <Choice
            labelledBy={ids.workload}
            options={DISTRIBUTIONS}
            value={distribution}
            onChange={setDistribution}
            name={(option) => t(DISTRIBUTION_NAMES[option])}
          />
          <label className="mt-3 block text-sm text-text">
            <span id={ids.writes}>{t('cacheWriteShare')}</span>
            <input
              type="range"
              min={0}
              max={MAX_WRITE_PERCENT}
              value={writePercent}
              aria-labelledby={ids.writes}
              aria-valuetext={t('cacheWriteShareValue', { percent: writePercent })}
              onChange={(event) => setWritePercent(Number(event.target.value))}
              className="mt-1 w-full"
            />
            <span className="block">{t('cacheWriteShareValue', { percent: writePercent })}</span>
          </label>
        </Control>

        <TimingControl
          strategy={strategy}
          labelId={ids.timing}
          ttl={ttl}
          onTtl={setTtl}
          flushInterval={flushInterval}
          onFlushInterval={setFlushInterval}
        />
      </div>

      <PlaybackBar playback={playback} total={TICKS} onRerun={() => setSeed(newSeed)} />
      <p className="mt-1 text-xs text-text-muted">{t('cacheTickHint', { count: OPERATIONS_PER_TICK })}</p>

      <Metrics strategy={strategy} ticks={result.ticks.slice(0, playback.tick)} />

      <div ref={chartsRef} className="mt-4 grid gap-6 md:grid-cols-2">
        <TimelineChart
          title={t('cacheReadsTitle')}
          hint={t('cacheReadsHint')}
          total={TICKS}
          shown={playback.tick}
          series={[
            { key: 'hits', label: t('cacheSeriesHits'), color: COLORS.hits, values: result.ticks.map((tick) => tick.hits) },
            { key: 'misses', label: t('cacheSeriesMisses'), color: COLORS.misses, values: result.ticks.map((tick) => tick.misses) },
            { key: 'stale', label: t('cacheSeriesStale'), color: COLORS.stale, values: result.ticks.map((tick) => tick.staleReads) },
          ]}
          formatValue={formatInteger}
        />
        <TimelineChart
          title={t('cacheDatabaseTitle')}
          hint={t('cacheDatabaseHint')}
          total={TICKS}
          shown={playback.tick}
          series={[
            { key: 'db-reads', label: t('cacheSeriesDbReads'), color: COLORS.dbReads, values: result.ticks.map((tick) => tick.dbReads) },
            { key: 'db-writes', label: t('cacheSeriesDbWrites'), color: COLORS.dbWrites, values: result.ticks.map((tick) => tick.dbWrites) },
            ...(strategy === 'write-behind'
              ? [{ key: 'unflushed', label: t('cacheSeriesUnflushed'), color: COLORS.unflushed, values: result.ticks.map((tick) => tick.mostUnflushedWrites) }]
              : []),
          ]}
          formatValue={formatInteger}
        />
      </div>
      <StrategyTable settings={settings} current={strategy} />
    </SimulationFrame>
  )
}

/** The TTL for strategies whose entries expire, the flush interval for write-behind; write-through needs neither. */
function TimingControl({
  strategy,
  labelId,
  ttl,
  onTtl,
  flushInterval,
  onFlushInterval,
}: {
  strategy: CacheStrategy
  labelId: string
  ttl: number
  onTtl: (ttl: number) => void
  flushInterval: number
  onFlushInterval: (interval: number) => void
}) {
  if (strategy === 'write-behind') {
    return (
      <Control label={t('cacheFlushInterval')} hint={t('cacheFlushIntervalHint')} labelId={labelId}>
        <input
          type="range"
          min={FLUSH_RANGE.min}
          max={FLUSH_RANGE.max}
          value={flushInterval}
          aria-labelledby={labelId}
          onChange={(event) => onFlushInterval(Number(event.target.value))}
          className="w-full"
        />
        <p className="text-sm text-text">{t('cacheFlushIntervalValue', { interval: flushInterval })}</p>
      </Control>
    )
  }
  if (!usesTtl(strategy)) {
    return (
      <Control label={t('cacheTtl')} hint={t('cacheTtlNotUsed')} labelId={labelId}>
        <p className="text-sm text-text">{t('cacheTtlNotUsedValue')}</p>
      </Control>
    )
  }
  return (
    <Control label={t('cacheTtl')} hint={t('cacheTtlHint')} labelId={labelId}>
      <input
        type="range"
        min={TTL_RANGE.min}
        max={TTL_RANGE.max}
        value={ttl}
        aria-labelledby={labelId}
        onChange={(event) => onTtl(Number(event.target.value))}
        className="w-full"
      />
      <p className="text-sm text-text">{t('cacheTtlValue', { ttl })}</p>
    </Control>
  )
}

/** The four metrics over the ticks played so far, each with what it means under the chosen strategy. */
function Metrics({ strategy, ticks }: { strategy: CacheStrategy; ticks: CacheTick[] }) {
  const { reads, writes, hits, misses, staleReads, longestStaleWindow, refreshes, dbReads, dbWrites, mostUnflushedWrites } = totalsOf(ticks)
  const operations = reads + writes

  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label={t('cacheMetricHitRatio')} value={percent(hits, reads)}>
        {t('cacheMetricHitRatioNote', { reads, hits, misses })}
      </Metric>
      <Metric label={t('cacheMetricDbLoad')} value={percent(dbReads + dbWrites, operations)}>
        {t('cacheMetricDbLoadNote', { operations, db: dbReads + dbWrites, reads: dbReads, writes: dbWrites })}
        {strategy === 'refresh-ahead' && ` ${t('cacheMetricDbLoadRefreshes', { refreshes })}`}
      </Metric>
      <Metric label={t('cacheMetricStale')} value={formatInteger(staleReads)}>
        {!usesTtl(strategy)
          ? t('cacheMetricStaleNoneNote')
          : staleReads > 0
            ? t('cacheMetricStaleNote', { window: longestStaleWindow })
            : t('cacheMetricStaleNoneYetNote')}
      </Metric>
      <Metric label={t('cacheMetricAtRisk')} value={formatInteger(ticks.at(-1)?.unflushedWrites ?? 0)}>
        {strategy === 'write-behind' ? t('cacheMetricAtRiskNote', { most: mostUnflushedWrites }) : t('cacheMetricAtRiskNoneNote')}
      </Metric>
    </dl>
  )
}

/** Every strategy's whole run on the same workload, size and policy, also the charts' table view. */
function StrategyTable({ settings, current }: { settings: Omit<CacheInput, 'strategy'>; current: CacheStrategy }) {
  const rows = useMemo(
    () => CACHE_STRATEGIES.map((strategy) => ({ strategy, totals: simulateCache({ ...settings, strategy }).totals })),
    [settings],
  )
  const dbLoad = (totals: CacheTotals) => percent(totals.dbReads + totals.dbWrites, totals.reads + totals.writes)
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer py-3 text-text sm:py-1">{t('cacheCompareTitle')}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="text-text-muted">
            <tr>
              {(['cacheColumnStrategy', 'cacheColumnHitRatio', 'cacheColumnDbLoad', 'cacheColumnStaleReads', 'cacheColumnLongestStale', 'cacheColumnMostAtRisk'] as const).map((key) => (
                <th key={key} className="py-1 pr-3 font-normal">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-text">
            {rows.map(({ strategy, totals }) => (
              <tr key={strategy} aria-current={strategy === current || undefined} className={`border-t border-border ${strategy === current ? 'text-accent' : ''}`}>
                <td className="py-1 pr-3">{t(STRATEGY_NAMES[strategy])}</td>
                <td className="py-1 pr-3">{percent(totals.hits, totals.reads)}</td>
                <td className="py-1 pr-3">{dbLoad(totals)}</td>
                <td className="py-1 pr-3">{formatInteger(totals.staleReads)}</td>
                <td className="py-1 pr-3">{formatInteger(totals.longestStaleWindow)}</td>
                <td className="py-1 pr-3">{formatInteger(totals.mostUnflushedWrites)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
