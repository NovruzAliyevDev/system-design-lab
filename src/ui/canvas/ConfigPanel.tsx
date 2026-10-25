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
  setNodeConfig,
  setNodeNotes,
  updateEdge,
  type Design,
  type DesignEdge,
  type DesignNode,
  type EdgeMode,
  type EdgeTraffic,
} from '../../core/design/design'
import { formatInteger, formatNumber, t, type StringKey } from '../i18n'
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
  'mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 aria-invalid:border-red-500 disabled:opacity-70'
const labelClass = 'mt-3 block text-xs font-medium text-zinc-400'

export function ConfigPanel({
  nodeId,
  edgeId,
  readOnly,
  ...edit
}: EditProps & {
  nodeId?: string
  edgeId?: string
  readOnly: boolean
}) {
  const { design } = edit
  const node = design.nodes.find((candidate) => candidate.id === nodeId)
  const edge = design.edges.find((candidate) => candidate.id === edgeId)
  return (
    <section aria-label={t('configTitle')} className="text-sm">
      <h2 className="font-semibold text-zinc-100">{t('configTitle')}</h2>
      {readOnly && <p className="mt-1 text-xs text-zinc-500">{t('configReadOnly')}</p>}
      {node ? (
        // Keyed by the Node, so that drafts of invalid values do not carry over to another Node.
        <fieldset key={node.id} disabled={readOnly}>
          <NodeConfig node={node} {...edit} />
        </fieldset>
      ) : edge ? (
        <fieldset key={edge.id} disabled={readOnly}>
          <EdgeConfig edge={edge} {...edit} />
        </fieldset>
      ) : (
        <p className="mt-2 text-zinc-500">{t('configNothingSelected')}</p>
      )}
    </section>
  )
}

function NodeConfig({ design, node, onCommit, onEndEdit }: EditProps & { node: DesignNode }) {
  const id = useId()
  const { config: fields } = componentDefinition(node.componentType)
  const config: AnyConfig = node.config
  return (
    <>
      <p className="mt-1 text-xs text-zinc-500">{componentName(node.componentType)}</p>
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
      <SimulationDefaults node={node} />
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
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-400">
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

/** What one instance handles, how long it takes and what it costs, ready for the Traffic Simulation. */
function SimulationDefaults({ node }: { node: DesignNode }) {
  const { simulation } = componentDefinition(node.componentType)
  return (
    <div className="mt-5 border-t border-zinc-800 pt-3">
      <h3 className="text-xs font-semibold text-zinc-300">{t('simulationTitle')}</h3>
      {simulation ? (
        <>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-zinc-500">{t('simulationCapacity')}</dt>
            <dd className="text-zinc-200">{t('simulationCapacityValue', { qps: formatInteger(simulation.capacityQps) })}</dd>
            <dt className="text-zinc-500">{t('simulationLatency')}</dt>
            <dd className="text-zinc-200">{t('simulationLatencyValue', { ms: formatNumber(simulation.baseLatencyMs) })}</dd>
            <dt className="text-zinc-500">{t('simulationCost')}</dt>
            <dd className="text-zinc-200">{t('simulationCostValue', { usd: formatInteger(simulation.monthlyCostUsd) })}</dd>
          </dl>
          <p className="mt-2 text-xs text-zinc-500">{t('simulationLatencyBasis', { table: 'Latency numbers' })}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-zinc-400">
            {simulation.latency.map((term) => (
              <li key={term.operation}>
                {term.times} × {term.operation} ({formatDuration(term.nanoseconds)})
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">{t('simulationClient')}</p>
      )}
    </div>
  )
}

function EdgeConfig({ design, edge, onCommit }: EditProps & { edge: DesignEdge }) {
  const id = useId()
  const label = (nodeId: string) => design.nodes.find((node) => node.id === nodeId)?.label || nodeId
  return (
    <>
      <p className="mt-1 text-xs text-zinc-500">
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
