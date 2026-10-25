import { Link } from 'react-router-dom'
import { catalog } from './catalog'
import { t } from './i18n'
import { lessonPath } from './routes'

export function LessonList() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-zinc-50">{t('lessonsTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t('lessonCount', { count: catalog.lessons.length })}</p>
      <ol className="mt-6 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {catalog.lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              to={lessonPath(lesson.id)}
              className="flex items-baseline gap-3 px-4 py-2.5 hover:bg-zinc-900 focus-visible:bg-zinc-900 focus-visible:outline-none"
            >
              <span aria-hidden className="w-8 shrink-0 text-right font-mono text-xs text-zinc-500">{lesson.order + 1}</span>
              <span lang="en" className="text-zinc-100">{lesson.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
