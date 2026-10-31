import { describe, expect, it } from 'vitest'
import { comparePrimerVersions, formatPinChangeReport } from './pin-change-report'

const repoUrl = 'https://github.com/donnemartin/system-design-primer'
const version = (commit: string, lines: string[]) => ({ markdown: lines.join('\n'), source: { repoUrl, commit, path: 'README.md' } })

describe('comparePrimerVersions', () => {
  it('reports the Lessons only the new pin has as added and those only the old pin has as removed', () => {
    const before = version('old', ['## Cache', 'a', '### Client caching', 'b', '## Queues', 'c'])
    const after = version('new', ['## Cache', 'a', '### CDN', 'b2', '## Database', 'd'])

    const report = comparePrimerVersions({ before, after })

    expect(report.added).toEqual([
      { id: 'cdn', title: 'CDN' },
      { id: 'database', title: 'Database' },
    ])
    expect(report.removed).toEqual([
      { id: 'client-caching', title: 'Client caching' },
      { id: 'queues', title: 'Queues' },
    ])
    expect(report.renamed).toEqual([])
  })

  it('reports a Lesson whose heading changed a little as renamed, not as removed and added', () => {
    const before = version('old', ['## Relational database management system (RDBMS)', 'a', '## Load balancer', 'b', '## Queues', 'c'])
    const after = version('new', ['## Relational database management system', 'a', '## Load balancers', 'b', '## CDN', 'd'])

    const report = comparePrimerVersions({ before, after })

    expect(report.renamed).toEqual([
      {
        before: { id: 'relational-database-management-system-rdbms', title: 'Relational database management system (RDBMS)' },
        after: { id: 'relational-database-management-system', title: 'Relational database management system' },
      },
      { before: { id: 'load-balancer', title: 'Load balancer' }, after: { id: 'load-balancers', title: 'Load balancers' } },
    ])
    expect(report.added).toEqual([{ id: 'cdn', title: 'CDN' }])
    expect(report.removed).toEqual([{ id: 'queues', title: 'Queues' }])
  })

  it('reports a heading whose title changed but whose anchor did not as renamed with the same id', () => {
    const report = comparePrimerVersions({
      before: version('old', ['## Cache-aside', 'a']),
      after: version('new', ['## Cache aside', 'a']),
    })

    expect(report.renamed).toEqual([
      { before: { id: 'cache-aside', title: 'Cache-aside' }, after: { id: 'cache-aside', title: 'Cache aside' } },
    ])
    expect(report.added).toEqual([])
    expect(report.removed).toEqual([])
  })

  it('pairs a removed Lesson with the most similar added one only', () => {
    const report = comparePrimerVersions({
      before: version('old', ['## Load balancer', 'a']),
      after: version('new', ['## Load balancing', 'a', '## Load balancers', 'b']),
    })

    expect(report.renamed).toEqual([
      { before: { id: 'load-balancer', title: 'Load balancer' }, after: { id: 'load-balancers', title: 'Load balancers' } },
    ])
    expect(report.added).toEqual([{ id: 'load-balancing', title: 'Load balancing' }])
  })

  it('does not pair Lessons that only share a word', () => {
    const report = comparePrimerVersions({
      before: version('old', ['## Client caching', 'a']),
      after: version('new', ['## CDN caching', 'a']),
    })

    expect(report.renamed).toEqual([])
    expect(report.added).toEqual([{ id: 'cdn-caching', title: 'CDN caching' }])
    expect(report.removed).toEqual([{ id: 'client-caching', title: 'Client caching' }])
  })

  it('does not pair Lessons whose titles differ in a number', () => {
    const report = comparePrimerVersions({
      before: version('old', ['## Layer 4 load balancing', 'a']),
      after: version('new', ['## Layer 7 load balancing', 'a']),
    })

    expect(report.renamed).toEqual([])
    expect(report.added).toEqual([{ id: 'layer-7-load-balancing', title: 'Layer 7 load balancing' }])
  })

  it('compares Lessons even when other parts of the primer, such as the study guide, cannot be read', () => {
    const report = comparePrimerVersions({
      before: version('old', ['## Study guide', 'No timelines here.']),
      after: version('new', ['## Study guide', 'No timelines here.', '## Cache', 'a']),
    })

    expect(report.added).toEqual([{ id: 'cache', title: 'Cache' }])
  })

  it('lists authored items that reference Lessons the new pin does not have, with the new id of a renamed Lesson', () => {
    const before = version('old', ['## Load balancer', 'a', '## Queues', 'b', '## Cache', 'c'])
    const after = version('new', ['## Load balancers', 'a', '## Cache', 'c'])
    const glossary = [
      { term: 'Load balancer', explanation: 'x', lessonIds: ['load-balancer'] },
      { term: 'Message queue', explanation: 'x', lessonIds: ['cache', 'queues'] },
      { term: 'Cache', explanation: 'x', lessonIds: ['cache'] },
    ]

    const report = comparePrimerVersions({ before, after, authored: { glossary } })

    expect(report.brokenReferences).toEqual([
      { referrer: 'Glossary Term "Load balancer"', lessonId: 'load-balancer', renamedTo: 'load-balancers' },
      { referrer: 'Glossary Term "Message queue"', lessonId: 'queues' },
    ])
  })

  it('lists authored Flashcards that reference Lessons the new pin does not have', () => {
    const before = version('old', ['## Queues', 'b', '## Cache', 'c'])
    const after = version('new', ['## Cache', 'c'])
    const flashcards = [
      { cardId: 'system-design/1', lessonIds: ['cache', 'queues'] },
      { cardId: 'system-design/2', lessonIds: ['cache'] },
    ]

    const report = comparePrimerVersions({ before, after, authored: { flashcards } })

    expect(report.brokenReferences).toEqual([{ referrer: 'Flashcard "system-design/1"', lessonId: 'queues' }])
  })

  it('lists authored Quizzes shown in Lessons the new pin does not have', () => {
    const before = version('old', ['## Queues', 'b', '## Cache', 'c'])
    const after = version('new', ['## Cache', 'c'])
    const quizzes = [
      { id: 'queues-basics', lessonId: 'queues', questions: [] },
      { id: 'cache-basics', lessonId: 'cache', questions: [] },
    ]

    const report = comparePrimerVersions({ before, after, authored: { quizzes } })

    expect(report.brokenReferences).toEqual([{ referrer: 'Quiz "queues-basics"', lessonId: 'queues' }])
  })

  it('lists authored Challenges that practise Lessons the new pin does not have', () => {
    const before = version('old', ['## Queues', 'b', '## Cache', 'c'])
    const after = version('new', ['## Cache', 'c'])
    const challenges = [{ id: 'pastebin', lessonIds: ['cache', 'queues'], stages: [] }]

    const report = comparePrimerVersions({ before, after, authored: { challenges } })

    expect(report.brokenReferences).toEqual([{ referrer: 'Challenge "pastebin"', lessonId: 'queues' }])
  })

  it('lists Skill Tree topics that cover Lessons the new pin does not have', () => {
    const before = version('old', ['## Queues', 'b', '## Cache', 'c'])
    const after = version('new', ['## Cache', 'c'])
    const skillTree = [{ id: 'asynchronism', title: 'Asynchronism', lessonIds: ['queues'], prerequisiteIds: [] }]

    const report = comparePrimerVersions({ before, after, authored: { skillTree } })

    expect(report.brokenReferences).toEqual([{ referrer: 'Skill Tree topic "asynchronism"', lessonId: 'queues' }])
  })

  it('reports no broken references when every authored reference resolves', () => {
    const lines = ['## Cache', 'a']
    const glossary = [{ term: 'Cache', explanation: 'x', lessonIds: ['cache'] }]

    const report = comparePrimerVersions({ before: version('old', lines), after: version('new', lines), authored: { glossary } })

    expect(report).toMatchObject({ added: [], removed: [], renamed: [], brokenReferences: [] })
  })
})

describe('formatPinChangeReport', () => {
  it('lists each change and broken reference on a line of its own', () => {
    const report = comparePrimerVersions({
      before: version('1111111aaaa', ['## Load balancer', 'a', '## Queues', 'b', '## Cache-aside', 'c']),
      after: version('2222222bbbb', ['## Load balancers', 'a', '## Cache aside', 'c', '## CDN', 'd']),
      authored: { glossary: [{ term: 'Message queue', explanation: 'x', lessonIds: ['queues'] }] },
    })

    expect(formatPinChangeReport(report)).toBe(
      [
        'Primer pin 1111111 → 2222222',
        '',
        'Added Lessons (1):',
        '  + cdn  "CDN"',
        'Removed Lessons (1):',
        '  - queues  "Queues"',
        'Renamed Lessons (2):',
        '  ~ load-balancer → load-balancers  "Load balancer" → "Load balancers"',
        '  ~ cache-aside  "Cache-aside" → "Cache aside"',
        '',
        'Authored content that references a missing Lesson (1):',
        '  Glossary Term "Message queue": queues (removed)',
      ].join('\n'),
    )
  })

  it('says so when nothing changed', () => {
    const lines = ['## Cache', 'a']
    const report = comparePrimerVersions({ before: version('1111111', lines), after: version('2222222', lines) })

    expect(formatPinChangeReport(report)).toBe(
      ['Primer pin 1111111 → 2222222', '', 'No Lessons added, removed or renamed.', '', 'Every authored Lesson reference resolves.'].join('\n'),
    )
  })

  it('names the new id of a renamed Lesson that authored content still references', () => {
    const report = comparePrimerVersions({
      before: version('1111111', ['## Load balancer', 'a']),
      after: version('2222222', ['## Load balancers', 'a']),
      authored: { glossary: [{ term: 'Load balancer', explanation: 'x', lessonIds: ['load-balancer'] }] },
    })

    expect(formatPinChangeReport(report).split('\n').at(-1)).toBe(
      '  Glossary Term "Load balancer": load-balancer (renamed to load-balancers)',
    )
  })
})
