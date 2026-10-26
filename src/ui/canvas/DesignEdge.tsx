import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react'
import { useMemo } from 'react'
import type { EdgeMode, EdgeTraffic } from '../../core/design/design'
import { SKETCH_FONT, sketchLines, sketchPath } from './sketch'

export type DesignFlowEdge = Edge<{ mode: EdgeMode; traffic: EdgeTraffic; sketch: boolean }, 'design'>

/** An Edge drawn as a clean curve with an arrow marker, or sketched by hand with Rough.js. */
export function DesignEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style,
  label,
  labelStyle,
  labelBgStyle,
  interactionWidth,
}: EdgeProps<DesignFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const sketch = data?.sketch ?? false
  const dashed = data?.mode === 'async'

  const strokes = useMemo(() => {
    if (!sketch) return []
    // Edges end on a Node's left side, so they always arrive heading right.
    const arrow: [number, number][] = [
      [targetX - 11, targetY - 6],
      [targetX, targetY],
      [targetX - 11, targetY + 6],
    ]
    return [...sketchPath(id, path, dashed), ...sketchLines(id, arrow)]
  }, [sketch, id, path, dashed, targetX, targetY])

  const labelProps = { label, labelX, labelY, labelBgStyle, interactionWidth }
  if (!sketch) return <BaseEdge path={path} markerEnd={markerEnd} style={style} labelStyle={labelStyle} {...labelProps} />
  return (
    <>
      {strokes.map((d, i) => (
        <path key={i} d={d} fill="none" style={{ stroke: style?.stroke, strokeWidth: selected ? 2.5 : 1.5 }} />
      ))}
      {/* An invisible copy of the curve takes the clicks and carries the label. */}
      <BaseEdge path={path} style={{ stroke: 'transparent' }} labelStyle={{ ...labelStyle, fontFamily: SKETCH_FONT }} {...labelProps} />
    </>
  )
}
