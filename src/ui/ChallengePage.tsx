import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { finishStage, newAttempt, openStageCount, stageWork, updateStage, type Attempt, type AttemptMode, type StageWork } from '../core/challenges/attempt'
import { findChallenge, isRuledStageType, type Challenge, type Stage } from '../core/challenges/challenge'
import { assessInterview, startMockInterview, type InterviewPlan, type SelfAssessmentInput } from '../core/challenges/mock-interview'
import { ClassDesignStageView } from './challenge/ClassDesignStageView'
import { DeepDiveStageView } from './challenge/DeepDiveStageView'
import { DesignStageView, type DesignWork } from './challenge/DesignStageView'
import { EstimationStageView } from './challenge/EstimationStageView'
import { formatAverageRating, InterviewTimer, InterviewTimes, MockInterviewStart, SelfAssessmentPanel } from './challenge/MockInterview'
import { RequirementsStageView } from './challenge/RequirementsStageView'
import { buttonClass, ConfirmButton, outcomeStatus, percent, primaryButtonClass, SourceBadge, STAGE_NAMES } from './challenge/shared'
import { catalog } from './catalog'
import { formatDate, t, type StringKey } from './i18n'
import { useOpened, useProgress } from './progress/store'
import { solutionPath } from './routes'

/**
 * A Challenge solved Stage by Stage, in practice or as a Mock Interview. The current Attempt is the last
 * one stored (or a new one, stored on its first change); `?attempt=N` shows an earlier Attempt read-only
 * and `?stage=id` picks a Stage.
 */
export function ChallengePage() {
  const { challengeId = '' } = useParams()
  const challenge = findChallenge(catalog.challenges, challengeId)
  const loaded = useProgress((state) => state.progress !== undefined)
  useOpened(challenge && { kind: 'challenge', challengeId: challenge.id })

  if (!challenge) return <p className="text-text-muted">{t('challengeNotFound')}</p>
  return (
    <>
      <p className="text-sm text-text-muted">
        <SourceBadge source={challenge.source} />
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-balance text-text">{challenge.title}</h1>
      {loaded ? <Workspace key={challenge.id} challenge={challenge} /> : <p className="mt-4 text-sm text-text-muted">{t('designLoading')}</p>}
    </>
  )
}

function Workspace({ challenge }: { challenge: Challenge }) {
  const stored = useProgress((state) => state.progress?.challenges.attempts[challenge.id])
  const saveCurrentAttempt = useProgress((state) => state.saveCurrentAttempt)
  const startAttempt = useProgress((state) => state.startAttempt)
  const [params, setParams] = useSearchParams()
  // Until the first change stores it, a Challenge never tried has a fresh Attempt that is not saved.
  const [fresh] = useState(() => newAttempt(new Date()))
  const attempts = stored && stored.length > 0 ? stored : [fresh]
  const currentNumber = attempts.length

  const requested = Number(params.get('attempt'))
  const attemptNumber = Number.isInteger(requested) && requested >= 1 && requested < currentNumber ? requested : currentNumber
  const attempt = attempts[attemptNumber - 1]
  const isCurrent = attemptNumber === currentNumber
  const isInterview = attempt.mode === 'mock-interview'
  const last = stored?.at(-1)
  // What a new Attempt would leave behind for good: an Attempt in progress, or an interview not yet self-assessed.
  const leaving: { retry?: StringKey; interview?: StringKey } =
    last === undefined
      ? {}
      : last.finishedAt === undefined
        ? { retry: 'retryConfirm', interview: 'mockInterviewStartConfirm' }
        : last.mode === 'mock-interview' && !last.selfAssessment
          ? { retry: 'leaveUnassessedConfirm', interview: 'leaveUnassessedConfirm' }
          : {}

  const openCount = openStageCount(challenge, attempt)
  // The Stage to work on: the last one open, which is the last Stage once every Stage is over.
  const defaultStage = challenge.stages[openCount - 1]
  const requestedIndex = challenge.stages.findIndex((stage) => stage.id === params.get('stage'))
  const stage = requestedIndex >= 0 && requestedIndex < openCount ? challenge.stages[requestedIndex] : defaultStage
  const stageIndex = challenge.stages.indexOf(stage)
  const work = stageWork(challenge, attempt, stage.id)

  function show(change: { stage?: string; attempt?: number }) {
    const next = new URLSearchParams()
    const number = change.attempt ?? (isCurrent ? undefined : attemptNumber)
    if (number !== undefined && number !== currentNumber) next.set('attempt', String(number))
    if (change.stage) next.set('stage', change.stage)
    setParams(next)
  }

  /** Ends the Stage and stays on it, so that its results show before the learner moves on. */
  function finish(gaveUp: boolean) {
    void saveCurrentAttempt(challenge.id, finishStage(challenge, attempt, stage.id, new Date(), { gaveUp }))
    show({ stage: stage.id })
  }

  function retry(from?: Attempt) {
    void startAttempt(challenge.id, newAttempt(new Date(), from))
    setParams(new URLSearchParams())
  }

  function startInterview(plan: InterviewPlan) {
    void startAttempt(challenge.id, startMockInterview(challenge, plan, new Date()))
    setParams(new URLSearchParams())
  }

  const finishAndGiveUp = isCurrent && !work.outcome && (
    // Keyed by the Stage, so that a confirmation left open does not carry over to the next one.
    <div key={stage.id} className="mt-4 flex flex-wrap items-center gap-3">
      <ConfirmButton
        label={t('stageFinish')}
        confirm={t(isRuledStageType(stage.type) ? 'stageFinishConfirm' : 'stageFinishConfirmAnswers')}
        yes={t('stageFinishYes')}
        onConfirm={() => finish(false)}
      />
      <ConfirmButton
        label={t('stageGiveUp')}
        confirm={t('stageGiveUpConfirm')}
        yes={t('stageGiveUpYes')}
        onConfirm={() => finish(true)}
      />
    </div>
  )
  const nextStage = challenge.stages[stageIndex + 1]

  return (
    <>
      {!isCurrent && (
        <p role="status" className="mt-3 flex flex-wrap items-center gap-3 rounded border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-text">
          {t('attemptViewing', { number: attemptNumber })}
          <button type="button" className={buttonClass} onClick={() => show({ attempt: currentNumber })}>
            {t('attemptBackToCurrent')}
          </button>
        </p>
      )}
      {isCurrent && isInterview && attempt.finishedAt === undefined ? (
        <InterviewTimer challenge={challenge} attempt={attempt} />
      ) : (
        isCurrent && <MockInterviewStart challenge={challenge} confirm={leaving.interview} onStart={startInterview} />
      )}
      <StageSteps challenge={challenge} attempt={attempt} selected={stage} openCount={openCount} onSelect={(stageId) => show({ stage: stageId })} />

      <section aria-labelledby="stage-heading" className="mt-6">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 id="stage-heading" className="text-xl font-semibold text-text">
            {t('stageTitle', { number: stageIndex + 1, name: t(STAGE_NAMES[stage.type]) })}
          </h2>
          <span className="text-sm text-text-muted">{t('stageWeight', { weight: stage.weight })}</span>
        </div>
        <p className="mt-2 max-w-prose text-sm text-pretty text-text">{stage.prompt}</p>
        {work.outcome ? (
          <Outcome stage={stage} work={work} solutionId={attempt.finishedAt === undefined ? undefined : challenge.solutionId} />
        ) : (
          !isCurrent && <p className="mt-3 text-sm text-text-muted">{t('stageNotOverInAttempt')}</p>
        )}
        {finishAndGiveUp}
        {/* Keyed by the Attempt and the Stage, so that each starts from its own stored work. */}
        <StageView
          key={`${attempt.startedAt}/${stage.id}`}
          stage={stage}
          work={work}
          codeSolutionId={challenge.codeSolutionId}
          editable={isCurrent && !work.outcome}
          hints={!isInterview}
          onChange={(input) => void saveCurrentAttempt(challenge.id, updateStage(challenge, attempt, stage.id, input))}
        />
        {work.outcome && nextStage && challenge.stages.indexOf(nextStage) < openCount && (
          <button type="button" className={`${primaryButtonClass} mt-6`} onClick={() => show({ stage: nextStage.id })}>
            {t('stageNext')}: {t(STAGE_NAMES[nextStage.type])} →
          </button>
        )}
      </section>

      {attempt.finishedAt !== undefined && (
        <AttemptSummary
          challenge={challenge}
          attempt={attempt}
          editable={isCurrent}
          onAssess={(input) => void saveCurrentAttempt(challenge.id, assessInterview(attempt, input, new Date()))}
        />
      )}
      <AttemptHistory
        challenge={challenge}
        attempts={stored ?? []}
        shown={attemptNumber}
        retryConfirm={leaving.retry}
        onShow={(number) => show({ attempt: number })}
        onRetry={retry}
      />
    </>
  )
}

function StageView(props: { stage: Stage; work: StageWork; codeSolutionId?: string; editable: boolean; hints: boolean; onChange(input: StageWork): void }) {
  const { stage, work, codeSolutionId, editable, hints, onChange } = props
  // `stageWork` gives each Stage work of its own type.
  switch (stage.type) {
    case 'requirements':
      return <RequirementsStageView stage={stage} work={work as Extract<StageWork, { type: 'requirements' }>} editable={editable} onChange={onChange} />
    case 'estimation':
      return <EstimationStageView stage={stage} work={work as Extract<StageWork, { type: 'estimation' }>} editable={editable} onChange={onChange} />
    case 'deep-dive':
      return <DeepDiveStageView stage={stage} work={work as Extract<StageWork, { type: 'deep-dive' }>} editable={editable} onChange={onChange} />
    case 'high-level-design':
    case 'scaling':
      return <DesignStageView stage={stage} work={work as DesignWork} editable={editable} hints={hints} onChange={onChange} />
    case 'class-design':
      return <ClassDesignStageView stage={stage} work={work as DesignWork} codeSolutionId={codeSolutionId} editable={editable} hints={hints} onChange={onChange} />
  }
}

/** The Stages in order, each with its score once it is over and its time box in a Mock Interview; Stages not open yet cannot be picked. */
function StageSteps(props: { challenge: Challenge; attempt: Attempt; selected: Stage; openCount: number; onSelect(stageId: string): void }) {
  const { challenge, attempt, selected, openCount, onSelect } = props
  return (
    <nav aria-label={t('challengeStages')} className="mt-4">
      <ol className="flex flex-wrap gap-2">
        {challenge.stages.map((stage, i) => {
          const outcome = attempt.stages[stage.id]?.outcome
          const open = i < openCount
          const status = outcome && outcomeStatus(outcome)
          return (
            <li key={stage.id}>
              <button
                type="button"
                disabled={!open}
                title={open ? undefined : t('stageLocked')}
                aria-current={stage === selected ? 'step' : undefined}
                className={`min-h-11 rounded border px-3 text-sm sm:min-h-8 ${stage === selected ? 'border-accent font-medium text-accent ring-1 ring-accent ring-inset' : 'border-border hover:border-text-muted'} disabled:opacity-50 disabled:hover:border-border`}
                onClick={() => onSelect(stage.id)}
              >
                {t('stageTitle', { number: i + 1, name: t(STAGE_NAMES[stage.type]) })}
                {attempt.interview && (
                  <span className="ml-2 text-xs text-text-muted">{t('mockInterviewTimeBoxMinutes', { minutes: attempt.interview.timeBoxes[stage.id] ?? '–' })}</span>
                )}
                {status && <span className={`ml-2 text-xs ${outcome?.gaveUp ? 'text-danger' : 'text-success'}`}>{status}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * How a Stage ended: its score (or that the learner gave up), and where the primer discusses it. The
 * Solution page gives every Stage away, so pass `solutionId` only once the Attempt is finished.
 */
function Outcome({ stage, work, solutionId }: { stage: Stage; work: StageWork; solutionId?: string }) {
  const { outcome } = work
  if (!outcome) return null
  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-sm">
      <span className="text-text-muted">{t('stageFinished')}</span>
      <span className={outcome.gaveUp ? 'text-danger' : 'font-medium text-text'}>
        {outcome.gaveUp ? t('stageGaveUp') : t('stageOutcomeScore', { percent: percent(outcome.score) })}
      </span>
      {solutionId && (
        <Link to={solutionPath(solutionId, stage.solutionAnchor)} className="link">
          {t('stageReadSolution')} →
        </Link>
      )}
    </p>
  )
}

/** A finished Attempt's Challenge score and how each Stage contributed to it; for a Mock Interview, its times and the self-assessment too. */
function AttemptSummary(props: { challenge: Challenge; attempt: Attempt; editable: boolean; onAssess(input: SelfAssessmentInput): void }) {
  const { challenge, attempt, editable, onAssess } = props
  return (
    <section aria-labelledby="attempt-summary" className="mt-10 max-w-4xl rounded-lg border border-border p-4">
      <h2 id="attempt-summary" className="text-lg font-semibold text-text">
        {t('attemptSummaryTitle')}
        <span className="ml-2 text-sm font-normal text-text-muted">{t(MODE_NAMES[attempt.mode])}</span>
      </h2>
      <p className="mt-1 text-xl font-semibold text-text">{t('attemptScore', { percent: percent(attempt.score ?? 0) })}</p>
      <p className="text-xs text-text-muted">{t('attemptScoreHint')}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {challenge.stages.map((stage, i) => {
          const outcome = attempt.stages[stage.id]?.outcome
          return (
            <li key={stage.id} className="flex flex-wrap gap-x-3">
              <span className="text-text">{t('stageTitle', { number: i + 1, name: t(STAGE_NAMES[stage.type]) })}</span>
              <span className="text-text-muted">{t('stageWeight', { weight: stage.weight })}</span>
              <span className={outcome?.gaveUp ? 'text-danger' : 'text-text'}>
                {outcome ? outcomeStatus(outcome) : '–'}
              </span>
            </li>
          )
        })}
      </ul>
      {attempt.mode === 'mock-interview' && (
        <>
          <InterviewTimes challenge={challenge} attempt={attempt} />
          <SelfAssessmentPanel key={attempt.startedAt} attempt={attempt} editable={editable} onSave={onAssess} />
        </>
      )}
    </section>
  )
}

const MODE_NAMES: Record<AttemptMode, StringKey> = {
  practice: 'attemptModePractice',
  'mock-interview': 'attemptModeMockInterview',
}

/**
 * Every stored Attempt, newest first, with the way to start another: fresh, or from the last one's inputs.
 * `retryConfirm` asks first when that would leave something behind.
 */
function AttemptHistory(props: {
  challenge: Challenge
  attempts: Attempt[]
  shown: number
  retryConfirm?: StringKey
  onShow(number: number): void
  onRetry(from?: Attempt): void
}) {
  const { challenge, attempts, shown, retryConfirm, onShow, onRetry } = props
  const last = attempts.at(-1)
  const retryButton = (label: string, from?: Attempt) =>
    retryConfirm ? (
      <ConfirmButton label={label} confirm={t(retryConfirm)} yes={t('retryYes')} onConfirm={() => onRetry(from)} />
    ) : (
      <button type="button" className={buttonClass} onClick={() => onRetry(from)}>
        {label}
      </button>
    )

  return (
    <section aria-labelledby="attempt-history" className="mt-10 max-w-4xl">
      <h2 id="attempt-history" className="text-lg font-semibold text-text">
        {t('attemptsTitle')}
      </h2>
      {last && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {retryButton(t('retryFresh'))}
          {retryButton(t('retryFromLast'), last)}
        </div>
      )}
      {attempts.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">{t('challengeNotStarted')}</p>
      ) : (
        <ol className="mt-3 divide-y divide-border/60 rounded-lg border border-border">
          {attempts
            .map((attempt, i) => ({ attempt, number: i + 1 }))
            .reverse()
            .map(({ attempt, number }) => (
              <li key={attempt.startedAt + number} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-medium text-text">{t('attemptLabel', { number })}</span>
                <span className={attempt.mode === 'mock-interview' ? 'text-accent' : 'text-text-muted'}>{t(MODE_NAMES[attempt.mode])}</span>
                <span className="text-text-muted">{t('attemptStarted', { date: formatDate(new Date(attempt.startedAt)) })}</span>
                <span className="text-text">
                  {attempt.score !== undefined ? t('attemptScore', { percent: percent(attempt.score) }) : t('attemptInProgress')}
                </span>
                {attempt.selfAssessment && (
                  <span className="text-text-muted">{formatAverageRating(attempt.selfAssessment.ratings)}</span>
                )}
                <span className="text-xs text-text-muted">
                  {challenge.stages
                    .map((stage) => {
                      const outcome = attempt.stages[stage.id]?.outcome
                      return `${t(STAGE_NAMES[stage.type])}: ${outcome ? outcomeStatus(outcome) : '–'}`
                    })
                    .join(' · ')}
                </span>
                {number !== shown && (
                  <button type="button" className={`${buttonClass} ml-auto`} onClick={() => onShow(number)}>
                    {t('attemptView')}
                  </button>
                )}
              </li>
            ))}
        </ol>
      )}
    </section>
  )
}
