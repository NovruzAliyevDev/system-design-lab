import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { LessonList } from './LessonList'
import { LessonPage } from './LessonPage'
import { t } from './i18n'

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-4xl items-baseline gap-3 px-4 py-3">
          <Link to="/" className="font-semibold text-zinc-50">
            {t('appTitle')}
          </Link>
          <span className="hidden text-sm text-zinc-500 sm:inline">{t('appTagline')}</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Routes>
          <Route path="/" element={<LessonList />} />
          <Route path="/lessons/:lessonId" element={<LessonPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
