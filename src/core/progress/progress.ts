import type { CardStates } from '../flashcards/queue'
import { readCardState, type CardState } from '../flashcards/scheduler'

export const THEMES = ['dark', 'light'] as const

export type Theme = (typeof THEMES)[number]

export interface ReadingProgress {
  /** Id of each Lesson marked read → when it was marked (ISO timestamp). */
  readLessons: Record<string, string>
}

export interface Settings {
  theme: Theme
  /** How many new Flashcards the daily review may start each day. */
  newCardsPerDay: number
}

/** Anki's default. */
export const DEFAULT_NEW_CARDS_PER_DAY = 20
export const MAX_NEW_CARDS_PER_DAY = 999

export interface FlashcardProgress {
  /** Flashcard id → where the Review Scheduler left it; a card without a state is new. */
  cards: CardStates
}

/** Everything the learner has done, split into areas that are stored and reset separately. */
export interface Progress {
  reading: ReadingProgress
  settings: Settings
  flashcards: FlashcardProgress
}

export type ProgressArea = keyof Progress

export const PROGRESS_AREAS: readonly ProgressArea[] = ['reading', 'settings', 'flashcards']

export function emptyProgress(): Progress {
  return { reading: { readLessons: {} }, settings: { theme: 'dark', newCardsPerDay: DEFAULT_NEW_CARDS_PER_DAY }, flashcards: { cards: {} } }
}

export const PROGRESS_SCHEMA_VERSION = 3

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
}

function validateCurrent(data: Record<string, unknown>): ProgressExport {
  const { exportedAt, progress } = data
  if (!isTimestamp(exportedAt)) throw malformed('exportedAt is not a timestamp')
  if (!isRecord(progress)) throw malformed('progress is missing')
  return { schemaVersion: PROGRESS_SCHEMA_VERSION, exportedAt, progress: validateProgress(progress) }
}

function validateProgress(progress: Record<string, unknown>): Progress {
  const { reading, settings, flashcards } = progress
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

  if (!isRecord(flashcards) || !isRecord(flashcards.cards)) throw malformed('flashcards is missing')
  const cards = Object.entries(flashcards.cards).map(([cardId, value]): [string, CardState] => {
    const state = readCardState(value)
    if (!state) throw malformed(`the state of card ${cardId} is invalid`)
    return [cardId, state]
  })

  // Object.fromEntries defines keys as own properties, so an id such as `__proto__` stays data.
  return {
    reading: { readLessons: Object.fromEntries(readLessons) as Record<string, string> },
    settings: { theme, newCardsPerDay },
    flashcards: { cards: Object.fromEntries(cards) },
  }
}

/** A daily new-card limit: a whole number from 0 to `MAX_NEW_CARDS_PER_DAY`. */
export function isNewCardLimit(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_NEW_CARDS_PER_DAY
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
