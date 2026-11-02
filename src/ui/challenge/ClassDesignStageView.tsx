import { useState } from 'react'
import type { ClassDesignStage } from '../../core/challenges/challenge'
import { evaluateDesign, openNextHint } from '../../core/challenges/rules'
import { findCodeSolution } from '../../core/content/catalog'
import type { Design } from '../../core/design/design'
import { createHistory, type History } from '../../core/design/history'
import { Attribution } from '../Attribution'
import { UmlEditor } from '../canvas/UmlEditor'
import { catalog } from '../catalog'
import { t } from '../i18n'
import { TABLET_QUERY, useMediaQuery } from '../useMediaQuery'
import type { DesignWork } from './DesignStageView'
import { Feedback, RuleResults } from './RuleFeedback'
import { primaryButtonClass } from './shared'

interface Props {
  stage: ClassDesignStage
  work: DesignWork
  /** The primer's Python solution, shown beside the reference UML once the Stage is over. */
  codeSolutionId?: string
  editable: boolean
  hints: boolean
  onChange(work: DesignWork): void
}

/**
 * An object-oriented design built on the UML Class Builder: build, check against the Rules and open
 * Hints (none in a Mock Interview). Once the Stage is over, every Rule's result, the learner's UML, and
 * the reference UML beside the primer's Python solution.
 */
export function ClassDesignStageView(props: Props) {
  if (props.work.outcome) return <OverStage {...props} />
  return <OpenStage {...props} />
}

function OpenStage({ stage, work, editable, hints, onChange }: Props) {
  const wideEnough = useMediaQuery(TABLET_QUERY)
  const [history, setHistory] = useState<History<Design>>(() => createHistory(work.design))
  /** The Design as it was at the last check; feedback describes it. */
  const [checked, setChecked] = useState<Design>()

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
            <p className="mt-2 text-sm text-zinc-400">{t('stageUmlNotChecked')}</p>
          )}
        </section>
      )}
      <div className="mt-4">
        <UmlEditor history={history} onChange={change} readOnly={!(editable && wideEnough)} />
      </div>
    </>
  )
}

function OverStage({ stage, work, codeSolutionId }: Props) {
  const evaluation = work.outcome?.evaluation ?? evaluateDesign(stage, work.design, work.hintUsage)
  const [yours] = useState(() => createHistory(work.design))
  const [reference] = useState(() => createHistory(stage.referenceSolution))
  const code = codeSolutionId === undefined ? undefined : findCodeSolution(catalog, codeSolutionId)

  return (
    <>
      <RuleResults stage={stage} evaluation={evaluation} gaveUp={work.outcome?.gaveUp ?? false} />
      <section className="mt-6">
        <h3 className="mb-2 text-lg font-semibold text-zinc-100">{t('stageYourUml')}</h3>
        <UmlEditor history={yours} onChange={() => {}} readOnly compact label={t('stageYourUml')} />
      </section>
      <section className="mt-6">
        <h3 className="mb-3 text-lg font-semibold text-zinc-100">{t('stageReferenceUmlTitle')}</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-300">{t('stageReferenceUml')}</h4>
            <UmlEditor history={reference} onChange={() => {}} readOnly compact label={t('stageReferenceUml')} />
          </div>
          {code && (
            <div className="min-w-0">
              <h4 className="mb-2 text-sm font-medium text-zinc-300">{t('stageReferenceCode')}</h4>
              <p className="mb-2 text-xs text-zinc-500">
                <span className="font-mono" lang="en">
                  {code.path}
                </span>
                {' · '}
                <a href={code.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                  {t('viewSource')}
                </a>
              </p>
              <pre lang="en" className="max-h-[32rem] overflow-auto rounded border border-zinc-800 bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-200">
                <code>{code.code}</code>
              </pre>
              <p className="mt-2 text-xs text-zinc-500">
                <Attribution textKey="codeAttribution" />
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
