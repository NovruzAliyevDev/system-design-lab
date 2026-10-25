import { slug } from 'github-slugger'
import type { Element, Nodes, Root } from 'hast'
import { fromHtml } from 'hast-util-from-html'
import { defaultSchema, sanitize } from 'hast-util-sanitize'
import { toHtml } from 'hast-util-to-html'

/** A card of a Deck. Front and back are sanitised HTML, as the primer's Anki Deck has them. */
export interface Flashcard {
  id: string
  front: string
  back: string
}

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
}

/** The primer keeps a copy of the imgur images it uses here, named as on imgur. */
const PRIMER_IMAGE_DIR = 'images'
/** GitHub's image proxy: the last path segment is the original URL in hex. */
const CAMO_URL = /^https:\/\/camo\.githubusercontent\.com\/[0-9a-f]+\/((?:[0-9a-f]{2})+)$/i
const IMGUR_URL = /^https?:\/\/i\.imgur\.com\/([\w-]+\.(?:png|jpe?g|gif))$/i

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
    })),
  }
}

/** The card fields were copied from GitHub's rendering of the README, styles, proxied images and all. */
function cleanCardHtml(html: string, context: DeckContext): string {
  const tree = fromHtml(html, { fragment: true })
  // Before sanitising, which drops the attribute that some images keep their original URL in.
  visitElements(tree, (element) => {
    if (element.tagName === 'img') element.properties.src = imageSource(element, context)
    const { href } = element.properties
    if (element.tagName === 'a' && typeof href === 'string') {
      // GitHub links each image to its full-size proxy URL.
      element.properties.href = Object.hasOwn(context.linkFixes, href) ? context.linkFixes[href] : primerCopy(decodeCamoUrl(href), context) ?? href
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

/** Checks the authored link fixes: a map of links in the Decks to the links to show instead. */
export function validateLinkFixes(input: unknown): { fixes: Record<string, string>; problems: string[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { fixes: {}, problems: ['Flashcard link fixes: must map links to links'] }
  }
  const fixes: Record<string, string> = {}
  const problems: string[] = []
  for (const [link, fixed] of Object.entries(input)) {
    if (typeof fixed === 'string' && fixed !== '') fixes[link] = fixed
    else problems.push(`Flashcard link fix "${link}": must be a link`)
  }
  return { fixes, problems }
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
