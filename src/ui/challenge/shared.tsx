import { useState } from 'react'
import type { StageOutcome } from '../../core/challenges/attempt'
import type { ChallengeSource, StageType } from '../../core/challenges/challenge'
import { t, type StringKey } from '../i18n'

// What the views of a Challenge's Stages share.

export const STAGE_NAMES: Record<StageType, StringKey> = {
  requirements: 'stageRequirements',
  estimation: 'stageEstimation',
  'high-level-design': 'stageHighLevelDesign',
  'class-design': 'stageClassDesign',
  'deep-dive': 'stageDeepDive',
  scaling: 'stageScaling',
}

export const buttonClass = 'min-h-11 rounded border border-border px-3 text-sm hover:border-text-muted disabled:opacity-50 disabled:hover:border-border sm:min-h-8'
export const primaryButtonClass = 'min-h-11 rounded border border-accent bg-accent px-3 text-sm font-medium text-surface hover:opacity-90 sm:min-h-8'

/** A share from 0 to 1 as a whole percentage. */
export const percent = (share: number) => Math.round(share * 100)

/** How a Stage ended, in short: its score as a percentage, or that the learner gave up. */
export function outcomeStatus(outcome: StageOutcome): string {
  return outcome.gaveUp ? t('stageStatusGaveUp') : `${percent(outcome.score)}%`
}

/** Where a Challenge comes from: plain for the primer's questions, a badge for those not from the primer. */
export function SourceBadge({ source }: { source: ChallengeSource }) {
  if (source === 'primer') return <span>{t('challengeSourcePrimer')}</span>
  return <span className="rounded border border-accent/60 px-1.5 text-accent">{t('challengeSourceAuthored')}</span>
}

/** ✓ or ✗ with a label, coloured by the verdict. */
export function Verdict({ passed, label }: { passed: boolean; label: string }) {
  return (
    <span className={passed ? 'text-success' : 'text-danger'}>
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
      <span className="text-text">{confirm}</span>
      <button type="button" className={buttonClass} onClick={onConfirm}>
        {yes}
      </button>
      <button type="button" className={buttonClass} onClick={() => setConfirming(false)}>
        {t('cancel')}
      </button>
    </span>
  )
}
