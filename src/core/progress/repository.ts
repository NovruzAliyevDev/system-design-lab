import {
  emptyProgress,
  migrateProgress,
  parseProgressFile,
  PROGRESS_AREAS,
  PROGRESS_SCHEMA_VERSION,
  type Progress,
  type ProgressArea,
  type ProgressExport,
} from './progress'

/** All progress persistence goes through this, so storage can change (e.g. cloud sync) without touching features. */
export interface ProgressRepository {
  get<A extends ProgressArea>(area: A): Promise<Progress[A]>
  getAll(): Promise<Progress>
  put<A extends ProgressArea>(area: A, value: Progress[A]): Promise<void>
  /** Puts one area, or every area when none is given, back to its empty state. */
  reset(area?: ProgressArea): Promise<void>
  exportAll(now: Date): Promise<ProgressExport>
  /**
   * Validates and migrates an export file, backs up the current progress, then replaces it.
   * An invalid file throws `InvalidProgressFileError` and changes nothing.
   */
  importAll(fileText: string, now: Date): Promise<void>
  latestBackup(): Promise<ProgressExport | undefined>
}

/** The storage a repository needs: a key-value store with atomic multi-key writes. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  /** Writes every entry in one transaction: all of them land, or none do. */
  putAll(entries: Record<string, unknown>): Promise<void>
}

const areaKey = (area: ProgressArea) => `area:${area}`
/** The progress as it was just before the last import replaced it. */
const BACKUP_KEY = 'backup:before-import'

export function createProgressRepository(store: KeyValueStore): ProgressRepository {
  async function get<A extends ProgressArea>(area: A): Promise<Progress[A]> {
    const stored = (await store.get(areaKey(area))) as Progress[A] | undefined
    return stored ?? emptyProgress()[area]
  }

  async function getAll(): Promise<Progress> {
    const progress = emptyProgress()
    for (const area of PROGRESS_AREAS) Object.assign(progress, { [area]: await get(area) })
    return progress
  }

  async function exportAll(now: Date): Promise<ProgressExport> {
    return { schemaVersion: PROGRESS_SCHEMA_VERSION, exportedAt: now.toISOString(), progress: await getAll() }
  }

  return {
    get,

    getAll,

    put: (area, value) => store.putAll({ [areaKey(area)]: value }),

    reset(area) {
      const empty = emptyProgress()
      const areas = area ? [area] : PROGRESS_AREAS
      return store.putAll(Object.fromEntries(areas.map((resetArea) => [areaKey(resetArea), empty[resetArea]])))
    },

    exportAll,

    async importAll(fileText, now) {
      const { progress } = migrateProgress(parseProgressFile(fileText))
      const backup = await exportAll(now)
      await store.putAll({
        [BACKUP_KEY]: backup,
        ...Object.fromEntries(PROGRESS_AREAS.map((area) => [areaKey(area), progress[area]])),
      })
    },

    async latestBackup() {
      const backup = await store.get(BACKUP_KEY)
      // A backup is an export file, so one written by an older version of the app is migrated like one.
      return backup === undefined ? undefined : migrateProgress(backup)
    },
  }
}

/** A repository that keeps progress in memory, for tests. */
export function createInMemoryProgressRepository(): ProgressRepository {
  const entries = new Map<string, string>()
  return createProgressRepository({
    // Values are stored serialised, so callers never share objects with the store (as with IndexedDB).
    get: async (key) => {
      const value = entries.get(key)
      return value === undefined ? undefined : JSON.parse(value)
    },
    putAll: async (newEntries) => {
      for (const [key, value] of Object.entries(newEntries)) entries.set(key, JSON.stringify(value))
    },
  })
}
