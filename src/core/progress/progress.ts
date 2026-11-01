import { readActivity, readOpenedItem, type Activity, type OpenedItem } from '../activity/activity'
import { DEFAULT_STREAK_MIN_ACTIVITIES, MAX_STREAK_MIN_ACTIVITIES } from '../activity/streak'
import { readAttempt, type Attempt } from '../challenges/attempt'
import { readDesign, type Design } from '../design/design'
import type { CardStates } from '../flashcards/queue'
import { readCardState, type CardState } from '../flashcards/scheduler'

export const THEMES = ['dark', 'light'] as const

export type Theme = (typeof THEMES)[number]

/** How the Design Canvas draws Nodes and Edges: clean lines, or hand-drawn like a whiteboard sketch. */
export const CANVAS_STYLES = ['clean', 'sketch'] as const

export type CanvasStyle = (typeof CANVAS_STYLES)[number]

export interface ReadingProgress {
  /** Id of each Lesson marked read → when it was marked (ISO timestamp). */
  readLessons: Record<string, string>
}

export interface Settings {
  theme: Theme
  /** How many new Flashcards the daily review may start each day. */
  newCardsPerDay: number
  canvasStyle: CanvasStyle
  /** How many Lesson reads, quizzes and Challenge Stages make a day count toward the streak without the daily review. */
  streakMinActivities: number
}

/** Anki's default. */
export const DEFAULT_NEW_CARDS_PER_DAY = 20
export const MAX_NEW_CARDS_PER_DAY = 999

export interface FlashcardProgress {
  /** Flashcard id → where the Review Scheduler left it; a card without a state is new. */
  cards: CardStates
}

export interface QuizResult {
  /** The best share of points of any attempt, from 0 to 1. */
  bestScore: number
  /** When the quiz was last completed (ISO timestamp). */
  lastAttemptAt: string
}

export interface QuizProgress {
  /** Quiz id → its result; a quiz without one has not been completed. */
  results: Record<string, QuizResult>
}

export interface ActivityProgress {
  /** What the learner did, oldest first; the streak is counted from it. */
  log: Activity[]
  /** The Lesson or Challenge opened last, to continue from on the Dashboard. */
  lastOpened?: OpenedItem
}

/** The id of the free sandbox Design among the drafts. */
export const SANDBOX_DRAFT_ID = 'sandbox'

export interface DesignProgress {
  /** Draft id → the Design being edited there, auto-saved as it changes. */
  drafts: Record<string, Design>
}

export interface ChallengeProgress {
  /** Challenge id → its Attempts, oldest first. The last one is the current Attempt, finished or not. */
  attempts: Record<string, Attempt[]>
}

/** Everything the learner has done, split into areas that are stored and reset separately. */
export interface Progress {
  reading: ReadingProgress
  settings: Settings
  flashcards: FlashcardProgress
  quizzes: QuizProgress
  designs: DesignProgress
  challenges: ChallengeProgress
  activity: ActivityProgress
}

export type ProgressArea = keyof Progress

export const PROGRESS_AREAS: readonly ProgressArea[] = ['reading', 'settings', 'flashcards', 'quizzes', 'designs', 'challenges', 'activity']

export function emptyProgress(): Progress {
  return {
    reading: { readLessons: {} },
    settings: { theme: 'dark', newCardsPerDay: DEFAULT_NEW_CARDS_PER_DAY, canvasStyle: 'clean', streakMinActivities: DEFAULT_STREAK_MIN_ACTIVITIES },
    flashcards: { cards: {} },
    quizzes: { results: {} },
    designs: { drafts: {} },
    challenges: { attempts: {} },
    activity: { log: [] },
  }
}

export const PROGRESS_SCHEMA_VERSION = 10

/** The export file: all progress, versioned so that older files can be migrated on import. */
export interface ProgressExport {
  schemaVersion: typeof PROGRESS_SCHEMA_VERSION
  exportedAt: string
  progress: Progress
}

export type InvalidProgressFileReason = 'not-json' | 'malformed' | 'unsupported-version'

export class InvalidProgressFileError extends Error {
  override name = 'InvalidProgressFileError'

  constructor(
    readonly reason: InvalidProgressFileReason,
    detail: string,
  ) {
    super(detail)
  }
}

/** Parses the text of an export file. */
export function parseProgressFile(fileText: string): unknown {
  try {
    return JSON.parse(fileText)
  } catch {
    throw new InvalidProgressFileError('not-json', 'The file is not JSON.')
  }
}

/**
 * Validates a parsed export file and upgrades it from any known `schemaVersion` to the current format.
 * Throws `InvalidProgressFileError` for anything else.
 */
export function migrateProgress(data: unknown): ProgressExport {
  if (!isRecord(data) || typeof data.schemaVersion !== 'number') {
    throw new InvalidProgressFileError('malformed', 'The file has no schemaVersion.')
  }
  let current = data
  while (current.schemaVersion !== PROGRESS_SCHEMA_VERSION) {
    const upgrade = UPGRADES[current.schemaVersion as number]
    if (!upgrade) throw new InvalidProgressFileError('unsupported-version', `Unknown schemaVersion ${data.schemaVersion}.`)
    current = upgrade(current)
  }
  return validateCurrent(current)
}

/** schemaVersion N → a function that turns a version-N file into a version-(N + 1) file. */
const UPGRADES: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // v0 listed read Lessons without times and had no settings. The export time is the latest a Lesson can have been read.
  0: ({ exportedAt, readLessons }) => {
    if (!isTimestamp(exportedAt)) throw malformed('exportedAt is not a timestamp')
    if (!Array.isArray(readLessons) || !readLessons.every((id) => typeof id === 'string')) {
      throw malformed('readLessons is not a list of Lesson ids')
    }
    return {
      schemaVersion: 1,
      exportedAt,
      progress: {
        reading: { readLessons: Object.fromEntries(readLessons.map((id) => [id, exportedAt])) },
        settings: { theme: emptyProgress().settings.theme },
      },
    }
  },
  // v1 had no Flashcards.
  1: ({ exportedAt, progress }) => {
    if (!isRecord(progress)) throw malformed('progress is missing')
    return { schemaVersion: 2, exportedAt, progress: { ...progress, flashcards: { cards: {} } } }
  },
  // v2 had no daily new-card limit.
  2: ({ exportedAt, progress }) => {
    if (!isRecord(progress) || !isRecord(progress.settings)) throw malformed('settings is missing')
    const settings = { ...progress.settings, newCardsPerDay: DEFAULT_NEW_CARDS_PER_DAY }
    return { schemaVersion: 3, exportedAt, progress: { ...progress, settings } }
  },
  // v3 had no quiz results.
  3: ({ exportedAt, progress }) => {
    if (!isRecord(progress)) throw malformed('progress is missing')
    return { schemaVersion: 4, exportedAt, progress: { ...progress, quizzes: { results: {} } } }
  },
  // v4 had no Designs.
  4: ({ exportedAt, progress }) => {
    if (!isRecord(progress)) throw malformed('progress is missing')
    return { schemaVersion: 5, exportedAt, progress: { ...progress, designs: { drafts: {} } } }
  },
  // v5 had no Challenge work.
  5: ({ exportedAt, progress }) => {
    if (!isRecord(progress)) throw malformed('progress is missing')
    return { schemaVersion: 6, exportedAt, progress: { ...progress, challenges: { stages: {} } } }
  },
  // v6 had no canvas style.
  6: ({ exportedAt, progress }) => {
    if (!isRecord(progress) || !isRecord(progress.settings)) throw malformed('settings is missing')
    const settings = { ...progress.settings, canvasStyle: emptyProgress().settings.canvasStyle }
    return { schemaVersion: 7, exportedAt, progress: { ...progress, settings } }
  },
  // v7 kept the work on each high-level design Stage, not Attempts.
  7: ({ exportedAt, progress }) => {
    if (!isRecord(progress) || !isRecord(progress.challenges) || !isRecord(progress.challenges.stages)) throw malformed('challenges is missing')
    if (!isTimestamp(exportedAt)) throw malformed('exportedAt is not a timestamp')
    const attempts = attemptsFromStageWork(progress.challenges.stages, exportedAt)
    if (!attempts) throw malformed('the Challenge work is not keyed by Challenge and Stage')
    return { schemaVersion: 8, exportedAt, progress: { ...progress, challenges: { attempts } } }
  },
  // v8 had practice Attempts only; a v8 file is a valid v9 file. The version tells older apps not to read Mock Interviews.
  8: (file) => ({ ...file, schemaVersion: 9 }),
  // v9 had no activity log, so no streak: it starts from the import.
  9: ({ exportedAt, progress }) => {
    if (!isRecord(progress) || !isRecord(progress.settings)) throw malformed('settings is missing')
    const settings = { ...progress.settings, streakMinActivities: DEFAULT_STREAK_MIN_ACTIVITIES }
    return { schemaVersion: 10, exportedAt, progress: { ...progress, settings, activity: { log: [] } } }
  },
}

/**
 * Turns v7 work on high-level design Stages (keyed `challengeId/stageId`) into one Attempt in progress
 * per Challenge, started at `startedAt`. The Stages before the high-level design came later, so a
 * finished Stage is open again until they are over. Undefined when a key names no Stage.
 */
function attemptsFromStageWork(stages: Record<string, unknown>, startedAt: string): Record<string, unknown[]> | undefined {
  const attempts = new Map<string, Record<string, unknown>>()
  for (const [key, work] of Object.entries(stages)) {
    const slash = key.indexOf('/')
    if (slash <= 0 || slash === key.length - 1) return undefined
    const [challengeId, stageId] = [key.slice(0, slash), key.slice(slash + 1)]
    // Invalid work is reported when the Attempt is read.
    const { design, hintUsage } = isRecord(work) ? work : {}
    attempts.set(challengeId, { ...attempts.get(challengeId), [stageId]: { type: 'high-level-design', design, hintUsage } })
  }
  return Object.fromEntries([...attempts].map(([challengeId, work]) => [challengeId, [{ mode: 'practice', startedAt, stages: work }]]))
}

/**
 * An area as the browser stored it, in the current format. Areas are stored as they are, so one
 * written by an older version of the app is upgraded when it is read; `now` dates what that creates.
 */
export function upgradeStoredArea(area: ProgressArea, stored: unknown, now: Date): unknown {
  if (area === 'challenges' && isRecord(stored) && stored.attempts === undefined && isRecord(stored.stages)) {
    return { attempts: attemptsFromStageWork(stored.stages, now.toISOString()) ?? {} }
  }
  return stored
}

function validateCurrent(data: Record<string, unknown>): ProgressExport {
  const { exportedAt, progress } = data
  if (!isTimestamp(exportedAt)) throw malformed('exportedAt is not a timestamp')
  if (!isRecord(progress)) throw malformed('progress is missing')
  return { schemaVersion: PROGRESS_SCHEMA_VERSION, exportedAt, progress: validateProgress(progress) }
}

function validateProgress(progress: Record<string, unknown>): Progress {
  const { reading, settings, flashcards, quizzes, designs, challenges, activity } = progress
  if (!isRecord(reading) || !isRecord(reading.readLessons)) throw malformed('reading is missing')
  const readLessons = Object.entries(reading.readLessons)
  for (const [lessonId, readAt] of readLessons) {
    if (!isTimestamp(readAt)) throw malformed(`the read time of ${lessonId} is not a timestamp`)
  }

  if (!isRecord(settings)) throw malformed('settings is missing')
  const theme = THEMES.find((known) => known === settings.theme)
  if (!theme) throw malformed('the theme is unknown')
  const { newCardsPerDay } = settings
  if (!isNewCardLimit(newCardsPerDay)) throw malformed('the daily new-card limit is not a whole number from 0 to 999')
  const canvasStyle = CANVAS_STYLES.find((known) => known === settings.canvasStyle)
  if (!canvasStyle) throw malformed('the canvas style is unknown')
  const { streakMinActivities } = settings
  if (!isStreakMinimum(streakMinActivities)) throw malformed(`the streak minimum is not a whole number from 1 to ${MAX_STREAK_MIN_ACTIVITIES}`)

  if (!isRecord(flashcards) || !isRecord(flashcards.cards)) throw malformed('flashcards is missing')
  const cards = Object.entries(flashcards.cards).map(([cardId, value]): [string, CardState] => {
    const state = readCardState(value)
    if (!state) throw malformed(`the state of card ${cardId} is invalid`)
    return [cardId, state]
  })

  if (!isRecord(quizzes) || !isRecord(quizzes.results)) throw malformed('quizzes is missing')
  const results = Object.entries(quizzes.results).map(([quizId, value]): [string, QuizResult] => {
    if (!isRecord(value) || !isQuizScore(value.bestScore) || !isTimestamp(value.lastAttemptAt)) {
      throw malformed(`the result of quiz ${quizId} is invalid`)
    }
    return [quizId, { bestScore: value.bestScore, lastAttemptAt: value.lastAttemptAt }]
  })

  if (!isRecord(designs) || !isRecord(designs.drafts)) throw malformed('designs is missing')
  const drafts = Object.entries(designs.drafts).map(([draftId, value]): [string, Design] => {
    const { design, problems } = readDesign(value)
    if (!design) throw malformed(`the Design draft ${draftId} is invalid: ${problems.join('; ')}`)
    return [draftId, design]
  })

  if (!isRecord(challenges) || !isRecord(challenges.attempts)) throw malformed('challenges is missing')
  const attempts = Object.entries(challenges.attempts).map(([challengeId, value]): [string, Attempt[]] => {
    if (!Array.isArray(value)) throw malformed(`the Attempts of Challenge ${challengeId} are not a list`)
    return [
      challengeId,
      value.map((stored, i) => {
        const attempt = readAttempt(stored)
        if (!attempt) throw malformed(`Attempt ${i + 1} of Challenge ${challengeId} is invalid`)
        return attempt
      }),
    ]
  })

  if (!isRecord(activity) || !Array.isArray(activity.log)) throw malformed('activity is missing')
  const log = activity.log.map((value, i) => {
    const entry = readActivity(value)
    if (!entry) throw malformed(`activity ${i + 1} is invalid`)
    return entry
  })
  const lastOpened = activity.lastOpened === undefined ? undefined : readOpenedItem(activity.lastOpened)
  if (activity.lastOpened !== undefined && !lastOpened) throw malformed('the item opened last is invalid')

  // Object.fromEntries defines keys as own properties, so an id such as `__proto__` stays data.
  return {
    reading: { readLessons: Object.fromEntries(readLessons) as Record<string, string> },
    settings: { theme, newCardsPerDay, canvasStyle, streakMinActivities },
    flashcards: { cards: Object.fromEntries(cards) },
    quizzes: { results: Object.fromEntries(results) },
    designs: { drafts: Object.fromEntries(drafts) },
    challenges: { attempts: Object.fromEntries(attempts) },
    activity: { log, ...(lastOpened && { lastOpened }) },
  }
}

/** A quiz score: the share of points earned, from 0 to 1. */
export function isQuizScore(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1
}

/** A daily new-card limit: a whole number from 0 to `MAX_NEW_CARDS_PER_DAY`. */
export function isNewCardLimit(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_NEW_CARDS_PER_DAY
}

/** A streak minimum: a whole number of activities from 1 to `MAX_STREAK_MIN_ACTIVITIES`. */
export function isStreakMinimum(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_STREAK_MIN_ACTIVITIES
}

function malformed(detail: string): InvalidProgressFileError {
  return new InvalidProgressFileError('malformed', `Invalid progress file: ${detail}.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
