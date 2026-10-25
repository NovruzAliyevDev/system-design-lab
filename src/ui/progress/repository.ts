import Dexie, { type EntityTable } from 'dexie'
import { createProgressRepository, type KeyValueStore } from '../../core/progress/repository'

interface ProgressRecord {
  key: string
  value: unknown
}

class ProgressDatabase extends Dexie {
  records!: EntityTable<ProgressRecord, 'key'>

  constructor() {
    super('system-design-lab-progress')
    this.version(1).stores({ records: 'key' })
  }
}

function dexieStore(db: ProgressDatabase): KeyValueStore {
  return {
    get: async (key) => (await db.records.get(key))?.value,
    putAll: async (entries) => {
      await db.transaction('rw', db.records, () =>
        db.records.bulkPut(Object.entries(entries).map(([key, value]) => ({ key, value }))),
      )
    },
  }
}

/** The browser's progress, kept in IndexedDB. */
export const progressRepository = createProgressRepository(dexieStore(new ProgressDatabase()))
