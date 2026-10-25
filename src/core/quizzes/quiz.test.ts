import { describe, expect, it } from 'vitest'
import { buildContentCatalog, ContentValidationError } from '../content/catalog'

const source = {
  repoUrl: 'https://github.com/donnemartin/system-design-primer',
  commit: 'abc123',
  path: 'README.md',
}

const markdown = ['## Cache', 'Cache text.', '### Write-through', 'Writes go through.', '## Database', 'Database text.'].join('\n')

function catalogWith(quizzes: unknown) {
  return buildContentCatalog({ markdown, source, authored: { quizzes } })
}

/** The problems the build reports for authored Quizzes, or none when they are valid. */
function problemsOf(quizzes: unknown): string[] {
  try {
    catalogWith(quizzes)
    return []
  } catch (error) {
    if (error instanceof ContentValidationError) return error.problems
    throw error
  }
}

const option = (text: string, correct?: boolean) => ({ text, ...(correct === undefined ? {} : { correct }), explanation: `${text} izahı.` })

const cacheQuiz = {
  id: 'cache',
  lessonId: 'cache',
  questions: [
    { type: 'multiple-choice', prompt: 'Keş nəyi azaldır?', options: [option('Bazaya yükü', true), option('Disk həcmini')] },
    { type: 'multi-select', prompt: 'Hansılar keşdir?', options: [option('Redis', true), option('Memcached', true), option('MySQL')] },
    {
      type: 'ordering',
      prompt: 'Sıraya düzün.',
      items: [
        { text: 'Keşdə axtar', explanation: 'Əvvəl keş.' },
        { text: 'Bazadan oxu', explanation: 'Sonra baza.' },
      ],
    },
    { type: 'component-fit', prompt: 'Boş yerə nə uyğundur?', flow: ['Web server', '?', 'Database'], options: [option('Cache', true), option('DNS')] },
  ],
}

const withQuestion = (question: unknown) => [{ ...cacheQuiz, questions: [question] }]

describe('authored Quizzes', () => {
  it('puts the Quizzes in the catalog, with every option marked right or wrong', () => {
    const [quiz] = catalogWith([cacheQuiz]).quizzes

    expect(quiz.id).toBe('cache')
    expect(quiz.lessonId).toBe('cache')
    expect(quiz.questions.map((question) => question.type)).toEqual(['multiple-choice', 'multi-select', 'ordering', 'component-fit'])
    expect(quiz.questions[1]).toEqual({
      type: 'multi-select',
      prompt: 'Hansılar keşdir?',
      options: [
        { text: 'Redis', correct: true, explanation: 'Redis izahı.' },
        { text: 'Memcached', correct: true, explanation: 'Memcached izahı.' },
        { text: 'MySQL', correct: false, explanation: 'MySQL izahı.' },
      ],
    })
    expect(quiz.questions[3]).toMatchObject({ flow: ['Web server', '?', 'Database'] })
  })

  it('has no Quizzes when none are authored', () => {
    expect(buildContentCatalog({ markdown, source }).quizzes).toEqual([])
  })

  it('fails on a Quiz for a Lesson that does not exist', () => {
    expect(problemsOf([{ ...cacheQuiz, lessonId: 'caching' }])).toEqual(['Quiz "cache": unknown Lesson id "caching"'])
  })

  it('fails on two Quizzes with one id, or two Quizzes in one Lesson', () => {
    expect(problemsOf([cacheQuiz, { ...cacheQuiz, lessonId: 'write-through' }])).toEqual(['Quiz "cache": its id is already used by another Quiz'])
    expect(problemsOf([cacheQuiz, { ...cacheQuiz, id: 'cache-2' }])).toEqual(['Quiz "cache-2": Lesson "cache" already has Quiz "cache"'])
  })

  it('fails on a Quiz that is not a list, a Quiz with no questions, a missing id or an unknown field', () => {
    expect(problemsOf({ cache: cacheQuiz })).toEqual(['Quizzes: must be a list of Quizzes'])
    expect(problemsOf([{ ...cacheQuiz, questions: [] }])).toEqual(['Quiz "cache": "questions" must list at least one question'])
    expect(problemsOf([{ lessonId: 'cache', questions: cacheQuiz.questions, title: 'Keş' }])).toEqual([
      'Quiz #1: unknown field "title"',
      'Quiz #1: "id" must be a non-empty string',
    ])
  })

  it('fails on an unknown question type', () => {
    expect(problemsOf(withQuestion({ type: 'true-false', prompt: 'Doğru?' }))).toEqual([
      'Quiz "cache": question 1: "type" must be one of "multiple-choice", "multi-select", "ordering", "component-fit"',
    ])
  })

  it('fails on a single-answer question without exactly one correct option', () => {
    const [mc, , , fit] = cacheQuiz.questions
    expect(problemsOf(withQuestion({ ...mc, options: [option('A'), option('B')] }))).toEqual([
      'Quiz "cache": question 1: must have exactly one correct option, not 0',
    ])
    expect(problemsOf(withQuestion({ ...fit, options: [option('Cache', true), option('CDN', true)] }))).toEqual([
      'Quiz "cache": question 1: must have exactly one correct option, not 2',
    ])
  })

  it('fails on a multi-select question with no correct option, or no wrong one to leave out', () => {
    const [, multi] = cacheQuiz.questions
    expect(problemsOf(withQuestion({ ...multi, options: [option('A', false), option('B')] }))).toEqual([
      'Quiz "cache": question 1: must have at least one correct option',
    ])
    expect(problemsOf(withQuestion({ ...multi, options: [option('A', true), option('B', true)] }))).toEqual([
      'Quiz "cache": question 1: must have at least one wrong option, or choosing everything would be right',
    ])
  })

  it('fails on an option without an explanation, a repeated option, a non-boolean "correct" or fewer than two options', () => {
    const [mc] = cacheQuiz.questions
    expect(problemsOf(withQuestion({ ...mc, options: [{ text: 'A', correct: true }, option('B'), option('B')] }))).toEqual([
      'Quiz "cache": question 1: option 1: "explanation" must be a non-empty string; every option is explained',
      'Quiz "cache": question 1: option 3: "B" is listed twice',
    ])
    expect(problemsOf(withQuestion({ ...mc, options: [option('A', true), option('B'), { ...option('C'), correct: 'yes' }] }))).toEqual([
      'Quiz "cache": question 1: option 3: "correct" must be true or false',
    ])
    expect(problemsOf(withQuestion({ ...mc, options: [option('A', true)] }))).toEqual([
      'Quiz "cache": question 1: "options" must list at least two options',
    ])
  })

  it('fails on an ordering item without an explanation, or with a "correct" flag', () => {
    const [, , ordering] = cacheQuiz.questions
    expect(problemsOf(withQuestion({ ...ordering, items: [{ text: 'A' }, { text: 'B', explanation: 'B.', correct: true }] }))).toEqual([
      'Quiz "cache": question 1: item 1: "explanation" must be a non-empty string; every item is explained',
      'Quiz "cache": question 1: item 2: unknown field "correct"',
    ])
  })

  it('fails on a component flow without exactly one blank', () => {
    const [, , , fit] = cacheQuiz.questions
    expect(problemsOf(withQuestion({ ...fit, flow: ['Web server', 'Database'] }))).toEqual([
      'Quiz "cache": question 1: "flow" must have exactly one blank ("?")',
    ])
    expect(problemsOf(withQuestion({ ...fit, flow: ['?', '?'] }))).toEqual(['Quiz "cache": question 1: "flow" must have exactly one blank ("?")'])
    expect(problemsOf(withQuestion({ ...fit, flow: ['?'] }))).toEqual(['Quiz "cache": question 1: "flow" must have a component besides the blank'])
  })

  it('reports problems of every question and every Quiz at once', () => {
    const [mc, multi] = cacheQuiz.questions
    expect(
      problemsOf([
        { ...cacheQuiz, questions: [{ ...mc, prompt: '' }, { ...multi, extra: 1 }] },
        { ...cacheQuiz, id: 'db', lessonId: 'db' },
      ]),
    ).toEqual([
      'Quiz "cache": question 1: "prompt" must be a non-empty string',
      'Quiz "cache": question 2: unknown field "extra"',
      'Quiz "db": unknown Lesson id "db"',
    ])
  })
})
