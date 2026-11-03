import { Link } from 'react-router-dom'
import { catalog } from './catalog'
import { t } from './i18n'
import { lessonPath } from './routes'

export function LessonList() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-text">{t('lessonsTitle')}</h1>
      <p className="mt-1 text-sm text-text-muted">{t('lessonCount', { count: catalog.lessons.length })}</p>
      <ol className="mt-6 divide-y divide-border/60 rounded-lg border border-border">
        {catalog.lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              to={lessonPath(lesson.id)}
              className="flex items-baseline gap-3 px-4 py-2.5 hover:bg-surface-raised focus-visible:-outline-offset-2"
            >
              <span aria-hidden className="w-8 shrink-0 text-right font-mono text-xs text-text-muted">{lesson.order + 1}</span>
              <span lang="en" className="text-text">{lesson.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
