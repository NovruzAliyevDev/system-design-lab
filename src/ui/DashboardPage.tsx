import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { continueTarget, type ContinueTarget } from '../core/activity/continue'
import { computeStreak, type Streak } from '../core/activity/streak'
import { findChallenge } from '../core/challenges/challenge'
import { findLesson } from '../core/content/catalog'
import { buildDailyQueue, type DailyQueue } from '../core/flashcards/queue'
import type { Progress } from '../core/progress/progress'
import { computeMastery, suggestNextTopic } from '../core/skill-tree/mastery'
import { percent } from './challenge/shared'
import { allCards, catalog } from './catalog'
import { t } from './i18n'
import { dailyReviewSettings, localTimeZone } from './localDay'
import { useProgress } from './progress/store'
import { challengePath, FLASHCARDS_ROUTE, LESSONS_ROUTE, lessonPath, skillTreePath } from './routes'
import { MasteryBar } from './SkillTreePage'

const linkClass = 'link text-sm'

/** How often the Dashboard looks at the clock again, so a page left open moves on to the next day. */
const CLOCK_TICK_MS = 60 * 1000

function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** The home page: what to do today. */
export function DashboardPage() {
  const progress = useProgress((state) => state.progress)
  return (
    <section>
      <h1 className="text-2xl font-semibold text-text">{t('dashboardTitle')}</h1>
      <p className="mt-1 text-sm text-text-muted">{t('dashboardDescription')}</p>
      {progress ? <Blocks progress={progress} /> : <p className="mt-6 text-sm text-text-muted">{t('dashboardLoading')}</p>}
      <p className="mt-6">
        <Link to={LESSONS_ROUTE} className={linkClass}>
          {t('dashboardAllLessons')} →
        </Link>
      </p>
    </section>
  )
}

function Blocks({ progress }: { progress: Progress }) {
  const now = useNow()
  const { settings } = progress
  const review = buildDailyQueue(allCards, progress.flashcards.cards, dailyReviewSettings(settings.newCardsPerDay, now), now)
  const streak = computeStreak(progress.activity.log, now, localTimeZone(), settings.streakMinActivities)
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <ReviewBlock review={review} streak={streak} />
      <StreakBlock streak={streak} minActivities={settings.streakMinActivities} reviewLeft={review.cards.length > 0} />
      <ContinueBlock progress={progress} target={continueTarget(progress.activity.lastOpened, progress.reading, catalog)} />
      <NextTopicBlock progress={progress} />
    </div>
  )
}

function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-text-muted">{title}</h2>
      {children}
      {action && <p className="mt-auto pt-4">{action}</p>}
    </section>
  )
}

const valueClass = 'mt-2 text-3xl font-semibold text-text tabular-nums'
const detailClass = 'mt-1 text-sm text-text-muted'

function ReviewBlock({ review: { cards, counts }, streak }: { review: DailyQueue<unknown>; streak: Streak }) {
  const empty = cards.length === 0
  return (
    <Block
      title={t('dashboardReviewTitle')}
      action={
        <Link to={FLASHCARDS_ROUTE} className={linkClass}>
          {t(empty ? 'dashboardReviewOpen' : 'dashboardReviewStart')} →
        </Link>
      }
    >
      <p className={valueClass}>{t('dashboardReviewCount', { count: cards.length })}</p>
      <p className={detailClass}>
        {empty
          ? t(streak.today.reviewFinished ? 'dashboardReviewDone' : 'dashboardReviewNone')
          : t('dashboardReviewCounts', { new: counts.new, learning: counts.learning, review: counts.review })}
      </p>
    </Block>
  )
}

/** `reviewLeft`: whether today has a review to finish, or only learning activity can make it count. */
function StreakBlock({ streak, minActivities, reviewLeft }: { streak: Streak; minActivities: number; reviewLeft: boolean }) {
  const { today } = streak
  const tally = { remaining: minActivities - today.activities, done: today.activities, min: minActivities }
  return (
    <Block title={t('dashboardStreakTitle')}>
      <p className={valueClass}>{t('dashboardStreakDays', { count: streak.current })}</p>
      <p className={detailClass}>{t('dashboardStreakLongest', { count: streak.longest })}</p>
      <p className={`mt-3 text-sm ${today.counts ? 'text-success' : 'text-text'}`}>
        {today.counts
          ? t('dashboardStreakCounted')
          : t(reviewLeft ? 'dashboardStreakPending' : 'dashboardStreakPendingNoReview', tally)}
      </p>
    </Block>
  )
}

const CONTINUE_LABELS = { resume: 'dashboardContinueResume', next: 'dashboardContinueNext', start: 'dashboardContinueStart' } as const

function ContinueBlock({ progress, target }: { progress: Progress; target: ContinueTarget | undefined }) {
  const title = t('dashboardContinueTitle')
  if (!target) {
    return (
      <Block title={title}>
        <p className={detailClass}>{t('dashboardAllRead')}</p>
      </Block>
    )
  }
  if (target.kind === 'lesson') {
    const lesson = findLesson(catalog, target.lessonId)!
    return (
      <Block
        title={title}
        action={
          <Link to={lessonPath(lesson.id)} className={linkClass}>
            {t(CONTINUE_LABELS[target.reason])} →
          </Link>
        }
      >
        <p lang="en" className="mt-2 text-lg font-medium text-text">
          {lesson.title}
        </p>
      </Block>
    )
  }
  const challenge = findChallenge(catalog.challenges, target.challengeId)!
  const attempt = progress.challenges.attempts[challenge.id]?.at(-1)
  const over = attempt ? challenge.stages.filter((stage) => attempt.stages[stage.id]?.outcome).length : 0
  return (
    <Block
      title={title}
      action={
        <Link to={challengePath(challenge.id)} className={linkClass}>
          {t('dashboardContinueChallenge')} →
        </Link>
      }
    >
      <p className="mt-2 text-lg font-medium text-text">{challenge.title}</p>
      <p className={detailClass}>
        {attempt?.score !== undefined
          ? t('dashboardContinueChallengeFinished', { percent: percent(attempt.score) })
          : t('dashboardContinueStages', { done: over, total: challenge.stages.length })}
      </p>
    </Block>
  )
}

function NextTopicBlock({ progress }: { progress: Progress }) {
  const mastery = useMemo(() => computeMastery(progress, catalog), [progress])
  const topic = suggestNextTopic(catalog.skillTree, mastery)
  const title = t('dashboardNextTopicTitle')
  if (!topic) {
    return (
      <Block title={title}>
        <p className={detailClass}>{t('dashboardAllMastered')}</p>
      </Block>
    )
  }
  const { mastery: share } = mastery[topic.id]
  return (
    <Block
      title={title}
      action={
        <Link to={skillTreePath(topic.id)} className={linkClass}>
          {t('dashboardNextTopicOpen')} →
        </Link>
      }
    >
      <p className="mt-2 text-lg font-medium text-text">{topic.title}</p>
      <p className={`${detailClass} mb-2`}>{t('topicMastery', { percent: percent(share) })}</p>
      <MasteryBar mastery={share} />
    </Block>
  )
}
