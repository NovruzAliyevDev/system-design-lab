import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { tableOfContents } from '../core/content/navigation'
import { isLessonRead } from '../core/progress/reading'
import { catalog } from './catalog'
import { t } from './i18n'
import { useProgress } from './progress/store'
import { ReadMarker } from './ReadMarker'
import { lessonPath, HEADER_PAGES } from './routes'

const toc = tableOfContents(catalog)

// Two levels: top-level entries (pages, single-Lesson groups, group headings) are `text`, and the
// Lessons nested in a group are `text-muted`, indented on a rule.
function lessonLinkClass({ isActive }: { isActive: boolean }, topLevel = false) {
  // 44px rows on a phone, where the drawer is the main navigation.
  return `block min-w-0 flex-1 rounded px-2 py-3 text-sm sm:py-1 ${
    isActive
      ? 'bg-accent/10 font-medium text-accent'
      : `${topLevel ? 'font-medium text-text' : 'text-text-muted hover:text-text'} hover:bg-surface-raised`
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
      {/* Wider screens link these pages from the header. */}
      <ul className="mb-4 xl:hidden">
        {HEADER_PAGES.map(({ to, label }) => (
          <li key={to}>
            <NavLink to={to} className={(state) => lessonLinkClass(state, true)}>
              {t(label)}
            </NavLink>
          </li>
        ))}
      </ul>
      <ol className="space-y-5">
        {toc.map(({ group, lessons, isSingleLesson }) => {
          return (
            <li key={group.id}>
              {!isSingleLesson && (
                <p lang="en" className="px-2 pb-1 text-sm font-semibold text-balance text-text">
                  {group.title}
                </p>
              )}
              {/* Primer titles are English; marking them keeps screen readers right on an Azerbaijani page. */}
              <ol lang="en" className={isSingleLesson ? undefined : 'ml-2 border-l border-border pl-1.5'}>
                {lessons.map((lesson) => (
                  <li key={lesson.id} className="flex items-center gap-1">
                    <NavLink to={lessonPath(lesson.id)} className={(state) => lessonLinkClass(state, isSingleLesson)}>
                      {lesson.title}
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
