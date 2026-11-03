import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { findLesson } from '../core/content/catalog'
import { selectCards, type CardSelection, type Flashcard } from '../core/flashcards/deck'
import { buildDailyQueue, deckStats, nextDueAt, type CardStates, type DailyReviewSettings, type DeckStats } from '../core/flashcards/queue'
import { GRADES, scheduleReview, type Grade } from '../core/flashcards/scheduler'
import { Attribution } from './Attribution'
import { catalog } from './catalog'
import { t, tRich, type StringKey } from './i18n'
import { dailyReviewSettings } from './localDay'
import { PRIMER_PROSE_CLASS, PrimerHtml } from './PrimerMarkdown'
import { useProgress } from './progress/store'
import { flashcardsPath, flashcardsQuery, lessonPath, selectionFromQuery, SETTINGS_ROUTE } from './routes'

const GRADE_LABELS: Record<Grade, StringKey> = { again: 'gradeAgain', hard: 'gradeHard', good: 'gradeGood', easy: 'gradeEasy' }

const GRADE_CLASSES: Record<Grade, string> = {
  again: 'border-danger/60 hover:bg-danger/10',
  hard: 'border-border hover:bg-surface-raised',
  good: 'border-success/60 hover:bg-success/10',
  easy: 'border-accent/60 hover:bg-accent/10',
}

/** The key that gives each grade, as in Anki: 1 again … 4 easy. */
const GRADE_KEYS: Record<string, Grade> = Object.fromEntries(GRADES.map((grade, i) => [String(i + 1), grade]))

const STATS: { key: Exclude<keyof DeckStats, 'total'>; label: StringKey }[] = [
  { key: 'new', label: 'statNew' },
  { key: 'learning', label: 'statLearning' },
  { key: 'young', label: 'statYoung' },
  { key: 'mature', label: 'statMature' },
  { key: 'due', label: 'statDue' },
]

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** How often the review looks at the clock again, so cards that fall due appear without a grade or reload. */
const CLOCK_TICK_MS = 15 * 1000

function useClockTick(): void {
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])
}

/** A wait such as "10 dəq" or "3 gün", rounded to the unit that suits it. */
function formatWait(ms: number): string {
  if (ms < HOUR_MS) return t('intervalMinutes', { count: Math.max(1, Math.round(ms / MINUTE_MS)) })
  if (ms < DAY_MS) return t('intervalHours', { count: Math.round(ms / HOUR_MS) })
  return t('intervalDays', { count: Math.round(ms / DAY_MS) })
}

/** Lessons that cards link to, in primer order, with how many cards each has. */
const topics = catalog.lessons
  .map((lesson) => ({ lesson, count: selectCards(catalog.decks, { kind: 'lesson', lessonId: lesson.id }).length }))
  .filter(({ count }) => count > 0)

/** What the URL asks to study; every card when it names no Deck, or no Lesson that cards link to. */
function useSelection(): CardSelection {
  const [params] = useSearchParams()
  const selection = selectionFromQuery(params)
  const known =
    selection.kind === 'all' ||
    (selection.kind === 'deck' && catalog.decks.some((deck) => deck.id === selection.deckId)) ||
    (selection.kind === 'lesson' && topics.some(({ lesson }) => lesson.id === selection.lessonId))
  return known ? selection : { kind: 'all' }
}

/** The daily review of the primer's Decks: all of them, one Deck, or the cards of one Lesson. */
export function FlashcardsPage() {
  const selection = useSelection()
  const progress = useProgress((state) => state.progress)
  return (
    <section>
      <h1 className="text-2xl font-semibold text-text">{t('flashcardsTitle')}</h1>
      <p className="mt-1 text-sm text-text-muted">{t('flashcardsDescription')}</p>
      <SelectionPicker selection={selection} />
      {progress ? (
        <>
          <Review
            // A new selection starts with its first card's front.
            key={JSON.stringify(selection)}
            cards={selectCards(catalog.decks, selection)}
            states={progress.flashcards.cards}
            newCardsPerDay={progress.settings.newCardsPerDay}
          />
          <DeckStatsList states={progress.flashcards.cards} newCardsPerDay={progress.settings.newCardsPerDay} />
        </>
      ) : (
        <p className="mt-6 text-sm text-text-muted">{t('flashcardsLoading')}</p>
      )}
      <p className="mt-8 text-xs text-text-muted">
        <Attribution textKey="lessonAttribution" />
      </p>
    </section>
  )
}

function SelectionPicker({ selection }: { selection: CardSelection }) {
  const [, setParams] = useSearchParams()
  const options: { selection: CardSelection; label: string }[] = [
    { selection: { kind: 'all' }, label: t('studyAll') },
    ...catalog.decks.map((deck) => ({
      selection: { kind: 'deck', deckId: deck.id } as const,
      label: t('studyOption', { title: deck.title, count: deck.cards.length }),
    })),
    ...topics.map(({ lesson, count }) => ({
      selection: { kind: 'lesson', lessonId: lesson.id } as const,
      label: t('studyOption', { title: lesson.title, count }),
    })),
  ]
  // An option's value is the selection's URL path, which is unique per selection.
  const option = (index: number) => (
    <option key={index} value={flashcardsPath(options[index].selection)}>
      {options[index].label}
    </option>
  )
  const deckOptions = catalog.decks.map((_, i) => option(1 + i))
  const topicOptions = topics.map((_, i) => option(1 + catalog.decks.length + i))
  return (
    <label className="mt-4 block text-sm text-text">
      {t('studySelection')}
      <select
        className="mt-1 block min-h-11 w-full rounded border border-border bg-surface-raised px-2 text-text sm:min-h-8 sm:w-auto"
        value={flashcardsPath(selection)}
        onChange={(event) => {
          const chosen = options.find((candidate) => flashcardsPath(candidate.selection) === event.currentTarget.value)
          if (chosen) setParams(flashcardsQuery(chosen.selection))
        }}
      >
        {option(0)}
        <optgroup label={t('studyDecks')}>{deckOptions}</optgroup>
        <optgroup label={t('studyTopics')}>{topicOptions}</optgroup>
      </select>
    </label>
  )
}

/** Whether a key press belongs to a form control, an open input method or another shortcut, not to the review. */
function isKeyForSomethingElse(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  return (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    !!target?.closest('input, textarea, select, [contenteditable], dialog')
  )
}

function Review({ cards, states, newCardsPerDay }: { cards: Flashcard[]; states: CardStates; newCardsPerDay: number }) {
  const gradeCard = useProgress((state) => state.gradeCard)
  const [revealed, setRevealed] = useState(false)
  const showAnswerRef = useRef<HTMLButtonElement>(null)
  const goodRef = useRef<HTMLButtonElement>(null)
  const interacted = useRef(false)
  useClockTick()
  const now = new Date()
  const settings = dailyReviewSettings(newCardsPerDay, now)
  const queue = buildDailyQueue(cards, states, settings, now)
  const card = queue.cards[0]
  const { counts } = queue

  function reveal() {
    interacted.current = true
    setRevealed(true)
  }

  function grade(value: Grade) {
    if (!card) return
    interacted.current = true
    setRevealed(false)
    void gradeCard(card.id, value)
  }

  // Keyboard users stay on the next step: grading after a reveal, the next reveal after a grade.
  useEffect(() => {
    if (!interacted.current) return
    ;(revealed ? goodRef : showAnswerRef).current?.focus()
  }, [revealed, card?.id])

  // Space or Enter reveals the answer and 1–4 grade it. On a focused button Space and Enter press it instead.
  const onKey = useRef<(event: KeyboardEvent) => void>(undefined)
  useLayoutEffect(() => {
    onKey.current = (event) => {
      if (!card || isKeyForSomethingElse(event)) return
      // A held key would otherwise go on revealing and grading card after card.
      if (event.repeat) return event.preventDefault()
      handleKey(event)
    }
  })
  function handleKey(event: KeyboardEvent) {
    const onControl = !!(event.target as HTMLElement | null)?.closest('button, a, summary')
    if (!revealed && (event.key === ' ' || event.key === 'Enter') && !onControl) {
      event.preventDefault()
      reveal()
    } else if (revealed && Object.hasOwn(GRADE_KEYS, event.key)) {
      event.preventDefault()
      grade(GRADE_KEYS[event.key])
    }
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey.current?.(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  return (
    <div className="mt-6">
      <p className="text-sm text-text">
        {t('dailyCounts', { total: counts.new + counts.learning + counts.review, ...counts })}
      </p>
      {card ? (
        <article aria-label={t('flashcardsTitle')} className="mt-4 rounded-lg border border-border p-4 sm:p-6">
          <div role="region" lang="en" aria-label={t('flashcardFront')} className={PRIMER_PROSE_CLASS}>
            <PrimerHtml html={card.front} />
          </div>
          {revealed ? (
            <>
              <div role="region" lang="en" aria-label={t('flashcardBack')} className={`${PRIMER_PROSE_CLASS} mt-4 border-t border-border pt-4`}>
                <PrimerHtml html={card.back} />
              </div>
              {card.explanation && (
                <section aria-label={t('flashcardExplanation')} className="mt-4 rounded border border-border bg-surface-raised/50 p-3 text-sm text-text">
                  <h2 className="mb-1 text-xs font-medium tracking-wide text-text-muted uppercase">{t('flashcardExplanation')}</h2>
                  <p>{card.explanation}</p>
                </section>
              )}
              <CardLessons card={card} />
              <div
                role="group"
                aria-label={t('gradeQuestion')}
                className="sticky bottom-0 mt-6 border-t border-border bg-surface pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <p className="mb-2 text-sm text-text-muted">{t('gradeQuestion')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {GRADES.map((value, i) => (
                    <button
                      key={value}
                      ref={value === 'good' ? goodRef : undefined}
                      type="button"
                      aria-keyshortcuts={String(i + 1)}
                      className={`min-h-12 rounded border px-1 py-2 text-sm text-text ${GRADE_CLASSES[value]}`}
                      onClick={() => grade(value)}
                    >
                      <span className="mr-1 hidden text-xs text-text-muted sm:inline" aria-hidden>
                        {i + 1}
                      </span>
                      {t(GRADE_LABELS[value])}
                      <span className="block text-xs text-text-muted">
                        {formatWait(Date.parse(scheduleReview(states[card.id], value, now).due) - now.getTime())}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="sticky bottom-0 mt-6 bg-surface pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:p-0">
              <button
                ref={showAnswerRef}
                type="button"
                aria-keyshortcuts="Space Enter"
                className="min-h-12 w-full rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-surface hover:opacity-90 sm:w-auto"
                onClick={reveal}
              >
                {t('showAnswer')}
              </button>
            </div>
          )}
          <p className="mt-3 hidden text-xs text-text-muted sm:block">{t('flashcardsShortcuts')}</p>
        </article>
      ) : (
        <ReviewDone cards={cards} states={states} settings={settings} now={now} />
      )}
    </div>
  )
}

function CardLessons({ card }: { card: Flashcard }) {
  return (
    <p className="mt-4 text-sm text-text-muted">
      {t('flashcardLessons')}{' '}
      {card.lessonIds.map((lessonId, i) => (
        <span key={lessonId}>
          {i > 0 && ', '}
          <Link to={lessonPath(lessonId)} lang="en" className="link">
            {findLesson(catalog, lessonId)?.title ?? lessonId}
          </Link>
        </span>
      ))}
    </p>
  )
}

function ReviewDone({ cards, states, settings, now }: { cards: Flashcard[]; states: CardStates; settings: DailyReviewSettings; now: Date }) {
  const nextDue = nextDueAt(cards, states)
  // New cards are left only when today's allowance of them is used up.
  const newLeft = deckStats(cards, states, settings, now).new > 0
  return (
    <div role="status" className="mt-4 rounded-lg border border-border p-4 text-sm text-text">
      <p>{t('flashcardsDone')}</p>
      {nextDue && nextDue > now && <p className="mt-1 text-text-muted">{t('flashcardsNextDue', { time: formatWait(nextDue.getTime() - now.getTime()) })}</p>}
      {newLeft && (
        <p className="mt-1 text-text-muted">
          {tRich('flashcardsNewLimitReached', {
            limit: settings.newCardsPerDay,
            settings: (
              <Link to={SETTINGS_ROUTE} className="link">
                {t('flashcardsNewLimitSettings')}
              </Link>
            ),
          })}
        </p>
      )}
    </div>
  )
}

function DeckStatsList({ states, newCardsPerDay }: { states: CardStates; newCardsPerDay: number }) {
  const now = new Date()
  const settings = dailyReviewSettings(newCardsPerDay, now)
  return (
    <section aria-labelledby="deck-stats" className="mt-10 border-t border-border pt-6">
      <h2 id="deck-stats" className="text-lg font-medium text-text">
        {t('deckStatsTitle')}
      </h2>
      <ul className="mt-4 space-y-4">
        {catalog.decks.map((deck) => {
          const stats = deckStats(deck.cards, states, settings, now)
          return (
            <li key={deck.id} aria-label={deck.title} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 lang="en" className="font-medium text-text">
                  {deck.title} <span className="text-sm font-normal text-text-muted">{t('deckCardCount', { count: stats.total })}</span>
                </h3>
                <span className="text-xs">
                  <Link to={flashcardsPath({ kind: 'deck', deckId: deck.id })} className="link inline-flex min-h-11 items-center sm:min-h-0">
                    {t('studyDeck')}
                  </Link>
                  {' · '}
                  <a href={deck.sourceUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-11 items-center sm:min-h-0">
                    {t('viewSource')}
                  </a>
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-5 gap-2 text-center">
                {STATS.map(({ key, label }) => (
                  <div key={key}>
                    <dt className="text-xs text-text-muted">{t(label)}</dt>
                    <dd className="text-lg text-text tabular-nums">{stats[key]}</dd>
                  </div>
                ))}
              </dl>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-text-muted">{t('deckStatsNote')}</p>
    </section>
  )
}
