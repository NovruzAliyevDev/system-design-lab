import {
  Background,
  Controls,
  getViewportForBounds,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { copyElements, pasteElements } from '../../core/design/clipboard'
import { PALETTE, type ComponentType } from '../../core/design/components'
import {
  addNode,
  addZone,
  canConnect,
  connect,
  moveElements,
  NODE_SIZE,
  removeElements,
  setZoneBounds,
  type Design,
  type EdgeTraffic,
  type Position,
  type Size,
} from '../../core/design/design'
import { canRedo, canUndo, commit, endMerge, redo, undo, type History } from '../../core/design/history'
import { autoLayout } from '../../core/design/layout'
import { downloadDataUrl } from '../download'
import { t } from '../i18n'
import { useProgress } from '../progress/store'
import { ComponentNode, type ComponentFlowNode } from './ComponentNode'
import { TRAFFIC_LABELS, componentName } from './componentText'
import { ConfigPanel, type CommitDesign } from './ConfigPanel'
import { DesignEdge, type DesignFlowEdge } from './DesignEdge'
import { COMPONENT_DRAG_TYPE, Palette } from './Palette'
import { ZoneNode, type ResizeZone, type ZoneFlowNode } from './ZoneNode'

const NODE_TYPES = { component: ComponentNode, zone: ZoneNode }
const EDGE_TYPES = { design: DesignEdge }

type FlowNode = ComponentFlowNode | ZoneFlowNode

/** A new zone box placed in the middle of the canvas, and the room kept around Nodes a new zone is put around. */
const NEW_ZONE_SIZE: Size = { width: 400, height: 260 }
const NEW_ZONE_PADDING = { side: 24, top: 40 }

/** How far each paste of the same copy lands from the last, so that copies do not hide each other. */
const PASTE_STEP = 40

/** The largest side of an exported PNG, in pixels; bigger Designs are scaled down to fit. */
const MAX_EXPORT_SIDE = 4096
const EXPORT_MARGIN = 40

const TRAFFIC_COLORS: Record<EdgeTraffic, string> = {
  read: 'var(--canvas-read)',
  write: 'var(--canvas-write)',
  both: 'var(--canvas-both)',
}

interface Selection {
  nodeIds: string[]
  edgeIds: string[]
  zoneIds: string[]
}

const NO_SELECTION: Selection = { nodeIds: [], edgeIds: [], zoneIds: [] }

/** What was copied last, shared by every canvas so that a copy can be pasted into another Design. */
let clipboard: { copied: Design; pastes: number } | undefined

/**
 * The Design Canvas: a palette, a React Flow canvas and a config panel over a Design's edit history.
 * Read-only, it still lets the learner select elements to inspect their config, and export a PNG.
 */
interface DesignEditorProps {
  history: History<Design>
  onChange: (history: History<Design>) => void
  readOnly: boolean
  /** Stacks the config panel under a shorter canvas, e.g. for two canvases side by side. */
  compact?: boolean
  /** Names the canvas when a page shows more than one. */
  label?: string
}

export function DesignEditor(props: DesignEditorProps) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  )
}

function Editor({ history, onChange, readOnly, compact = false, label = t('canvasLabel') }: DesignEditorProps) {
  const design = history.present
  const theme = useProgress((state) => state.progress?.settings.theme)
  const sketch = useProgress((state) => state.progress?.settings.canvasStyle === 'sketch')
  const setCanvasStyle = useProgress((state) => state.setCanvasStyle)
  const { screenToFlowPosition, fitView, getNodes, getNodesBounds } = useReactFlow<FlowNode, DesignFlowEdge>()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<Selection>(NO_SELECTION)
  /** Sizes React Flow measured; it only draws Nodes it knows the size of. */
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  /** Positions of Nodes and zones being dragged; the Design changes once the drag ends. */
  const [dragged, setDragged] = useState<Record<string, XYPosition>>({})
  /** The bounds of a zone being resized; the Design changes once the resize ends. */
  const [resized, setResized] = useState<{ zoneId: string; position: Position; size: Size }>()
  /** The zone being resized, known at once: React Flow reports the resize as a move of the zone too, which is not one. */
  const resizingRef = useRef<string>(undefined)
  const [hasClipboard, setHasClipboard] = useState(clipboard !== undefined)
  const [exportFailed, setExportFailed] = useState(false)
  /** Counts requests to fit the view to the Design, e.g. after an auto-layout; each is served once it has rendered. */
  const [fitRequests, setFitRequests] = useState(0)
  // Fitting the view to an empty canvas would jump to the first Node added instead.
  const [fitOnLoad] = useState(design.nodes.length > 0 || design.zones.length > 0)

  // The latest history, so that handlers React Flow keeps between renders never commit onto a stale one.
  const historyRef = useRef(history)
  historyRef.current = history
  const change = useCallback(
    (next: History<Design>) => {
      historyRef.current = next
      onChange(next)
    },
    [onChange],
  )
  const commitDesign: CommitDesign = useCallback((next, mergeKey) => change(commit(historyRef.current, next, mergeKey)), [change])

  // What the canvas shows: the Design, with any drag or resize in progress applied.
  const shown = useMemo(() => {
    let next = Object.keys(dragged).length > 0 ? moveElements(design, dragged) : design
    if (resized) next = setZoneBounds(next, resized.zoneId, resized.position, resized.size)
    return next
  }, [design, dragged, resized])

  const resizeZone: ResizeZone = useCallback(
    (zoneId, { position, size }, done) => {
      resizingRef.current = done ? undefined : zoneId
      if (!done) return setResized({ zoneId, position, size })
      setResized(undefined)
      commitDesign(setZoneBounds(historyRef.current.present, zoneId, position, size))
    },
    [commitDesign],
  )

  const nodes = useMemo(
    (): FlowNode[] => [
      // Zones are drawn under the Edges and Nodes; their box lets clicks through, but not their header.
      ...shown.zones.map(
        (zone): ZoneFlowNode => ({
          id: zone.id,
          type: 'zone',
          position: zone.position,
          width: zone.size.width,
          height: zone.size.height,
          measured: zone.size,
          zIndex: -1,
          style: { pointerEvents: 'none' },
          data: { zone, sketch, resizable: !readOnly, onResize: resizeZone },
          selected: selection.zoneIds.includes(zone.id),
        }),
      ),
      ...shown.nodes.map(
        (node): ComponentFlowNode => ({
          id: node.id,
          type: 'component',
          position: node.position,
          data: { node, sketch },
          measured: measured[node.id],
          selected: selection.nodeIds.includes(node.id),
        }),
      ),
    ],
    [shown, measured, selection.nodeIds, selection.zoneIds, sketch, readOnly, resizeZone],
  )

  const edges = useMemo(
    (): DesignFlowEdge[] =>
      design.edges.map((edge) => {
        const color = TRAFFIC_COLORS[edge.traffic]
        const selected = selection.edgeIds.includes(edge.id)
        return {
          id: edge.id,
          type: 'design',
          source: edge.source,
          target: edge.target,
          selected,
          label: t(TRAFFIC_LABELS[edge.traffic]),
          labelStyle: { fill: color, fontSize: 11 },
          labelBgStyle: { fill: 'var(--color-zinc-950)' },
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: { stroke: color, strokeWidth: selected ? 3 : 2, strokeDasharray: edge.mode === 'async' ? '6 4' : undefined },
          ariaLabel: `${edge.source} → ${edge.target}`,
          data: { mode: edge.mode, traffic: edge.traffic, sketch },
        }
      }),
    [design.edges, selection.edgeIds, sketch],
  )

  const zoneIds = useMemo(() => new Set(design.zones.map((zone) => zone.id)), [design.zones])

  function applySelect(changes: (NodeChange | EdgeChange)[], kind: 'nodes' | 'edges') {
    const selects = changes.filter((change) => change.type === 'select')
    if (selects.length === 0) return
    setSelection((current) => {
      const ids = { nodeIds: new Set(current.nodeIds), edgeIds: new Set(current.edgeIds), zoneIds: new Set(current.zoneIds) }
      for (const change of selects) {
        const set = kind === 'edges' ? ids.edgeIds : zoneIds.has(change.id) ? ids.zoneIds : ids.nodeIds
        if (change.selected) set.add(change.id)
        else set.delete(change.id)
      }
      return { nodeIds: [...ids.nodeIds], edgeIds: [...ids.edgeIds], zoneIds: [...ids.zoneIds] }
    })
  }

  function onNodesChange(changes: NodeChange<FlowNode>[]) {
    applySelect(changes, 'nodes')
    const sizes: typeof measured = {}
    const dragging: typeof dragged = {}
    const moved: typeof dragged = {}
    for (const change of changes) {
      // A zone's size is the Design's; resizing reports through the zone itself.
      if (change.type === 'dimensions' && change.dimensions && !zoneIds.has(change.id)) sizes[change.id] = change.dimensions
      if (change.type === 'position' && change.position) {
        if (resizingRef.current === change.id) continue
        // A drag reports each step while dragging and the final position once it ends; arrow keys report only that.
        if (change.dragging) dragging[change.id] = change.position
        else moved[change.id] = change.position
      }
    }
    if (Object.keys(sizes).length > 0) setMeasured((current) => ({ ...current, ...sizes }))
    if (Object.keys(dragging).length > 0) setDragged((current) => ({ ...current, ...dragging }))
    if (Object.keys(moved).length > 0) {
      setDragged((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !Object.hasOwn(moved, id))))
      const present = historyRef.current.present
      const changed = [...present.nodes, ...present.zones].some(
        ({ id, position }) => Object.hasOwn(moved, id) && (moved[id].x !== position.x || moved[id].y !== position.y),
      )
      if (changed) commitDesign(moveElements(present, moved))
    }
    // Removals arrive through onDelete, as one change for Nodes, zones and Edges together.
  }

  function deleteElements(ids: Selection) {
    if (ids.nodeIds.length === 0 && ids.edgeIds.length === 0 && ids.zoneIds.length === 0) return
    commitDesign(removeElements(historyRef.current.present, ids))
    setSelection(NO_SELECTION)
  }

  /** The middle of the visible canvas. */
  function canvasCentre(): Position | undefined {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return undefined
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }

  function addComponent(componentType: ComponentType, position: XYPosition) {
    const added = addNode(historyRef.current.present, componentType, position, componentName(componentType))
    commitDesign(added.design)
    setSelection({ ...NO_SELECTION, nodeIds: [added.nodeId] })
  }

  /** Adds a component in the middle of the visible canvas, a little offset from the last one added there. */
  function addAtCentre(componentType: ComponentType) {
    const centre = canvasCentre()
    if (!centre) return
    const step = design.nodes.length % 5
    addComponent(componentType, { x: centre.x - NODE_SIZE.width / 2 + step * 30, y: centre.y - NODE_SIZE.height / 2 + step * 80 })
  }

  /** Puts a new zone box around the selected Nodes, or in the middle of the canvas when none is selected. */
  function addZoneBox() {
    const present = historyRef.current.present
    const around = present.nodes.filter((node) => selected.nodeIds.includes(node.id))
    let position: Position
    let size = NEW_ZONE_SIZE
    if (around.length > 0) {
      const left = Math.min(...around.map((node) => node.position.x)) - NEW_ZONE_PADDING.side
      const top = Math.min(...around.map((node) => node.position.y)) - NEW_ZONE_PADDING.top
      const right = Math.max(...around.map((node) => node.position.x + NODE_SIZE.width)) + NEW_ZONE_PADDING.side
      const bottom = Math.max(...around.map((node) => node.position.y + NODE_SIZE.height)) + NEW_ZONE_PADDING.side
      position = { x: left, y: top }
      size = { width: right - left, height: bottom - top }
    } else {
      const centre = canvasCentre()
      if (!centre) return
      position = { x: centre.x - size.width / 2, y: centre.y - size.height / 2 }
    }
    const added = addZone(present, position, size, t('zoneDefaultLabel'))
    commitDesign(added.design)
    setSelection({ ...NO_SELECTION, zoneIds: [added.zoneId] })
  }

  function copySelection(): boolean {
    if (selected.nodeIds.length === 0 && selected.zoneIds.length === 0) return false
    // Text selected on the page is what the learner means to copy.
    if (!(window.getSelection()?.isCollapsed ?? true)) return false
    clipboard = { copied: copyElements(historyRef.current.present, selected), pastes: 0 }
    setHasClipboard(true)
    return true
  }

  function paste(): boolean {
    if (!clipboard) return false
    clipboard.pastes++
    const offset = clipboard.pastes * PASTE_STEP
    const pasted = pasteElements(historyRef.current.present, clipboard.copied, { x: offset, y: offset })
    commitDesign(pasted.design)
    setSelection({ ...NO_SELECTION, nodeIds: pasted.nodeIds, zoneIds: pasted.zoneIds })
    return true
  }

  function layOut() {
    commitDesign(autoLayout(historyRef.current.present))
    setFitRequests((count) => count + 1)
  }

  useEffect(() => {
    if (fitRequests > 0) void fitView({ padding: 0.1, maxZoom: 1, duration: 300 })
  }, [fitRequests, fitView])

  async function exportPng() {
    const viewport = canvasRef.current?.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewport) return
    setExportFailed(false)
    const bounds = getNodesBounds(getNodes())
    const width = Math.min(MAX_EXPORT_SIDE, Math.ceil(bounds.width + 2 * EXPORT_MARGIN))
    const height = Math.min(MAX_EXPORT_SIDE, Math.ceil(bounds.height + 2 * EXPORT_MARGIN))
    // At most full size; a Design bigger than the image is scaled down, with the margin scaled along.
    const { x, y, zoom } = getViewportForBounds(bounds, width, height, 0.05, 1, 0)
    try {
      const dataUrl = await toPng(viewport, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        width,
        height,
        // Web fonts are not fetched again; the image uses what the system has.
        skipFonts: true,
        style: { width: `${width}px`, height: `${height}px`, transform: `translate(${x}px, ${y}px) scale(${zoom})` },
      })
      downloadDataUrl(t('canvasExportFileName'), dataUrl)
    } catch {
      setExportFailed(true)
    }
  }

  function onDragOver(event: DragEvent) {
    if (readOnly || !event.dataTransfer.types.includes(COMPONENT_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function onDrop(event: DragEvent) {
    const componentType = event.dataTransfer.getData(COMPONENT_DRAG_TYPE) as ComponentType
    if (readOnly || !PALETTE.includes(componentType)) return
    event.preventDefault()
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    addComponent(componentType, { x: point.x - NODE_SIZE.width / 2, y: point.y - NODE_SIZE.height / 2 })
  }

  const undoChange = useCallback(() => change(undo(historyRef.current)), [change])
  const redoChange = useCallback(() => change(redo(historyRef.current)), [change])

  // Undo can remove a selected element; the panel then shows nothing rather than a stale selection.
  const existingIds = new Set([...design.nodes.map((node) => node.id), ...design.edges.map((edge) => edge.id), ...zoneIds])
  const selected: Selection = {
    nodeIds: selection.nodeIds.filter((id) => existingIds.has(id)),
    edgeIds: selection.edgeIds.filter((id) => existingIds.has(id)),
    zoneIds: selection.zoneIds.filter((id) => existingIds.has(id)),
  }
  const selectedCount = selected.nodeIds.length + selected.edgeIds.length + selected.zoneIds.length

  // The latest handlers for the keyboard shortcuts, which are listened to once.
  const shortcuts = useRef({ undo: undoChange, redo: redoChange, copy: copySelection, paste })
  shortcuts.current = { undo: undoChange, redo: redoChange, copy: copySelection, paste }

  useEffect(() => {
    if (readOnly) return
    function onKeyDown(event: KeyboardEvent) {
      // Text fields keep their own undo, copy and paste.
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      let handled = true
      if (key === 'z' && !event.shiftKey) shortcuts.current.undo()
      else if ((key === 'z' && event.shiftKey) || key === 'y') shortcuts.current.redo()
      // Copying with nothing selected on the canvas, or with page text selected, leaves the browser's copy alone.
      else if (key === 'c') handled = shortcuts.current.copy()
      else if (key === 'v') handled = shortcuts.current.paste()
      else handled = false
      if (handled) event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readOnly])

  const buttonClass = 'rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-40'
  const empty = design.nodes.length === 0 && design.zones.length === 0

  return (
    <div className={compact ? 'flex flex-col gap-3' : 'flex flex-col gap-3 md:h-[calc(100vh-11rem)] md:min-h-[32rem] md:flex-row'}>
      {!readOnly && <Palette onAdd={addAtCentre} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <button type="button" className={buttonClass} disabled={!canUndo(history)} onClick={undoChange}>
                {t('canvasUndo')}
              </button>
              <button type="button" className={buttonClass} disabled={!canRedo(history)} onClick={redoChange}>
                {t('canvasRedo')}
              </button>
              <button type="button" className={buttonClass} disabled={selectedCount === 0} onClick={() => deleteElements(selected)}>
                {t('canvasDelete')}
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={selected.nodeIds.length === 0 && selected.zoneIds.length === 0}
                onClick={copySelection}
              >
                {t('canvasCopy')}
              </button>
              <button type="button" className={buttonClass} disabled={!hasClipboard} onClick={paste}>
                {t('canvasPaste')}
              </button>
              <button type="button" className={buttonClass} title={t('canvasAddZoneDescription')} onClick={addZoneBox}>
                {t('canvasAddZone')}
              </button>
              <button type="button" className={buttonClass} disabled={design.nodes.length === 0} onClick={layOut}>
                {t('canvasAutoLayout')}
              </button>
            </>
          )}
          <button type="button" className={buttonClass} disabled={empty} onClick={() => void exportPng()}>
            {t('canvasExportPng')}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-zinc-300">
            <input type="checkbox" checked={sketch} onChange={(event) => void setCanvasStyle(event.target.checked ? 'sketch' : 'clean')} />
            {t('canvasSketchStyle')}
          </label>
          {exportFailed && (
            <span role="alert" className="text-xs text-red-400">
              {t('canvasExportFailed')}
            </span>
          )}
        </div>
        {!readOnly && <p className="mb-2 text-xs text-zinc-500">{t('canvasShortcuts')}</p>}
        <div
          ref={canvasRef}
          // React Flow fills its parent's height, so the parent needs one: fixed when stacked, the free space beside the panels from `md`.
          className={
            compact
              ? 'h-[26rem] overflow-hidden rounded border border-zinc-800'
              : 'h-[26rem] overflow-hidden rounded border border-zinc-800 md:h-auto md:min-h-0 md:flex-1'
          }
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            aria-label={label}
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            colorMode={theme ?? 'dark'}
            onNodesChange={onNodesChange}
            onEdgesChange={(changes) => applySelect(changes, 'edges')}
            onDelete={({ nodes: deletedNodes, edges: deletedEdges }) =>
              deleteElements({
                nodeIds: deletedNodes.filter((node) => node.type === 'component').map((node) => node.id),
                zoneIds: deletedNodes.filter((node) => node.type === 'zone').map((node) => node.id),
                edgeIds: deletedEdges.map((edge) => edge.id),
              })
            }
            isValidConnection={(connection) => canConnect(historyRef.current.present, connection.source, connection.target)}
            onConnect={(connection) => {
              if (canConnect(historyRef.current.present, connection.source, connection.target)) {
                commitDesign(connect(historyRef.current.present, connection.source, connection.target))
              }
            }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
            // Shift-click adds to the selection, and Shift-drag on the canvas selects everything in a box.
            multiSelectionKeyCode={readOnly ? null : 'Shift'}
            selectionKeyCode={readOnly ? null : 'Shift'}
            // A selected zone stays under the Nodes in it.
            elevateNodesOnSelect={false}
            fitView={fitOnLoad}
            fitViewOptions={{ maxZoom: 1 }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <p className="mt-2 text-xs text-zinc-500">{t('canvasLegend')}</p>
      </div>

      <aside className={compact ? 'shrink-0' : 'shrink-0 overflow-y-auto md:w-72'}>
        <ConfigPanel
          design={design}
          nodeId={selectedCount === 1 ? selected.nodeIds[0] : undefined}
          edgeId={selectedCount === 1 ? selected.edgeIds[0] : undefined}
          zoneId={selectedCount === 1 ? selected.zoneIds[0] : undefined}
          selectedCount={selectedCount}
          readOnly={readOnly}
          onCommit={commitDesign}
          onEndEdit={() => change(endMerge(historyRef.current))}
        />
      </aside>
    </div>
  )
}
