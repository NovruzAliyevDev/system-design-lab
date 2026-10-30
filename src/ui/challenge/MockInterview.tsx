import { useEffect, useId, useState } from 'react'
import type { Attempt } from '../../core/challenges/attempt'
import type { Challenge } from '../../core/challenges/challenge'
import {
  averageRating,
  DEFAULT_INTERVIEW_MINUTES,
  defaultInterviewPlan,
  interviewClock,
  RUBRIC_CRITERIA,
  RUBRIC_LEVELS,
  type InterviewPlan,
  type RubricCriterion,
  type SelfAssessmentInput,
} from '../../core/challenges/mock-interview'
import { parseDecimal } from '../EstimationSteps'
import { formatDate, formatDecimal, t, type StringKey } from '../i18n'
import { buttonClass, ConfirmButton, primaryButtonClass, STAGE_NAMES } from './shared'

// A Mock Interview on the Challenge page: the form that starts one, its clock, and the self-assessment at the end.

const fieldClass = 'w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100'

/** A duration as minutes and seconds, e.g. "42:05"; overtime is given as a positive duration. A countdown rounds `up`, so it starts at the full time. */
function formatClock(ms: number, { up = false } = {}): string {
  const seconds = (up ? Math.ceil : Math.floor)(Math.abs(ms) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** The interview's length and the Stage time boxes, which follow the length until the learner edits one. */
export function MockInterviewStart(props: { challenge: Challenge; confirm?: StringKey; onStart(plan: InterviewPlan): void }) {
  const { challenge, confirm, onStart } = props
  const [minutes, setMinutes] = useState(String(DEFAULT_INTERVIEW_MINUTES))
  const [boxes, setBoxes] = useState(() => texts(defaultInterviewPlan(challenge).timeBoxes))
  const minutesId = useId()

  function changeMinutes(text: string) {
    setMinutes(text)
    const total = parseDecimal(text)
    if (total !== undefined && total > 0) setBoxes(texts(defaultInterviewPlan(challenge, total).timeBoxes))
  }

  const total = parseDecimal(minutes)
  const timeBoxes = Object.fromEntries(challenge.stages.map((stage) => [stage.id, parseDecimal(boxes[stage.id] ?? '')]))
  const valid = total !== undefined && total > 0 && Object.values(timeBoxes).every((box) => box !== undefined && box > 0)
  const plan = valid ? { minutes: total, timeBoxes: timeBoxes as Record<string, number> } : undefined
  const boxSum = Object.values(timeBoxes).reduce<number>((sum, box) => sum + (box ?? 0), 0)

  return (
    <details className="mt-4 max-w-4xl rounded border border-zinc-800 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-zinc-100">{t('mockInterviewTitle')}</summary>
      <p className="mt-2 text-sm text-zinc-400">{t('mockInterviewDescription')}</p>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor={minutesId} className="block text-sm text-zinc-300">
            {t('mockInterviewMinutes')}
          </label>
          <input id={minutesId} inputMode="decimal" className={`${fieldClass} mt-1`} value={minutes} onChange={(event) => changeMinutes(event.target.value)} />
        </div>
        {challenge.stages.map((stage) => (
          <TimeBoxField
            key={stage.id}
            label={t('mockInterviewTimeBox', { stage: t(STAGE_NAMES[stage.type]) })}
            value={boxes[stage.id] ?? ''}
            onChange={(text) => setBoxes((current) => ({ ...current, [stage.id]: text }))}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{t('mockInterviewTimeBoxSum', { minutes: formatDecimal(boxSum) })}</p>
      <div className="mt-3">
        {!plan ? (
          <p role="alert" className="text-sm text-rose-400">
            {t('mockInterviewInvalid')}
          </p>
        ) : confirm ? (
          <ConfirmButton label={t('mockInterviewStart')} confirm={t(confirm)} yes={t('mockInterviewStart')} onConfirm={() => onStart(plan)} />
        ) : (
          <button type="button" className={primaryButtonClass} onClick={() => onStart(plan)}>
            {t('mockInterviewStart')}
          </button>
        )}
      </div>
    </details>
  )
}

function texts(timeBoxes: Record<string, number>): Record<string, string> {
  return Object.fromEntries(Object.entries(timeBoxes).map(([stageId, minutes]) => [stageId, String(minutes)]))
}

function TimeBoxField({ label, value, onChange }: { label: string; value: string; onChange(text: string): void }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-zinc-300">
        {label}
      </label>
      <input id={id} inputMode="decimal" className={`${fieldClass} mt-1`} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

/** The time now, updated every second. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** The running interview's time left and the current Stage's time against its box. It counts from the stored start, so a reload loses nothing. */
export function InterviewTimer({ challenge, attempt }: { challenge: Challenge; attempt: Attempt }) {
  const clock = interviewClock(challenge, attempt, useNow())
  const current = clock.stages.find((stage) => stage.state === 'current')
  const currentStage = current && challenge.stages.find((stage) => stage.id === current.stageId)
  return (
    <div
      role="timer"
      aria-label={t('mockInterviewTimer')}
      className={`sticky top-12 z-10 mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded border px-3 py-2 text-sm backdrop-blur ${clock.overtime ? 'border-rose-500/50 bg-rose-950/80' : 'border-sky-500/40 bg-zinc-950/90'}`}
    >
      <span className="font-medium text-zinc-100">{t('mockInterviewTitle')}</span>
      <span className={`font-mono text-lg ${clock.overtime ? 'text-rose-300' : 'text-zinc-50'}`}>
        {clock.overtime ? t('mockInterviewOvertime', { time: formatClock(clock.remainingMs) }) : t('mockInterviewRemaining', { time: formatClock(clock.remainingMs, { up: true }) })}
      </span>
      {current && currentStage && (
        <span className={`font-mono ${current.overTimeBox ? 'text-amber-300' : 'text-zinc-300'}`}>
          {t('mockInterviewStageTime', { stage: t(STAGE_NAMES[currentStage.type]), elapsed: formatClock(current.elapsedMs), box: formatClock(current.timeBoxMs) })}
        </span>
      )}
    </div>
  )
}

/** A finished interview's time, overall and per Stage against its box. */
export function InterviewTimes({ challenge, attempt }: { challenge: Challenge; attempt: Attempt }) {
  const clock = interviewClock(challenge, attempt, new Date())
  return (
    <div className="mt-3 text-sm">
      <p className={clock.overtime ? 'text-rose-300' : 'text-zinc-300'}>
        {t('mockInterviewStopped', { time: formatClock(clock.elapsedMs), minutes: formatDecimal(clock.totalMs / 60_000) })}
      </p>
      <ul className="mt-1 flex flex-wrap gap-x-4 text-xs">
        {clock.stages.map((stageClock, i) => (
          <li key={stageClock.stageId} className={stageClock.overTimeBox ? 'text-amber-300' : 'text-zinc-400'}>
            {t('mockInterviewStageTime', {
              stage: t(STAGE_NAMES[challenge.stages[i].type]),
              elapsed: formatClock(stageClock.elapsedMs),
              box: formatClock(stageClock.timeBoxMs),
            })}
          </li>
        ))}
      </ul>
    </div>
  )
}

const CRITERION_NAMES: Record<RubricCriterion, { name: StringKey; hint: StringKey }> = {
  communication: { name: 'rubricCommunication', hint: 'rubricCommunicationHint' },
  scoping: { name: 'rubricScoping', hint: 'rubricScopingHint' },
  estimation: { name: 'rubricEstimation', hint: 'rubricEstimationHint' },
  design: { name: 'rubricDesign', hint: 'rubricDesignHint' },
  'trade-offs': { name: 'rubricTradeOffs', hint: 'rubricTradeOffsHint' },
  scaling: { name: 'rubricScaling', hint: 'rubricScalingHint' },
}

const LEVEL_NAMES: StringKey[] = ['rubricLevel1', 'rubricLevel2', 'rubricLevel3', 'rubricLevel4', 'rubricLevel5']

/** The average of a self-assessment's ratings, e.g. "3,5 / 5". */
export function formatAverageRating(ratings: Record<RubricCriterion, number>): string {
  return t('selfAssessmentAverage', { average: formatDecimal(averageRating(ratings)), levels: RUBRIC_LEVELS })
}

/** The rubric of a finished Mock Interview: editable on the current Attempt, read-only on earlier ones. */
export function SelfAssessmentPanel(props: { attempt: Attempt; editable: boolean; onSave(input: SelfAssessmentInput): void }) {
  const { attempt, editable, onSave } = props
  const saved = attempt.selfAssessment
  const [ratings, setRatings] = useState<Partial<Record<RubricCriterion, number>>>(() => saved?.ratings ?? {})
  const [notes, setNotes] = useState(saved?.notes ?? '')
  const notesId = useId()
  const complete = RUBRIC_CRITERIA.every((criterion) => ratings[criterion] !== undefined)

  return (
    <section aria-labelledby="self-assessment" className="mt-4 border-t border-zinc-800 pt-4">
      <h3 id="self-assessment" className="font-semibold text-zinc-100">
        {t('selfAssessmentTitle')}
      </h3>
      <p className="mt-1 text-sm text-zinc-400">{t('selfAssessmentDescription')}</p>
      {!editable && !saved && <p className="mt-2 text-sm text-zinc-400">{t('selfAssessmentMissing')}</p>}
      {(editable || saved) && (
        <div className="mt-3 space-y-3">
          {RUBRIC_CRITERIA.map((criterion) => (
            <fieldset key={criterion} disabled={!editable}>
              <legend className="text-sm text-zinc-200">
                {t(CRITERION_NAMES[criterion].name)} <span className="text-zinc-500">· {t(CRITERION_NAMES[criterion].hint)}</span>
              </legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {Array.from({ length: RUBRIC_LEVELS }, (_, i) => i + 1).map((level) => (
                  <label
                    key={level}
                    className={`cursor-pointer rounded border px-2 py-1 text-xs ${ratings[criterion] === level ? 'border-sky-500 bg-sky-500/15 text-zinc-50' : 'border-zinc-700 text-zinc-300'}`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`${attempt.startedAt}/${criterion}`}
                      value={level}
                      checked={ratings[criterion] === level}
                      onChange={() => setRatings((current) => ({ ...current, [criterion]: level }))}
                    />
                    {level} · {t(LEVEL_NAMES[level - 1])}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div>
            <label htmlFor={notesId} className="block text-sm text-zinc-200">
              {t('selfAssessmentNotes')}
            </label>
            <textarea
              id={notesId}
              rows={3}
              disabled={!editable}
              placeholder={t('selfAssessmentNotesPlaceholder')}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          {editable && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={buttonClass}
                disabled={!complete}
                onClick={() => onSave({ ratings: ratings as Record<RubricCriterion, number>, notes })}
              >
                {t('selfAssessmentSave')}
              </button>
              {saved && (
                <span role="status" className="text-sm text-emerald-400">
                  {t('selfAssessmentSaved', { date: formatDate(new Date(saved.assessedAt)) })}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
