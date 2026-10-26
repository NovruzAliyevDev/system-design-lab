import { useState } from 'react'
import type { StageOutcome } from '../../core/challenges/attempt'
import type { StageType } from '../../core/challenges/challenge'
import { t, type StringKey } from '../i18n'

// What the views of a Challenge's Stages share.

export const STAGE_NAMES: Record<StageType, StringKey> = {
  requirements: 'stageRequirements',
  estimation: 'stageEstimation',
  'high-level-design': 'stageHighLevelDesign',
  'deep-dive': 'stageDeepDive',
  scaling: 'stageScaling',
}

export const buttonClass = 'rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-40'
export const primaryButtonClass = 'rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500'

/** A share from 0 to 1 as a whole percentage. */
export const percent = (share: number) => Math.round(share * 100)

/** How a Stage ended, in short: its score as a percentage, or that the learner gave up. */
export function outcomeStatus(outcome: StageOutcome): string {
  return outcome.gaveUp ? t('stageStatusGaveUp') : `${percent(outcome.score)}%`
}

/** ✓ or ✗ with a label, coloured by the verdict. */
export function Verdict({ passed, label }: { passed: boolean; label: string }) {
  return (
    <span className={passed ? 'text-emerald-400' : 'text-rose-400'}>
      {passed ? '✓' : '✗'} {label}
    </span>
  )
}

/** A button that asks for confirmation before it acts. */
export function ConfirmButton(props: { label: string; confirm: string; yes: string; onConfirm(): void }) {
  const { label, confirm, yes, onConfirm } = props
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <button type="button" className={buttonClass} onClick={() => setConfirming(true)}>
        {label}
      </button>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-300">{confirm}</span>
      <button type="button" className={buttonClass} onClick={onConfirm}>
        {yes}
      </button>
      <button type="button" className={buttonClass} onClick={() => setConfirming(false)}>
        {t('cancel')}
      </button>
    </span>
  )
}
