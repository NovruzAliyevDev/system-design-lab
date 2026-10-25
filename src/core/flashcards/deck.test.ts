import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError } from '../content/catalog'
import { findUnresolvedLinks, referencedAssets } from '../content/links'
import { selectCards, type DeckSource } from './deck'

const source = { repoUrl: 'https://github.com/donnemartin/system-design-primer', commit: 'abc123', path: 'README.md' }
const readme = ['## Reverse proxy (web server)', 'Text.', '## Cache', 'Text.'].join('\n')
const deckPath = 'resources/flash_cards/System Design.apkg'
const imageMirrors = { 'http://i.imgur.com/old.png': 'images/new.png' }
const flashcardLinkFixes = {
  'https://github.com/donnemartin/system-design-primer#reverse-proxy': 'https://github.com/donnemartin/system-design-primer#reverse-proxy-web-server',
}

/** Every card links to the Cache Lesson unless the authored flashcards are given. */
function catalogWith(cards: DeckSource['cards'], authored: { flashcardLinkFixes?: unknown; flashcards?: unknown; flashcardFormerRepoUrls?: unknown; flashcardPlaceholderLinks?: unknown } = {}) {
  return buildContentCatalog({
    markdown: readme,
    source,
    decks: [{ title: 'System Design', path: deckPath, cards }],
    primerImages: ['images/C9ioGtn.png', 'images/new.png'],
    authored: {
      imageMirrors,
      flashcardLinkFixes,
      flashcards: cards.map((card) => ({ cardId: `system-design/${card.ankiId}`, lessonIds: ['cache'] })),
      ...authored,
    },
  })
}

/** The problems the build reports, or none when it succeeds. */
function problemsOf(build: () => unknown): string[] {
  try {
    build()
    return []
  } catch (error) {
    if (error instanceof ContentValidationError) return error.problems
    throw error
  }
}

function cardWith(front: string, back = '<p>Answer</p>') {
  return catalogWith([{ ankiId: 7, front, back }]).decks[0].cards[0]
}

/** The camo proxy URL GitHub gave an image: its last segment is the original URL in hex. */
const camo = (url: string) =>
  `https://camo.githubusercontent.com/0123abcd/${[...url].map((char) => char.charCodeAt(0).toString(16).padStart(2, '0')).join('')}`

describe('Decks', () => {
  it('are named by their title, and their cards by Anki card id, in the given order', () => {
    const catalog = catalogWith([
      { ankiId: 20, front: '<p>B</p>', back: '<p>b</p>' },
      { ankiId: 10, front: '<p>A</p>', back: '<p>a</p>' },
    ])

    expect(catalog.decks).toEqual([
      {
        id: 'system-design',
        title: 'System Design',
        sourceUrl: 'https://github.com/donnemartin/system-design-primer/blob/abc123/resources/flash_cards/System%20Design.apkg',
        cards: [
          { id: 'system-design/20', front: '<p>B</p>', back: '<p>b</p>', lessonIds: ['cache'] },
          { id: 'system-design/10', front: '<p>A</p>', back: '<p>a</p>', lessonIds: ['cache'] },
        ],
      },
    ])
  })

  it('have sanitised card HTML: no scripts, event handlers, inline styles or SVG', () => {
    const card = cardWith(
      '<h2 style="color: red">Cache<script>alert(1)</script></h2>',
      '<p onclick="steal()" style="font-size: 16px">A <span style="font-weight: 600">cache</span> <a href="javascript:alert(1)">x</a></p><svg><path d="M0"></path></svg><iframe src="https://evil.example"></iframe>',
    )

    expect(card.front).toBe('<h2>Cache</h2>')
    expect(card.back).toBe('<p>A <span>cache</span> <a>x</a></p>')
  })

  it('keep the structure of the answer: lists, tables, code and links', () => {
    const back =
      '<ul><li><a href="https://example.com/a">Source</a></li></ul><table><thead><tr><th>Op</th></tr></thead><tbody><tr><td>Read</td></tr></tbody></table><pre><code>x = 1</code></pre>'

    expect(cardWith('<h2>Q</h2>', back).back).toBe(back)
  })

  it('drop the heading permalinks GitHub put in the copied HTML, which have no text of their own', () => {
    const front =
      '<h2><a id="user-content-cache" class="anchor" href="#cache" aria-hidden="true"><svg class="octicon"><path d="M4"></path></svg></a>Cache</h2>'

    expect(cardWith(front).front).toBe('<h2>Cache</h2>')
  })
})

describe('Flashcard links', () => {
  it('resolve like links on the README page they were copied from', () => {
    const catalog = catalogWith([
      { ankiId: 1, front: '<h2>Q</h2>', back: '<a href="https://github.com/donnemartin/system-design-primer#cache">a</a><a href="#nowhere">b</a>' },
    ])

    expect(findUnresolvedLinks(catalog)).toEqual([{ location: 'system-design/1', href: '#nowhere' }])
  })

  it('are replaced where the README has fixed them since the Deck was made', () => {
    const catalog = catalogWith([
      { ankiId: 1, front: '<h2>Q</h2>', back: '<p><a href="https://github.com/donnemartin/system-design-primer#reverse-proxy">server side</a></p>' },
    ])

    expect(catalog.decks[0].cards[0].back).toBe(
      '<p><a href="https://github.com/donnemartin/system-design-primer#reverse-proxy-web-server">server side</a></p>',
    )
    expect(findUnresolvedLinks(catalog)).toEqual([])
  })

  it('to the repo under the name it had when the Deck was made are links to the primer', () => {
    const former = 'https://github.com/donnemartin/system-design-primer-interview'
    const catalog = catalogWith(
      [{ ankiId: 1, front: '<h2>Q</h2>', back: `<a href="${former}#cache">a</a><a href="${former}#nowhere">b</a><a href="${former}-two#cache">c</a>` }],
      { flashcardFormerRepoUrls: [former] },
    )

    expect(catalog.decks[0].cards[0].back).toBe(
      `<a href="https://github.com/donnemartin/system-design-primer#cache">a</a><a href="https://github.com/donnemartin/system-design-primer#nowhere">b</a><a href="${former}-two#cache">c</a>`,
    )
    expect(findUnresolvedLinks(catalog)).toEqual([{ location: 'system-design/1', href: 'https://github.com/donnemartin/system-design-primer#nowhere' }])
  })

  it('that were placeholders for sections the README did not have yet link where their text says', () => {
    const catalog = catalogWith(
      [{ ankiId: 1, front: '<h2>Q</h2>', back: `<a href="${source.repoUrl}#">Cache</a><a href="${source.repoUrl}#">Queues</a>` }],
      { flashcardPlaceholderLinks: { Cache: `${source.repoUrl}#cache` } },
    )

    expect(catalog.decks[0].cards[0].back).toBe(`<a href="${source.repoUrl}#cache">Cache</a><a href="${source.repoUrl}#">Queues</a>`)
    expect(findUnresolvedLinks(catalog)).toEqual([{ location: 'system-design/1', href: `${source.repoUrl}#` }])
    expect(problemsOf(() => catalogWith([], { flashcardPlaceholderLinks: { Cache: 1 } }))).toEqual(['Flashcard placeholder link "Cache": must be a link'])
  })

  it('fail the build when the former repo URLs are not a list of URLs', () => {
    expect(problemsOf(() => catalogWith([], { flashcardFormerRepoUrls: 'https://example.com' }))).toEqual([
      'Flashcard former repo URLs: must be a list of URLs',
    ])
    expect(problemsOf(() => catalogWith([], { flashcardFormerRepoUrls: ['https://example.com', 'example'] }))).toEqual([
      'Flashcard former repo URL "example": must be an absolute URL',
    ])
  })

  it('fail the build when the authored fixes are not a map of links to links', () => {
    const build = (fixes: unknown) => () => catalogWith([], { flashcardLinkFixes: fixes })

    expect(build(['a'])).toThrow('Flashcard link fixes: must map to links')
    expect(build({ a: 3 })).toThrow('Flashcard link fix "a": must be a link')
    expect(build({ a: '' })).toThrow('Flashcard link fix "a": must be a link')
  })
})

describe('Flashcard images', () => {
  it('are served from the primer, found by the original URL the proxied image gives', () => {
    const catalog = catalogWith([
      {
        ankiId: 1,
        front: '<h2>Q</h2>',
        back: `<p><img src="${camo('http://i.imgur.com/C9ioGtn.png')}" data-canonical-src="http://i.imgur.com/C9ioGtn.png" style="max-width: 100%;"></p>`,
      },
    ])

    expect(catalog.decks[0].cards[0].back).toBe('<p><img src="images/C9ioGtn.png"></p>')
    expect(referencedAssets(catalog)).toEqual(['images/C9ioGtn.png'])
  })

  it('are found by the original URL in the proxy URL when the image does not give it', () => {
    expect(cardWith('<h2>Q</h2>', `<img src="${camo('http://i.imgur.com/C9ioGtn.png')}" alt="">`).back).toBe(
      '<img src="images/C9ioGtn.png" alt="">',
    )
  })

  it('take the link GitHub wraps them in along to the same copy', () => {
    const src = camo('http://i.imgur.com/C9ioGtn.png')

    expect(cardWith('<h2>Q</h2>', `<a href="${src}" target="_blank"><img src="${src}"></a>`).back).toBe(
      '<a href="images/C9ioGtn.png"><img src="images/C9ioGtn.png"></a>',
    )
  })

  it('use an authored mirror when the primer has them under another name', () => {
    expect(cardWith('<h2>Q</h2>', `<img src="${camo('http://i.imgur.com/old.png')}">`).back).toBe('<img src="images/new.png">')
  })

  it('keep their proxy URL when the primer does not have them', () => {
    const src = camo('http://i.imgur.com/missing.png')

    expect(cardWith('<h2>Q</h2>', `<img src="${src}">`).back).toBe(`<img src="${src}">`)
  })
})

describe('authored Flashcards', () => {
  const cards = [
    { ankiId: 1, front: '<h2>Cache</h2>', back: '<p>a</p>' },
    { ankiId: 2, front: '<h2>Reverse proxy</h2>', back: '<p>b</p>' },
  ]

  it('link each card to its Lessons and give it an Azerbaijani explanation where one is written', () => {
    const catalog = catalogWith(cards, {
      flashcards: [
        { cardId: 'system-design/1', lessonIds: ['cache'], explanation: 'Keş tez-tez lazım olan məlumatı yaxında saxlayır.' },
        { cardId: 'system-design/2', lessonIds: ['reverse-proxy-web-server', 'cache'] },
      ],
    })

    expect(catalog.decks[0].cards).toEqual([
      { id: 'system-design/1', front: '<h2>Cache</h2>', back: '<p>a</p>', lessonIds: ['cache'], explanation: 'Keş tez-tez lazım olan məlumatı yaxında saxlayır.' },
      { id: 'system-design/2', front: '<h2>Reverse proxy</h2>', back: '<p>b</p>', lessonIds: ['reverse-proxy-web-server', 'cache'] },
    ])
  })

  it('fail the build on an unknown card or Lesson, a card authored twice and a card left out', () => {
    const problems = problemsOf(() =>
      catalogWith(cards, {
        flashcards: [
          { cardId: 'system-design/1', lessonIds: ['caching'] },
          { cardId: 'system-design/1', lessonIds: ['cache'] },
          { cardId: 'system-design/9', lessonIds: ['cache'] },
        ],
      }),
    )

    expect(problems).toEqual([
      'Flashcard "system-design/1": unknown Lesson id "caching"',
      'Flashcard "system-design/1": is authored more than once',
      'Flashcard "system-design/9": no such card in the Decks',
      'Flashcard "system-design/2": not authored; every card needs the Lessons it links to',
    ])
  })

  it('fail the build on an entry that does not match the schema', () => {
    const problems = problemsOf(() =>
      catalogWith(cards.slice(0, 1), {
        flashcards: [{ cardId: 'system-design/1', lessonIds: [], explanation: ' ', hint: 'x' }, 'card'],
      }),
    )

    expect(problems).toEqual([
      'Flashcard "system-design/1": unknown field "hint"',
      'Flashcard "system-design/1": "lessonIds" must list at least one Lesson id',
      'Flashcard "system-design/1": "explanation" must be a non-empty string',
      'Flashcard #2: must be an object with a "cardId"',
    ])
    expect(problemsOf(() => catalogWith([], { flashcards: {} }))).toEqual(['Flashcards: must be a list of authored Flashcards'])
  })
})

describe('selectCards', () => {
  const catalog = buildContentCatalog({
    markdown: readme,
    source,
    decks: [
      { title: 'System Design', path: deckPath, cards: [{ ankiId: 1, front: 'a', back: 'a' }, { ankiId: 2, front: 'b', back: 'b' }] },
      { title: 'OO Design', path: 'resources/flash_cards/OO Design.apkg', cards: [{ ankiId: 3, front: 'c', back: 'c' }] },
    ],
    authored: {
      flashcards: [
        { cardId: 'system-design/1', lessonIds: ['cache'] },
        { cardId: 'system-design/2', lessonIds: ['reverse-proxy-web-server'] },
        { cardId: 'oo-design/3', lessonIds: ['reverse-proxy-web-server', 'cache'] },
      ],
    },
  })
  const ids = (selection: Parameters<typeof selectCards>[1]) => selectCards(catalog.decks, selection).map((card) => card.id)

  it('picks every card, in Deck order', () => {
    expect(ids({ kind: 'all' })).toEqual(['system-design/1', 'system-design/2', 'oo-design/3'])
  })

  it('picks the cards of one Deck', () => {
    expect(ids({ kind: 'deck', deckId: 'oo-design' })).toEqual(['oo-design/3'])
  })

  it('picks the cards linked to a Lesson, from every Deck', () => {
    expect(ids({ kind: 'lesson', lessonId: 'cache' })).toEqual(['system-design/1', 'oo-design/3'])
  })
})
