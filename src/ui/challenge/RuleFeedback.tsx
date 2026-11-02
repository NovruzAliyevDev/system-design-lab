import { HINT_CAPS, HINT_TIERS, levelZeroFeedback, problemHints, type Evaluation, type RuledStage } from '../../core/challenges/rules'
import { formatNumber, t, type StringKey } from '../i18n'

// What the views of Stages checked by Rules share: the feedback after a check, with its Hints, and every
// Rule's result once the Stage is over.

/** Names of the Hint tiers, in the order they open. */
const HINT_TIER_LABELS: StringKey[] = ['hintTierQuestion', 'hintTierPointer', 'hintTierExplanation']

/** How much of a Rule's points each opened Hint tier takes, as a percentage. */
const HINT_COST_PERCENT = Math.round((HINT_CAPS[0] - HINT_CAPS[1]) * 100)

/** Level-0 feedback (the score and how many problems remain) with the Hints of each problem. No Rule is named. */
export function Feedback({
  stage,
  evaluation,
  stale,
  hints,
  onOpenHint,
}: {
  stage: RuledStage
  evaluation: Evaluation
  stale: boolean
  hints: boolean
  onOpenHint: (ruleId: string) => void
}) {
  const { score, maxScore, totalWeight, failingCount } = levelZeroFeedback(evaluation)
  return (
    <div role="status" className="mt-3 text-sm">
      <ScoreLine score={score} totalWeight={totalWeight} />
      {maxScore < totalWeight && <p className="text-zinc-400">{t('stageMaxScore', { max: formatNumber(maxScore) })}</p>}
      <p className={failingCount === 0 ? 'text-emerald-400' : 'text-zinc-300'}>
        {failingCount === 0 ? t('stageAllPass') : t('stageProblemsLeft', { count: failingCount })}
      </p>
      {stale && <p className="text-amber-300">{t('stageCheckStale')}</p>}
      {failingCount > 0 && !hints && <p className="mt-2 text-xs text-zinc-500">{t('stageNoHintsInInterview')}</p>}
      {failingCount > 0 && hints && (
        <>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {problemHints(stage, evaluation).map((problem, i) => (
              <li key={problem.ruleId} className="rounded border border-zinc-800 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-zinc-200">{t('stageProblem', { number: i + 1 })}</p>
                  {problem.canOpenMore && (
                    <button type="button" className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-200 hover:border-zinc-500" onClick={() => onOpenHint(problem.ruleId)}>
                      {t('stageOpenHint', { tier: problem.opened.length + 1, tiers: HINT_TIERS })}
                    </button>
                  )}
                </div>
                {problem.opened.map((hint, tier) => (
                  <p key={tier} className="mt-1 text-zinc-300">
                    <span className="text-zinc-500">{t(HINT_TIER_LABELS[tier])}: </span>
                    {hint}
                  </p>
                ))}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-zinc-500">{t('stageHintCost', { percent: HINT_COST_PERCENT })}</p>
        </>
      )}
    </div>
  )
}

export function ScoreLine({ score, totalWeight }: { score: number; totalWeight: number }) {
  return (
    <p className="font-medium text-zinc-100">
      {t('stageScore', { score: formatNumber(score), total: formatNumber(totalWeight), percent: Math.round((score / totalWeight) * 100) })}
    </p>
  )
}

/** After the Stage: its score (none when given up) and every Rule's result, described, with its points and Hints. */
export function RuleResults({ stage, evaluation, gaveUp }: { stage: RuledStage; evaluation: Evaluation; gaveUp: boolean }) {
  const descriptions = new Map(stage.rules.map((rule) => [rule.id, rule.description]))
  return (
    <section className="mt-4 rounded border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
      {/* Given up, the Stage scores 0 whatever its Design would have earned. */}
      {!gaveUp && <ScoreLine score={evaluation.score} totalWeight={evaluation.totalWeight} />}
      <h3 className="mt-3 font-semibold text-zinc-100">{t('stageResultsTitle')}</h3>
      <ul className="mt-2 space-y-1">
        {evaluation.rules.map((result) => (
          <li key={result.ruleId} className="flex flex-wrap items-baseline gap-x-2">
            <span className={result.passed ? 'text-emerald-400' : 'text-rose-400'}>
              {result.passed ? '✓' : '✗'} {t(result.passed ? 'stageRulePassed' : 'stageRuleFailed')}:
            </span>
            <span className="text-zinc-200">{descriptions.get(result.ruleId) ?? result.ruleId}</span>
            <span className="text-xs text-zinc-500">
              {t('stageRulePoints', { points: formatNumber(result.points), weight: formatNumber(result.weight) })}
              {result.hintsOpened > 0 && ` · ${t('stageRuleHints', { count: result.hintsOpened })}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
