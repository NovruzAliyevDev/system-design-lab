import { useId, useState } from 'react'
import { formatDuration } from '../../core/content/appendix'
import {
  componentDefinition,
  configProblem,
  isFieldApplicable,
  type AnyConfig,
  type ConfigField,
  type ConfigProblem,
} from '../../core/design/components'
import {
  EDGE_MODES,
  EDGE_TRAFFIC,
  LABEL_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  renameNode,
  renameZone,
  nodeSimulation,
  setNodeConfig,
  setNodeNotes,
  setNodeSimulation,
  SIMULATION_SETTINGS,
  simulationProblem,
  updateEdge,
  type Design,
  type DesignEdge,
  type DesignNode,
  type DesignZone,
  type EdgeMode,
  type EdgeTraffic,
  type SimulationProblem,
  type SimulationSetting,
} from '../../core/design/design'
import { parseDecimal } from '../EstimationSteps'
import { formatNumber, t, type StringKey } from '../i18n'
import { EDGE_MODE_LABELS, TRAFFIC_LABELS, componentName, fieldLabel, optionLabel } from './componentText'

/** Commits a changed Design as an undo step; commits with the same `mergeKey` in a row undo as one. */
export type CommitDesign = (next: Design, mergeKey?: string) => void

interface EditProps {
  design: Design
  onCommit: CommitDesign
  /** Called when the learner leaves a field: typing there again starts a new undo step. */
  onEndEdit: () => void
}

const inputClass =
  'mt-1 min-h-11 w-full rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text aria-invalid:border-danger disabled:opacity-70 sm:min-h-8'
const labelClass = 'mt-3 block text-xs font-medium text-text-muted'

export function ConfigPanel({
  nodeId,
  edgeId,
  zoneId,
  selectedCount,
  readOnly,
  ...edit
}: EditProps & {
  nodeId?: string
  edgeId?: string
  zoneId?: string
  /** How many elements are selected; the panel configures one at a time. */
  selectedCount: number
  readOnly: boolean
}) {
  const { design } = edit
  const node = design.nodes.find((candidate) => candidate.id === nodeId)
  const edge = design.edges.find((candidate) => candidate.id === edgeId)
  const zone = design.zones.find((candidate) => candidate.id === zoneId)
  return (
    <section aria-label={t('configTitle')} className="text-sm">
      <h2 className="font-semibold text-text">{t('configTitle')}</h2>
      {readOnly && <p className="mt-1 text-xs text-text-muted">{t('configReadOnly')}</p>}
      {node ? (
        // Keyed by the Node, so that drafts of invalid values do not carry over to another Node.
        <fieldset key={node.id} disabled={readOnly}>
          <NodeConfig node={node} {...edit} />
        </fieldset>
      ) : edge ? (
        <fieldset key={edge.id} disabled={readOnly}>
          <EdgeConfig edge={edge} {...edit} />
        </fieldset>
      ) : zone ? (
        <fieldset key={zone.id} disabled={readOnly}>
          <ZoneConfig zone={zone} {...edit} />
        </fieldset>
      ) : (
        <p className="mt-2 text-text-muted">{selectedCount > 1 ? t('configManySelected', { count: selectedCount }) : t('configNothingSelected')}</p>
      )}
    </section>
  )
}

function ZoneConfig({ design, zone, onCommit, onEndEdit }: EditProps & { zone: DesignZone }) {
  const id = useId()
  const members = design.nodes.filter((node) => node.zoneId === zone.id).length
  return (
    <>
      <p className="mt-1 text-xs text-text-muted">{t('zoneTitle')}</p>
      <label className={labelClass} htmlFor={`${id}-label`}>
        {t('nodeName')}
      </label>
      <input
        id={`${id}-label`}
        className={inputClass}
        value={zone.label}
        maxLength={LABEL_MAX_LENGTH}
        onBlur={onEndEdit}
        onChange={(event) => onCommit(renameZone(design, zone.id, event.target.value), `zone-label:${zone.id}`)}
      />
      <p className="mt-3 text-xs text-text-muted">{t('zoneMembers', { count: members })}</p>
      <p className="mt-2 text-xs text-text-muted">{t('zoneHelp')}</p>
    </>
  )
}

function NodeConfig({ design, node, onCommit, onEndEdit }: EditProps & { node: DesignNode }) {
  const id = useId()
  const { config: fields } = componentDefinition(node.componentType)
  const config: AnyConfig = node.config
  return (
    <>
      <p className="mt-1 text-xs text-text-muted">{componentName(node.componentType)}</p>
      <label className={labelClass} htmlFor={`${id}-label`}>
        {t('nodeName')}
      </label>
      <input
        id={`${id}-label`}
        className={inputClass}
        value={node.label}
        maxLength={LABEL_MAX_LENGTH}
        onBlur={onEndEdit}
        onChange={(event) => onCommit(renameNode(design, node.id, event.target.value), `label:${node.id}`)}
      />
      <label className={labelClass} htmlFor={`${id}-notes`}>
        {t('nodeNotes')}
      </label>
      <textarea
        id={`${id}-notes`}
        className={inputClass}
        rows={3}
        value={node.notes}
        maxLength={NOTES_MAX_LENGTH}
        onBlur={onEndEdit}
        onChange={(event) => onCommit(setNodeNotes(design, node.id, event.target.value), `notes:${node.id}`)}
      />
      {Object.entries(fields).map(([key, field]) => (
        <ConfigFieldInput
          key={key}
          id={`${id}-${key}`}
          fieldKey={key}
          field={field}
          value={config[key]}
          applicable={isFieldApplicable(field, config)}
          check={(value) => configProblem(node.componentType, key, value, { ...config, [key]: value })}
          onChange={(value) => onCommit(setNodeConfig(design, node.id, key, value), `config:${node.id}:${key}`)}
          onEndEdit={onEndEdit}
        />
      ))}
      <SimulationSettings design={design} node={node} onCommit={onCommit} onEndEdit={onEndEdit} />
    </>
  )
}

/** One config field. A value the schema refuses is shown with the reason and never committed. */
function ConfigFieldInput({
  id,
  fieldKey,
  field,
  value,
  applicable,
  check,
  onChange,
  onEndEdit,
}: {
  id: string
  fieldKey: string
  field: ConfigField
  value: string | number
  /** A field that does not apply to the rest of the config (e.g. replicas of a replica) keeps its default. */
  applicable: boolean
  check: (value: unknown) => ConfigProblem | undefined
  onChange: (value: string | number) => void
  onEndEdit: () => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [problem, setProblem] = useState<ConfigProblem>()
  // An undo or redo changes the stored value under the input: show it, unless an invalid draft is being typed.
  const shown = problem ? draft : String(value)

  function change(text: string) {
    setDraft(text)
    const next = field.kind === 'integer' ? (text.trim() === '' ? NaN : Number(text)) : text
    const nextProblem = check(next)
    setProblem(nextProblem)
    if (!nextProblem) onChange(next)
  }

  const errorId = `${id}-error`
  return (
    <>
      <label className={labelClass} htmlFor={id}>
        {fieldLabel(fieldKey)}
      </label>
      {field.kind === 'choice' ? (
        <select id={id} className={inputClass} value={value} disabled={!applicable} onChange={(event) => change(event.target.value)}>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className={inputClass}
          type={field.kind === 'integer' ? 'number' : 'text'}
          inputMode={field.kind === 'integer' ? 'numeric' : undefined}
          min={field.kind === 'integer' ? field.min : undefined}
          max={field.kind === 'integer' ? field.max : undefined}
          step={field.kind === 'integer' ? 1 : undefined}
          value={shown}
          disabled={!applicable}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? errorId : undefined}
          // Leaving the field gives up an invalid draft; the stored value stays.
          onBlur={() => {
            setProblem(undefined)
            onEndEdit()
          }}
          onChange={(event) => change(event.target.value)}
        />
      )}
      {problem && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {problemText(problem, field)}
        </p>
      )}
    </>
  )
}

const PROBLEM_TEXT: Record<Exclude<ConfigProblem, 'out-of-range' | 'too-long'>, StringKey> = {
  'unknown-field': 'configUnknownField',
  'not-an-option': 'configNotAnOption',
  'not-an-integer': 'configNotInteger',
  'not-text': 'configNotText',
  'not-applicable': 'configNotApplicable',
}

function problemText(problem: ConfigProblem, field: ConfigField): string {
  if (problem === 'out-of-range' && field.kind === 'integer') return t('configOutOfRange', { min: field.min, max: field.max })
  if (problem === 'too-long' && field.kind === 'text') return t('configTooLong', { max: field.maxLength })
  return t(PROBLEM_TEXT[problem as keyof typeof PROBLEM_TEXT])
}

/** How each setting reads in the panel: its label, the unit it is typed in, and how many of that make one stored unit. */
const SETTING_TEXT: Record<SimulationSetting, { label: StringKey; unit: StringKey; scale: number }> = {
  capacityQps: { label: 'simulationCapacity', unit: 'simulationUnitQps', scale: 1 },
  baseLatencyMs: { label: 'simulationLatency', unit: 'simulationUnitMs', scale: 1 },
  monthlyCostUsd: { label: 'simulationCost', unit: 'simulationUnitUsd', scale: 1 },
  // Typed as a percentage, stored as a share.
  hitRatio: { label: 'simulationHitRatio', unit: 'simulationUnitPercent', scale: 100 },
}

/**
 * What one instance handles, how long it takes and what it costs in the Traffic Simulation: the
 * component's defaults, each of which the Node can set for itself and reset.
 */
function SimulationSettings({ design, node, onCommit, onEndEdit }: EditProps & { node: DesignNode }) {
  const id = useId()
  const defaults = componentDefinition(node.componentType).simulation
  const current = nodeSimulation(node)
  return (
    <div className="mt-5 border-t border-border pt-3">
      <h3 className="text-xs font-semibold text-text">{t('simulationTitle')}</h3>
      {defaults && current ? (
        <>
          {SIMULATION_SETTINGS.filter((key) => defaults[key] !== undefined).map((key) => (
            <SimulationSettingInput
              key={key}
              id={`${id}-${key}`}
              setting={key}
              check={(value) => simulationProblem(node.componentType, key, value)}
              value={current[key]!}
              defaultValue={defaults[key]!}
              overridden={node.simulation?.[key] !== undefined}
              onChange={(value) => onCommit(setNodeSimulation(design, node.id, key, value), `simulation:${node.id}:${key}`)}
              onEndEdit={onEndEdit}
            />
          ))}
          <p className="mt-3 text-xs text-text-muted">{t('simulationLatencyBasis', { table: 'Latency numbers' })}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
            {defaults.latency.map((term) => (
              <li key={term.operation}>
                {term.times} × {term.operation} ({formatDuration(term.nanoseconds)})
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-xs text-text-muted">{t('simulationClient')}</p>
      )}
    </div>
  )
}

const SIMULATION_PROBLEM_TEXT: Record<SimulationProblem, StringKey> = {
  'no-such-setting': 'configUnknownField',
  'not-a-number': 'simulationInvalidPositive',
  'not-positive': 'simulationInvalidPositive',
  negative: 'simulationInvalidCost',
  'not-a-share': 'simulationInvalidPercent',
}

/** One simulation setting, typed in its unit. A value that makes no sense is shown with the reason and never committed. */
function SimulationSettingInput(props: {
  id: string
  setting: SimulationSetting
  value: number
  defaultValue: number
  overridden: boolean
  check(value: unknown): SimulationProblem | undefined
  onChange(value: number | undefined): void
  onEndEdit(): void
}) {
  const { id, setting, value, defaultValue, overridden, check, onChange, onEndEdit } = props
  const { label, unit, scale } = SETTING_TEXT[setting]
  const show = (stored: number) => formatNumber(Number((stored * scale).toPrecision(6)))
  const [draft, setDraft] = useState<string>()
  const [problem, setProblem] = useState<SimulationProblem>()
  const invalid = problem !== undefined

  function change(text: string) {
    setDraft(text)
    const typed = parseDecimal(text)
    const stored = typed === undefined ? Number.NaN : typed / scale
    const nextProblem = check(stored)
    setProblem(nextProblem)
    if (!nextProblem) onChange(stored)
  }

  const errorId = `${id}-error`
  return (
    <>
      <label className={labelClass} htmlFor={id}>
        {t(label)} ({t(unit)})
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          className={inputClass}
          inputMode="decimal"
          // An undo or redo changes the stored value under the input: show it, unless an invalid draft is being typed.
          value={invalid && draft !== undefined ? draft : show(value)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          onBlur={() => {
            setProblem(undefined)
            setDraft(undefined)
            onEndEdit()
          }}
          onChange={(event) => change(event.target.value)}
        />
        {overridden && (
          <button
            type="button"
            className="mt-1 min-h-11 shrink-0 rounded border border-border px-2 text-xs hover:border-text-muted sm:min-h-8"
            title={t('simulationResetTitle', { value: show(defaultValue) })}
            onClick={() => onChange(undefined)}
          >
            {t('simulationReset')}
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-text-muted">{t('simulationDefault', { value: show(defaultValue) })}</p>
      {problem && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {t(SIMULATION_PROBLEM_TEXT[problem])}
        </p>
      )}
    </>
  )
}

function EdgeConfig({ design, edge, onCommit }: EditProps & { edge: DesignEdge }) {
  const id = useId()
  const label = (nodeId: string) => design.nodes.find((node) => node.id === nodeId)?.label || nodeId
  return (
    <>
      <p className="mt-1 text-xs text-text-muted">
        {t('edgeTitle')}: {label(edge.source)} → {label(edge.target)}
      </p>
      <label className={labelClass} htmlFor={`${id}-mode`}>
        {t('edgeMode')}
      </label>
      <select
        id={`${id}-mode`}
        className={inputClass}
        value={edge.mode}
        onChange={(event) => onCommit(updateEdge(design, edge.id, { mode: event.target.value as EdgeMode }))}
      >
        {EDGE_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {t(EDGE_MODE_LABELS[mode])}
          </option>
        ))}
      </select>
      <label className={labelClass} htmlFor={`${id}-traffic`}>
        {t('edgeTraffic')}
      </label>
      <select
        id={`${id}-traffic`}
        className={inputClass}
        value={edge.traffic}
        onChange={(event) => onCommit(updateEdge(design, edge.id, { traffic: event.target.value as EdgeTraffic }))}
      >
        {EDGE_TRAFFIC.map((traffic) => (
          <option key={traffic} value={traffic}>
            {t(TRAFFIC_LABELS[traffic])}
          </option>
        ))}
      </select>
    </>
  )
}
