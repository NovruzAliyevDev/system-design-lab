import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { Link, useParams } from 'react-router-dom'
import { calculatorsOfLesson } from '../core/content/calculator-lessons'
import { findLesson } from '../core/content/catalog'
import { adjacentLessons } from '../core/content/navigation'
import { selectCards } from '../core/flashcards/deck'
import { isLessonRead } from '../core/progress/reading'
import { findLessonQuiz } from '../core/quizzes/quiz'
import { appendixTablesOf } from './AppendixTables'
import { Attribution } from './Attribution'
import { CalculatorLinks } from './CalculatorsPage'
import { LessonQuiz } from './LessonQuiz'
import { catalog } from './catalog'
import { LessonText } from './concept-simulations/LessonText'
import { t } from './i18n'
import { useOpened, useProgress } from './progress/store'
import { ReadMarker } from './ReadMarker'
import { flashcardsPath, lessonPath } from './routes'
import { useScrollToHash } from './useScrollToHash'

export function LessonPage() {
  const { lessonId = '' } = useParams()
  const lesson = findLesson(catalog, lessonId)
  const { previous, next } = adjacentLessons(catalog, lessonId)
  const { progress, markRead, markUnread } = useProgress()
  const isRead = progress ? isLessonRead(progress.reading, lessonId) : undefined
  const endRef = useRef<HTMLDivElement>(null)
  const autoMark = useMarkReadAtEnd(lesson ? lessonId : undefined, isRead === false, endRef, markRead)
  const appendixTables = useMemo(() => lesson && appendixTablesOf(lesson), [lesson])
  const cardCount = useMemo(() => selectCards(catalog.decks, { kind: 'lesson', lessonId }).length, [lessonId])
  const quiz = findLessonQuiz(catalog.quizzes, lessonId)

  useScrollToHash()
  useOpened(lesson && { kind: 'lesson', lessonId: lesson.id })

  if (!lesson) return <p className="text-text-muted">{t('lessonNotFound')}</p>

  return (
    <article>
      <h1 lang="en" className="text-3xl font-semibold text-balance text-text">
        {lesson.title}
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        <a href={lesson.sourceUrl} target="_blank" rel="noopener noreferrer" className="link">
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
            className="min-h-11 rounded border border-border px-3 hover:border-text-muted sm:min-h-8"
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

      {cardCount > 0 && (
        <p className="mt-2 text-sm">
          <Link to={flashcardsPath({ kind: 'lesson', lessonId })} className="link">
            {t('studyLessonCards', { count: cardCount })}
          </Link>
        </p>
      )}

      <CalculatorLinks calculators={calculatorsOfLesson(lessonId)} />

      <LessonText lesson={lesson} codeBlocks={appendixTables} />
      <div ref={endRef} aria-hidden />

      {quiz && progress && <LessonQuiz key={quiz.id} quiz={quiz} />}

      <nav aria-label={t('lessonNavigation')} className="mt-12 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
        {previous && (
          <Link
            to={lessonPath(previous.id)}
            rel="prev"
            className="rounded-lg border border-border p-4 hover:border-text-muted"
          >
            <span className="block text-xs text-text-muted">← {t('previousLesson')}</span>
            <span lang="en" className="text-text">{previous.title}</span>
          </Link>
        )}
        {next && (
          <Link
            to={lessonPath(next.id)}
            rel="next"
            className="rounded-lg border border-border p-4 text-right hover:border-text-muted sm:col-start-2"
          >
            <span className="block text-xs text-text-muted">{t('nextLesson')} →</span>
            <span lang="en" className="text-text">{next.title}</span>
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
      // The root reaches far above the viewport, so an end jumped past (to a Quiz below it) counts as reached.
    }, { rootMargin: '1000000px 0px 0px 0px' })
    observer.observe(end)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [lessonId, enabled, endRef, markRead])

  return { cancel: () => (armedRef.current = false) }
}

/**
 * Waits for the images in view that are still loading. Images out of view are left out: they are lazy, so
 * the ones skipped over on a jump to the end would never load, and they cannot push the end out of view anyway.
 */
function imagesLoaded(container: Element): Promise<unknown> {
  const loading = [...container.querySelectorAll('img')].filter((img) => !img.complete && isInView(img))
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

function isInView(element: Element): boolean {
  const { top, bottom } = element.getBoundingClientRect()
  return bottom >= 0 && top <= window.innerHeight
}
