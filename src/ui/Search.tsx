import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadSearchIndex, search, type Highlight, type SearchIndex, type SearchResult, type SerializedSearchIndex } from '../core/search/search'
import { t } from './i18n'
import { challengePath, glossaryPath, lessonPath } from './routes'

/** The index is loaded on the first search only, so it stays out of the app bundle. */
let indexPromise: Promise<SearchIndex> | undefined
function loadIndex(): Promise<SearchIndex> {
  if (!indexPromise) {
    indexPromise = import('../generated/search-index.json').then((module) =>
      loadSearchIndex(module.default as unknown as SerializedSearchIndex),
    )
    // A failed load (e.g. offline before the chunk was cached) is retried on the next search.
    indexPromise.catch(() => (indexPromise = undefined))
  }
  return indexPromise
}

/** Where a result leads, what is shown next to its title, and the languages of its title and text. */
function resultDetails(result: SearchResult): { path: string; context: string; titleLang: string; contextLang: string; textLang: string } {
  switch (result.kind) {
    case 'lesson':
      return { path: lessonPath(result.id), context: result.context, titleLang: 'en', contextLang: 'en', textLang: 'en' }
    case 'glossary':
      // A Glossary Term's explanation is Azerbaijani.
      return { path: glossaryPath(result.id), context: t('glossaryTitle'), titleLang: 'en', contextLang: 'az', textLang: 'az' }
    case 'challenge':
      // A Challenge's title and Stage tasks are Azerbaijani.
      return { path: challengePath(result.id), context: t('challengeSearchContext'), titleLang: 'az', contextLang: 'az', textLang: 'az' }
  }
}

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)

function isSearchShortcut(event: KeyboardEvent): boolean {
  // `code` keeps the shortcut on the K key whatever the keyboard layout.
  return (isMac ? event.metaKey : event.ctrlKey) && !event.altKey && !event.shiftKey && event.code === 'KeyK'
}

/** The header's search button and the Ctrl/Cmd+K shortcut, which work on every page. */
export function Search() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event)) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 rounded border border-zinc-700 px-2 py-0.5 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-100"
        aria-label={t('search')}
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        onClick={() => setOpen(true)}
      >
        {/* On a phone the header has room for the icon only. */}
        <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 sm:hidden">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4.5 4.5" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">{t('search')}</span>
        <kbd aria-hidden className="hidden font-sans text-xs text-zinc-500 sm:inline">
          {t(isMac ? 'searchShortcutMac' : 'searchShortcut')}
        </kbd>
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  )
}

type IndexState = { status: 'loading' } | { status: 'ready'; index: SearchIndex } | { status: 'failed' }

function SearchDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  const [indexState, setIndexState] = useState<IndexState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    dialogRef.current?.showModal()
    let current = true
    loadIndex().then(
      (index) => current && setIndexState({ status: 'ready', index }),
      () => current && setIndexState({ status: 'failed' }),
    )
    return () => {
      current = false
    }
  }, [])

  const results = useMemo(
    () => (indexState.status === 'ready' ? search(indexState.index, query) : []),
    [indexState, query],
  )

  // Keep the chosen result in view while moving through a long list with the keyboard.
  useEffect(() => {
    document.getElementById(resultId(activeIndex))?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  /** Closing the dialog natively (its `close` event calls `onClose`) gives focus back to where it was. */
  function close() {
    dialogRef.current?.close()
  }

  function openResult(result: SearchResult) {
    navigate(resultDetails(result).path)
    close()
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    // Enter or an arrow key may belong to an input method still composing a word.
    if (results.length === 0 || event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((activeIndex + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      openResult(results[activeIndex])
    }
  }

  const message = statusMessage(query, indexState, results.length)

  return (
    <dialog
      ref={dialogRef}
      aria-label={t('search')}
      className="m-auto mt-[10vh] flex max-h-[80vh] w-[min(40rem,calc(100%-2rem))] flex-col rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 shadow-2xl backdrop:bg-black/60"
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(event) => event.target === event.currentTarget && close()}
    >
      <input
        type="text"
        role="combobox"
        aria-label={t('search')}
        aria-expanded={results.length > 0}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={results.length > 0 ? resultId(activeIndex) : undefined}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder={t('searchPlaceholder')}
        className="w-full border-b border-zinc-700 bg-transparent px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={onInputKeyDown}
      />
      <ul id="search-results" role="listbox" aria-label={t('searchResults')} className="min-h-0 overflow-y-auto p-2">
        {results.map((result, i) => {
          const { context, titleLang, contextLang, textLang } = resultDetails(result)
          return (
            <li
              key={`${result.kind}:${result.id}`}
              id={resultId(i)}
              role="option"
              aria-selected={i === activeIndex}
              className={`cursor-pointer rounded px-3 py-2 ${i === activeIndex ? 'bg-sky-500/15' : ''}`}
              onMouseMove={() => setActiveIndex(i)}
              onClick={() => openResult(result)}
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span lang={titleLang} className="font-medium text-zinc-50">
                  <Highlighted text={result.title} highlights={result.titleHighlights} />
                </span>
                <span lang={contextLang} className="text-xs text-zinc-500">
                  {context}
                </span>
              </div>
              <p lang={textLang} className="mt-0.5 text-sm text-zinc-400">
                <Highlighted text={result.snippet.text} highlights={result.snippet.highlights} />
              </p>
            </li>
          )
        })}
      </ul>
      {message && (
        <p role="status" className="px-4 pb-3 text-sm text-zinc-500">
          {message}
        </p>
      )}
      <p aria-hidden className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
        {t('searchKeys')}
      </p>
    </dialog>
  )
}

/** What to tell the reader in place of results: a hint, the loading state or that nothing matched. */
function statusMessage(query: string, indexState: IndexState, resultCount: number): string | undefined {
  if (!query.trim()) return t('searchHint')
  if (indexState.status === 'loading') return t('searchLoading')
  if (indexState.status === 'failed') return t('searchLoadFailed')
  if (resultCount === 0) return t('searchNoResults')
  return undefined
}

function resultId(i: number): string {
  return `search-result-${i}`
}

function Highlighted({ text, highlights }: { text: string; highlights: Highlight[] }) {
  const parts = []
  let at = 0
  for (const { start, end } of highlights) {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      <mark key={start} className="rounded-sm bg-amber-400/25 text-inherit">
        {text.slice(start, end)}
      </mark>,
    )
    at = end
  }
  parts.push(text.slice(at))
  return <>{parts}</>
}
