// Reads an Anki package (.apkg): a zip holding the collection as an SQLite database.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { unzipSync } from 'fflate'
import type { DeckSource } from '../src/core/flashcards/deck'

/** Packages from Anki 2.1.50+ also have `collection.anki21b`, but this one is always there. */
const COLLECTION_FILE = 'collection.anki2'
/** Anki separates a note's fields with the unit separator. */
const FIELD_SEPARATOR = '\x1f'

interface NoteType {
  name: string
  flds: { name: string; ord: number }[]
}

/**
 * The cards of an Anki package, in the order Anki shows new cards. Every note must be of a type with
 * a Front and a Back field, as the primer's Basic notes are.
 */
export function readAnkiPackage(file: string, title: string, path: string): DeckSource {
  const collection = unzipSync(readFileSync(file))[COLLECTION_FILE]
  if (!collection) throw new Error(`${path} has no ${COLLECTION_FILE}`)
  // SQLite opens files, so the collection is written out for the duration of the read.
  const dir = mkdtempSync(join(tmpdir(), 'apkg-'))
  try {
    writeFileSync(join(dir, COLLECTION_FILE), collection)
    const db = new DatabaseSync(join(dir, COLLECTION_FILE), { readOnly: true })
    try {
      const { models } = db.prepare('SELECT models FROM col').get() as { models: string }
      const noteTypes = JSON.parse(models) as Record<string, NoteType>
      // A new card's `due` is its position in the new-card queue.
      const rows = db.prepare('SELECT cards.id, notes.mid, notes.flds FROM cards JOIN notes ON notes.id = cards.nid ORDER BY cards.due, cards.id').all() as {
        id: number
        mid: number
        flds: string
      }[]
      const cards = rows.map(({ id, mid, flds }) => {
        const noteType = noteTypes[String(mid)]
        const fields = flds.split(FIELD_SEPARATOR)
        const field = (name: string) => {
          const ord = noteType?.flds.find((candidate) => candidate.name === name)?.ord
          if (ord === undefined) throw new Error(`${path}: card ${id} is a "${noteType?.name ?? mid}" note, which has no ${name} field`)
          return fields[ord] ?? ''
        }
        return { ankiId: id, front: field('Front'), back: field('Back') }
      })
      return { title, path, cards }
    } finally {
      db.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
