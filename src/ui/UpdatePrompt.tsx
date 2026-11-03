import { useRegisterSW } from 'virtual:pwa-register/react'
import { t } from './i18n'

const buttonClass = 'min-h-11 rounded border px-3 sm:min-h-8'

/** Browsers only look for a new service worker on a page load; moving between Lessons is not one. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Offers to switch to a newly deployed version once its service worker has cached it. When any tab
 * accepts, every open tab reloads, because the old version's files leave the cache.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration) setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-40 flex flex-wrap items-center gap-3 rounded border border-border bg-surface-raised px-4 py-3 text-sm text-text shadow-lg sm:left-auto"
    >
      <span>{t('updateAvailable')}</span>
      <button
        type="button"
        className={`${buttonClass} ml-auto border-accent bg-accent font-medium text-surface hover:opacity-90`}
        onClick={() => updateServiceWorker(true)}
      >
        {t('updateReload')}
      </button>
      <button type="button" className={`${buttonClass} border-border hover:border-text-muted`} onClick={() => setNeedRefresh(false)}>
        {t('updateLater')}
      </button>
    </div>
  )
}
