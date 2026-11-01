import type { ReactNode } from 'react'
import { formatInteger, t } from '../i18n'
import { TABLET_QUERY, useMediaQuery } from '../useMediaQuery'

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
