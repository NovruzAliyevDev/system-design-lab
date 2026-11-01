import { useEffect, useId, useState, type ReactNode, type RefObject } from 'react'
import { formatInteger, t } from '../i18n'
import { TABLET_QUERY, useMediaQuery } from '../useMediaQuery'

const TICK_MS = 120
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** The colour of series `index` (a server, a node): slots in a fixed order, so an entity keeps its colour. */
export function seriesColor(index: number): string {
  return `var(--series-${(index % 8) + 1})`
}

/** A seed for a new random run; Core never reads randomness itself. */
export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

/** A Concept Simulation's box in a Lesson. Its text is Azerbaijani, unlike the primer text around it. */
export function SimulationFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const wide = useMediaQuery(TABLET_QUERY)
  return (
    <section lang="az" className="my-10 rounded-lg border border-zinc-800 p-4 sm:p-5">
      <p className="text-xs font-medium tracking-wide text-sky-400 uppercase">{t('conceptSimulationLabel')}</p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
      {!wide && (
        <p role="status" className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-zinc-200">
          {t('conceptSimulationDesktopBetter')}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** A control with its Azerbaijani explanation beside it. */
export function Control({ label, hint, labelId, children }: { label: string; hint: string; labelId?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <p id={labelId} className="text-sm font-medium text-zinc-200">
        {label}
      </p>
      <div className="mt-2">{children}</div>
      <p className="mt-2 text-xs text-zinc-400">{hint}</p>
    </div>
  )
}

/** One of a few options, as a group of radio buttons labelled by the element `labelledBy` names. */
export function Choice<T extends string>({
  labelledBy,
  options,
  value,
  onChange,
  name,
}: {
  labelledBy: string
  options: readonly T[]
  value: T
  onChange: (option: T) => void
  name: (option: T) => string
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`rounded border px-2 py-1 text-sm ${value === option ? 'border-sky-400 text-sky-300' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
        >
          {name(option)}
        </button>
      ))}
    </div>
  )
}

export interface ShareBar {
  key: string
  label: string
  count: number
  color: string
}

/** A labelled bar per entity, as long as its count against the largest, with the count and its share of all. */
export function ShareBars({ title, bars, valueKey }: { title: string; bars: ShareBar[]; valueKey: 'loadBalancerDistributionValue' | 'consistentHashingKeysPerNodeValue' }) {
  const total = bars.reduce((sum, bar) => sum + bar.count, 0)
  const most = Math.max(1, ...bars.map((bar) => bar.count))
  return (
    <figure>
      <figcaption className="text-sm font-medium text-zinc-200">{title}</figcaption>
      <ul className="mt-2 space-y-2">
        {bars.map((bar) => (
          <li key={bar.key} className="text-sm">
            <div className="flex justify-between gap-2 text-zinc-300">
              <span>{bar.label}</span>
              <span className="text-zinc-400 tabular-nums">
                {t(valueKey, { count: bar.count, percent: formatInteger(total > 0 ? (bar.count / total) * 100 : 0) })}
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-sm bg-zinc-800">
              <div className="h-full rounded-sm" style={{ width: `${(bar.count / most) * 100}%`, background: bar.color }} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  )
}

/**
 * Plays a run of `total` ticks from its first tick once the charts come into view, and again whenever
 * `restartOn` changes (the run). With reduced motion the run is shown whole.
 */
export function usePlayback(restartOn: unknown, total: number, charts: RefObject<HTMLElement | null>) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION)
  const seen = useSeen(charts)
  const [tick, setTick] = useState(reducedMotion ? total : 1)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (reducedMotion || !seen) return
    setTick(1)
    setPlaying(true)
  }, [restartOn, reducedMotion, seen])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setTick((current) => {
        if (current >= total) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [playing, total])

  return {
    tick,
    playing,
    toggle: () => {
      if (!playing && tick >= total) setTick(1)
      setPlaying(!playing)
    },
    seek: (next: number) => {
      setPlaying(false)
      setTick(next)
    },
  }
}

/** Play/pause, a scrubber over the ticks, and a re-run of the same settings with a new seed. */
export function PlaybackBar({ playback, total, onRerun }: { playback: ReturnType<typeof usePlayback>; total: number; onRerun: () => void }) {
  const tickId = useId()
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        onClick={playback.toggle}
        className="rounded border border-sky-400 px-3 py-1 text-sky-300 hover:bg-sky-400/10"
      >
        {playback.playing ? t('conceptSimulationPause') : t('conceptSimulationPlay')}
      </button>
      <label htmlFor={tickId} className="sr-only">
        {t('conceptSimulationTick')}
      </label>
      <input
        id={tickId}
        type="range"
        min={1}
        max={total}
        value={playback.tick}
        onChange={(event) => playback.seek(Number(event.target.value))}
        className="min-w-0 flex-1 basis-40"
      />
      <span className="text-zinc-400 tabular-nums">{t('conceptSimulationTickValue', { tick: playback.tick, total })}</span>
      <button
        type="button"
        title={t('conceptSimulationRerunHint')}
        onClick={onRerun}
        className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
      >
        {t('conceptSimulationRerun')}
      </button>
    </div>
  )
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

export interface TimelineSeries {
  key: string
  label: string
  color: string
  /** One value per tick of the whole run. */
  values: number[]
}

const CHART = { width: 480, height: 200, left: 30, right: 8, top: 8, bottom: 20 }

/**
 * A line per series over the `shown` ticks played so far of `total`, with a crosshair and the tick's values
 * on hover, and a legend.
 */
export function TimelineChart({
  title,
  hint,
  total,
  shown,
  series,
  formatValue,
}: {
  title: string
  hint: string
  total: number
  shown: number
  series: TimelineSeries[]
  formatValue: (value: number) => string
}) {
  const [hover, setHover] = useState<number>()
  // The y axis fits the whole run, so it stays still while the run plays, and ends on a round number.
  const highest = roundUp(Math.max(4, ...series.flatMap((line) => line.values)))
  const plotWidth = CHART.width - CHART.left - CHART.right
  const plotHeight = CHART.height - CHART.top - CHART.bottom
  const x = (index: number) => CHART.left + (index / Math.max(1, total - 1)) * plotWidth
  const y = (value: number) => CHART.top + plotHeight - (value / highest) * plotHeight
  const hovered = hover !== undefined && hover < shown ? hover : undefined

  return (
    <figure>
      <figcaption className="text-sm font-medium text-zinc-200">{title}</figcaption>
      <p className="text-xs text-zinc-500">{hint}</p>
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          className="w-full"
          role="img"
          aria-label={title}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect()
            const svgX = ((event.clientX - box.left) / box.width) * CHART.width
            const index = Math.round(((svgX - CHART.left) / plotWidth) * (total - 1))
            setHover(Math.min(Math.max(index, 0), total - 1))
          }}
          onPointerLeave={() => setHover(undefined)}
        >
          {[0, highest / 2, highest].map((value) => (
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
            {total}
          </text>
          {series.map((line) => (
            <polyline
              key={line.key}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinejoin="round"
              points={line.values
                .slice(0, shown)
                .map((value, i) => `${x(i)},${y(value)}`)
                .join(' ')}
            />
          ))}
          {hovered !== undefined && (
            <g>
              <line x1={x(hovered)} x2={x(hovered)} y1={CHART.top} y2={CHART.top + plotHeight} className="stroke-zinc-500" strokeWidth={1} />
              {series.map((line) => (
                <circle key={line.key} cx={x(hovered)} cy={y(line.values[hovered])} r={4} fill={line.color} className="stroke-zinc-950" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hovered !== undefined && (
          <div
            className="pointer-events-none absolute top-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap shadow"
            // Beside the crosshair, on the side with room.
            style={{
              left: `${(x(hovered) / CHART.width) * 100}%`,
              transform: hovered > total / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
            }}
          >
            <p className="font-medium text-zinc-200">{t('conceptSimulationTickAt', { tick: hovered + 1 })}</p>
            {series.map((line) => (
              <p key={line.key} className="flex items-center gap-1.5 text-zinc-300">
                <span aria-hidden className="size-2 rounded-full" style={{ background: line.color }} />
                {line.label}: {formatValue(line.values[hovered])}
              </p>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-400">
        {series.map((line) => (
          <li key={line.key} className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3" style={{ background: line.color }} />
            {line.label}
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
