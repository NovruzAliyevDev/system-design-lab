import { Link } from 'react-router-dom'
import { findLesson } from '../core/content/catalog'
import { catalog } from './catalog'
import { t } from './i18n'
import { lessonPath } from './routes'
import { useScrollToHash } from './useScrollToHash'

/** Every Glossary Term in alphabetical order, with its explanation and the Lessons about it. */
export function GlossaryPage() {
  useScrollToHash()

  return (
    <section>
      <h1 className="text-2xl font-semibold text-zinc-50">{t('glossaryTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t('glossaryDescription', { count: catalog.glossary.length })}</p>
      <dl className="mt-6 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {catalog.glossary.map((term) => (
          // A link from a tooltip or from search lands on the term and highlights it.
          <div key={term.id} id={term.id} className="scroll-mt-16 px-4 py-3 target:bg-sky-500/10">
            <dt lang="en" className="font-medium text-zinc-50">
              {term.term}
            </dt>
            {term.aliases.length > 0 && (
              <dd className="text-xs text-zinc-500">
                {t('glossaryAliases')} <span lang="en">{term.aliases.join(', ')}</span>
              </dd>
            )}
            <dd className="mt-1 text-zinc-300">{term.explanation}</dd>
            <dd className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <span className="text-zinc-500">{t('glossaryLessons')}</span>
              {term.lessonIds.map((lessonId) => (
                <Link key={lessonId} to={lessonPath(lessonId)} lang="en" className="text-sky-400 hover:underline">
                  {findLesson(catalog, lessonId)?.title ?? lessonId}
                </Link>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
