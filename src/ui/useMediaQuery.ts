import { useSyncExternalStore } from 'react'

/** Tailwind's `md`: below it canvases are read-only. */
export const TABLET_QUERY = '(min-width: 48rem)'

/** Whether a CSS media query matches, updated as the window changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
