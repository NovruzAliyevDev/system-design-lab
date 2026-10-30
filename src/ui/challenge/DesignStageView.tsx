import { useState } from 'react'
import type { StageWork } from '../../core/challenges/attempt'
import type { DesignStage } from '../../core/challenges/challenge'
import {
  evaluateDesign,
  HINT_CAPS,
  HINT_TIERS,
  levelZeroFeedback,
  openNextHint,
  problemHints,
  type Evaluation,
} from '../../core/challenges/rules'
import type { Design } from '../../core/design/design'
import { createHistory, type History } from '../../core/design/history'
import { DesignEditor } from '../canvas/DesignEditor'
import { draftOf, SimulationSummary, useLoadControls, useSimulation } from '../canvas/SimulationPanel'
import { formatNumber, t, type StringKey } from '../i18n'
import { TABLET_QUERY, useMediaQuery } from '../useMediaQuery'
import { primaryButtonClass } from './shared'

type DesignWork = Extract<StageWork, { type: DesignStage['type'] }>

/** Names of the Hint tiers, in the order they open. */
const HINT_TIER_LABELS: StringKey[] = ['hintTierQuestion', 'hintTierPointer', 'hintTierExplanation']

/** How much of a Rule's points each opened Hint tier takes, as a percentage. */
const HINT_COST_PERCENT = Math.round((HINT_CAPS[0] - HINT_CAPS[1]) * 100)

/**
 * A Stage solved on the canvas: build, check against the Rules and open Hints (none in a Mock Interview).
 * Once the Stage is over, every Rule's result and the learner's Design beside the Reference Solution.
 */
export function DesignStageView(props: { stage: DesignStage; work: DesignWork; editable: boolean; hints: boolean; onChange(work: DesignWork): void }) {
  const { stage, work, editable, hints, onChange } = props
  if (work.outcome) return <OverStage stage={stage} work={work} />
  return <OpenStage stage={stage} work={work} editable={editable} hints={hints} onChange={onChange} />
}

function OpenStage(props: { stage: DesignStage; work: DesignWork; editable: boolean; hints: boolean; onChange(work: DesignWork): void }) {
  const { stage, work, editable, hints, onChange } = props
  const wideEnough = useMediaQuery(TABLET_QUERY)
  const [history, setHistory] = useState<History<Design>>(() => createHistory(work.design))
  /** The Design as it was at the last check; feedback describes it. */
  const [checked, setChecked] = useState<Design>()
  const canEdit = editable && wideEnough
  const load = useLoadControls(draftOf(stage.loadProfile))
  const simulation = useSimulation(history.present, load.profile)

  function change(next: History<Design>) {
    setHistory(next)
    // Every change is stored at once, so closing the tab never loses work.
    if (next.present !== history.present) onChange({ ...work, design: next.present })
  }

  return (
    <>
      {editable && !wideEnough && (
        <p role="status" className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-zinc-200">
          {t('canvasDesktopOnly')}
        </p>
      )}
      {stage.type === 'scaling' && editable && <p className="mt-2 text-sm text-zinc-400">{t('stageScalingStart')}</p>}
      {editable && (
        <section aria-label={t('stageCheck')} className="mt-4 rounded border border-zinc-800 bg-zinc-900/60 p-3">
          <button type="button" className={primaryButtonClass} onClick={() => setChecked(history.present)}>
            {t('stageCheck')}
          </button>
          {checked ? (
            <Feedback
              stage={stage}
              evaluation={evaluateDesign(stage, checked, work.hintUsage)}
              stale={checked !== history.present}
              hints={hints}
              onOpenHint={(ruleId) => onChange({ ...work, hintUsage: openNextHint(work.hintUsage, stage, ruleId) })}
            />
          ) : (
            <p className="mt-2 text-sm text-zinc-400">{t('stageNotChecked')}</p>
          )}
        </section>
      )}
      <div className="mt-4">
        <DesignEditor history={history} onChange={change} readOnly={!canEdit} simulation={simulation} />
        {/* Under the canvas, which stays in view beside the Stage's task. */}
        <div className="mt-3">{load.controls}</div>
        {simulation && <SimulationSummary design={history.present} result={simulation} />}
      </div>
    </>
  )
}

/** Level-0 feedback (the score and how many problems remain) with the Hints of each problem. No Rule is named. */
function Feedback({
  stage,
  evaluation,
  stale,
  hints,
  onOpenHint,
}: {
  stage: DesignStage
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

function ScoreLine({ score, totalWeight }: { score: number; totalWeight: number }) {
  return (
    <p className="font-medium text-zinc-100">
      {t('stageScore', { score: formatNumber(score), total: formatNumber(totalWeight), percent: Math.round((score / totalWeight) * 100) })}
    </p>
  )
}

/**
 * After the Stage: every Rule's result as recorded when it ended, and the learner's Design beside the
 * Reference Solution, both simulated under the same load to compare them.
 */
function OverStage({ stage, work }: { stage: DesignStage; work: DesignWork }) {
  const evaluation = work.outcome?.evaluation ?? evaluateDesign(stage, work.design, work.hintUsage)
  const [reference] = useState(() => createHistory(stage.referenceSolution))
  const [yours] = useState(() => createHistory(work.design))
  const descriptions = new Map(stage.rules.map((rule) => [rule.id, rule.description]))
  const load = useLoadControls(draftOf(stage.loadProfile))
  const yourSimulation = useSimulation(yours.present, load.profile)
  const referenceSimulation = useSimulation(reference.present, load.profile)

  return (
    <>
      <section className="mt-4 rounded border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
        {/* Given up, the Stage scores 0 whatever its Design would have earned. */}
        {!work.outcome?.gaveUp && <ScoreLine score={evaluation.score} totalWeight={evaluation.totalWeight} />}
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

      <section className="mt-6">
        <h3 className="mb-3 text-lg font-semibold text-zinc-100">{t('stageCompareTitle')}</h3>
        {load.controls}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-300">{t('stageYourDesign')}</h4>
            <DesignEditor history={yours} onChange={() => {}} readOnly compact label={t('stageYourDesign')} simulation={yourSimulation} />
            {yourSimulation && <SimulationSummary design={yours.present} result={yourSimulation} label={t('stageYourSimulation')} />}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-300">{t('stageReferenceSolution')}</h4>
            <DesignEditor history={reference} onChange={() => {}} readOnly compact label={t('stageReferenceSolution')} simulation={referenceSimulation} />
            {referenceSimulation && <SimulationSummary design={reference.present} result={referenceSimulation} label={t('stageReferenceSimulation')} />}
          </div>
        </div>
      </section>
    </>
  )
}
