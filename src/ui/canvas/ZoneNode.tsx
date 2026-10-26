import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import { ZONE_MIN_SIZE, type DesignZone, type Position, type Size } from '../../core/design/design'
import { SKETCH_FONT, SketchBox } from './sketch'

/** Reports a zone box being resized from one of its corners or sides, with its new bounds. */
export type ResizeZone = (zoneId: string, bounds: { position: Position; size: Size }, done: boolean) => void

export type ZoneFlowNode = Node<{ zone: DesignZone; sketch: boolean; resizable: boolean; onResize: ResizeZone }, 'zone'>

/**
 * A zone or region box. Only its header takes the pointer, so that the canvas and the Nodes inside it
 * stay clickable, and a box selection can start inside it.
 */
export function ZoneNode({ data: { zone, sketch, resizable, onResize }, selected }: NodeProps<ZoneFlowNode>) {
  const report = (done: boolean) => (_: unknown, { x, y, width, height }: { x: number; y: number; width: number; height: number }) =>
    onResize(zone.id, { position: { x, y }, size: { width, height } }, done)
  const colour = selected ? 'var(--color-sky-400)' : 'var(--color-zinc-500)'
  return (
    <div className="relative h-full w-full" data-testid={`zone-${zone.id}`} style={{ fontFamily: sketch ? SKETCH_FONT : undefined }}>
      <NodeResizer
        isVisible={selected && resizable}
        minWidth={ZONE_MIN_SIZE.width}
        minHeight={ZONE_MIN_SIZE.height}
        color="var(--color-sky-400)"
        onResize={report(false)}
        onResizeEnd={report(true)}
      />
      {sketch ? (
        <>
          <div className="absolute inset-0 rounded-lg bg-zinc-500/5" />
          <SketchBox id={zone.id} dashed strokeStyle={{ stroke: colour, strokeWidth: selected ? 2.5 : 1.5 }} />
        </>
      ) : (
        <div className="absolute inset-0 rounded-lg border-2 border-dashed bg-zinc-500/5" style={{ borderColor: colour }} />
      )}
      <div
        className="pointer-events-auto absolute inset-x-0 top-0 flex h-8 cursor-move items-center truncate rounded-t-lg px-3 text-xs font-semibold text-zinc-400"
        title={zone.label}
      >
        {zone.label}
      </div>
    </div>
  )
}
