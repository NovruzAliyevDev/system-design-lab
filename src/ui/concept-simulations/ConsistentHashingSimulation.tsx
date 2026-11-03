import { useId, useMemo, useState } from 'react'
import { generateKeys, rebalance, RING_SIZE, type KeyPlacement, type RingPoint } from '../../core/concept-simulations/consistent-hashing'
import { formatDecimal, t } from '../i18n'
import { Control, seriesColor, ShareBars, SimulationFrame } from './shared'

// The consistent hashing Concept Simulation: the ring and modulo hashing side by side, with the keys the
// last change of nodes moved lit up.

/** The nodes' names, also their ids on the ring; a node's colour is its name's slot, so it keeps it when others come and go. */
const NODE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const KEY_COUNT = 500
/** The keys stay the same, so changes of nodes are compared on the same data. */
const KEYS = generateKeys(KEY_COUNT, 1)
const MAX_VIRTUAL_NODES = 200

/** The last change of nodes: the nodes before it, and the node added or removed. */
interface Change {
  before: string[]
  kind: 'added' | 'removed'
  name: string
}

const colorOf = (name: string | undefined) => seriesColor(Math.max(0, NODE_NAMES.indexOf(name ?? '')))

/** Keys the last change moved stand out; the rest fade. With no change yet, every key shows alike. */
const keyOpacity = (highlight: boolean, moved: boolean) => (!highlight ? 0.85 : moved ? 1 : 0.18)

export function ConsistentHashingSimulation() {
  const [nodes, setNodes] = useState(['A', 'B', 'C', 'D'])
  const [change, setChange] = useState<Change>()
  const [virtualNodes, setVirtualNodes] = useState(50)
  const result = useMemo(
    () => rebalance({ keys: KEYS, before: change?.before ?? nodes, after: nodes, virtualNodes }),
    [nodes, change, virtualNodes],
  )
  const virtualNodesId = useId()

  const add = () => {
    const name = NODE_NAMES.find((candidate) => !nodes.includes(candidate))
    if (!name) return
    setChange({ before: nodes, kind: 'added', name })
    setNodes(NODE_NAMES.filter((candidate) => candidate === name || nodes.includes(candidate)))
  }
  const remove = (name: string) => {
    setChange({ before: nodes, kind: 'removed', name })
    setNodes(nodes.filter((candidate) => candidate !== name))
  }

  return (
    <SimulationFrame title={t('consistentHashingTitle')} description={t('consistentHashingDescription')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Control label={t('consistentHashingNodes')} hint={t('consistentHashingNodesHint')}>
          <ul className="flex flex-wrap gap-2">
            {nodes.map((name) => (
              <li key={name} className="flex items-center gap-1.5 rounded border border-border py-0.5 pr-1 pl-2 text-sm text-text">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: colorOf(name) }} />
                {t('consistentHashingNodeName', { name })}
                <button
                  type="button"
                  disabled={nodes.length <= 1}
                  aria-label={t('consistentHashingRemoveNode', { name })}
                  onClick={() => remove(name)}
                  className="min-h-11 min-w-11 rounded text-text-muted hover:text-text disabled:opacity-30 sm:min-h-6 sm:min-w-6"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={nodes.length >= NODE_NAMES.length}
            onClick={add}
            className="mt-2 min-h-11 rounded border border-accent px-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-50 sm:min-h-8"
          >
            + {t('consistentHashingAddNode')}
          </button>
        </Control>

        <Control label={t('consistentHashingVirtualNodes')} hint={t('consistentHashingVirtualNodesHint')} labelId={virtualNodesId}>
          <input
            type="range"
            min={1}
            max={MAX_VIRTUAL_NODES}
            value={virtualNodes}
            aria-labelledby={virtualNodesId}
            onChange={(event) => setVirtualNodes(Number(event.target.value))}
            className="w-full"
          />
          <p className="text-sm text-text">{t('consistentHashingVirtualNodesValue', { count: virtualNodes })}</p>
        </Control>
      </div>

      <p className="mt-4 text-sm text-text" aria-live="polite">
        {change
          ? t(change.kind === 'added' ? 'consistentHashingLastChangeAdded' : 'consistentHashingLastChangeRemoved', {
              name: change.name,
              before: change.before.length,
              after: nodes.length,
            })
          : t('consistentHashingNoChange')}
        {change && ` ${t('consistentHashingMovedHint')}`}
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <figure>
          <figcaption className="text-sm font-medium text-text">{t('consistentHashingRingTitle')}</figcaption>
          {change && <MovedCount moved={result.ringMoved} idealShare={result.idealShare} />}
          <Ring keys={result.keys} points={result.ring} highlight={change !== undefined} />
          <p className="text-xs text-text-muted">{t('consistentHashingRingHint')}</p>
        </figure>
        <figure>
          <figcaption className="text-sm font-medium text-text">{t('consistentHashingModuloTitle')}</figcaption>
          {change && <MovedCount moved={result.moduloMoved} idealShare={result.idealShare} />}
          <ModuloGrid keys={result.keys} highlight={change !== undefined} />
          <p className="mt-2 text-xs text-text-muted">{t('consistentHashingModuloHint')}</p>
        </figure>
      </div>

      <KeysPerNode keysPerNode={result.keysPerNode} />
    </SimulationFrame>
  )
}

function MovedCount({ moved, idealShare }: { moved: number; idealShare: number }) {
  return (
    <div className="mt-1">
      <p className="text-lg font-semibold text-text tabular-nums">
        {t('consistentHashingMoved', { count: moved, percent: formatDecimal((moved / KEY_COUNT) * 100) })}
      </p>
      <p className="text-xs text-text-muted">{t('consistentHashingIdeal', { percent: formatDecimal(idealShare * 100) })}</p>
    </div>
  )
}

const RING = { size: 300, radius: 130, keysFrom: 70, keysTo: 116 }

/** The ring: each node's points as ticks on the circle, each key a dot inside at its angle, coloured by its node. */
function Ring({ keys, points, highlight }: { keys: KeyPlacement[]; points: RingPoint[]; highlight: boolean }) {
  const center = RING.size / 2
  const at = (position: number, radius: number) => {
    const angle = (position / RING_SIZE) * 2 * Math.PI - Math.PI / 2
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }
  }
  return (
    <svg viewBox={`0 0 ${RING.size} ${RING.size}`} className="mx-auto mt-2 w-full max-w-xs" role="img" aria-label={t('consistentHashingRingTitle')}>
      <circle cx={center} cy={center} r={RING.radius} fill="none" className="stroke-border" strokeWidth={1} />
      {points.map((point, i) => {
        const inner = at(point.position, RING.radius - 6)
        const outer = at(point.position, RING.radius + 6)
        return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={colorOf(point.nodeId)} strokeWidth={2} />
      })}
      {keys.map((key) => {
        // Spread the dots between two radii by the key's low bits, so keys at close angles stay apart.
        const { x, y } = at(key.position, RING.keysFrom + ((key.position & 0xff) / 0xff) * (RING.keysTo - RING.keysFrom))
        return (
          <circle
            key={key.key}
            cx={x}
            cy={y}
            r={highlight && key.ring.moved ? 3 : 2}
            fill={colorOf(key.ring.after)}
            opacity={keyOpacity(highlight, key.ring.moved)}
          />
        )
      })}
    </svg>
  )
}

const GRID_COLUMNS = 25

/** The same keys in a grid, coloured by their node under modulo hashing. */
function ModuloGrid({ keys, highlight }: { keys: KeyPlacement[]; highlight: boolean }) {
  const cell = 12
  const rows = Math.ceil(keys.length / GRID_COLUMNS)
  return (
    <svg viewBox={`0 0 ${GRID_COLUMNS * cell} ${rows * cell}`} className="mx-auto mt-2 w-full max-w-xs" role="img" aria-label={t('consistentHashingModuloTitle')}>
      {keys.map((key, i) => (
        <rect
          key={key.key}
          x={(i % GRID_COLUMNS) * cell + 1}
          y={Math.floor(i / GRID_COLUMNS) * cell + 1}
          width={cell - 2}
          height={cell - 2}
          rx={2}
          fill={colorOf(key.modulo.after)}
          opacity={keyOpacity(highlight, key.modulo.moved)}
        />
      ))}
    </svg>
  )
}

function KeysPerNode({ keysPerNode }: { keysPerNode: Record<string, number> }) {
  return (
    <div className="mt-6">
      <ShareBars
        title={t('consistentHashingKeysPerNodeTitle')}
        valueKey="consistentHashingKeysPerNodeValue"
        bars={Object.entries(keysPerNode).map(([name, count]) => ({ key: name, label: t('consistentHashingNodeName', { name }), count, color: colorOf(name) }))}
      />
    </div>
  )
}
