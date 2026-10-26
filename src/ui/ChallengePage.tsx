import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { findChallenge, type DesignStage } from '../core/challenges/challenge'
import {
  evaluateDesign,
  HINT_CAPS,
  HINT_TIERS,
  levelZeroFeedback,
  openNextHint,
  problemHints,
  type Evaluation,
  type HintUsage,
} from '../core/challenges/rules'
import { emptyDesign, readDesign, type Design } from '../core/design/design'
import { createHistory, type History } from '../core/design/history'
import { stageWorkKey, type StageWork } from '../core/progress/progress'
import { DesignEditor } from './canvas/DesignEditor'
import { catalog } from './catalog'
import { formatNumber, t, type StringKey } from './i18n'
import { useProgress } from './progress/store'
import { solutionPath } from './routes'
import { TABLET_QUERY, useMediaQuery } from './useMediaQuery'

/** Names of the Hint tiers, in the order they open. */
const HINT_TIER_LABELS: StringKey[] = ['hintTierQuestion', 'hintTierPointer', 'hintTierExplanation']

/** How much of a Rule's points each opened Hint tier takes, as a percentage. */
const HINT_COST_PERCENT = Math.round((HINT_CAPS[0] - HINT_CAPS[1]) * 100)

const buttonClass = 'rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-40'
const primaryButtonClass = 'rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500'

/** A Challenge's high-level design Stage: build on the canvas, check against the Rules, open Hints, finish and compare. */
export function ChallengePage() {
  const { challengeId = '' } = useParams()
  const challenge = findChallenge(catalog.challenges, challengeId)
  const stage = challenge?.stages.find((candidate) => candidate.type === 'high-level-design')

  if (!challenge || !stage) return <p className="text-zinc-400">{t('challengeNotFound')}</p>
  const workKey = stageWorkKey(challenge.id, stage.id)

  return (
    <>
      <p className="text-sm text-zinc-500">
        {t(challenge.source === 'primer' ? 'challengeSourcePrimer' : 'challengeSourceAuthored')} · {t('stageHighLevelDesign')}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-50">{challenge.title}</h1>
      <p className="mt-2 max-w-4xl text-sm text-zinc-300">{stage.prompt}</p>
      {/* Keyed by the Stage, so that another Challenge starts from its own stored work. */}
      <StageWorkspace key={workKey} workKey={workKey} stage={stage} solutionId={challenge.solutionId} />
    </>
  )
}

function StageWorkspace({ workKey, stage, solutionId }: { workKey: string; stage: DesignStage; solutionId?: string }) {
  const loaded = useProgress((state) => state.progress !== undefined)
  const work = useProgress((state) => state.progress?.challenges.stages[workKey])
  const saveStageWork = useProgress((state) => state.saveStageWork)
  const editable = useMediaQuery(TABLET_QUERY)
  const [history, setHistory] = useState<History<Design>>()
  /** The Design as it was at the last check; feedback describes it. */
  const [checked, setChecked] = useState<Design>()
  const [confirmingFinish, setConfirmingFinish] = useState(false)

  useEffect(() => {
    if (!loaded || history) return
    const stored = useProgress.getState().progress?.challenges.stages[workKey]?.design
    setHistory(createHistory(stored === undefined ? emptyDesign() : (readDesign(stored).design ?? emptyDesign())))
  }, [loaded, history, workKey])

  if (!history) return <p className="mt-4 text-sm text-zinc-500">{t('designLoading')}</p>

  const hintUsage: HintUsage = work?.hintUsage ?? {}
  const finishedAt = work?.finishedAt

  function store(change: Partial<StageWork>) {
    void saveStageWork(workKey, { design: history!.present, hintUsage, ...(finishedAt && { finishedAt }), ...change })
  }

  function change(next: History<Design>) {
    setHistory(next)
    // Every change is stored at once, so closing the tab never loses work.
    if (next.present !== history?.present) store({ design: next.present })
  }

  if (finishedAt) return <FinishedStage stage={stage} design={history.present} hintUsage={hintUsage} solutionId={solutionId} />

  return (
    <>
      {!editable && (
        <p role="status" className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-zinc-200">
          {t('canvasDesktopOnly')}
        </p>
      )}
      <section aria-label={t('stageCheck')} className="mt-4 rounded border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={primaryButtonClass} onClick={() => setChecked(history.present)}>
            {t('stageCheck')}
          </button>
          {confirmingFinish ? (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-zinc-300">{t('stageFinishConfirm')}</span>
              <button type="button" className={buttonClass} onClick={() => store({ finishedAt: new Date().toISOString() })}>
                {t('stageFinishYes')}
              </button>
              <button type="button" className={buttonClass} onClick={() => setConfirmingFinish(false)}>
                {t('cancel')}
              </button>
            </span>
          ) : (
            <button type="button" className={buttonClass} onClick={() => setConfirmingFinish(true)}>
              {t('stageFinish')}
            </button>
          )}
        </div>
        {checked ? (
          <Feedback
            stage={stage}
            evaluation={evaluateDesign(stage, checked, hintUsage)}
            stale={checked !== history.present}
            onOpenHint={(ruleId) => store({ hintUsage: openNextHint(hintUsage, stage, ruleId) })}
          />
        ) : (
          <p className="mt-2 text-sm text-zinc-400">{t('stageNotChecked')}</p>
        )}
      </section>
      <div className="mt-4">
        <DesignEditor history={history} onChange={change} readOnly={!editable} />
      </div>
    </>
  )
}

/** Level-0 feedback (the score and how many problems remain) with the Hints of each problem. No Rule is named. */
function Feedback({
  stage,
  evaluation,
  stale,
  onOpenHint,
}: {
  stage: DesignStage
  evaluation: Evaluation
  stale: boolean
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
      {failingCount > 0 && (
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

function ScoreLine({ score, totalWeight }: { score: number; totalWeight: number }) {
  return (
    <p className="font-medium text-zinc-100">
      {t('stageScore', { score: formatNumber(score), total: formatNumber(totalWeight), percent: Math.round((score / totalWeight) * 100) })}
    </p>
  )
}

/** After the Stage: every Rule's result, and the learner's Design beside the Reference Solution. */
function FinishedStage({ stage, design, hintUsage, solutionId }: { stage: DesignStage; design: Design; hintUsage: HintUsage; solutionId?: string }) {
  const evaluation = evaluateDesign(stage, design, hintUsage)
  const [reference] = useState(() => createHistory(stage.referenceSolution))
  const [yours] = useState(() => createHistory(design))
  const descriptions = new Map(stage.rules.map((rule) => [rule.id, rule.description]))

  return (
    <>
      <section className="mt-4 rounded border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
        <p className="text-zinc-400">{t('stageFinished')}</p>
        <div className="mt-1">
          <ScoreLine score={evaluation.score} totalWeight={evaluation.totalWeight} />
        </div>
        <h2 className="mt-3 font-semibold text-zinc-100">{t('stageResultsTitle')}</h2>
        <ul className="mt-2 space-y-1">
          {evaluation.rules.map((result) => (
            <li key={result.ruleId} className="flex flex-wrap items-baseline gap-x-2">
              <span className={result.passed ? 'text-emerald-400' : 'text-rose-400'}>
                {result.passed ? '✓' : '✗'} {t(result.passed ? 'stageRulePassed' : 'stageRuleFailed')}:
              </span>
              <span className="text-zinc-200">{descriptions.get(result.ruleId)}</span>
              <span className="text-xs text-zinc-500">
                {t('stageRulePoints', { points: formatNumber(result.points), weight: formatNumber(result.weight) })}
                {result.hintsOpened > 0 && ` · ${t('stageRuleHints', { count: result.hintsOpened })}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">{t('stageCompareTitle')}</h2>
          {solutionId && (
            <Link to={solutionPath(solutionId, stage.solutionAnchor)} className="text-sm text-sky-400 hover:underline">
              {t('stageReadSolution')} →
            </Link>
          )}
        </div>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-300">{t('stageYourDesign')}</h3>
            <DesignEditor history={yours} onChange={() => {}} readOnly compact label={t('stageYourDesign')} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-300">{t('stageReferenceSolution')}</h3>
            <DesignEditor history={reference} onChange={() => {}} readOnly compact label={t('stageReferenceSolution')} />
          </div>
        </div>
      </section>
    </>
  )
}
