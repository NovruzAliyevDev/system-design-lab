import { Link } from 'react-router-dom'
import { bestAttemptScore } from '../core/challenges/attempt'
import type { ChallengeKind } from '../core/challenges/challenge'
import { percent } from './challenge/shared'
import { catalog } from './catalog'
import { t, type StringKey } from './i18n'
import { useProgress } from './progress/store'
import { challengePath } from './routes'

const KIND_NAMES: Record<ChallengeKind, StringKey> = { architecture: 'challengeKindArchitecture', ood: 'challengeKindOod' }

/** Every Challenge, with how many Attempts the learner made and their best score. */
export function ChallengesPage() {
  const attempts = useProgress((state) => state.progress?.challenges.attempts)
  return (
    <section>
      <h1 className="text-2xl font-semibold text-zinc-50">{t('challengesTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t('challengesDescription')}</p>
      <ol className="mt-6 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {catalog.challenges.map((challenge) => {
          const tried = attempts?.[challenge.id] ?? []
          const best = bestAttemptScore(tried)
          return (
            <li key={challenge.id}>
              <Link to={challengePath(challenge.id)} className="block px-4 py-3 hover:bg-zinc-900 focus-visible:bg-zinc-900 focus-visible:outline-none">
                <span className="font-medium text-zinc-100">{challenge.title}</span>
                <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                  <span>{t(KIND_NAMES[challenge.kind])}</span>
                  <span>{t(challenge.source === 'primer' ? 'challengeSourcePrimer' : 'challengeSourceAuthored')}</span>
                  <span>{t('challengeStageCount', { count: challenge.stages.length })}</span>
                  {tried.length === 0 ? (
                    <span>{t('challengeNotStarted')}</span>
                  ) : (
                    <span>{t('challengeAttemptCount', { count: tried.length })}</span>
                  )}
                  {best !== undefined && <span className="text-zinc-300">{t('challengeBestScore', { percent: percent(best) })}</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
