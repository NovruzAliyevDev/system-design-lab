import type { CardSelection } from '../core/flashcards/deck'
import type { CalculatorId } from '../core/content/calculator-lessons'
import type { StringKey } from './i18n'

/** App route of a Lesson, optionally scrolled to a heading inside it. */
export function lessonPath(lessonId: string, anchor?: string): string {
  return `/lessons/${lessonId}${anchor ? `#${anchor}` : ''}`
}

export const LESSON_ROUTE = '/lessons/:lessonId'

export const SETTINGS_ROUTE = '/settings'

export const GLOSSARY_ROUTE = '/glossary'

/** App route of a term on the Glossary page. */
export function glossaryPath(termId: string): string {
  return `${GLOSSARY_ROUTE}#${termId}`
}

export const SOLUTIONS_ROUTE = '/solutions'

export const SOLUTION_ROUTE = '/solutions/:solutionId'

/** App route of a Solution page, optionally scrolled to a heading inside it. */
export function solutionPath(solutionId: string, anchor?: string): string {
  return `${SOLUTIONS_ROUTE}/${solutionId}${anchor ? `#${anchor}` : ''}`
}

export const STUDY_GUIDE_ROUTE = '/study-guide'

export const FLASHCARDS_ROUTE = '/flashcards'

export const CHALLENGES_ROUTE = '/challenges'

export const CHALLENGE_ROUTE = '/challenges/:challengeId'

/** App route of a Challenge, optionally at one of its Stages. */
export function challengePath(challengeId: string, stageId?: string): string {
  return `${CHALLENGES_ROUTE}/${challengeId}${stageId ? `?stage=${encodeURIComponent(stageId)}` : ''}`
}

export const CALCULATORS_ROUTE = '/calculators'

/** App route of a calculator. */
export function calculatorPath(calculatorId: CalculatorId): string {
  return `${CALCULATORS_ROUTE}#${calculatorId}`
}

/** The free Design Canvas, outside any Challenge. */
export const SANDBOX_ROUTE = '/sandbox'

/** The query of the Flashcard review's URL for a selection of cards: `?deck=<id>`, `?lesson=<id>`, or none for all. */
export function flashcardsQuery(selection: CardSelection): Record<string, string> {
  if (selection.kind === 'deck') return { deck: selection.deckId }
  if (selection.kind === 'lesson') return { lesson: selection.lessonId }
  return {}
}

/** The selection a Flashcard review URL's query names; `all` when it names none. Ids are not checked here. */
export function selectionFromQuery(params: URLSearchParams): CardSelection {
  const deckId = params.get('deck')
  const lessonId = params.get('lesson')
  if (deckId) return { kind: 'deck', deckId }
  if (lessonId) return { kind: 'lesson', lessonId }
  return { kind: 'all' }
}

/** App route of the Flashcard review of a selection of cards. */
export function flashcardsPath(selection: CardSelection): string {
  const query = new URLSearchParams(flashcardsQuery(selection)).toString()
  return query ? `${FLASHCARDS_ROUTE}?${query}` : FLASHCARDS_ROUTE
}

/** Pages besides the Lessons, linked from the header (from `lg` up) and the table of contents drawer. */
export const HEADER_PAGES: { to: string; label: StringKey }[] = [
  { to: CHALLENGES_ROUTE, label: 'challengesTitle' },
  { to: FLASHCARDS_ROUTE, label: 'flashcardsTitle' },
  { to: SANDBOX_ROUTE, label: 'sandboxTitle' },
  { to: CALCULATORS_ROUTE, label: 'calculatorsTitle' },
  { to: STUDY_GUIDE_ROUTE, label: 'studyGuideTitle' },
  { to: SOLUTIONS_ROUTE, label: 'solutionsTitle' },
  { to: GLOSSARY_ROUTE, label: 'glossaryTitle' },
]
