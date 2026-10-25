import { describe, expect, it } from 'vitest'
import { formatDuration } from './appendix'
import { buildContentCatalog } from './catalog'

const source = { repoUrl: 'https://github.com/donnemartin/system-design-primer', commit: 'abc123', path: 'README.md' }

function appendixWith(powersTable: string[]) {
  const markdown = ['## Appendix', 'Intro.', '### Powers of two table', '', '```', ...powersTable, '```'].join('\n')
  return buildContentCatalog({ markdown, source })
}

describe('appendix tables', () => {
  it('locates the table in its Lesson, so the Lesson can show it in place of the code block', () => {
    const catalog = appendixWith(['Power  Exact Value  Approx Value  Bytes', '-----', '10   1024   1 thousand   1 KB'])
    const lesson = catalog.lessons.find((candidate) => candidate.id === 'powers-of-two-table')!
    const table = catalog.appendix.powersOfTwo!

    expect(table.lessonId).toBe('powers-of-two-table')
    expect(lesson.body.slice(table.offset)).toMatch(/^```\nPower/)
    expect(table.rows).toEqual([{ power: 10, exactValue: 1024, approxValue: '1 thousand', bytes: '1 KB' }])
  })

  it('fails on a row it cannot read instead of dropping it', () => {
    expect(() => appendixWith(['Power  Exact Value', '10   1000'])).toThrow('cannot read the powers of two row "10   1000"')
  })

  it('has no table when the primer has no such Lesson', () => {
    expect(buildContentCatalog({ markdown: '## Cache\nText.', source }).appendix).toEqual({})
  })
})

describe('formatDuration', () => {
  it('shows nanoseconds in the largest unit that keeps the number at least 1', () => {
    expect(formatDuration(0.5)).toBe('0.5 ns')
    expect(formatDuration(25)).toBe('25 ns')
    expect(formatDuration(10_000)).toBe('10 µs')
    expect(formatDuration(150_000)).toBe('150 µs')
    expect(formatDuration(1_000_000)).toBe('1 ms')
    expect(formatDuration(150_000_000)).toBe('150 ms')
    expect(formatDuration(2_500_000_000)).toBe('2.5 s')
  })
})
