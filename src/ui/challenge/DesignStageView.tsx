import { useState } from 'react'
import type { StageWork } from '../../core/challenges/attempt'
import type { DesignStage, RuledStageType } from '../../core/challenges/challenge'
import { evaluateDesign, openNextHint } from '../../core/challenges/rules'
import type { Design } from '../../core/design/design'
import { createHistory, type History } from '../../core/design/history'
import { useChaosControls } from '../canvas/ChaosPanel'
import { DesignEditor } from '../canvas/DesignEditor'
import { draftOf, SimulationSummary, useLoadControls, useSimulation } from '../canvas/SimulationPanel'
import { t } from '../i18n'
import { TABLET_QUERY, useMediaQuery } from '../useMediaQuery'
import { Feedback, RuleResults } from './RuleFeedback'
import { primaryButtonClass } from './shared'

/** The work on a Stage whose input is a Design, on either canvas. */
export type DesignWork = Extract<StageWork, { type: RuledStageType }>

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
  const chaos = useChaosControls(stage.chaosTasks ?? [], history.present)
  const simulation = useSimulation(history.present, load.profile, chaos.scenarioFor(history.present), load.mode)

  function change(next: History<Design>) {
    setHistory(next)
    // Every change is stored at once, so closing the tab never loses work.
    if (next.present !== history.present) onChange({ ...work, design: next.present })
  }

  return (
    <>
      {editable && !wideEnough && (
        <p role="status" className="mt-3 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text">
          {t('canvasDesktopOnly')}
        </p>
      )}
      {stage.type === 'scaling' && editable && <p className="mt-2 text-sm text-text-muted">{t('stageScalingStart')}</p>}
      {editable && (
        <section aria-label={t('stageCheck')} className="mt-4 rounded border border-border bg-surface-raised/50 p-3">
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
            <p className="mt-2 text-sm text-text-muted">{t('stageNotChecked')}</p>
          )}
        </section>
      )}
      <div className="mt-4">
        <DesignEditor history={history} onChange={change} readOnly={!canEdit} simulation={simulation} />
        {/* Under the canvas, which stays in view beside the Stage's task. */}
        <div className="mt-3">
          {load.controls}
          {chaos.controls}
        </div>
        {simulation && <SimulationSummary design={history.present} result={simulation} />}
      </div>
    </>
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
  const load = useLoadControls(draftOf(stage.loadProfile))
  // Only the Stage's Chaos tasks, which pick their Nodes in each Design alike.
  const chaos = useChaosControls(stage.chaosTasks ?? [])
  const yourSimulation = useSimulation(yours.present, load.profile, chaos.scenarioFor(yours.present), load.mode)
  const referenceSimulation = useSimulation(reference.present, load.profile, chaos.scenarioFor(reference.present), load.mode)

  return (
    <>
      <RuleResults stage={stage} evaluation={evaluation} gaveUp={work.outcome?.gaveUp ?? false} />

      <section className="mt-6">
        <h3 className="mb-3 text-lg font-semibold text-text">{t('stageCompareTitle')}</h3>
        {load.controls}
        {chaos.controls}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            {/* h3, not h4: the Traffic Simulation and Chaos panels above are h2, and a heading must not skip a level. */}
            <h3 className="mb-2 text-sm font-medium text-text">{t('stageYourDesign')}</h3>
            <DesignEditor history={yours} onChange={() => {}} readOnly compact label={t('stageYourDesign')} simulation={yourSimulation} />
            {yourSimulation && <SimulationSummary design={yours.present} result={yourSimulation} label={t('stageYourSimulation')} />}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-text">{t('stageReferenceSolution')}</h3>
            <DesignEditor history={reference} onChange={() => {}} readOnly compact label={t('stageReferenceSolution')} simulation={referenceSimulation} />
            {referenceSimulation && <SimulationSummary design={reference.present} result={referenceSimulation} label={t('stageReferenceSimulation')} />}
          </div>
        </div>
      </section>
    </>
  )
}
