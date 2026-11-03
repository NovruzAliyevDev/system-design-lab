import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react'
import type { DesignRelation, RelationKind } from '../../core/design/design'

/** `markers`: the prefix of the ids of this canvas's `RelationMarkers`. */
export type RelationFlowEdge = Edge<{ relation: DesignRelation; markers: string }, 'relation'>

type Marker = 'triangle' | 'arrow' | 'filled-diamond' | 'hollow-diamond'

/**
 * How UML draws each kind: a hollow triangle at the superclass or interface (dashed for an
 * implementation), a diamond at the whole (filled for composition), an open arrow at the class used.
 */
const ENDS: Record<RelationKind, { start?: Marker; end?: Marker; dashed?: boolean }> = {
  inheritance: { end: 'triangle' },
  implementation: { end: 'triangle', dashed: true },
  composition: { start: 'filled-diamond' },
  aggregation: { start: 'hollow-diamond' },
  association: { end: 'arrow' },
}

const STROKE = 'var(--color-text-muted)'
const BACKGROUND = 'var(--color-surface)'

/** How far above its ends a class's relation to itself loops, clear of the class box. */
const LOOP_HEIGHT = 150

/** The marker shapes a canvas's relations draw at their ends, with ids prefixed by `prefix`. */
export function RelationMarkers({ prefix }: { prefix: string }) {
  return (
    <svg width={0} height={0} className="absolute" aria-hidden>
      <defs>
        <marker id={`${prefix}-triangle`} viewBox="0 0 14 12" refX={14} refY={6} markerWidth={14} markerHeight={12} markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L14,6 L0,12 Z" fill={BACKGROUND} stroke={STROKE} strokeWidth={1.5} />
        </marker>
        <marker id={`${prefix}-arrow`} viewBox="0 0 14 12" refX={14} refY={6} markerWidth={14} markerHeight={12} markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L14,6 L0,12" fill="none" stroke={STROKE} strokeWidth={1.5} />
        </marker>
        <marker id={`${prefix}-filled-diamond`} viewBox="0 0 18 12" refX={0} refY={6} markerWidth={18} markerHeight={12} markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,6 L9,0 L18,6 L9,12 Z" fill={STROKE} stroke={STROKE} strokeWidth={1.5} />
        </marker>
        <marker id={`${prefix}-hollow-diamond`} viewBox="0 0 18 12" refX={0} refY={6} markerWidth={18} markerHeight={12} markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,6 L9,0 L18,6 L9,12 Z" fill={BACKGROUND} stroke={STROKE} strokeWidth={1.5} />
        </marker>
      </defs>
    </svg>
  )
}

/** A relation as UML draws it, with its multiplicities beside the ends. */
export function RelationEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, interactionWidth }: EdgeProps<RelationFlowEdge>) {
  if (!data) return null
  const { relation, markers } = data
  // A class's relation to itself leaves its right side and loops over the box back into its left side.
  const path =
    relation.source === relation.target
      ? `M ${sourceX},${sourceY} C ${sourceX + 60},${sourceY - LOOP_HEIGHT} ${targetX - 60},${targetY - LOOP_HEIGHT} ${targetX},${targetY}`
      : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })[0]
  const { start, end, dashed } = ENDS[relation.kind]
  const marker = (shape: Marker | undefined) => shape && `url(#${markers}-${shape})`
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={marker(start)}
        markerEnd={marker(end)}
        interactionWidth={interactionWidth}
        style={{ stroke: selected ? 'var(--color-accent)' : STROKE, strokeWidth: selected ? 2.5 : 1.5, strokeDasharray: dashed ? '6 4' : undefined }}
      />
      <EdgeLabelRenderer>
        {/* Above the line, just off each end: the source leaves to the right, the target is entered from the left. */}
        {relation.sourceMultiplicity && <MultiplicityLabel x={sourceX + 18} y={sourceY - 12} text={relation.sourceMultiplicity} />}
        {relation.targetMultiplicity && <MultiplicityLabel x={targetX - 18} y={targetY - 12} text={relation.targetMultiplicity} />}
      </EdgeLabelRenderer>
    </>
  )
}

function MultiplicityLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <span
      className="pointer-events-none absolute font-mono text-xs text-text"
      style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
    >
      {text}
    </span>
  )
}
