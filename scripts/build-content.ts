// Content Pipeline: turns the pinned primer submodule into the static catalog the app loads.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildContentCatalog } from '../src/core/content/catalog'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRIMER_PATH = 'vendor/system-design-primer'
const PRIMER_DIR = join(root, PRIMER_PATH)
const OUTPUT = join(root, 'src', 'generated', 'catalog.json')

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

/** The commit the repo pins the primer to; fails if the submodule checkout has drifted from it. */
function pinnedPrimerCommit(): string {
  // `git ls-files -s` prints "<mode> <sha> <stage>\t<path>" for the gitlink in the index.
  const pinned = git(['ls-files', '-s', PRIMER_PATH]).split(/\s+/)[1]
  const checkedOut = git(['-C', PRIMER_DIR, 'rev-parse', 'HEAD'])
  if (!pinned || pinned !== checkedOut) {
    throw new Error(
      `Primer checkout (${checkedOut}) does not match the pinned commit (${pinned ?? 'none'}). ` +
        'Run `git submodule update --init`, or stage the new pin with `git add vendor/system-design-primer`.',
    )
  }
  return pinned
}

export function loadPrimerCatalog() {
  const markdown = readFileSync(join(PRIMER_DIR, 'README.md'), 'utf8')
  const commit = pinnedPrimerCommit()
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
