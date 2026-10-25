// Content Pipeline: turns the pinned primer submodule into the static catalog the app loads.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { glossary } from '../content/glossary'
import { imageMirrors } from '../content/image-mirrors'
import { buildContentCatalog, type Catalog } from '../src/core/content/catalog'
import { findUnresolvedLinks, referencedAssets } from '../src/core/content/links'
import type { SolutionSource } from '../src/core/content/solutions'
import { buildSearchIndex, searchDocuments } from '../src/core/search/search'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const PRIMER_PATH = 'vendor/system-design-primer'
export const PRIMER_DIR = join(root, PRIMER_PATH)
export const PRIMER_REPO_URL = 'https://github.com/donnemartin/system-design-primer'
/** Each system design question has a folder here with its write-up in `README.md`. */
const SOLUTIONS_PATH = 'solutions/system_design'
const GENERATED_DIR = join(root, 'src', 'generated')
const CATALOG_OUTPUT = join(GENERATED_DIR, 'catalog.json')
const SEARCH_OUTPUT = join(GENERATED_DIR, 'search-index.json')
/** Primer files the Lessons display are copied here and served under `<base>/primer/`. */
const ASSET_DIR = join(root, 'public', 'primer')

/** Runs git in this repo, or in `cwd` (e.g. the primer checkout). The primer README is a few hundred KB. */
export function git(args: string[], cwd = root): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
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

function readSolutions(): SolutionSource[] {
  return readdirSync(join(PRIMER_DIR, SOLUTIONS_PATH), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(PRIMER_DIR, SOLUTIONS_PATH, entry.name, 'README.md')))
    .map((entry) => {
      const path = `${SOLUTIONS_PATH}/${entry.name}/README.md`
      return { path, markdown: readFileSync(join(PRIMER_DIR, path), 'utf8') }
    })
}

export function loadPrimerCatalog() {
  const markdown = readFileSync(join(PRIMER_DIR, 'README.md'), 'utf8')
  const commit = pinnedPrimerCommit()
  return buildContentCatalog({
    markdown,
    source: { repoUrl: PRIMER_REPO_URL, commit, path: 'README.md' },
    solutions: readSolutions(),
    authored: { glossary, imageMirrors },
  })
}

/** The reference material the app builds pages from must be in the primer, readable. */
function assertReferenceMaterial(catalog: Catalog) {
  const missing = [
    !catalog.appendix.powersOfTwo && 'the powers of two table',
    !catalog.appendix.latencyNumbers && 'the latency numbers table',
    !catalog.studyGuide && 'the study guide',
  ].filter(Boolean)
  if (missing.length > 0) throw new Error(`The primer has no ${missing.join(', ')} (Lesson renamed or removed?)`)
}

function assertLinksResolve(catalog: Catalog) {
  const unresolved = findUnresolvedLinks(catalog)
  if (unresolved.length > 0) {
    const list = unresolved.map(({ location, href }) => `  ${location}: ${href}`).join('\n')
    throw new Error(`Links in the primer that match no heading:\n${list}`)
  }
}

function copyAssets(catalog: Catalog): number {
  const assets = referencedAssets(catalog)
  rmSync(ASSET_DIR, { recursive: true, force: true })
  const absent = assets.filter((path) => !existsSync(join(PRIMER_DIR, path)))
  if (absent.length > 0) {
    throw new Error(`Images that primer text uses but the primer does not have:\n  ${absent.join('\n  ')}`)
  }
  for (const path of assets) {
    mkdirSync(dirname(join(ASSET_DIR, path)), { recursive: true })
    copyFileSync(join(PRIMER_DIR, path), join(ASSET_DIR, path))
  }
  return assets.length
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const catalog = loadPrimerCatalog()
  assertLinksResolve(catalog)
  assertReferenceMaterial(catalog)
  const assetCount = copyAssets(catalog)
  mkdirSync(GENERATED_DIR, { recursive: true })
  writeFileSync(CATALOG_OUTPUT, JSON.stringify(catalog))
  writeFileSync(SEARCH_OUTPUT, JSON.stringify(buildSearchIndex(searchDocuments(catalog))))
  console.log(
    `Content catalog: ${catalog.lessons.length} Lessons in ${catalog.groups.length} groups, ${catalog.solutions.length} Solutions, ${catalog.glossary.length} Glossary Terms, ${assetCount} images (${catalog.source.commit.slice(0, 7)})`,
  )
}
