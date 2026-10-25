import type { CardState } from './scheduler'

/** Card id → its state; a card without one is new. */
export type CardStates = Record<string, CardState>

/** What the daily review needs to know about the learner. */
export interface DailyReviewSettings {
  /** How many new cards a day may introduce, across all Decks. */
  newCardsPerDay: number
  /** The learner's offset from UTC (e.g. 240 in Baku): a day runs from local midnight to midnight. */
  utcOffsetMinutes: number
}

/** The cards to review now, in order, with how many of them are new, learning and review cards. */
export interface DailyQueue<Card> {
  cards: Card[]
  counts: { new: number; learning: number; review: number }
}

/** How a Deck's cards stand: young and mature cards have graduated, below and from a 21-day interval. */
export interface DeckStats {
  total: number
  new: number
  learning: number
  young: number
  mature: number
  /** Reviewed cards today's review shows now, as `buildDailyQueue` picks them. */
  due: number
}

/** A learning card due this soon is shown once nothing else is left, as Anki's "learn ahead" does. */
const LEARN_AHEAD_MS = 20 * 60 * 1000
/** Anki calls a card mature from this interval on. */
const MATURE_INTERVAL_DAYS = 21
const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

/** The start and end (exclusive) of the learner's day around `now`, in ms. */
function today(now: Date, utcOffsetMinutes: number): { start: number; end: number } {
  const offsetMs = utcOffsetMinutes * MINUTE_MS
  const start = Math.floor((now.getTime() + offsetMs) / DAY_MS) * DAY_MS - offsetMs
  return { start, end: start + DAY_MS }
}

/** A Deck's cards split into new ones (in Deck order) and reviewed ones (by due time). */
function splitCards<Card extends { id: string }>(cards: readonly Card[], states: CardStates) {
  const fresh: Card[] = []
  const reviewed: { card: Card; state: CardState; dueAt: number }[] = []
  for (const card of cards) {
    if (Object.hasOwn(states, card.id)) reviewed.push({ card, state: states[card.id], dueAt: Date.parse(states[card.id].due) })
    else fresh.push(card)
  }
  reviewed.sort((a, b) => a.dueAt - b.dueAt)
  return { fresh, reviewed }
}

/** Whether a reviewed card is due now: a learning card by the minute, a review card by the day, as in Anki. */
function isDue({ state, dueAt }: { state: CardState; dueAt: number }, now: Date, dayEnd: number): boolean {
  return state.phase === 'learning' ? dueAt <= now.getTime() : dueAt < dayEnd
}

/** A learning card that is not due yet but will be within the learn-ahead window. */
function isLearnAhead(card: { state: CardState; dueAt: number }, now: Date, dayEnd: number): boolean {
  return card.state.phase === 'learning' && !isDue(card, now, dayEnd) && card.dueAt <= now.getTime() + LEARN_AHEAD_MS
}

/**
 * Today's review of the given cards: due cards first (most overdue first), then new cards in Deck
 * order, as many as the daily limit has left, then learning cards due within the next 20 minutes.
 * New cards introduced today count against the limit whichever Deck they are in, so `states` holds
 * every card's state, not only those of `cards`.
 */
export function buildDailyQueue<Card extends { id: string }>(
  cards: readonly Card[],
  states: CardStates,
  settings: DailyReviewSettings,
  now: Date,
): DailyQueue<Card> {
  const day = today(now, settings.utcOffsetMinutes)
  const { fresh, reviewed } = splitCards(cards, states)
  const introducedToday = Object.values(states).filter((state) => {
    const introduced = state.introduced === undefined ? NaN : Date.parse(state.introduced)
    return introduced >= day.start && introduced < day.end
  }).length
  const newCards = fresh.slice(0, Math.max(0, settings.newCardsPerDay - introducedToday))
  const due = reviewed.filter((card) => isDue(card, now, day.end))
  const learnAhead = reviewed.filter((card) => isLearnAhead(card, now, day.end))
  const learning = [...due, ...learnAhead].filter(({ state }) => state.phase === 'learning').length
  return {
    cards: [...due.map(({ card }) => card), ...newCards, ...learnAhead.map(({ card }) => card)],
    counts: { new: newCards.length, learning, review: due.filter(({ state }) => state.phase === 'review').length },
  }
}

/** How many of a Deck's cards are new, learning, young and mature, and how many are due today. */
export function deckStats(
  cards: readonly { id: string }[],
  states: CardStates,
  settings: Pick<DailyReviewSettings, 'utcOffsetMinutes'>,
  now: Date,
): DeckStats {
  const { end } = today(now, settings.utcOffsetMinutes)
  const { fresh, reviewed } = splitCards(cards, states)
  const graduated = reviewed.filter(({ state }) => state.phase === 'review')
  const mature = graduated.filter(({ state }) => state.intervalDays >= MATURE_INTERVAL_DAYS).length
  return {
    total: cards.length,
    new: fresh.length,
    learning: reviewed.length - graduated.length,
    young: graduated.length - mature,
    mature,
    due: reviewed.filter((card) => isDue(card, now, end) || isLearnAhead(card, now, end)).length,
  }
}

/** When the first of a Deck's reviewed cards falls due; undefined while none has been reviewed. */
export function nextDueAt(cards: readonly { id: string }[], states: CardStates): Date | undefined {
  const reviewed = cards.flatMap((card) => (Object.hasOwn(states, card.id) ? [Date.parse(states[card.id].due)] : []))
  return reviewed.length > 0 ? new Date(Math.min(...reviewed)) : undefined
}
