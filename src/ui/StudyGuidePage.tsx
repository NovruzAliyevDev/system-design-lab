import { Link, useSearchParams } from 'react-router-dom'
import type { StudyAmount, StudyGuideStep, Timeline } from '../core/content/study-guide'
import { findLesson } from '../core/content/catalog'
import { isLessonRead } from '../core/progress/reading'
import { Attribution } from './Attribution'
import { catalog } from './catalog'
import { t, type StringKey } from './i18n'
import { useProgress } from './progress/store'
import { ReadMarker } from './ReadMarker'
import { lessonPath } from './routes'

const TIMELINE_LABELS: Record<Timeline, StringKey> = { short: 'timelineShort', medium: 'timelineMedium', long: 'timelineLong' }
const AMOUNT_LABELS: Record<Exclude<StudyAmount, 'yes'>, StringKey> = {
  some: 'studyAmountSome',
  many: 'studyAmountMany',
  most: 'studyAmountMost',
}
const TIMELINE_PARAM = 'timeline'

/** The primer's study guide: pick a timeline and follow its steps through the Lessons. */
export function StudyGuidePage() {
  const guide = catalog.studyGuide
  const [params, setParams] = useSearchParams()
  const progress = useProgress((state) => state.progress)
  if (!guide) return null
  const source = findLesson(catalog, guide.lessonId)

  // The chosen timeline is in the URL, so a plan can be bookmarked or shared.
  const chosen = guide.timelines.find((timeline) => timeline.id === params.get(TIMELINE_PARAM)) ?? guide.timelines[0]

  return (
    <section>
      <h1 className="text-2xl font-semibold text-text">{t('studyGuideTitle')}</h1>
      <p className="mt-1 text-sm text-text-muted">{t('studyGuideDescription')}</p>

      <div role="tablist" aria-label={t('studyGuideTimelines')} className="mt-6 flex gap-1 rounded-lg border border-border p-1">
        {guide.timelines.map((timeline) => {
          const selected = timeline.id === chosen.id
          return (
            <button
              key={timeline.id}
              type="button"
              role="tab"
              id={`timeline-${timeline.id}`}
              aria-selected={selected}
              aria-controls="timeline-panel"
              onClick={() => setParams({ [TIMELINE_PARAM]: timeline.id }, { replace: true })}
              className={`min-h-11 flex-1 rounded px-2 text-sm sm:min-h-8 ${
                selected ? 'bg-accent/10 font-medium text-accent ring-1 ring-accent ring-inset' : 'text-text-muted hover:bg-surface-raised hover:text-text'
              }`}
            >
              {t(TIMELINE_LABELS[timeline.id])}
            </button>
          )
        })}
      </div>

      <div id="timeline-panel" role="tabpanel" aria-labelledby={`timeline-${chosen.id}`} className="mt-4">
        <p lang="en" className="max-w-prose text-pretty text-text">
          {chosen.summary}
        </p>
        <ol className="mt-4 space-y-2">
          {guide.steps.map((step, i) => {
            const amount = step.amounts[chosen.id]
            return (
              <li key={i} className="flex gap-3 rounded-lg border border-border px-4 py-3">
                <span aria-hidden className="w-5 shrink-0 text-right font-mono text-sm text-text-muted">{i + 1}</span>
                <div className="min-w-0">
                  <StepText step={step} isRead={(lessonId) => (progress ? isLessonRead(progress.reading, lessonId) : false)} />
                  {amount !== 'yes' && (
                    <p className="mt-1 text-xs text-warning">{t('studyGuideAmount', { amount: t(AMOUNT_LABELS[amount]) })}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <p className="mt-6 text-sm text-text-muted">
        <Link to={lessonPath(guide.lessonId)} className="link">
          {t('studyGuideSource')}
        </Link>
        {' · '}
        {source && (
          <>
            <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="link">
              {t('viewSource')}
            </a>
            {' · '}
          </>
        )}
        <Attribution textKey="lessonAttribution" />
      </p>
    </section>
  )
}

function StepText({ step, isRead }: { step: StudyGuideStep; isRead: (lessonId: string) => boolean }) {
  return (
    <p lang="en" className="text-pretty text-text">
      {step.parts.map((part, i) =>
        part.lessonId ? (
          <span key={i}>
            <Link to={lessonPath(part.lessonId, part.anchor)} className="link">
              {part.text}
            </Link>
            {isRead(part.lessonId) && <ReadMarker />}
          </span>
        ) : (
          part.text
        ),
      )}
    </p>
  )
}
