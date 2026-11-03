import { Link } from 'react-router-dom'
import { bestAttemptScore } from '../core/challenges/attempt'
import type { ChallengeKind } from '../core/challenges/challenge'
import { percent, SourceBadge } from './challenge/shared'
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
      <h1 className="text-2xl font-semibold text-text">{t('challengesTitle')}</h1>
      <p className="mt-1 text-sm text-text-muted">{t('challengesDescription')}</p>
      <ol className="mt-6 divide-y divide-border/60 rounded-lg border border-border">
        {catalog.challenges.map((challenge) => {
          const tried = attempts?.[challenge.id] ?? []
          const best = bestAttemptScore(tried)
          return (
            <li key={challenge.id}>
              <Link to={challengePath(challenge.id)} className="block px-4 py-3 hover:bg-surface-raised focus-visible:-outline-offset-2">
                <span className="font-medium text-text">{challenge.title}</span>
                <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-text-muted">
                  <span>{t(KIND_NAMES[challenge.kind])}</span>
                  <SourceBadge source={challenge.source} />
                  <span>{t('challengeStageCount', { count: challenge.stages.length })}</span>
                  {tried.length === 0 ? (
                    <span>{t('challengeNotStarted')}</span>
                  ) : (
                    <span>{t('challengeAttemptCount', { count: tried.length })}</span>
                  )}
                  {best !== undefined && <span className="text-text">{t('challengeBestScore', { percent: percent(best) })}</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
