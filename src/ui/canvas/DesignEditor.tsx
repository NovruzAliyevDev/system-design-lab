import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { PALETTE, type ComponentType } from '../../core/design/components'
import {
  addNode,
  canConnect,
  connect,
  moveNodes,
  removeElements,
  type Design,
  type EdgeTraffic,
} from '../../core/design/design'
import { canRedo, canUndo, commit, endMerge, redo, undo, type History } from '../../core/design/history'
import { t } from '../i18n'
import { useProgress } from '../progress/store'
import { ComponentNode, type ComponentFlowNode } from './ComponentNode'
import { COMPONENT_TAGS, componentName, TRAFFIC_LABELS } from './componentText'
import { ConfigPanel, type CommitDesign } from './ConfigPanel'

/** The drag data type of a palette component being dropped on the canvas. */
const COMPONENT_DRAG_TYPE = 'application/x-system-design-lab-component'

const NODE_TYPES = { component: ComponentNode }

/** Roughly half a Node's size (`w-44` wide in ComponentNode), so that a dropped Node centres on the pointer. */
const NODE_HALF_SIZE = { x: 88, y: 30 }

const TRAFFIC_COLORS: Record<EdgeTraffic, string> = {
  read: 'var(--canvas-read)',
  write: 'var(--canvas-write)',
  both: 'var(--canvas-both)',
}

interface Selection {
  nodeIds: string[]
  edgeIds: string[]
}

const NO_SELECTION: Selection = { nodeIds: [], edgeIds: [] }

/**
 * The Design Canvas: a palette, a React Flow canvas and a config panel over a Design's edit history.
 * Read-only, it still lets the learner select elements to inspect their config.
 */
interface DesignEditorProps {
  history: History<Design>
  onChange: (history: History<Design>) => void
  readOnly: boolean
}

export function DesignEditor(props: DesignEditorProps) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  )
}

function Editor({ history, onChange, readOnly }: DesignEditorProps) {
  const design = history.present
  const theme = useProgress((state) => state.progress?.settings.theme)
  const { screenToFlowPosition } = useReactFlow()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<Selection>(NO_SELECTION)
  /** Sizes React Flow measured; it only draws Nodes it knows the size of. */
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  /** Positions of Nodes being dragged; the Design changes once the drag ends. */
  const [dragged, setDragged] = useState<Record<string, XYPosition>>({})
  // Fitting the view to an empty canvas would jump to the first Node added instead.
  const [fitOnLoad] = useState(design.nodes.length > 0)

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

  const nodes = useMemo(
    (): ComponentFlowNode[] =>
      design.nodes.map((node) => ({
        id: node.id,
        type: 'component',
        position: dragged[node.id] ?? node.position,
        data: { node },
        measured: measured[node.id],
        selected: selection.nodeIds.includes(node.id),
      })),
    [design.nodes, dragged, measured, selection.nodeIds],
  )

  const edges = useMemo(
    (): Edge[] =>
      design.edges.map((edge) => {
        const color = TRAFFIC_COLORS[edge.traffic]
        const selected = selection.edgeIds.includes(edge.id)
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          selected,
          label: t(TRAFFIC_LABELS[edge.traffic]),
          labelStyle: { fill: color, fontSize: 11 },
          labelBgStyle: { fill: 'var(--color-zinc-950)' },
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: { stroke: color, strokeWidth: selected ? 3 : 2, strokeDasharray: edge.mode === 'async' ? '6 4' : undefined },
          ariaLabel: `${edge.source} → ${edge.target}`,
          data: { mode: edge.mode, traffic: edge.traffic },
        }
      }),
    [design.edges, selection.edgeIds],
  )

  function applySelect(changes: (NodeChange | EdgeChange)[], kind: 'nodeIds' | 'edgeIds') {
    const selects = changes.filter((change) => change.type === 'select')
    if (selects.length === 0) return
    setSelection((current) => {
      const ids = new Set(current[kind])
      for (const change of selects) {
        if (change.selected) ids.add(change.id)
        else ids.delete(change.id)
      }
      return { ...current, [kind]: [...ids] }
    })
  }

  function onNodesChange(changes: NodeChange<ComponentFlowNode>[]) {
    applySelect(changes, 'nodeIds')
    const sizes: typeof measured = {}
    const dragging: typeof dragged = {}
    const moved: typeof dragged = {}
    for (const change of changes) {
      if (change.type === 'dimensions' && change.dimensions) sizes[change.id] = change.dimensions
      if (change.type === 'position' && change.position) {
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
      const changed = present.nodes.some(({ id, position }) => Object.hasOwn(moved, id) && (moved[id].x !== position.x || moved[id].y !== position.y))
      if (changed) commitDesign(moveNodes(present, moved))
    }
    // Removals arrive through onDelete, as one change for Nodes and Edges together.
  }

  function deleteElements({ nodeIds, edgeIds }: Selection) {
    if (nodeIds.length === 0 && edgeIds.length === 0) return
    commitDesign(removeElements(historyRef.current.present, { nodeIds, edgeIds }))
    setSelection(NO_SELECTION)
  }

  function addComponent(componentType: ComponentType, position: XYPosition) {
    const added = addNode(historyRef.current.present, componentType, position, componentName(componentType))
    commitDesign(added.design)
    setSelection({ nodeIds: [added.nodeId], edgeIds: [] })
  }

  /** Adds a component in the middle of the visible canvas, a little offset from the last one added there. */
  function addAtCentre(componentType: ComponentType) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const centre = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    const step = design.nodes.length % 5
    addComponent(componentType, { x: centre.x - NODE_HALF_SIZE.x + step * 30, y: centre.y - NODE_HALF_SIZE.y + step * 80 })
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
    addComponent(componentType, { x: point.x - NODE_HALF_SIZE.x, y: point.y - NODE_HALF_SIZE.y })
  }

  const undoChange = useCallback(() => change(undo(historyRef.current)), [change])
  const redoChange = useCallback(() => change(redo(historyRef.current)), [change])

  useEffect(() => {
    if (readOnly) return
    function onKeyDown(event: KeyboardEvent) {
      // Text fields keep their own undo.
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) undoChange()
      else if ((key === 'z' && event.shiftKey) || key === 'y') redoChange()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readOnly, undoChange, redoChange])

  // Undo can remove a selected element; the panel then shows nothing rather than a stale selection.
  const existingIds = new Set([...design.nodes.map((node) => node.id), ...design.edges.map((edge) => edge.id)])
  const selected: Selection = {
    nodeIds: selection.nodeIds.filter((id) => existingIds.has(id)),
    edgeIds: selection.edgeIds.filter((id) => existingIds.has(id)),
  }
  const selectedCount = selected.nodeIds.length + selected.edgeIds.length
  const buttonClass = 'rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-40'

  return (
    <div className="flex flex-col gap-3 md:h-[calc(100vh-11rem)] md:min-h-[32rem] md:flex-row">
      {!readOnly && (
        <nav aria-label={t('paletteTitle')} className="shrink-0 overflow-y-auto md:w-48">
          <h2 className="text-sm font-semibold text-zinc-100">{t('paletteTitle')}</h2>
          <ul className="mt-2 space-y-1">
            {PALETTE.map((componentType) => (
              <li key={componentType}>
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(COMPONENT_DRAG_TYPE, componentType)
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => addAtCentre(componentType)}
                  aria-label={t('paletteAdd', { component: componentName(componentType) })}
                  className="flex w-full cursor-grab items-baseline gap-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-left text-xs text-zinc-200 hover:border-zinc-600"
                >
                  <span className="w-10 shrink-0 font-mono text-[10px] text-zinc-500">{COMPONENT_TAGS[componentType]}</span>
                  {componentName(componentType)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!readOnly && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass} disabled={!canUndo(history)} onClick={undoChange}>
              {t('canvasUndo')}
            </button>
            <button type="button" className={buttonClass} disabled={!canRedo(history)} onClick={redoChange}>
              {t('canvasRedo')}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={selectedCount === 0}
              onClick={() => deleteElements(selected)}
            >
              {t('canvasDelete')}
            </button>
            <span className="text-xs text-zinc-500">{t('canvasShortcuts')}</span>
          </div>
        )}
        <div
          ref={canvasRef}
          // React Flow fills its parent's height, so the parent needs one: fixed when stacked, the free space beside the panels from `md`.
          className="h-[26rem] overflow-hidden rounded border border-zinc-800 md:h-auto md:min-h-0 md:flex-1"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            aria-label={t('canvasLabel')}
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            colorMode={theme ?? 'dark'}
            onNodesChange={onNodesChange}
            onEdgesChange={(changes) => applySelect(changes, 'edgeIds')}
            onDelete={({ nodes: deletedNodes, edges: deletedEdges }) =>
              deleteElements({ nodeIds: deletedNodes.map((node) => node.id), edgeIds: deletedEdges.map((edge) => edge.id) })
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
            multiSelectionKeyCode={null}
            selectionKeyCode={null}
            fitView={fitOnLoad}
            fitViewOptions={{ maxZoom: 1 }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <p className="mt-2 text-xs text-zinc-500">{t('canvasLegend')}</p>
      </div>

      <aside className="shrink-0 overflow-y-auto md:w-72">
        <ConfigPanel
          design={design}
          nodeId={selectedCount === 1 ? selected.nodeIds[0] : undefined}
          edgeId={selectedCount === 1 ? selected.edgeIds[0] : undefined}
          readOnly={readOnly}
          onCommit={commitDesign}
          onEndEdit={() => change(endMerge(historyRef.current))}
        />
      </aside>
    </div>
  )
}
