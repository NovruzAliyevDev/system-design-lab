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
      <h1 className="text-2xl font-semibold text-text">{t('glossaryTitle')}</h1>
      <p className="mt-1 text-sm text-text-muted">{t('glossaryDescription', { count: catalog.glossary.length })}</p>
      <dl className="mt-6 divide-y divide-border/60 rounded-lg border border-border">
        {catalog.glossary.map((term) => (
          // A link from a tooltip or from search lands on the term and highlights it.
          <div key={term.id} id={term.id} className="scroll-mt-16 px-4 py-3 target:bg-accent/10 target:ring-1 target:ring-accent target:ring-inset">
            <dt lang="en" className="font-medium text-text">
              {term.term}
            </dt>
            {term.aliases.length > 0 && (
              <dd className="text-xs text-text-muted">
                {t('glossaryAliases')} <span lang="en">{term.aliases.join(', ')}</span>
              </dd>
            )}
            <dd className="mt-1 max-w-prose text-pretty text-text">{term.explanation}</dd>
            <dd className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <span className="text-text-muted">{t('glossaryLessons')}</span>
              {term.lessonIds.map((lessonId) => (
                <Link key={lessonId} to={lessonPath(lessonId)} lang="en" className="link">
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
