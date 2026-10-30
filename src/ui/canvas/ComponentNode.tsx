import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { componentDefinition, type AnyConfig } from '../../core/design/components'
import { NODE_SIZE, type DesignNode } from '../../core/design/design'
import type { NodeMetrics } from '../../core/simulation/simulate'
import { formatMeasure } from '../EstimationSteps'
import { formatDecimal, formatInteger, t } from '../i18n'
import { COMPONENT_TAGS, componentName, fieldLabel, optionLabel } from './componentText'
import { SKETCH_FONT, SketchBox } from './sketch'

export type ComponentFlowNode = Node<{ node: DesignNode; sketch: boolean; metrics?: NodeMetrics }, 'component'>

/** The choices made in a Node's config, e.g. "Layer 7 · Round robin · ×2". */
function configSummary(node: DesignNode): string {
  const config: AnyConfig = node.config
  const parts = Object.entries(componentDefinition(node.componentType).config).flatMap(([key, field]) => {
    const value = config[key]
    // Defaults that say nothing (one instance, no replicas, no shard key) are left out.
    if (field.kind === 'choice') return [optionLabel(String(value))]
    if (value === field.default) return []
    if (key === 'instances') return [`×${value}`]
    if (key === 'replicas') return [t('nodeReplicas', { count: value })]
    if (key === 'shardKey') return [t('nodeShardKey', { key: value })]
    return [`${fieldLabel(key)}: ${value}`]
  })
  return parts.join(' · ')
}

/** A Node's Traffic Simulation results: load against capacity, latency and cost, or what a client sends. */
function MetricsOverlay({ metrics }: { metrics: NodeMetrics }) {
  if (metrics.capacityQps === undefined) {
    return <div className="mt-1 border-t border-zinc-800 pt-1 text-xs text-sky-300">{t('nodeMetricsSent', { load: formatInteger(metrics.loadQps) })}</div>
  }
  return (
    <div className={`mt-1 border-t pt-1 text-xs ${metrics.overloaded ? 'border-rose-800 text-rose-200' : 'border-zinc-800 text-sky-300'}`}>
      <div>
        {t('nodeMetricsLoad', {
          load: formatInteger(metrics.loadQps),
          capacity: formatInteger(metrics.capacityQps),
          percent: formatDecimal(metrics.utilisation * 100),
        })}
      </div>
      <div>
        {t('nodeMetricsLatency', {
          ms: formatDecimal(metrics.latencyMs),
          usd: formatInteger(metrics.monthlyCostUsd),
          bandwidth: formatMeasure(metrics.bandwidthBytesPerSecond, 'bytes-per-second'),
        })}
        {metrics.backlogQps > 0 && ` · ${t('nodeBacklog', { qps: formatInteger(metrics.backlogQps) })}`}
      </div>
      {metrics.overloaded && <div className="font-semibold text-rose-300">{t('nodeOverloaded')}</div>}
    </div>
  )
}

export function ComponentNode({ data: { node, sketch, metrics }, selected, isConnectable }: NodeProps<ComponentFlowNode>) {
  const summary = configSummary(node)
  const overloaded = metrics?.overloaded ?? false
  // Sketched, the border is a Rough.js box drawn over the background instead.
  const frame = sketch
    ? 'border-transparent'
    : overloaded
      ? `border-rose-500 ${selected ? 'ring-2 ring-sky-400' : 'ring-1 ring-rose-500'}`
      : selected
        ? 'border-sky-400 ring-1 ring-sky-400'
        : 'border-zinc-700'
  return (
    <div
      className={`relative rounded-md border px-3 py-2 text-left shadow ${overloaded ? 'bg-rose-950' : 'bg-zinc-900'} ${frame}`}
      data-overloaded={metrics ? overloaded : undefined}
      style={{ width: NODE_SIZE.width, minHeight: NODE_SIZE.height, fontFamily: sketch ? SKETCH_FONT : undefined }}
      data-testid={`node-${node.id}`}
    >
      {sketch && (
        <SketchBox
          id={node.id}
          strokeStyle={{
            stroke: selected ? 'var(--color-sky-400)' : overloaded ? 'var(--color-rose-500)' : 'var(--color-zinc-400)',
            strokeWidth: selected || overloaded ? 2.5 : 1.5,
          }}
        />
      )}
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="!h-3 !w-3 !border-zinc-950 !bg-zinc-400" />
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 rounded bg-zinc-800 px-1 font-mono text-[10px] text-zinc-400">{COMPONENT_TAGS[node.componentType]}</span>
        <span className="truncate text-sm font-medium text-zinc-50">{node.label || componentName(node.componentType)}</span>
        {node.notes && (
          <span className="ml-auto text-xs text-zinc-500" aria-hidden>
            ✎
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate text-xs text-zinc-400">{componentName(node.componentType)}</div>
      {summary && <div className="mt-0.5 truncate text-xs text-zinc-500">{summary}</div>}
      {metrics && <MetricsOverlay metrics={metrics} />}
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="!h-3 !w-3 !border-zinc-950 !bg-sky-400" />
    </div>
  )
}
