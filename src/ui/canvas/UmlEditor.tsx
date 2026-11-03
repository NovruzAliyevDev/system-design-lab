import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type EdgeChange, type NodeChange, type XYPosition } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { addClass, canRelate, edgeId, moveElements, relate, removeElements, type Design } from '../../core/design/design'
import { canRedo, canUndo, commit, endMerge, redo, undo, type History } from '../../core/design/history'
import { t } from '../i18n'
import { useProgress } from '../progress/store'
import { CLASS_WIDTH, ClassNode, type ClassFlowNode } from './ClassNode'
import type { CommitDesign } from './ConfigPanel'
import { RelationEdge, RelationMarkers, type RelationFlowEdge } from './RelationEdge'
import { UmlPanel } from './UmlPanel'
import { RELATION_KIND_LABELS } from './umlText'

// The UML Class Builder: a React Flow canvas of a UML Design's classes and relations over its edit
// history, with a panel for the selected class or relation. It shares the Design model, undo history
// and selection conventions of the Design Canvas, without its palette, zones or simulation.

const NODE_TYPES = { class: ClassNode }
const EDGE_TYPES = { relation: RelationEdge }

interface Selection {
  classIds: string[]
  relationIds: string[]
}

const NO_SELECTION: Selection = { classIds: [], relationIds: [] }

interface UmlEditorProps {
  history: History<Design>
  onChange: (history: History<Design>) => void
  readOnly: boolean
  /** Stacks the panel under a shorter canvas, e.g. for two canvases side by side. */
  compact?: boolean
  /** Names the canvas when a page shows more than one. */
  label?: string
}

export function UmlEditor(props: UmlEditorProps) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  )
}

function Editor({ history, onChange, readOnly, compact = false, label = t('umlLabel') }: UmlEditorProps) {
  const design = history.present
  const theme = useProgress((state) => state.progress?.settings.theme)
  const { screenToFlowPosition } = useReactFlow<ClassFlowNode, RelationFlowEdge>()
  const markers = useId().replace(/:/g, '')
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<Selection>(NO_SELECTION)
  /** Sizes React Flow measured; it only draws Nodes it knows the size of. */
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  /** Positions of classes being dragged; the Design changes once the drag ends. */
  const [dragged, setDragged] = useState<Record<string, XYPosition>>({})
  // Fitting the view to an empty canvas would jump to the first class added instead.
  const [fitOnLoad] = useState(design.classes.length > 0)

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

  const shown = useMemo(() => (Object.keys(dragged).length > 0 ? moveElements(design, dragged) : design), [design, dragged])

  const nodes = useMemo(
    (): ClassFlowNode[] =>
      shown.classes.map((umlClass) => ({
        id: umlClass.id,
        type: 'class',
        position: umlClass.position,
        data: { umlClass },
        measured: measured[umlClass.id],
        selected: selection.classIds.includes(umlClass.id),
      })),
    [shown.classes, measured, selection.classIds],
  )

  const edges = useMemo(
    (): RelationFlowEdge[] =>
      design.relations.map((relation) => {
        const nameOf = (classId: string) => design.classes.find((each) => each.id === classId)?.name || t('umlUnnamedClass')
        return {
          id: relation.id,
          type: 'relation',
          source: relation.source,
          target: relation.target,
          selected: selection.relationIds.includes(relation.id),
          ariaLabel: `${nameOf(relation.source)} → ${nameOf(relation.target)}: ${t(RELATION_KIND_LABELS[relation.kind])}`,
          data: { relation, markers },
        }
      }),
    [design.relations, design.classes, selection.relationIds, markers],
  )

  function applySelect(changes: (NodeChange | EdgeChange)[], kind: 'classIds' | 'relationIds') {
    const selects = changes.filter((each) => each.type === 'select')
    if (selects.length === 0) return
    setSelection((current) => {
      const ids = new Set(current[kind])
      for (const each of selects) {
        if (each.selected) ids.add(each.id)
        else ids.delete(each.id)
      }
      return { ...current, [kind]: [...ids] }
    })
  }

  function onNodesChange(changes: NodeChange<ClassFlowNode>[]) {
    applySelect(changes, 'classIds')
    const sizes: typeof measured = {}
    const dragging: typeof dragged = {}
    const moved: typeof dragged = {}
    for (const each of changes) {
      if (each.type === 'dimensions' && each.dimensions) sizes[each.id] = each.dimensions
      if (each.type === 'position' && each.position) {
        // A drag reports each step while dragging and the final position once it ends; arrow keys report only that.
        if (each.dragging) dragging[each.id] = each.position
        else moved[each.id] = each.position
      }
    }
    if (Object.keys(sizes).length > 0) setMeasured((current) => ({ ...current, ...sizes }))
    if (Object.keys(dragging).length > 0) setDragged((current) => ({ ...current, ...dragging }))
    if (Object.keys(moved).length > 0) {
      setDragged((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !Object.hasOwn(moved, id))))
      const present = historyRef.current.present
      const changed = present.classes.some(({ id, position }) => Object.hasOwn(moved, id) && (moved[id].x !== position.x || moved[id].y !== position.y))
      if (changed) commitDesign(moveElements(present, moved))
    }
  }

  function deleteElements(ids: Selection) {
    if (ids.classIds.length === 0 && ids.relationIds.length === 0) return
    commitDesign(removeElements(historyRef.current.present, { nodeIds: ids.classIds, edgeIds: ids.relationIds }))
    setSelection(NO_SELECTION)
  }

  /** Adds a class in the middle of the visible canvas, a little offset from the last one added there. */
  function addClassAtCentre() {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const centre = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    const step = design.classes.length % 5
    const added = addClass(historyRef.current.present, { x: centre.x - CLASS_WIDTH / 2 + step * 30, y: centre.y - 60 + step * 40 }, t('umlDefaultClassName'))
    commitDesign(added.design)
    setSelection({ ...NO_SELECTION, classIds: [added.classId] })
  }

  const undoChange = useCallback(() => change(undo(historyRef.current)), [change])
  const redoChange = useCallback(() => change(redo(historyRef.current)), [change])

  // Undo can remove a selected element; the panel then shows nothing rather than a stale selection.
  const classIds = new Set(design.classes.map((each) => each.id))
  const relationIds = new Set(design.relations.map((each) => each.id))
  const selected: Selection = {
    classIds: selection.classIds.filter((id) => classIds.has(id)),
    relationIds: selection.relationIds.filter((id) => relationIds.has(id)),
  }
  const selectedCount = selected.classIds.length + selected.relationIds.length

  // The latest handlers for the keyboard shortcuts, which are listened to once.
  const shortcuts = useRef({ undo: undoChange, redo: redoChange })
  shortcuts.current = { undo: undoChange, redo: redoChange }

  useEffect(() => {
    if (readOnly) return
    function onKeyDown(event: KeyboardEvent) {
      // Text fields keep their own undo.
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) shortcuts.current.undo()
      else if ((key === 'z' && event.shiftKey) || key === 'y') shortcuts.current.redo()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readOnly])

  const buttonClass = 'min-h-11 rounded border border-border px-2 text-xs hover:border-text-muted disabled:opacity-50 disabled:hover:border-border sm:min-h-8'

  return (
    <div className={compact ? 'flex flex-col gap-3' : 'flex flex-col gap-3 md:h-[calc(100vh-11rem)] md:min-h-[32rem] md:flex-row'}>
      <div className="flex min-w-0 flex-1 flex-col">
        {!readOnly && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button type="button" className={buttonClass} onClick={addClassAtCentre}>
                {t('umlAddClass')}
              </button>
              <button type="button" className={buttonClass} disabled={!canUndo(history)} onClick={undoChange}>
                {t('canvasUndo')}
              </button>
              <button type="button" className={buttonClass} disabled={!canRedo(history)} onClick={redoChange}>
                {t('canvasRedo')}
              </button>
              <button type="button" className={buttonClass} disabled={selectedCount === 0} onClick={() => deleteElements(selected)}>
                {t('canvasDelete')}
              </button>
            </div>
            <p className="mb-2 text-xs text-text-muted">{t('umlShortcuts')}</p>
          </>
        )}
        <div
          ref={canvasRef}
          // React Flow fills its parent's height, so the parent needs one: fixed when stacked, the free space beside the panel from `md`.
          className={
            compact
              ? 'relative h-[26rem] overflow-hidden rounded border border-border'
              : 'relative h-[26rem] overflow-hidden rounded border border-border md:h-auto md:min-h-0 md:flex-1'
          }
        >
          <RelationMarkers prefix={markers} />
          <ReactFlow
            aria-label={label}
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            colorMode={theme ?? 'dark'}
            onNodesChange={onNodesChange}
            onEdgesChange={(changes) => applySelect(changes, 'relationIds')}
            onDelete={({ nodes: deletedNodes, edges: deletedEdges }) =>
              deleteElements({ classIds: deletedNodes.map((node) => node.id), relationIds: deletedEdges.map((edge) => edge.id) })
            }
            isValidConnection={(connection) => canRelate(historyRef.current.present, connection.source, connection.target)}
            onConnect={(connection) => {
              if (!canRelate(historyRef.current.present, connection.source, connection.target)) return
              commitDesign(relate(historyRef.current.present, connection.source, connection.target, 'association'))
              // Selected at once, so that its kind and multiplicities can be set next.
              setSelection({ ...NO_SELECTION, relationIds: [edgeId(connection.source, connection.target)] })
            }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
            multiSelectionKeyCode={readOnly ? null : 'Shift'}
            selectionKeyCode={readOnly ? null : 'Shift'}
            fitView={fitOnLoad}
            fitViewOptions={{ maxZoom: 1 }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <p className="mt-2 text-xs text-text-muted">{t('umlLegend')}</p>
      </div>

      <aside className={compact ? 'shrink-0' : 'shrink-0 overflow-y-auto md:w-72'}>
        <UmlPanel
          design={design}
          classId={selectedCount === 1 ? selected.classIds[0] : undefined}
          relationId={selectedCount === 1 ? selected.relationIds[0] : undefined}
          selectedCount={selectedCount}
          readOnly={readOnly}
          onCommit={commitDesign}
          onEndEdit={() => change(endMerge(historyRef.current))}
          onSelectRelation={(relationId) => setSelection({ ...NO_SELECTION, relationIds: [relationId] })}
        />
      </aside>
    </div>
  )
}
