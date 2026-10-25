import { describe, expect, it } from 'vitest'
import { gradeQuestion, gradeQuiz, scrambledOrder } from './grading'
import type { Question, Quiz } from './quiz'

const option = (text: string, correct = false) => ({ text, correct, explanation: `${text}: izah.` })

const multipleChoice: Question = {
  type: 'multiple-choice',
  prompt: 'Cache-aside-da keşi kim doldurur?',
  options: [option('Tətbiq', true), option('Keşin özü'), option('Verilənlər bazası')],
}

const multiSelect: Question = {
  type: 'multi-select',
  prompt: 'Hansılar keşləmə strategiyasıdır?',
  options: [option('Cache-aside', true), option('Sharding'), option('Write-through', true), option('Federation'), option('Write-behind', true)],
}

const ordering: Question = {
  type: 'ordering',
  prompt: 'Cache-aside-da oxuma addımlarını sıraya düzün.',
  items: [
    { text: 'Keşdə axtar', explanation: 'Əvvəl keşə baxılır.' },
    { text: 'Bazadan yüklə', explanation: 'Miss olanda bazaya gedilir.' },
    { text: 'Keşə yaz', explanation: 'Növbəti oxu sürətli olsun.' },
    { text: 'Qaytar', explanation: 'Sonda cavab qaytarılır.' },
  ],
}

const componentFit: Question = {
  type: 'component-fit',
  prompt: 'Bazanın oxuma yükünü azaltmaq üçün boş yerə hansı komponent uyğundur?',
  flow: ['Web server', '?', 'Database'],
  options: [option('Cache', true), option('DNS'), option('CDN')],
}

describe('gradeQuestion', () => {
  it('gives a multiple-choice question full marks for the correct option and none for another', () => {
    expect(gradeQuestion(multipleChoice, [0])).toEqual({ score: 1, correct: true, marks: [true, true, true] })
    expect(gradeQuestion(multipleChoice, [2])).toEqual({ score: 0, correct: false, marks: [false, true, false] })
  })

  it('gives an unanswered choice question no marks', () => {
    expect(gradeQuestion(multipleChoice, [])).toEqual({ score: 0, correct: false, marks: [false, true, true] })
  })

  it('grades a "which component fits" question like a multiple-choice one', () => {
    expect(gradeQuestion(componentFit, [0])).toMatchObject({ score: 1, correct: true })
    expect(gradeQuestion(componentFit, [2])).toEqual({ score: 0, correct: false, marks: [false, true, false] })
  })

  it('rejects more than one option on a single-answer question', () => {
    expect(() => gradeQuestion(multipleChoice, [0, 1])).toThrow(RangeError)
    expect(() => gradeQuestion(componentFit, [0, 2])).toThrow(RangeError)
  })

  it('gives a multi-select question full marks only for exactly the correct options', () => {
    expect(gradeQuestion(multiSelect, [0, 2, 4])).toEqual({ score: 1, correct: true, marks: [true, true, true, true, true] })
  })

  it('gives a multi-select question partial marks per correct option chosen', () => {
    expect(gradeQuestion(multiSelect, [0, 4])).toEqual({ score: 2 / 3, correct: false, marks: [true, true, false, true, true] })
    expect(gradeQuestion(multiSelect, [2])).toMatchObject({ score: 1 / 3, correct: false })
  })

  it('takes a correct option off a multi-select score for each wrong option chosen', () => {
    expect(gradeQuestion(multiSelect, [0, 2, 1])).toEqual({ score: 1 / 3, correct: false, marks: [true, false, true, true, false] })
  })

  it('never lets a multi-select score go below zero, so choosing everything earns little', () => {
    expect(gradeQuestion(multiSelect, [0, 1, 2, 3, 4])).toMatchObject({ score: 1 / 3 })
    expect(gradeQuestion(multiSelect, [1, 3])).toMatchObject({ score: 0 })
    expect(gradeQuestion(multiSelect, [1, 3, 0])).toMatchObject({ score: 0 })
    expect(gradeQuestion(multiSelect, [])).toEqual({ score: 0, correct: false, marks: [false, true, false, true, false] })
  })

  it('gives an ordering question full marks for the authored order and marks each position', () => {
    expect(gradeQuestion(ordering, [0, 1, 2, 3])).toEqual({ score: 1, correct: true, marks: [true, true, true, true] })
  })

  it('gives an ordering question no marks for any other order, while marking the positions that are right', () => {
    expect(gradeQuestion(ordering, [0, 2, 1, 3])).toEqual({ score: 0, correct: false, marks: [true, false, false, true] })
  })

  it('rejects an answer that chooses an option twice, an option that does not exist, or an order that is not a permutation', () => {
    expect(() => gradeQuestion(multiSelect, [0, 0])).toThrow(RangeError)
    expect(() => gradeQuestion(multiSelect, [5])).toThrow(RangeError)
    expect(() => gradeQuestion(multipleChoice, [-1])).toThrow(RangeError)
    expect(() => gradeQuestion(ordering, [0, 1, 2])).toThrow(RangeError)
    expect(() => gradeQuestion(ordering, [0, 1, 1, 3])).toThrow(RangeError)
  })
})

describe('gradeQuiz', () => {
  const quiz: Quiz = { id: 'cache-basics', lessonId: 'cache', questions: [multipleChoice, multiSelect, ordering, componentFit] }

  it('scores a quiz as the share of points earned, one point per question', () => {
    const grade = gradeQuiz(quiz, [[0], [0, 4], [0, 2, 1, 3], [0]])

    expect(grade.points).toBeCloseTo(2 + 2 / 3)
    expect(grade.maxPoints).toBe(4)
    expect(grade.score).toBeCloseTo((2 + 2 / 3) / 4)
    expect(grade.questions.map((question) => question.correct)).toEqual([true, false, false, true])
  })

  it('needs an answer for every question', () => {
    expect(() => gradeQuiz(quiz, [[0]])).toThrow(RangeError)
  })
})

describe('scrambledOrder', () => {
  it('is a permutation that never starts out in the correct order', () => {
    for (let seed = 0; seed < 50; seed++) {
      const order = scrambledOrder(4, seed)
      expect([...order].sort()).toEqual([0, 1, 2, 3])
      expect(order).not.toEqual([0, 1, 2, 3])
    }
  })

  it('gives the same order for the same seed', () => {
    expect(scrambledOrder(5, 7)).toEqual(scrambledOrder(5, 7))
  })

  it('leaves a single item where it is', () => {
    expect(scrambledOrder(1, 3)).toEqual([0])
  })
})
