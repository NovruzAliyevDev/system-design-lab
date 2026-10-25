import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { findLesson } from '../core/content/catalog'
import { adjacentLessons } from '../core/content/navigation'
import { Attribution } from './Attribution'
import { catalog } from './catalog'
import { t } from './i18n'
import { PrimerMarkdown } from './PrimerMarkdown'

export function LessonPage() {
  const { lessonId = '' } = useParams()
  const { hash } = useLocation()
  const lesson = findLesson(catalog, lessonId)
  const { previous, next } = adjacentLessons(catalog, lessonId)

  // A new Lesson starts at the top, unless the link points at a heading inside it.
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [lessonId, hash])

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

      <div lang="en" className="prose prose-invert mt-8 max-w-none prose-a:text-sky-400 prose-img:mx-auto prose-img:rounded-md prose-img:bg-white prose-img:p-2">
        <PrimerMarkdown lesson={lesson} />
      </div>

      <nav aria-label={t('lessonNavigation')} className="mt-12 grid gap-3 border-t border-zinc-800 pt-6 sm:grid-cols-2">
        {previous && (
          <Link
            to={`/lessons/${previous.id}`}
            rel="prev"
            className="rounded-lg border border-zinc-800 p-4 hover:border-zinc-600"
          >
            <span className="block text-xs text-zinc-500">← {t('previousLesson')}</span>
            <span lang="en" className="text-zinc-100">{previous.title}</span>
          </Link>
        )}
        {next && (
          <Link
            to={`/lessons/${next.id}`}
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
