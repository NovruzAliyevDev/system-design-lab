import { t } from './i18n'

/** Shows that a Lesson has been read. */
export function ReadMarker() {
  return (
    <span role="img" lang="az" aria-label={t('lessonRead')} title={t('lessonRead')} className="shrink-0 px-1 text-sm text-emerald-500">
      ✓
    </span>
  )
}
