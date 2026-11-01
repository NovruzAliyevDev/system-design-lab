import { useEffect } from 'react'
import { create } from 'zustand'
import { stageActivities, type Activity, type OpenedItem } from '../../core/activity/activity'
import type { Attempt } from '../../core/challenges/attempt'
import type { Design } from '../../core/design/design'
import { finishesDailyReview } from '../../core/flashcards/queue'
import { scheduleReview, type Grade } from '../../core/flashcards/scheduler'
import type { CanvasStyle, Progress, ProgressArea, Theme } from '../../core/progress/progress'
import { isLessonRead, markLessonRead, markLessonUnread } from '../../core/progress/reading'
import { recordQuizResult } from '../../core/quizzes/results'
import { allCards } from '../catalog'
import { dailyReviewSettings } from '../localDay'
import { progressRepository } from './repository'

interface ProgressState {
  /** Undefined until the stored progress has loaded. */
  progress?: Progress
  markRead(lessonId: string): Promise<void>
  markUnread(lessonId: string): Promise<void>
  setTheme(theme: Theme): Promise<void>
  setNewCardsPerDay(count: number): Promise<void>
  setCanvasStyle(canvasStyle: CanvasStyle): Promise<void>
  setStreakMinActivities(count: number): Promise<void>
  /** Records a review of a Flashcard and schedules its next one; the daily review is finished once none is left. */
  gradeCard(cardId: string, grade: Grade): Promise<void>
  /** Records a completed attempt of a quiz, scored from 0 to 1. */
  recordQuiz(quizId: string, score: number): Promise<void>
  /** Stores the Design being edited in a draft, e.g. the sandbox. */
  saveDesign(draftId: string, design: Design): Promise<void>
  /** Stores a Challenge's current Attempt: it replaces the last Attempt, or becomes the first. Stages it ends are activity. */
  saveCurrentAttempt(challengeId: string, attempt: Attempt): Promise<void>
  /** Adds a new Attempt of a Challenge, which becomes its current one. */
  startAttempt(challengeId: string, attempt: Attempt): Promise<void>
  /** Remembers the Lesson or Challenge being opened, for the Dashboard to continue from. */
  rememberOpened(item: OpenedItem): Promise<void>
  /** Imports an export file; throws `InvalidProgressFileError` and changes nothing when it is invalid. */
  importProgress(fileText: string): Promise<void>
  /** Resets one area, or everything when no area is given. */
  reset(area?: ProgressArea): Promise<void>
}

export const useProgress = create<ProgressState>()(() => ({
  async markRead(lessonId) {
    const now = new Date()
    const before = await updateReturningPrevious('reading', (reading) => markLessonRead(reading, lessonId, now))
    if (before && !isLessonRead(before, lessonId)) await logActivity({ kind: 'lesson-read', at: now.toISOString(), lessonId })
  },
  markUnread: (lessonId) => update('reading', (reading) => markLessonUnread(reading, lessonId)),
  setTheme: (theme) => update('settings', (settings) => ({ ...settings, theme })),
  setNewCardsPerDay: (newCardsPerDay) => update('settings', (settings) => ({ ...settings, newCardsPerDay })),
  setCanvasStyle: (canvasStyle) => update('settings', (settings) => ({ ...settings, canvasStyle })),
  setStreakMinActivities: (streakMinActivities) => update('settings', (settings) => ({ ...settings, streakMinActivities })),
  async gradeCard(cardId, grade) {
    const progress = useProgress.getState().progress
    if (!progress) return
    const now = new Date()
    const before = progress.flashcards.cards
    const after = { ...before, [cardId]: scheduleReview(before[cardId], grade, now) }
    // Decided before storing, from this grade alone, so that quick grades log the finished review once.
    const finished = finishesDailyReview(allCards, before, after, dailyReviewSettings(progress.settings.newCardsPerDay, now), now)
    await update('flashcards', () => ({ cards: after }))
    if (finished) await logActivity({ kind: 'daily-review', at: now.toISOString() })
  },
  async recordQuiz(quizId, score) {
    const now = new Date()
    const before = await updateReturningPrevious('quizzes', (quizzes) => recordQuizResult(quizzes, quizId, score, now))
    if (before) await logActivity({ kind: 'quiz', at: now.toISOString(), quizId })
  },
  saveDesign: (draftId, design) => update('designs', ({ drafts }) => ({ drafts: { ...drafts, [draftId]: design } })),
  async saveCurrentAttempt(challengeId, attempt) {
    const before = await updateReturningPrevious('challenges', ({ attempts }) => {
      const previous = attempts[challengeId] ?? []
      return { attempts: { ...attempts, [challengeId]: [...previous.slice(0, -1), attempt] } }
    })
    if (before) await logActivity(...stageActivities(challengeId, before.attempts[challengeId]?.at(-1), attempt))
  },
  startAttempt: (challengeId, attempt) =>
    update('challenges', ({ attempts }) => ({ attempts: { ...attempts, [challengeId]: [...(attempts[challengeId] ?? []), attempt] } })),
  async rememberOpened(item) {
    const current = useProgress.getState().progress?.activity.lastOpened
    if (current && openedId(current) === openedId(item) && current.kind === item.kind) return
    await update('activity', (activity) => ({ ...activity, lastOpened: item }))
  },
  async importProgress(fileText) {
    await progressRepository.importAll(fileText, new Date())
    await load()
  },
  async reset(area) {
    await progressRepository.reset(area)
    await load()
  },
}))

/** Remembers a Lesson or Challenge as opened once progress has loaded; nothing for a page that shows neither. */
export function useOpened(item: OpenedItem | undefined): void {
  const loaded = useProgress((state) => state.progress !== undefined)
  const rememberOpened = useProgress((state) => state.rememberOpened)
  const kind = item?.kind
  const id = item && openedId(item)
  useEffect(() => {
    if (!loaded || id === undefined) return
    void rememberOpened(kind === 'lesson' ? { kind, lessonId: id } : { kind: 'challenge', challengeId: id })
  }, [loaded, kind, id, rememberOpened])
}

const openedId = (item: OpenedItem) => (item.kind === 'lesson' ? item.lessonId : item.challengeId)

// Counts loads and changes, so a load that finishes after a newer one (or after a change) is dropped.
let generation = 0

async function load(): Promise<void> {
  const started = ++generation
  const progress = await progressRepository.getAll()
  if (generation === started) useProgress.setState({ progress })
}

async function update<A extends ProgressArea>(area: A, change: (value: Progress[A]) => Progress[A]): Promise<void> {
  await updateReturningPrevious(area, change)
}

/** Changes an area, and resolves to what it was before; undefined while progress is still loading, when nothing changes. */
async function updateReturningPrevious<A extends ProgressArea>(area: A, change: (value: Progress[A]) => Progress[A]): Promise<Progress[A] | undefined> {
  const current = useProgress.getState().progress
  if (!current) return undefined
  generation++
  const value = change(current[area])
  // Show the change at once; storing it follows.
  useProgress.setState({ progress: { ...current, [area]: value } })
  await progressRepository.put(area, value)
  return current[area]
}

/** Adds to the activity log that the streak is counted from. */
async function logActivity(...activities: Activity[]): Promise<void> {
  if (activities.length > 0) await update('activity', (activity) => ({ ...activity, log: [...activity.log, ...activities] }))
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
