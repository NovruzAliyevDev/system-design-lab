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

/**
 * A Node's Traffic Simulation results: load against capacity, latency and cost, or what a client sends;
 * what a Chaos Scenario broke in it, and the requests it drops.
 */
function MetricsOverlay({ metrics }: { metrics: NodeMetrics }) {
  if (metrics.capacityQps === undefined) {
    return <div className="mt-1 border-t border-border pt-1 text-xs text-accent">{t('nodeMetricsSent', { load: formatInteger(metrics.loadQps) })}</div>
  }
  const dropped = metrics.droppedQps > 0 && <div className="text-danger">{t('nodeDropped', { qps: formatInteger(metrics.droppedQps) })}</div>
  if (metrics.down) {
    return (
      <div className="mt-1 border-t border-danger/40 pt-1 text-xs">
        <div className="font-semibold text-danger">{t('nodeDown')}</div>
        {dropped}
      </div>
    )
  }
  return (
    <div className={`mt-1 border-t pt-1 text-xs ${metrics.overloaded ? 'border-danger/40 text-danger' : 'border-border text-accent'}`}>
      {metrics.primaryDown && <div className="font-semibold text-danger">{t('nodePrimaryDown')}</div>}
      {metrics.cold && <div className="font-semibold text-warning">{t('nodeCold')}</div>}
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
      {metrics.queueingDelayMs !== undefined && metrics.loadQps > 0 && <div>{t('nodeQueueing', { ms: formatDecimal(metrics.queueingDelayMs) })}</div>}
      {metrics.overloaded && <div className="font-semibold text-danger">{t('nodeOverloaded')}</div>}
      {metrics.throttledQps > 0 && <div className="text-warning">{t('nodeThrottled', { qps: formatInteger(metrics.throttledQps) })}</div>}
      {dropped}
    </div>
  )
}

export function ComponentNode({ data: { node, sketch, metrics }, selected, isConnectable }: NodeProps<ComponentFlowNode>) {
  const summary = configSummary(node)
  const overloaded = metrics?.overloaded ?? false
  const down = metrics?.down ?? false
  // Sketched, the border is a Rough.js box drawn over the background instead.
  const frame = sketch
    ? 'border-transparent'
    : down
      ? `border-dashed border-danger ${selected ? 'ring-2 ring-accent' : ''}`
      : overloaded
        ? `border-danger ${selected ? 'ring-2 ring-accent' : 'ring-1 ring-danger'}`
        : selected
          ? 'border-accent ring-1 ring-accent'
          : 'border-border'
  // A Node that is down sinks to the page surface, so the rest of the request path stands out. Neither it nor an
  // overloaded Node is faded or tinted: their text has to stay readable, and the border, ring and words carry the state.
  const background = down ? 'bg-surface' : 'bg-surface-raised'
  return (
    <div
      className={`relative rounded-md border px-3 py-2 text-left shadow ${background} ${frame}`}
      data-overloaded={metrics ? overloaded : undefined}
      data-down={metrics ? down : undefined}
      style={{ width: NODE_SIZE.width, minHeight: NODE_SIZE.height, fontFamily: sketch ? SKETCH_FONT : undefined }}
      data-testid={`node-${node.id}`}
    >
      {sketch && (
        <SketchBox
          id={node.id}
          strokeStyle={{
            stroke: selected ? 'var(--color-accent)' : overloaded || down ? 'var(--color-danger)' : 'var(--color-text-muted)',
            strokeWidth: selected || overloaded || down ? 2.5 : 1.5,
          }}
        />
      )}
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="!h-3 !w-3 !border-surface !bg-text-muted" />
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 rounded bg-surface px-1 font-mono text-[10px] text-text-muted">{COMPONENT_TAGS[node.componentType]}</span>
        <span className="truncate text-sm font-medium text-text">{node.label || componentName(node.componentType)}</span>
        {node.notes && (
          <span className="ml-auto text-xs text-text-muted" aria-hidden>
            ✎
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate text-xs text-text-muted">{componentName(node.componentType)}</div>
      {summary && <div className="mt-0.5 truncate text-xs text-text-muted">{summary}</div>}
      {metrics && <MetricsOverlay metrics={metrics} />}
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="!h-3 !w-3 !border-surface !bg-accent" />
    </div>
  )
}
