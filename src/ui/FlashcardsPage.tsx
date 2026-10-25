import { useEffect, useRef, useState } from 'react'
import type { Deck } from '../core/flashcards/deck'
import { nextDueAt, reviewCounts, reviewQueue, type CardStates } from '../core/flashcards/queue'
import { GRADES, scheduleReview, type Grade } from '../core/flashcards/scheduler'
import { Attribution } from './Attribution'
import { catalog } from './catalog'
import { t, type StringKey } from './i18n'
import { PRIMER_PROSE_CLASS, PrimerHtml } from './PrimerMarkdown'
import { useProgress } from './progress/store'

const GRADE_LABELS: Record<Grade, StringKey> = { again: 'gradeAgain', hard: 'gradeHard', good: 'gradeGood', easy: 'gradeEasy' }

const GRADE_CLASSES: Record<Grade, string> = {
  again: 'border-red-500/60 hover:bg-red-500/10',
  hard: 'border-zinc-600 hover:bg-zinc-800',
  good: 'border-emerald-500/60 hover:bg-emerald-500/10',
  easy: 'border-sky-500/60 hover:bg-sky-500/10',
}

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

/** Reviews the primer's System Design Deck: due cards first, then new ones. */
export function FlashcardsPage() {
  const deck = catalog.decks[0]
  return (
    <section>
      <h1 className="text-2xl font-semibold text-zinc-50">{t('flashcardsTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t('flashcardsDescription')}</p>
      {deck && <DeckReview deck={deck} />}
    </section>
  )
}

function DeckReview({ deck }: { deck: Deck }) {
  const states = useProgress((state) => state.progress?.flashcards.cards)
  return (
    <div className="mt-6">
      <h2 lang="en" className="text-lg font-medium text-zinc-100">
        {deck.title}
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        <a href={deck.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
          {t('viewSource')}
        </a>
        {' · '}
        <Attribution textKey="lessonAttribution" />
      </p>
      {states ? <Review deck={deck} states={states} /> : <p className="mt-6 text-sm text-zinc-400">{t('flashcardsLoading')}</p>}
    </div>
  )
}

function Review({ deck, states }: { deck: Deck; states: CardStates }) {
  const gradeCard = useProgress((state) => state.gradeCard)
  const [revealed, setRevealed] = useState(false)
  const showAnswerRef = useRef<HTMLButtonElement>(null)
  const goodRef = useRef<HTMLButtonElement>(null)
  const interacted = useRef(false)
  useClockTick()
  const now = new Date()
  const card = reviewQueue(deck.cards, states, now)[0]
  const counts = reviewCounts(deck.cards, states, now)

  // Keyboard users stay on the next step: grading after a reveal, the next reveal after a grade.
  useEffect(() => {
    if (!interacted.current) return
    ;(revealed ? goodRef : showAnswerRef).current?.focus()
  }, [revealed, card?.id])

  function grade(value: Grade) {
    if (!card) return
    interacted.current = true
    setRevealed(false)
    void gradeCard(card.id, value)
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-zinc-400">{t('flashcardsCounts', { due: counts.due, new: counts.new })}</p>
      {card ? (
        <article aria-label={t('flashcardsTitle')} className="mt-4 rounded-lg border border-zinc-800 p-4 sm:p-6">
          <div role="region" lang="en" aria-label={t('flashcardFront')} className={PRIMER_PROSE_CLASS}>
            <PrimerHtml html={card.front} />
          </div>
          {revealed ? (
            <>
              <div role="region" lang="en" aria-label={t('flashcardBack')} className={`${PRIMER_PROSE_CLASS} mt-4 border-t border-zinc-800 pt-4`}>
                <PrimerHtml html={card.back} />
              </div>
              <div role="group" aria-label={t('gradeQuestion')} className="sticky bottom-0 mt-6 border-t border-zinc-800 bg-zinc-950 py-3">
                <p className="mb-2 text-sm text-zinc-400">{t('gradeQuestion')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {GRADES.map((value) => (
                    <button
                      key={value}
                      ref={value === 'good' ? goodRef : undefined}
                      type="button"
                      className={`rounded border px-2 py-2 text-sm text-zinc-100 ${GRADE_CLASSES[value]}`}
                      onClick={() => grade(value)}
                    >
                      {t(GRADE_LABELS[value])}
                      <span className="block text-xs text-zinc-400">
                        {formatWait(Date.parse(scheduleReview(states[card.id], value, now).due) - now.getTime())}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <button
              ref={showAnswerRef}
              type="button"
              className="mt-6 w-full rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:border-zinc-500 sm:w-auto"
              onClick={() => {
                interacted.current = true
                setRevealed(true)
              }}
            >
              {t('showAnswer')}
            </button>
          )}
        </article>
      ) : (
        <NothingDue deck={deck} states={states} now={now} />
      )}
    </div>
  )
}

function NothingDue({ deck, states, now }: { deck: Deck; states: CardStates; now: Date }) {
  const nextDue = nextDueAt(deck.cards, states)
  return (
    <div role="status" className="mt-4 rounded-lg border border-zinc-800 p-4 text-sm text-zinc-300">
      <p>{t('flashcardsDone')}</p>
      {nextDue && <p className="mt-1 text-zinc-400">{t('flashcardsNextDue', { time: formatWait(nextDue.getTime() - now.getTime()) })}</p>}
    </div>
  )
}
