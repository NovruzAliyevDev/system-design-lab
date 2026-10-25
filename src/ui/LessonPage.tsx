import { useEffect, useRef, type RefObject } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { findLesson } from '../core/content/catalog'
import { adjacentLessons } from '../core/content/navigation'
import { isLessonRead } from '../core/progress/reading'
import { Attribution } from './Attribution'
import { catalog } from './catalog'
import { t } from './i18n'
import { PrimerMarkdown } from './PrimerMarkdown'
import { useProgress } from './progress/store'
import { ReadMarker } from './ReadMarker'
import { lessonPath } from './routes'

export function LessonPage() {
  const { lessonId = '' } = useParams()
  const { hash, key } = useLocation()
  const lesson = findLesson(catalog, lessonId)
  const { previous, next } = adjacentLessons(catalog, lessonId)
  const { progress, markRead, markUnread } = useProgress()
  const isRead = progress ? isLessonRead(progress.reading, lessonId) : undefined
  const endRef = useRef<HTMLDivElement>(null)
  const autoMark = useMarkReadAtEnd(lesson ? lessonId : undefined, isRead === false, endRef, markRead)

  // Every navigation starts at the top of the Lesson, unless it points at a heading inside it.
  // Keyed on the location, so following the same anchor link again scrolls again.
  useEffect(() => {
    const target = hash ? document.getElementById(safeDecode(hash.slice(1))) : null
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [key, hash])

  if (!lesson) return <p className="text-zinc-400">{t('lessonNotFound')}</p>

  return (
    <article>
      <h1 lang="en" className="text-3xl font-semibold text-zinc-50">
        {lesson.title}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        <a href={lesson.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
          {t('viewSource')}
        </a>
        {' · '}
        <Attribution textKey="lessonAttribution" />
      </p>
      {isRead !== undefined && (
        <p className="mt-4 flex items-center gap-2 text-sm">
          {isRead && <ReadMarker />}
          <button
            type="button"
            aria-pressed={isRead}
            className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:border-zinc-500"
            onClick={() => {
              // A choice made by hand wins over marking at the end for the rest of this visit.
              autoMark.cancel()
              void (isRead ? markUnread(lesson.id) : markRead(lesson.id))
            }}
          >
            {isRead ? t('markAsUnread') : t('markAsRead')}
          </button>
        </p>
      )}

      <div lang="en" className="prose dark:prose-invert mt-8 max-w-none prose-a:text-sky-400 prose-img:mx-auto prose-img:rounded-md prose-img:bg-white prose-img:p-2">
        <PrimerMarkdown lesson={lesson} />
      </div>
      <div ref={endRef} aria-hidden />

      <nav aria-label={t('lessonNavigation')} className="mt-12 grid gap-3 border-t border-zinc-800 pt-6 sm:grid-cols-2">
        {previous && (
          <Link
            to={lessonPath(previous.id)}
            rel="prev"
            className="rounded-lg border border-zinc-800 p-4 hover:border-zinc-600"
          >
            <span className="block text-xs text-zinc-500">← {t('previousLesson')}</span>
            <span lang="en" className="text-zinc-100">{previous.title}</span>
          </Link>
        )}
        {next && (
          <Link
            to={lessonPath(next.id)}
            rel="next"
            className="rounded-lg border border-zinc-800 p-4 text-right hover:border-zinc-600 sm:col-start-2"
          >
            <span className="block text-xs text-zinc-500">{t('nextLesson')} →</span>
            <span lang="en" className="text-zinc-100">{next.title}</span>
          </Link>
        )}
      </nav>
    </article>
  )
}

/**
 * Marks the Lesson read once its end comes into view, at most once per visit.
 * Returns a handle to stop that for the rest of the visit.
 */
function useMarkReadAtEnd(
  lessonId: string | undefined,
  enabled: boolean,
  endRef: RefObject<HTMLElement | null>,
  markRead: (lessonId: string) => Promise<void>,
): { cancel(): void } {
  const armedRef = useRef(true)
  useEffect(() => {
    armedRef.current = true
  }, [lessonId])

  useEffect(() => {
    const end = endRef.current
    if (!lessonId || !enabled || !end) return
    let active = true
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || !armedRef.current) return
      // Images that are still loading take no space yet, so the end can look reached when it is not.
      // Decide once they have loaded; if they push the end out of view, it is observed coming back.
      void imagesLoaded(end.parentElement ?? end).then(() => {
        if (!active || !armedRef.current || end.getBoundingClientRect().top > window.innerHeight) return
        armedRef.current = false
        void markRead(lessonId)
      })
    })
    observer.observe(end)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [lessonId, enabled, endRef, markRead])

  return { cancel: () => (armedRef.current = false) }
}

function imagesLoaded(container: Element): Promise<unknown> {
  const loading = [...container.querySelectorAll('img')].filter((img) => !img.complete)
  return Promise.all(
    loading.map(
      (img) =>
        new Promise((resolve) => {
          // A broken image settles too; it just shows as broken.
          img.addEventListener('load', resolve, { once: true })
          img.addEventListener('error', resolve, { once: true })
        }),
    ),
  )
}

function safeDecode(fragment: string): string {
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
}
