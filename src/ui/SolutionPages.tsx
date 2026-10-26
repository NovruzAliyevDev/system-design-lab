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
      <h1 className="text-2xl font-semibold text-zinc-50">{t('solutionsTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t('solutionsDescription', { count: catalog.solutions.length })}</p>
      <ol className="mt-6 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {catalog.solutions.map((solution, i) => {
          const challenge = challengeOf(solution.id)
          return (
            <li key={solution.id} className="flex items-baseline">
              <Link
                to={solutionPath(solution.id)}
                className="flex flex-1 items-baseline gap-3 px-4 py-2.5 hover:bg-zinc-900 focus-visible:bg-zinc-900 focus-visible:outline-none"
              >
                <span aria-hidden className="w-8 shrink-0 text-right font-mono text-xs text-zinc-500">{i + 1}</span>
                <span lang="en" className="text-zinc-100">{solution.title}</span>
              </Link>
              {challenge && (
                <Link to={challengePath(challenge.id)} className="shrink-0 px-4 text-sm text-sky-400 hover:underline">
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

  if (!solution) return <p className="text-zinc-400">{t('solutionNotFound')}</p>

  return (
    <article>
      <p className="text-sm">
        <Link to={SOLUTIONS_ROUTE} className="text-sky-400 hover:underline">
          ← {t('allSolutions')}
        </Link>
      </p>
      <h1 lang="en" className="mt-2 text-3xl font-semibold text-zinc-50">
        {solution.title}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        <a href={solution.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
          {t('viewSource')}
        </a>
        {' · '}
        <Attribution textKey="lessonAttribution" />
      </p>
      {challenge && (
        <p className="mt-4 rounded border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-zinc-200">
          {t('challengeSolveHint')}{' '}
          <Link to={challengePath(challenge.id)} className="text-sky-400 hover:underline">
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
