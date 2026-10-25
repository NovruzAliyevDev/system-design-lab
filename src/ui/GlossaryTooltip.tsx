import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { GlossaryTerm } from '../core/glossary/glossary'
import { t } from './i18n'
import { glossaryPath } from './routes'

/** Distance between the term and its tooltip, and the least space kept to the viewport edges. */
const GAP = 6
const MARGIN = 8
/** Time to move the mouse from the term onto its tooltip before it closes. */
const CLOSE_DELAY_MS = 150

/**
 * A term in Lesson text with its Glossary explanation. The mouse opens it on hover; a click or tap
 * keeps it open until it is clicked again, Esc is pressed or the reader clicks elsewhere.
 */
export function GlossaryTooltip({ term, children }: { term: GlossaryTerm; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<number>(undefined)
  const popupId = useId()

  /** Whether `node` is the term or inside its tooltip. */
  function isInside(node: unknown): boolean {
    return node instanceof Node && !!(buttonRef.current?.contains(node) || popupRef.current?.contains(node))
  }

  function show(pin: boolean) {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
    if (pin) setPinned(true)
  }

  function hide() {
    window.clearTimeout(closeTimer.current)
    setOpen(false)
    setPinned(false)
    setPosition(undefined)
  }

  // Touch has no hover: a tap is a click.
  function onPointerEnter(event: PointerEvent) {
    if (event.pointerType === 'mouse') show(false)
  }
  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType === 'mouse' && !pinned) closeTimer.current = window.setTimeout(hide, CLOSE_DELAY_MS)
  }
  function onBlur(event: FocusEvent) {
    if (pinned && !isInside(event.relatedTarget)) hide()
  }

  // The tooltip is fixed to the viewport, so a table that scrolls sideways cannot clip it.
  // It sits below the term, or above it when there is no room below, and stays inside the viewport.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const button = buttonRef.current
      const popup = popupRef.current
      if (!button || !popup) return
      const anchor = button.getBoundingClientRect()
      const { clientWidth, clientHeight } = document.documentElement
      const left = Math.max(MARGIN, Math.min(anchor.left, clientWidth - popup.offsetWidth - MARGIN))
      const above = anchor.top - GAP - popup.offsetHeight
      const fitsBelow = anchor.bottom + GAP + popup.offsetHeight <= clientHeight - MARGIN
      setPosition({ top: fitsBelow || above < MARGIN ? anchor.bottom + GAP : above, left })
    }
    place()
    window.addEventListener('scroll', place, { capture: true, passive: true })
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, { capture: true })
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!isInside(event.target)) hide()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (popupRef.current?.contains(document.activeElement)) buttonRef.current?.focus()
      hide()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  return (
    <span onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        className="cursor-help underline decoration-zinc-500 decoration-dotted underline-offset-4 hover:decoration-sky-400"
        onClick={() => (open && pinned ? hide() : show(true))}
      >
        {children}
      </button>
      {open && (
        <span
          ref={popupRef}
          id={popupId}
          lang="az"
          className="not-prose fixed z-40 block w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-left text-sm font-normal text-zinc-300 shadow-xl"
          style={position ?? { top: 0, left: 0, visibility: 'hidden' }}
        >
          <span lang="en" className="block font-semibold text-zinc-50">
            {term.term}
          </span>
          <span className="mt-1 block">{term.explanation}</span>
          <Link to={glossaryPath(term.id)} className="mt-2 inline-block text-sky-400 hover:underline">
            {t('glossaryOpenEntry')}
          </Link>
        </span>
      )}
    </span>
  )
}
