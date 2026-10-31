// Content pin update report: what moving the primer submodule from one commit to another changes in
// the Lesson catalog, and which authored content then references a missing Lesson.
//
//   npm run pin-report -- [<from> [<to>]]
//
// <from> defaults to the pin committed in HEAD, <to> to the commit checked out in the submodule. Both
// may be any revision the submodule knows. Exits with 1 when authored content needs fixing.
import { challenges } from '../content/challenges'
import { flashcards } from '../content/flashcards'
import { glossary } from '../content/glossary'
import { quizzes } from '../content/quizzes'
import { skillTree } from '../content/skill-tree'
import { comparePrimerVersions, formatPinChangeReport, type PrimerVersion } from '../src/core/content/pin-change-report'
import { git, PRIMER_DIR, PRIMER_PATH, PRIMER_REPO_URL } from './build-content'

const README = 'README.md'

function primerVersion(revision: string): PrimerVersion {
  const commit = git(['rev-parse', '--verify', `${revision}^{commit}`], PRIMER_DIR)
  return {
    markdown: git(['show', `${commit}:${README}`], PRIMER_DIR),
    source: { repoUrl: PRIMER_REPO_URL, commit, path: README },
  }
}

const [from = git(['rev-parse', `HEAD:${PRIMER_PATH}`]), to = 'HEAD'] = process.argv.slice(2)
const report = comparePrimerVersions({ before: primerVersion(from), after: primerVersion(to), authored: { glossary, flashcards, quizzes, challenges, skillTree } })
console.log(formatPinChangeReport(report))
if (report.brokenReferences.length > 0) process.exitCode = 1
