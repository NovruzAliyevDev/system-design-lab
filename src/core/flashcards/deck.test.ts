import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError } from '../content/catalog'
import { findUnresolvedLinks, referencedAssets } from '../content/links'
import type { DeckSource } from './deck'

const source = { repoUrl: 'https://github.com/donnemartin/system-design-primer', commit: 'abc123', path: 'README.md' }
const readme = ['## Reverse proxy (web server)', 'Text.', '## Cache', 'Text.'].join('\n')
const deckPath = 'resources/flash_cards/System Design.apkg'
const imageMirrors = { 'http://i.imgur.com/old.png': 'images/new.png' }
const flashcardLinkFixes = {
  'https://github.com/donnemartin/system-design-primer#reverse-proxy': 'https://github.com/donnemartin/system-design-primer#reverse-proxy-web-server',
}

function catalogWith(cards: DeckSource['cards'], authored: { flashcardLinkFixes?: unknown } = { flashcardLinkFixes }) {
  return buildContentCatalog({
    markdown: readme,
    source,
    decks: [{ title: 'System Design', path: deckPath, cards }],
    primerImages: ['images/C9ioGtn.png', 'images/new.png'],
    authored: { imageMirrors, ...authored },
  })
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
          { id: 'system-design/20', front: '<p>B</p>', back: '<p>b</p>' },
          { id: 'system-design/10', front: '<p>A</p>', back: '<p>a</p>' },
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

  it('fail the build when the authored fixes are not a map of links to links', () => {
    const build = (fixes: unknown) => () => catalogWith([], { flashcardLinkFixes: fixes })

    expect(build(['a'])).toThrow(ContentValidationError)
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
