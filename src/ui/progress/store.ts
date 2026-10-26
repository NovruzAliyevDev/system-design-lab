import { create } from 'zustand'
import type { Attempt } from '../../core/challenges/attempt'
import type { Design } from '../../core/design/design'
import { scheduleReview, type Grade } from '../../core/flashcards/scheduler'
import type { CanvasStyle, Progress, ProgressArea, Theme } from '../../core/progress/progress'
import { markLessonRead, markLessonUnread } from '../../core/progress/reading'
import { recordQuizResult } from '../../core/quizzes/results'
import { progressRepository } from './repository'

interface ProgressState {
  /** Undefined until the stored progress has loaded. */
  progress?: Progress
  markRead(lessonId: string): Promise<void>
  markUnread(lessonId: string): Promise<void>
  setTheme(theme: Theme): Promise<void>
  setNewCardsPerDay(count: number): Promise<void>
  setCanvasStyle(canvasStyle: CanvasStyle): Promise<void>
  /** Records a review of a Flashcard and schedules its next one. */
  gradeCard(cardId: string, grade: Grade): Promise<void>
  /** Records a completed attempt of a quiz, scored from 0 to 1. */
  recordQuiz(quizId: string, score: number): Promise<void>
  /** Stores the Design being edited in a draft, e.g. the sandbox. */
  saveDesign(draftId: string, design: Design): Promise<void>
  /** Stores a Challenge's current Attempt: it replaces the last Attempt, or becomes the first. */
  saveCurrentAttempt(challengeId: string, attempt: Attempt): Promise<void>
  /** Adds a new Attempt of a Challenge, which becomes its current one. */
  startAttempt(challengeId: string, attempt: Attempt): Promise<void>
  /** Imports an export file; throws `InvalidProgressFileError` and changes nothing when it is invalid. */
  importProgress(fileText: string): Promise<void>
  /** Resets one area, or everything when no area is given. */
  reset(area?: ProgressArea): Promise<void>
}

export const useProgress = create<ProgressState>()(() => ({
  markRead: (lessonId) => update('reading', (reading) => markLessonRead(reading, lessonId, new Date())),
  markUnread: (lessonId) => update('reading', (reading) => markLessonUnread(reading, lessonId)),
  setTheme: (theme) => update('settings', (settings) => ({ ...settings, theme })),
  setNewCardsPerDay: (newCardsPerDay) => update('settings', (settings) => ({ ...settings, newCardsPerDay })),
  setCanvasStyle: (canvasStyle) => update('settings', (settings) => ({ ...settings, canvasStyle })),
  gradeCard: (cardId, grade) =>
    update('flashcards', ({ cards }) => ({ cards: { ...cards, [cardId]: scheduleReview(cards[cardId], grade, new Date()) } })),
  recordQuiz: (quizId, score) => update('quizzes', (quizzes) => recordQuizResult(quizzes, quizId, score, new Date())),
  saveDesign: (draftId, design) => update('designs', ({ drafts }) => ({ drafts: { ...drafts, [draftId]: design } })),
  saveCurrentAttempt: (challengeId, attempt) =>
    update('challenges', ({ attempts }) => {
      const previous = attempts[challengeId] ?? []
      return { attempts: { ...attempts, [challengeId]: [...previous.slice(0, -1), attempt] } }
    }),
  startAttempt: (challengeId, attempt) =>
    update('challenges', ({ attempts }) => ({ attempts: { ...attempts, [challengeId]: [...(attempts[challengeId] ?? []), attempt] } })),
  async importProgress(fileText) {
    await progressRepository.importAll(fileText, new Date())
    await load()
  },
  async reset(area) {
    await progressRepository.reset(area)
    await load()
  },
}))

// Counts loads and changes, so a load that finishes after a newer one (or after a change) is dropped.
let generation = 0

async function load(): Promise<void> {
  const started = ++generation
  const progress = await progressRepository.getAll()
  if (generation === started) useProgress.setState({ progress })
}

async function update<A extends ProgressArea>(area: A, change: (value: Progress[A]) => Progress[A]): Promise<void> {
  const current = useProgress.getState().progress
  if (!current) return
  generation++
  const value = change(current[area])
  // Show the change at once; storing it follows.
  useProgress.setState({ progress: { ...current, [area]: value } })
  await progressRepository.put(area, value)
}

/** A copy of the theme that `index.html` reads before first paint, so a light theme does not flash dark. */
const THEME_CACHE_KEY = 'system-design-lab-theme'

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme)
  } catch {
    // Storage can be unavailable (e.g. blocked); the theme then only applies once progress loads.
  }
}

useProgress.subscribe(({ progress }) => {
  if (progress) applyTheme(progress.settings.theme)
})

void load()
