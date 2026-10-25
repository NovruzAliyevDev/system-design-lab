import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Every navigation starts at the top of the page, unless it points at an element on it.
 * Keyed on the location, so following the same anchor link again scrolls again.
 */
export function useScrollToHash() {
  const { hash, key } = useLocation()
  useEffect(() => {
    const target = hash ? document.getElementById(safeDecode(hash.slice(1))) : null
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [key, hash])
}

function safeDecode(fragment: string): string {
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
}
