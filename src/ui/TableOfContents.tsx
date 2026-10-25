import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { tableOfContents } from '../core/content/navigation'
import { isLessonRead } from '../core/progress/reading'
import { catalog } from './catalog'
import { t } from './i18n'
import { useProgress } from './progress/store'
import { ReadMarker } from './ReadMarker'
import { lessonPath } from './routes'

const toc = tableOfContents(catalog)

function lessonLinkClass({ isActive }: { isActive: boolean }) {
  return `block min-w-0 flex-1 rounded px-2 py-1 text-sm ${
    isActive ? 'bg-sky-500/15 font-medium text-sky-300' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
  }`
}

export function TableOfContents({ currentLessonId }: { currentLessonId?: string }) {
  const navRef = useRef<HTMLElement>(null)
  const progress = useProgress((state) => state.progress)

  // Keep the current Lesson visible in a long sidebar.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' })
  }, [currentLessonId])

  return (
    <nav ref={navRef} aria-label={t('tableOfContents')}>
      <ol className="space-y-4">
        {toc.map(({ group, lessons, isSingleLesson }) => {
          return (
            <li key={group.id}>
              {!isSingleLesson && (
                <p lang="en" className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {group.title}
                </p>
              )}
              {/* Primer titles are English; marking them keeps upper-casing and screen readers right on an Azerbaijani page. */}
              <ol lang="en">
                {lessons.map((lesson) => (
                  <li key={lesson.id} className="flex items-center gap-1">
                    <NavLink to={lessonPath(lesson.id)} className={lessonLinkClass}>
                      {isSingleLesson ? <span className="font-medium">{lesson.title}</span> : lesson.title}
                    </NavLink>
                    {progress && isLessonRead(progress.reading, lesson.id) && <ReadMarker />}
                  </li>
                ))}
              </ol>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
