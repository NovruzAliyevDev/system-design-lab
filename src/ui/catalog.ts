import type { Catalog } from '../core/content/catalog'
import { selectCards } from '../core/flashcards/deck'
import data from '../generated/catalog.json'

export const catalog = data as Catalog

/** Every card of every Deck, which the whole daily review is made of. */
export const allCards = selectCards(catalog.decks, { kind: 'all' })
