import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react'
import { componentDefinition, PALETTE, type ComponentType } from '../../core/design/components'
import { catalog } from '../catalog'
import { t } from '../i18n'
import { COMPONENT_TAGS, componentName } from './componentText'

/** The drag data type of a palette component being dropped on the canvas. */
export const COMPONENT_DRAG_TYPE = 'application/x-system-design-lab-component'

/** Glossary Terms by id; the Content Pipeline makes sure every palette component has one. */
const TERMS = new Map(catalog.glossary.map((term) => [term.id, term]))

/** Space between a palette item and its tooltip, and the least kept to the viewport edges. */
const GAP = 8
const MARGIN = 8

/** The Component Palette: components to drag onto the canvas or click to add, each with its Glossary explanation as a tooltip. */
export function Palette({ onAdd }: { onAdd: (componentType: ComponentType) => void }) {
  return (
    <nav aria-label={t('paletteTitle')} className="shrink-0 overflow-y-auto md:w-48">
      <h2 className="text-sm font-semibold text-text">{t('paletteTitle')}</h2>
      <ul className="mt-2 space-y-1">
        {PALETTE.map((componentType) => (
          <PaletteItem key={componentType} componentType={componentType} onAdd={onAdd} />
        ))}
      </ul>
    </nav>
  )
}

function PaletteItem({ componentType, onAdd }: { componentType: ComponentType; onAdd: (componentType: ComponentType) => void }) {
  const term = TERMS.get(componentDefinition(componentType).glossaryTermId)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipId = useId()

  function hide() {
    setOpen(false)
    setPosition(undefined)
  }

  // The tooltip is fixed to the viewport beside the item: to its right, or to its left when there is
  // no room, and moved up when it would run off the bottom.
  useLayoutEffect(() => {
    if (!open) return
    const button = buttonRef.current
    const tooltip = tooltipRef.current
    if (!button || !tooltip) return
    const anchor = button.getBoundingClientRect()
    const { clientWidth, clientHeight } = document.documentElement
    const right = anchor.right + GAP
    const left = right + tooltip.offsetWidth <= clientWidth - MARGIN ? right : Math.max(MARGIN, anchor.left - GAP - tooltip.offsetWidth)
    const top = Math.max(MARGIN, Math.min(anchor.top, clientHeight - MARGIN - tooltip.offsetHeight))
    setPosition({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Touch has no hover: a tap adds the component instead.
  const onPointerEnter = (event: PointerEvent) => event.pointerType === 'mouse' && setOpen(true)
  const onFocus = (event: FocusEvent) => event.target.matches(':focus-visible') && setOpen(true)

  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        draggable
        onDragStart={(event) => {
          hide()
          event.dataTransfer.setData(COMPONENT_DRAG_TYPE, componentType)
          event.dataTransfer.effectAllowed = 'copy'
        }}
        onClick={() => onAdd(componentType)}
        onPointerEnter={onPointerEnter}
        onPointerLeave={hide}
        onFocus={onFocus}
        onBlur={hide}
        aria-label={t('paletteAdd', { component: componentName(componentType) })}
        aria-describedby={open && term ? tooltipId : undefined}
        className="flex w-full cursor-grab items-baseline gap-2 rounded border border-border bg-surface-raised px-2 py-1 text-left text-xs text-text hover:border-text-muted"
      >
        <span className="w-10 shrink-0 font-mono text-[10px] text-text-muted">{COMPONENT_TAGS[componentType]}</span>
        {componentName(componentType)}
      </button>
      {open && term && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          lang="az"
          className="pointer-events-none fixed z-40 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface-raised p-3 text-left text-sm text-text shadow-xl"
          style={position ?? { top: 0, left: 0, visibility: 'hidden' }}
        >
          <span lang="en" className="block font-semibold text-text">
            {term.term}
          </span>
          <span className="mt-1 block">{term.explanation}</span>
        </div>
      )}
    </li>
  )
}
