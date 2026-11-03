import { useEffect, useState } from 'react'
import { BrowserRouter, Link, matchPath, NavLink, Route, Routes, useLocation, useMatch } from 'react-router-dom'
import { Attribution } from './Attribution'
import { CalculatorsPage } from './CalculatorsPage'
import { ChallengePage } from './ChallengePage'
import { ChallengesPage } from './ChallengesPage'
import { DashboardPage } from './DashboardPage'
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
  LESSONS_ROUTE,
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

/** The current page is marked by more than colour: it is underlined too. */
function headerLinkClass({ isActive }: { isActive: boolean }) {
  return `rounded text-sm whitespace-nowrap ${
    isActive ? 'text-text underline decoration-accent decoration-2 underline-offset-6' : 'text-text-muted hover:text-text'
  }`
}

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
      <header className="sticky top-0 z-30 h-header border-b border-border bg-surface/90 backdrop-blur">
        <div className="flex h-full items-center gap-2 px-4 sm:gap-4">
          <button
            type="button"
            className={`flex min-h-11 min-w-11 items-center justify-center rounded border border-border px-2 text-sm text-text-muted hover:border-text-muted hover:text-text sm:min-h-8 sm:px-3 ${isCanvasPage ? '' : 'lg:hidden'}`}
            aria-expanded={tocOpen}
            aria-controls="toc-drawer"
            onClick={() => setTocOpen((open) => !open)}
          >
            {/* On a phone the header has room for the icon only; the label stays for screen readers. */}
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:hidden">
              {tocOpen ? (
                <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
              ) : (
                <path d="M3 5h1M3 10h1M3 15h1M8 5h9M8 10h9M8 15h9" strokeLinecap="round" />
              )}
            </svg>
            <span className="max-sm:sr-only">{tocOpen ? t('closeTableOfContents') : t('tableOfContents')}</span>
          </button>
          <Link to="/" className="min-w-0 truncate font-semibold text-text">
            {t('appTitle')}
          </Link>
          <span className="hidden text-sm text-text-muted 2xl:inline">{t('appTagline')}</span>
          <div className="ml-auto">
            <Search />
          </div>
          {/* A narrow header has no room for them; below `xl` the table of contents links them. */}
          {HEADER_PAGES.map(({ to, label }) => (
            <NavLink key={to} to={to} className={(state) => `hidden xl:inline ${headerLinkClass(state)}`}>
              {t(label)}
            </NavLink>
          ))}
          <NavLink
            to={SETTINGS_ROUTE}
            aria-label={t('settingsTitle')}
            className={(state) =>
              // On a phone the icon has no text to underline, so the current page gets a ring instead.
              `flex min-h-11 min-w-11 items-center justify-center sm:min-h-0 sm:min-w-0 ${headerLinkClass(state)} ${state.isActive ? 'max-sm:ring-1 max-sm:ring-accent' : ''}`
            }
          >
            {/* On a phone the header has room for the icon only, as for search. */}
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:hidden">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
              <circle cx="7" cy="5" r="1.75" fill="currentColor" />
              <circle cx="13" cy="10" r="1.75" fill="currentColor" />
              <circle cx="9" cy="15" r="1.75" fill="currentColor" />
            </svg>
            <span className="hidden sm:inline">{t('settingsTitle')}</span>
          </NavLink>
        </div>
      </header>

      <div className="lg:flex">
        <aside
          id="toc-drawer"
          className={`${tocOpen ? 'block' : 'hidden'} fixed inset-x-0 top-header bottom-0 z-20 overflow-y-auto bg-surface px-3 py-4 lg:w-72 lg:border-r lg:border-border ${isCanvasPage ? '' : 'lg:sticky lg:top-header lg:block lg:h-[calc(100vh-var(--spacing-header))] lg:shrink-0'}`}
        >
          <TableOfContents currentLessonId={currentLessonId} />
        </aside>

        <div className="min-w-0 flex-1">
          <main className={isCanvasPage ? 'px-4 py-6' : 'mx-auto max-w-3xl px-4 py-8'}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path={LESSONS_ROUTE} element={<LessonList />} />
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
          <footer className="mx-auto max-w-3xl border-t border-border px-4 py-6 text-xs text-text-muted">
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
