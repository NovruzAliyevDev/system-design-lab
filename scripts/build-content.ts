// Content Pipeline: turns the pinned primer submodule into the static catalog the app loads.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildContentCatalog } from '../src/core/content/catalog'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const PRIMER_DIR = join(root, 'vendor', 'system-design-primer')
const OUTPUT = join(root, 'src', 'generated', 'catalog.json')

export function loadPrimerCatalog() {
  const markdown = readFileSync(join(PRIMER_DIR, 'README.md'), 'utf8')
  const commit = execFileSync('git', ['-C', PRIMER_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  return buildContentCatalog({
    markdown,
    source: { repoUrl: 'https://github.com/donnemartin/system-design-primer', commit, path: 'README.md' },
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const catalog = loadPrimerCatalog()
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, JSON.stringify(catalog))
  console.log(`Content catalog: ${catalog.lessons.length} Lessons in ${catalog.groups.length} groups (${catalog.source.commit.slice(0, 7)})`)
}
