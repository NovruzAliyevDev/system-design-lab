import { slug } from 'github-slugger'
import type { Element, Nodes, Root } from 'hast'
import { fromHtml } from 'hast-util-from-html'
import { defaultSchema, sanitize } from 'hast-util-sanitize'
import { toHtml } from 'hast-util-to-html'
import type { LessonReference } from '../content/catalog'
import { isRecord, isText, isTextList } from '../content/validation'

/** A card of a Deck. Front and back are sanitised HTML, as the primer's Anki Deck has them. */
export interface Flashcard {
  id: string
  front: string
  back: string
  /** The Lessons the card is about (authored), at least one. */
  lessonIds: string[]
  /** A short Azerbaijani explanation shown under the English answer, where one is authored. */
  explanation?: string
}

/** What is authored for a card: the Lessons it links to and, optionally, an explanation. */
export interface FlashcardInput {
  /** `<deck id>/<Anki card id>`, as the catalog names the card. */
  cardId: string
  lessonIds: string[]
  explanation?: string
}

/** Which cards to study: all of them, one Deck's, or those linked to a Lesson. */
export type CardSelection = { kind: 'all' } | { kind: 'deck'; deckId: string } | { kind: 'lesson'; lessonId: string }

/** One of the primer's Anki Decks, converted for the app. */
export interface Deck {
  id: string
  title: string
  /** Link to the Deck's `.apkg` file at the pinned commit. */
  sourceUrl: string
  cards: Flashcard[]
}

/** A Deck as the Content Pipeline reads it from its Anki package: card fields as Anki stores them. */
export interface DeckSource {
  title: string
  /** Path of the `.apkg` file in the primer repo. */
  path: string
  /** In the order Anki shows new cards. */
  cards: { ankiId: number; front: string; back: string }[]
}

/** What converting a Deck needs to know about the primer repo. */
export interface DeckContext {
  repoUrl: string
  commit: string
  /** Authored image mirrors: original image URL → the same image in the primer repo. */
  imageMirrors: Record<string, string>
  /** Paths of the image files in the primer's images folder. */
  primerImages: ReadonlySet<string>
  /** Authored fixes of links the Decks have and the README has fixed since: link → fixed link. */
  linkFixes: Record<string, string>
  /**
   * Authored targets of links that were placeholders (to the README with an empty fragment) for
   * sections the README did not have yet: link text → link.
   */
  placeholderLinks: Record<string, string>
  /** URLs the primer repo had before it was renamed, which links in the Decks may still use. */
  formerRepoUrls: readonly string[]
}

/** The primer keeps a copy of the imgur images it uses here, named as on imgur. */
const PRIMER_IMAGE_DIR = 'images'
/** GitHub's image proxy: the last path segment is the original URL in hex. */
const CAMO_URL = /^https:\/\/camo\.githubusercontent\.com\/[0-9a-f]+\/((?:[0-9a-f]{2})+)$/i
const IMGUR_URL = /^https?:\/\/i\.imgur\.com\/([\w-]+\.(?:png|jpe?g|gif))$/i

/** Builds a Deck; its cards link to no Lessons until `linkCards` adds the authored links. */
export function buildDeck(source: DeckSource, context: DeckContext): Deck {
  const id = slug(source.title)
  const pathInRepo = source.path.split('/').map(encodeURIComponent).join('/')
  return {
    id,
    title: source.title,
    sourceUrl: `${context.repoUrl}/blob/${context.commit}/${pathInRepo}`,
    cards: source.cards.map((card) => ({
      id: `${id}/${card.ankiId}`,
      front: cleanCardHtml(card.front, context),
      back: cleanCardHtml(card.back, context),
      lessonIds: [],
    })),
  }
}

/** The card fields were copied from GitHub's rendering of the README, styles, proxied images and all. */
function cleanCardHtml(html: string, context: DeckContext): string {
  const tree = fromHtml(html, { fragment: true })
  // Before sanitising, which drops the attribute that some images keep their original URL in.
  visitElements(tree, (element) => {
    if (element.tagName === 'img') element.properties.src = imageSource(element, context)
    if (element.tagName === 'a' && typeof element.properties.href === 'string') {
      const href = withCurrentRepoUrl(element.properties.href, context)
      const text = textOf(element).trim()
      if (href === `${context.repoUrl}#` && Object.hasOwn(context.placeholderLinks, text)) element.properties.href = context.placeholderLinks[text]
      else if (Object.hasOwn(context.linkFixes, href)) element.properties.href = context.linkFixes[href]
      // GitHub links each image to its full-size proxy URL.
      else element.properties.href = primerCopy(decodeCamoUrl(href), context) ?? href
    }
  })
  // GitHub's sanitising rules, which also drop the inline styles the copied HTML is full of.
  const clean = sanitize(tree, defaultSchema) as Root
  visitElements(clean, (element) => {
    // Ids only made sense on GitHub's page (sanitising prefixes them) and no card links to them.
    delete element.properties.id
    delete element.properties.name
  })
  return toHtml(removeEmptyLinks(clean))
}

/** A link into the primer repo under a former name, rewritten to its current URL. */
function withCurrentRepoUrl(href: string, context: DeckContext): string {
  const former = context.formerRepoUrls.find((url) => href === url || href.startsWith(`${url}#`) || href.startsWith(`${url}/`))
  return former === undefined ? href : `${context.repoUrl}${href.slice(former.length)}`
}

/** Where a card image is served from: the primer's copy when it has one, the proxy URL otherwise. */
function imageSource(image: Element, context: DeckContext): string | undefined {
  const src = typeof image.properties.src === 'string' ? image.properties.src : undefined
  const canonical = image.properties.dataCanonicalSrc
  const original = typeof canonical === 'string' ? canonical : src && decodeCamoUrl(src)
  return primerCopy(original, context) ?? src
}

/** The primer's copy of the image at an original (imgur) URL, if it has one. */
function primerCopy(original: string | undefined, context: DeckContext): string | undefined {
  if (!original) return undefined
  if (Object.hasOwn(context.imageMirrors, original)) return context.imageMirrors[original]
  const name = IMGUR_URL.exec(original)?.[1]
  const copy = name && `${PRIMER_IMAGE_DIR}/${name}`
  return copy && context.primerImages.has(copy) ? copy : undefined
}

function decodeCamoUrl(src: string): string | undefined {
  const hex = CAMO_URL.exec(src)?.[1]
  return hex && hex.replace(/../g, (byte) => String.fromCharCode(parseInt(byte, 16)))
}

/** Drops links with no text, such as the permalink icon GitHub puts in each heading (its SVG is sanitised away). */
function removeEmptyLinks<T extends Nodes>(node: T): T {
  if (!('children' in node)) return node
  node.children = node.children
    .map((child) => removeEmptyLinks(child))
    .filter((child) => !(child.type === 'element' && child.tagName === 'a' && textOf(child).trim() === '' && !hasImage(child))) as typeof node.children
  return node
}

function textOf(node: Nodes): string {
  if (node.type === 'text') return node.value
  return 'children' in node ? node.children.map((child) => textOf(child)).join('') : ''
}

function hasImage(node: Nodes): boolean {
  if (node.type === 'element' && node.tagName === 'img') return true
  return 'children' in node && node.children.some((child) => hasImage(child))
}

function visitElements(node: Nodes, visit: (element: Element) => void): void {
  if (node.type === 'element') visit(node)
  if ('children' in node) for (const child of node.children) visitElements(child, visit)
}

/**
 * Checks authored link fixes: a map of links in the Decks (or, for placeholder links, their text) to
 * the links to show instead. `kind` names one of them and all of them in problems.
 */
export function validateLinkFixes(
  input: unknown,
  kind = { one: 'link fix', all: 'link fixes' },
): { fixes: Record<string, string>; problems: string[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { fixes: {}, problems: [`Flashcard ${kind.all}: must map to links`] }
  }
  const fixes: Record<string, string> = {}
  const problems: string[] = []
  for (const [link, fixed] of Object.entries(input)) {
    if (typeof fixed === 'string' && fixed !== '') fixes[link] = fixed
    else problems.push(`Flashcard ${kind.one} "${link}": must be a link`)
  }
  return { fixes, problems }
}

/** Checks the authored former URLs of the primer repo. */
export function validateFormerRepoUrls(input: unknown): { urls: string[]; problems: string[] } {
  if (!Array.isArray(input)) return { urls: [], problems: ['Flashcard former repo URLs: must be a list of URLs'] }
  const urls: string[] = []
  const problems: string[] = []
  for (const url of input as unknown[]) {
    if (typeof url === 'string' && /^https?:\/\/\S+$/.test(url)) urls.push(url)
    else problems.push(`Flashcard former repo URL "${String(url)}": must be an absolute URL`)
  }
  return { urls, problems }
}

const FLASHCARD_FIELDS = new Set<string>(['cardId', 'lessonIds', 'explanation'])

/**
 * Checks the authored Flashcards against their schema, the cards of the Decks and the Lessons, and
 * adds them to the cards. Every card must be authored, so that each one links to its Lessons.
 */
export function linkCards(decks: Deck[], input: unknown, lessonIds: ReadonlySet<string>): { decks: Deck[]; problems: string[] } {
  if (!Array.isArray(input)) return { decks, problems: ['Flashcards: must be a list of authored Flashcards'] }

  const cardIds = new Set(decks.flatMap((deck) => deck.cards.map((card) => card.id)))
  const authored = new Map<string, Pick<Flashcard, 'lessonIds' | 'explanation'>>()
  const seen = new Set<string>()
  const problems: string[] = []
  input.forEach((item: unknown, i) => {
    if (!isRecord(item) || !isText(item.cardId)) return problems.push(`Flashcard #${i + 1}: must be an object with a "cardId"`)
    const { cardId, lessonIds: cardLessonIds, explanation } = item
    const problem = (message: string) => problems.push(`Flashcard "${cardId}": ${message}`)
    const before = problems.length

    for (const field of Object.keys(item)) if (!FLASHCARD_FIELDS.has(field)) problem(`unknown field "${field}"`)
    if (!cardIds.has(cardId)) problem('no such card in the Decks')
    else if (seen.has(cardId)) problem('is authored more than once')
    seen.add(cardId)
    if (!isTextList(cardLessonIds)) problem('"lessonIds" must be a list of Lesson ids')
    else if (cardLessonIds.length === 0) problem('"lessonIds" must list at least one Lesson id')
    else for (const id of cardLessonIds) if (!lessonIds.has(id)) problem(`unknown Lesson id "${id}"`)
    if (explanation !== undefined && !isText(explanation)) problem('"explanation" must be a non-empty string')

    if (problems.length > before) return
    const lessons = cardLessonIds as string[]
    authored.set(cardId, explanation === undefined ? { lessonIds: lessons } : { lessonIds: lessons, explanation: explanation as string })
  })
  for (const cardId of cardIds) {
    if (!seen.has(cardId)) problems.push(`Flashcard "${cardId}": not authored; every card needs the Lessons it links to`)
  }

  return {
    decks: decks.map((deck) => ({ ...deck, cards: deck.cards.map((card) => ({ ...card, ...authored.get(card.id) })) })),
    problems,
  }
}

/**
 * The Lesson ids the authored Flashcards reference, per card. Malformed entries contribute what they
 * can: reporting them is `linkCards`'s job.
 */
export function flashcardLessonReferences(input: unknown): LessonReference[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item: unknown) => {
    if (!isRecord(item) || !isText(item.cardId) || !Array.isArray(item.lessonIds)) return []
    const referrer = `Flashcard "${item.cardId}"`
    return item.lessonIds.filter(isText).map((lessonId) => ({ referrer, lessonId }))
  })
}

/** The cards of a selection, in Deck order. */
export function selectCards(decks: readonly Deck[], selection: CardSelection): Flashcard[] {
  const cards = decks.filter((deck) => selection.kind !== 'deck' || deck.id === selection.deckId).flatMap((deck) => deck.cards)
  return selection.kind === 'lesson' ? cards.filter((card) => card.lessonIds.includes(selection.lessonId)) : cards
}

/** Every link and image URL in card HTML, in order. */
export function htmlLinkUrls(html: string): string[] {
  const urls: string[] = []
  visitElements(fromHtml(html, { fragment: true }), (element) => {
    const url = element.tagName === 'a' ? element.properties.href : element.tagName === 'img' ? element.properties.src : undefined
    if (typeof url === 'string') urls.push(url)
  })
  return urls
}
