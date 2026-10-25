import type { CardState } from './scheduler'

/** Card id → its state; a card without one is new. */
export type CardStates = Record<string, CardState>

/** A learning card due this soon is shown once nothing else is left, as Anki's "learn ahead" does. */
const LEARN_AHEAD_MS = 20 * 60 * 1000

/** A Deck's cards split by where they are now: new, due, or reviewed and not due yet (each by due time). */
function splitCards<Card extends { id: string }>(cards: readonly Card[], states: CardStates, now: Date) {
  const fresh: Card[] = []
  const reviewed: { card: Card; state: CardState; dueAt: number }[] = []
  for (const card of cards) {
    if (Object.hasOwn(states, card.id)) reviewed.push({ card, state: states[card.id], dueAt: Date.parse(states[card.id].due) })
    else fresh.push(card)
  }
  reviewed.sort((a, b) => a.dueAt - b.dueAt)
  const nowMs = now.getTime()
  return { fresh, due: reviewed.filter(({ dueAt }) => dueAt <= nowMs), later: reviewed.filter(({ dueAt }) => dueAt > nowMs) }
}

/**
 * The order to review a Deck's cards in now: due cards first (most overdue first), then new cards in
 * Deck order, then learning cards due within the next 20 minutes. Other cards are not due yet.
 */
export function reviewQueue<Card extends { id: string }>(cards: readonly Card[], states: CardStates, now: Date): Card[] {
  const { fresh, due, later } = splitCards(cards, states, now)
  const learnAhead = later.filter(({ state, dueAt }) => state.phase === 'learning' && dueAt <= now.getTime() + LEARN_AHEAD_MS)
  return [...due.map(({ card }) => card), ...fresh, ...learnAhead.map(({ card }) => card)]
}

/** How many of a Deck's cards are new, and how many are due now. */
export function reviewCounts(cards: readonly { id: string }[], states: CardStates, now: Date): { due: number; new: number } {
  const { fresh, due } = splitCards(cards, states, now)
  return { due: due.length, new: fresh.length }
}

/** When the first of a Deck's reviewed cards falls due; undefined while none has been reviewed. */
export function nextDueAt(cards: readonly { id: string }[], states: CardStates): Date | undefined {
  const reviewed = cards.flatMap((card) => (Object.hasOwn(states, card.id) ? [Date.parse(states[card.id].due)] : []))
  return reviewed.length > 0 ? new Date(Math.min(...reviewed)) : undefined
}
