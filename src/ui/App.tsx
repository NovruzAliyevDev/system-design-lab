import { useEffect, useState } from 'react'
import { BrowserRouter, Link, matchPath, Route, Routes, useLocation, useMatch } from 'react-router-dom'
import { Attribution } from './Attribution'
import { CalculatorsPage } from './CalculatorsPage'
import { ChallengePage } from './ChallengePage'
import { ChallengesPage } from './ChallengesPage'
import { FlashcardsPage } from './FlashcardsPage'
import { GlossaryPage } from './GlossaryPage'
import { LessonList } from './LessonList'
import { LessonPage } from './LessonPage'
import { SandboxPage } from './SandboxPage'
import { SolutionPage, SolutionsPage } from './SolutionPages'
import { Search } from './Search'
import { SettingsPage } from './SettingsPage'
import { SkillTreePage } from './SkillTreePage'
import { StudyGuidePage } from './StudyGuidePage'
import { TableOfContents } from './TableOfContents'
import { UpdatePrompt } from './UpdatePrompt'
import { t } from './i18n'
import {
  CALCULATORS_ROUTE,
  CHALLENGE_ROUTE,
  CHALLENGES_ROUTE,
  FLASHCARDS_ROUTE,
  GLOSSARY_ROUTE,
  LESSON_ROUTE,
  HEADER_PAGES,
  SANDBOX_ROUTE,
  SETTINGS_ROUTE,
  SKILL_TREE_ROUTE,
  SOLUTION_ROUTE,
  SOLUTIONS_ROUTE,
  STUDY_GUIDE_ROUTE,
} from './routes'

/** Pages whose canvas takes the whole width. */
const CANVAS_ROUTES = [SANDBOX_ROUTE, CHALLENGE_ROUTE, SKILL_TREE_ROUTE]

function Layout() {
  const lessonMatch = useMatch(LESSON_ROUTE)
  const currentLessonId = lessonMatch?.params.lessonId
  const { pathname } = useLocation()
  // A canvas (a Design, or the Skill Tree map) needs the whole width: the table of contents is only a drawer there.
  const isCanvasPage = CANVAS_ROUTES.some((route) => matchPath(route, pathname) !== null)
  const [tocOpen, setTocOpen] = useState(false)

  // The mobile table of contents closes once the reader picks a Lesson.
  useEffect(() => setTocOpen(false), [pathname])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="flex items-baseline gap-2 px-4 py-3 sm:gap-3">
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-0.5 text-sm text-zinc-300 lg:hidden"
            aria-expanded={tocOpen}
            aria-controls="toc-drawer"
            onClick={() => setTocOpen((open) => !open)}
          >
            {tocOpen ? t('closeTableOfContents') : t('tableOfContents')}
          </button>
          <Link to="/" className="font-semibold text-zinc-50">
            {t('appTitle')}
          </Link>
          <span className="hidden text-sm text-zinc-500 xl:inline">{t('appTagline')}</span>
          <div className="ml-auto self-center">
            <Search />
          </div>
          {/* A narrow header has no room for them; below `lg` the table of contents drawer links them. */}
          {HEADER_PAGES.map(({ to, label }) => (
            <Link key={to} to={to} className="hidden text-sm text-zinc-400 hover:text-zinc-100 lg:inline">
              {t(label)}
            </Link>
          ))}
          <Link to={SETTINGS_ROUTE} className="text-sm text-zinc-400 hover:text-zinc-100">
            {t('settingsTitle')}
          </Link>
        </div>
      </header>

      <div className="lg:flex">
        <aside
          id="toc-drawer"
          className={`${tocOpen ? 'block' : 'hidden'} fixed inset-x-0 top-12 bottom-0 z-20 overflow-y-auto bg-zinc-950 px-3 py-4 lg:w-72 lg:border-r lg:border-zinc-800 ${isCanvasPage ? '' : 'lg:sticky lg:top-12 lg:block lg:h-[calc(100vh-3rem)] lg:shrink-0'}`}
        >
          <TableOfContents currentLessonId={currentLessonId} />
        </aside>

        <div className="min-w-0 flex-1">
          <main className={isCanvasPage ? 'px-4 py-6' : 'mx-auto max-w-3xl px-4 py-8'}>
            <Routes>
              <Route path="/" element={<LessonList />} />
              <Route path={LESSON_ROUTE} element={<LessonPage />} />
              <Route path={GLOSSARY_ROUTE} element={<GlossaryPage />} />
              <Route path={SOLUTIONS_ROUTE} element={<SolutionsPage />} />
              <Route path={SOLUTION_ROUTE} element={<SolutionPage />} />
              <Route path={STUDY_GUIDE_ROUTE} element={<StudyGuidePage />} />
              <Route path={FLASHCARDS_ROUTE} element={<FlashcardsPage />} />
              <Route path={SANDBOX_ROUTE} element={<SandboxPage />} />
              <Route path={CALCULATORS_ROUTE} element={<CalculatorsPage />} />
              <Route path={CHALLENGES_ROUTE} element={<ChallengesPage />} />
              <Route path={CHALLENGE_ROUTE} element={<ChallengePage />} />
              <Route path={SKILL_TREE_ROUTE} element={<SkillTreePage />} />
              <Route path={SETTINGS_ROUTE} element={<SettingsPage />} />
            </Routes>
          </main>
          <footer className="mx-auto max-w-3xl border-t border-zinc-800 px-4 py-6 text-xs text-zinc-500">
            <Attribution textKey="siteAttribution" />
          </footer>
        </div>
      </div>
      <UpdatePrompt />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Layout />
    </BrowserRouter>
  )
}
