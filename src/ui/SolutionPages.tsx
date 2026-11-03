import { Link, useParams } from 'react-router-dom'
import { findSolution } from '../core/content/catalog'
import { Attribution } from './Attribution'
import { catalog } from './catalog'
import { t } from './i18n'
import { PRIMER_PROSE_CLASS, PrimerMarkdown } from './PrimerMarkdown'
import { challengePath, SOLUTIONS_ROUTE, solutionPath } from './routes'
import { useScrollToHash } from './useScrollToHash'

/** The solution write-ups of the primer's system design questions, in primer order. */
export function SolutionsPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-text">{t('solutionsTitle')}</h1>
      <p className="mt-1 text-sm text-text-muted">{t('solutionsDescription', { count: catalog.solutions.length })}</p>
      <ol className="mt-6 divide-y divide-border/60 rounded-lg border border-border">
        {catalog.solutions.map((solution, i) => {
          const challenge = challengeOf(solution.id)
          return (
            <li key={solution.id} className="flex flex-col sm:flex-row">
              <Link
                to={solutionPath(solution.id)}
                className="flex flex-1 items-baseline gap-3 px-4 py-2.5 hover:bg-surface-raised focus-visible:-outline-offset-2"
              >
                <span aria-hidden className="w-8 shrink-0 text-right font-mono text-xs text-text-muted">{i + 1}</span>
                <span lang="en" className="text-text">{solution.title}</span>
              </Link>
              {/* On a phone the link goes under the title, lined up with it, so the title keeps the row's width. */}
              {challenge && (
                <Link to={challengePath(challenge.id)} className="link flex min-h-11 shrink-0 items-center pr-4 pl-15 text-sm focus-visible:-outline-offset-2 sm:min-h-0 sm:pl-4">
                  {t('challengeSolve')}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function SolutionPage() {
  const { solutionId = '' } = useParams()
  const solution = findSolution(catalog, solutionId)
  const challenge = challengeOf(solutionId)

  useScrollToHash()

  if (!solution) return <p className="text-text-muted">{t('solutionNotFound')}</p>

  return (
    <article>
      <p className="text-sm">
        <Link to={SOLUTIONS_ROUTE} className="link">
          ← {t('allSolutions')}
        </Link>
      </p>
      <h1 lang="en" className="mt-2 text-3xl font-semibold text-balance text-text">
        {solution.title}
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        <a href={solution.sourceUrl} target="_blank" rel="noopener noreferrer" className="link">
          {t('viewSource')}
        </a>
        {' · '}
        <Attribution textKey="lessonAttribution" />
      </p>
      {challenge && (
        <p className="mt-4 rounded border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-pretty text-text">
          {t('challengeSolveHint')}{' '}
          <Link to={challengePath(challenge.id)} className="link">
            {t('challengeSolve')} →
          </Link>
        </p>
      )}
      <div lang="en" className={`${PRIMER_PROSE_CLASS} mt-8`}>
        <PrimerMarkdown text={solution} path={solution.path} />
      </div>
    </article>
  )
}

/** The Challenge that practises a Solution page's question, if one is authored. */
function challengeOf(solutionId: string) {
  return catalog.challenges.find((challenge) => challenge.solutionId === solutionId)
}
