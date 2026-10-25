import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, useParams } from 'react-router-dom'
import { findLesson } from '../core/content/catalog'
import { catalog } from './catalog'
import { t } from './i18n'

export function LessonPage() {
  const { lessonId = '' } = useParams()
  const lesson = findLesson(catalog, lessonId)

  return (
    <article>
      <Link to="/" className="text-sm text-sky-400 hover:underline">
        {t('backToLessons')}
      </Link>
      {lesson ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold text-zinc-50">{lesson.title}</h1>
          <div className="prose prose-invert mt-6 max-w-none prose-a:text-sky-400">
            {/* Raw HTML in the primer (image blocks) is dropped until ticket 02 renders it. */}
            <Markdown remarkPlugins={[remarkGfm]} skipHtml>
              {lesson.body}
            </Markdown>
          </div>
        </>
      ) : (
        <p className="mt-4 text-zinc-400">{t('lessonNotFound')}</p>
      )}
    </article>
  )
}
