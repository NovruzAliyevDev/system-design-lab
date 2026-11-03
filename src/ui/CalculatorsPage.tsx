import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDuration, type LatencyNumber } from '../core/content/appendix'
import type { CalculatorId } from '../core/content/calculator-lessons'
import { estimateFromUsage, perPeriod, PERIODS, type Period, type UsageInputs } from '../core/estimation/calculator'
import { BYTE_UNITS, ESTIMATION_QUANTITIES, fromUnit, inBestUnit, type ByteUnit, type EstimationQuantity } from '../core/estimation/estimate'
import { compareLatencies } from '../core/estimation/latency'
import { catalog } from './catalog'
import { formatMeasure, formatRounded, parseDecimal, quantityName, StepLine } from './EstimationSteps'
import { t, tRich, type StringKey } from './i18n'
import { calculatorPath } from './routes'
import { useScrollToHash } from './useScrollToHash'

const CALCULATOR_TITLES: Record<CalculatorId, StringKey> = {
  'back-of-the-envelope': 'calculatorBoteTitle',
  latency: 'calculatorLatencyTitle',
}

/** "Kalkulyatorlar: …" with a link to each calculator; in a new tab when the current page holds work in progress. */
export function CalculatorLinks({ calculators, newTab = false }: { calculators: CalculatorId[]; newTab?: boolean }) {
  if (calculators.length === 0) return null
  const links = calculators.map((calculatorId, i) => (
    <span key={calculatorId}>
      {i > 0 && ' · '}
      <Link
        to={calculatorPath(calculatorId)}
        className="link"
        {...(newTab && { target: '_blank', rel: 'noopener noreferrer' })}
      >
        {t(CALCULATOR_TITLES[calculatorId])}
      </Link>
    </span>
  ))
  return <p className="mt-2 text-sm text-text-muted">{tRich('calculatorsLinks', { links })}</p>
}

/** The back-of-the-envelope calculator and the latency comparison, each a section a link can point at. */
export function CalculatorsPage() {
  useScrollToHash()
  return (
    <section>
      <h1 className="text-2xl font-semibold text-text">{t('calculatorsTitle')}</h1>
      <p className="mt-1 text-sm text-text-muted">{t('calculatorsDescription')}</p>
      <BackOfTheEnvelope />
      <LatencyComparison />
    </section>
  )
}

const fieldClass = 'min-h-11 w-full rounded border border-border bg-surface-raised px-2 text-text sm:min-h-8'

const PERIOD_NAMES: Record<Period, StringKey> = {
  second: 'periodSecond',
  day: 'periodDay',
  month: 'periodMonth',
  year: 'periodYear',
}

/** A rate per second, per a period, in its best unit: "6 000 sorğu/san", "83,33 TB/gün". */
function formatRate(perSecond: number, kind: 'requests-per-second' | 'bytes-per-second', period: Period): string {
  const value = perPeriod(perSecond, period)
  const periodName = t(PERIOD_NAMES[period])
  if (kind === 'requests-per-second') return `${formatRounded(value)} ${t('calculatorRequestsPer', { period: periodName })}`
  const { value: inUnit, unit } = inBestUnit(value, 'bytes')
  return `${formatRounded(inUnit)} ${t('calculatorBytesPer', { unit: unit!, period: periodName })}`
}

interface Size {
  text: string
  unit: ByteUnit
}

/** The primer's Twitter solution: 100 million users, 500 million 10 KB tweets and ~8.3 billion reads a day. */
const START = {
  dailyActiveUsers: '100 000 000',
  writesPerUserPerDay: '5',
  readsPerUserPerDay: '83',
  bytesPerWrite: { text: '10', unit: 'KB' } as Size,
  bytesPerRead: { text: '', unit: 'KB' } as Size,
  peakFactor: '1',
  years: '1',
}

type Fields = typeof START

/** The usage the fields describe; undefined while one is not a number of at least 0. The read size may stay empty. */
function usageOf(fields: Fields): UsageInputs | undefined {
  const count = (text: string) => {
    const number = parseDecimal(text)
    return number !== undefined && number >= 0 ? number : undefined
  }
  const size = ({ text, unit }: Size) => {
    const number = count(text)
    return number === undefined ? undefined : fromUnit(number, unit)
  }
  const usage = {
    dailyActiveUsers: count(fields.dailyActiveUsers),
    writesPerUserPerDay: count(fields.writesPerUserPerDay),
    readsPerUserPerDay: count(fields.readsPerUserPerDay),
    bytesPerWrite: size(fields.bytesPerWrite),
    peakFactor: count(fields.peakFactor),
    years: count(fields.years),
  }
  if (Object.values(usage).some((value) => value === undefined)) return undefined
  if (fields.bytesPerRead.text.trim() === '') return usage as UsageInputs
  const bytesPerRead = size(fields.bytesPerRead)
  return bytesPerRead === undefined ? undefined : { ...(usage as UsageInputs), bytesPerRead }
}

/** The results, rates first: each per second, then per day, month and year. */
const RESULT_QUANTITIES: EstimationQuantity[] = [
  'writeQps',
  'readQps',
  'peakWriteQps',
  'peakReadQps',
  'writeBandwidth',
  'readBandwidth',
  'storagePerMonth',
  'storagePerYear',
  'storageTotal',
]

function BackOfTheEnvelope() {
  const [fields, setFields] = useState(START)
  const usage = usageOf(fields)
  const estimate = usage && estimateFromUsage(usage)
  const set = <Name extends keyof Fields>(name: Name) => (value: Fields[Name]) => setFields((current) => ({ ...current, [name]: value }))

  return (
    <section id="back-of-the-envelope" aria-labelledby="bote-title" className="mt-8 scroll-mt-16">
      <h2 id="bote-title" className="text-xl font-semibold text-text">
        {t('calculatorBoteTitle')}
      </h2>
      <p className="mt-1 text-sm text-text-muted">{t('calculatorBoteDescription')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <NumberField label={t('calculatorDailyActiveUsers')} value={fields.dailyActiveUsers} onChange={set('dailyActiveUsers')} />
        <NumberField label={t('calculatorWritesPerUser')} value={fields.writesPerUserPerDay} onChange={set('writesPerUserPerDay')} />
        <NumberField label={t('calculatorReadsPerUser')} value={fields.readsPerUserPerDay} onChange={set('readsPerUserPerDay')} />
        <SizeField label={t('calculatorBytesPerWrite')} value={fields.bytesPerWrite} onChange={set('bytesPerWrite')} />
        <SizeField label={t('calculatorBytesPerRead')} hint={t('calculatorBytesPerReadHint')} value={fields.bytesPerRead} onChange={set('bytesPerRead')} />
        <NumberField label={t('calculatorPeakFactor')} value={fields.peakFactor} onChange={set('peakFactor')} />
        <NumberField label={t('calculatorYears')} value={fields.years} onChange={set('years')} />
      </div>

      {!estimate ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {t('calculatorInvalid')}
        </p>
      ) : (
        <>
          <h3 className="mt-6 font-semibold text-text">{t('calculatorResults')}</h3>
          <dl className="mt-2 divide-y divide-border/60 rounded border border-border">
            {RESULT_QUANTITIES.map((quantity) => {
              const kind = ESTIMATION_QUANTITIES[quantity]
              const value = estimate.result.values[quantity]
              return (
                <div key={quantity} className="px-3 py-2">
                  <dt className="text-sm text-text-muted">{quantityName(quantity)}</dt>
                  {kind === 'bytes' ? (
                    <dd className="text-text">{formatMeasure(value, kind)}</dd>
                  ) : (
                    <dd className="flex flex-wrap gap-x-3 text-text">
                      {PERIODS.map((period) => (
                        <span key={period} className={period === 'second' ? '' : 'text-sm text-text-muted'}>
                          {formatRate(value, kind, period)}
                        </span>
                      ))}
                    </dd>
                  )}
                </div>
              )
            })}
          </dl>

          <h3 className="mt-6 font-semibold text-text">{t('calculatorSteps')}</h3>
          <ol className="mt-2 space-y-1 rounded border border-border bg-surface-raised/50 p-3 font-mono text-xs break-words text-text-muted">
            {[...estimate.usageSteps, ...estimate.result.steps].map((step) => (
              <li key={step.quantity}>
                <StepLine step={step} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children(id: string): ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-text">
        {label}
        {hint && <span className="text-text-muted"> ({hint})</span>}
      </label>
      <div className="mt-1 flex gap-2">{children(id)}</div>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return (
    <Field label={label}>
      {(id) => <input id={id} inputMode="decimal" className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)} />}
    </Field>
  )
}

function SizeField({ label, hint, value, onChange }: { label: string; hint?: string; value: Size; onChange(value: Size): void }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <>
          <input id={id} inputMode="decimal" className={fieldClass} value={value.text} onChange={(event) => onChange({ ...value, text: event.target.value })} />
          <select
            aria-label={t('calculatorUnit', { field: label })}
            className="min-h-11 rounded border border-border bg-surface-raised px-2 text-sm text-text sm:min-h-8"
            value={value.unit}
            onChange={(event) => onChange({ ...value, unit: event.target.value as ByteUnit })}
          >
            {BYTE_UNITS.map(({ unit }) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </>
      )}
    </Field>
  )
}

/** Questions the latency table answers, as pairs of its operations. */
const LATENCY_EXAMPLES: { label: StringKey; first: string; second: string }[] = [
  { label: 'calculatorLatencyExampleSeeks', first: 'Send packet CA->Netherlands->CA', second: 'HDD seek' },
  { label: 'calculatorLatencyExampleMemory', first: 'Round trip within same datacenter', second: 'Main memory reference' },
  { label: 'calculatorLatencyExampleSsd', first: 'Read 1 MB sequentially from SSD*', second: 'Read 1 MB sequentially from memory' },
]

function LatencyComparison() {
  const rows = catalog.appendix.latencyNumbers?.rows ?? []
  const indexOf = (operation: string) => rows.findIndex((row) => row.operation === operation)
  const examples = LATENCY_EXAMPLES.map((example) => ({ ...example, pair: [indexOf(example.first), indexOf(example.second)] as const })).filter(({ pair }) =>
    pair.every((index) => index !== -1),
  )
  const [pair, setPair] = useState<readonly [number, number]>(() => examples[0]?.pair ?? [rows.length - 1, 0])
  if (rows.length === 0) return null
  const comparison = compareLatencies(rows[pair[0]], rows[pair[1]])

  return (
    <section id="latency" aria-labelledby="latency-title" className="mt-12 scroll-mt-16">
      <h2 id="latency-title" className="text-xl font-semibold text-text">
        {t('calculatorLatencyTitle')}
      </h2>
      <p className="mt-1 text-sm text-text-muted">{t('calculatorLatencyDescription')}</p>

      {examples.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="text-text-muted">{t('calculatorLatencyExamples')}</p>
          <ul className="mt-2 flex flex-col items-start gap-2">
            {examples.map((example) => (
              <li key={example.label}>
                <button
                  type="button"
                  className="min-h-11 rounded border border-border px-3 py-2 text-left hover:border-text-muted sm:min-h-8 sm:py-1"
                  onClick={() => setPair(example.pair)}
                >
                  {t(example.label)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <OperationSelect label={t('calculatorLatencyFirst')} rows={rows} value={pair[0]} onChange={(index) => setPair([index, pair[1]])} />
        <OperationSelect label={t('calculatorLatencySecond')} rows={rows} value={pair[1]} onChange={(index) => setPair([pair[0], index])} />
      </div>

      <div className="mt-4 rounded border border-border bg-surface-raised/50 p-3" aria-live="polite">
        <p className="text-3xl font-semibold text-text tabular-nums">{t('calculatorLatencyRatio', { ratio: formatRounded(comparison.ratio) })}</p>
        {comparison.ratio === 1 ? (
          <p className="mt-2 text-text">{t('calculatorLatencySame', { time: formatDuration(comparison.faster.nanoseconds) })}</p>
        ) : (
          <p className="mt-2 text-text">
              {tRich('calculatorLatencyFits', {
                slower: <span lang="en">{comparison.slower.operation}</span>,
                slowerTime: formatDuration(comparison.slower.nanoseconds),
                faster: <span lang="en">{comparison.faster.operation}</span>,
                fasterTime: formatDuration(comparison.faster.nanoseconds),
                ratio: formatRounded(comparison.ratio),
            })}
          </p>
        )}
      </div>
    </section>
  )
}

function OperationSelect(props: { label: string; rows: LatencyNumber[]; value: number; onChange(index: number): void }) {
  const { label, rows, value, onChange } = props
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} lang="en" className={fieldClass} value={value} onChange={(event) => onChange(Number(event.target.value))}>
          {rows.map((row, index) => (
            <option key={row.operation} value={index}>
              {`${row.operation} (${formatDuration(row.nanoseconds)})`}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}
