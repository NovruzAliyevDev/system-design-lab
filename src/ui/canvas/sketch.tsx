import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import rough from 'roughjs'
import type { Options } from 'roughjs/bin/core'

// The hand-drawn (sketch) canvas style, drawn with Rough.js. Shapes take their seed from the
// element's id, so a Node or Edge looks the same on every render instead of wobbling.

const generator = rough.generator()

/** A handwriting font the system is likely to have, so that sketch labels match the strokes offline. */
export const SKETCH_FONT = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Chalkboard SE', cursive"

/** A stable Rough.js seed (a positive integer) for an element id. */
function seedOf(id: string): number {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return (Math.abs(hash) % 2_147_483_646) + 1
}

/** The SVG path data of a sketched shape; strokes take their colour from the element that draws them. */
function pathData(drawable: ReturnType<typeof generator.path>): string[] {
  return generator.toPaths(drawable).map((path) => path.d)
}

const BASE: Options = { roughness: 1.2, bowing: 1.5, strokeWidth: 1.5 }

/** A box with its top-left corner at the origin, drawn just inside `width` × `height`. */
export function sketchRectangle(id: string, width: number, height: number, dashed = false): string[] {
  return pathData(generator.rectangle(2, 2, width - 4, height - 4, { ...BASE, seed: seedOf(id), ...(dashed && { strokeLineDash: [8, 6] }) }))
}

/** An SVG path (e.g. an Edge's curve) drawn by hand. */
export function sketchPath(id: string, d: string, dashed: boolean): string[] {
  return pathData(generator.path(d, { ...BASE, seed: seedOf(id), ...(dashed && { strokeLineDash: [6, 5] }) }))
}

/** Straight lines through `points`, e.g. an arrowhead. */
export function sketchLines(id: string, points: [number, number][]): string[] {
  return pathData(generator.linearPath(points, { ...BASE, seed: seedOf(`${id}:lines`) }))
}

/**
 * A sketched box filling its positioned parent, measured so that its strokes fit the parent's size.
 * `strokeStyle` sets the colour (e.g. a CSS variable) and width of its strokes.
 */
export function SketchBox({ id, dashed = false, strokeStyle }: { id: string; dashed?: boolean; strokeStyle: CSSProperties }) {
  const ref = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<{ width: number; height: number }>()

  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg) return
    // Unchanged sizes keep the same state, so that measuring never re-renders in a loop.
    const measure = () =>
      setSize((current) =>
        current?.width === svg.clientWidth && current.height === svg.clientHeight ? current : { width: svg.clientWidth, height: svg.clientHeight },
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  const paths = useMemo(() => (size && size.width > 4 && size.height > 4 ? sketchRectangle(id, size.width, size.height, dashed) : []), [id, size, dashed])
  return (
    <svg ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" style={strokeStyle} />
      ))}
    </svg>
  )
}
