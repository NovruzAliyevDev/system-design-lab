import { useEffect, useState } from 'react'
import { emptyDesign, readDesign, type Design } from '../core/design/design'
import { createHistory, type History } from '../core/design/history'
import { SANDBOX_DRAFT_ID } from '../core/progress/progress'
import { DesignEditor } from './canvas/DesignEditor'
import { t } from './i18n'
import { useProgress } from './progress/store'
import { TABLET_QUERY, useMediaQuery } from './useMediaQuery'

/** The free sandbox: a Design Canvas outside any Challenge, auto-saved as a draft. */
export function SandboxPage() {
  const loaded = useProgress((state) => state.progress !== undefined)
  const saveDesign = useProgress((state) => state.saveDesign)
  const editable = useMediaQuery(TABLET_QUERY)
  const [history, setHistory] = useState<History<Design>>()

  useEffect(() => {
    if (!loaded || history) return
    const stored = useProgress.getState().progress?.designs.drafts[SANDBOX_DRAFT_ID]
    // A draft stored by an older version of the app gets config fields added since; one that no longer reads starts over.
    setHistory(createHistory(stored === undefined ? emptyDesign() : (readDesign(stored).design ?? emptyDesign())))
  }, [loaded, history])

  function change(next: History<Design>) {
    setHistory(next)
    // Every change is stored at once, so closing the tab never loses work.
    if (next.present !== history?.present) void saveDesign(SANDBOX_DRAFT_ID, next.present)
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-50">{t('sandboxTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t('sandboxDescription')}</p>
      {!editable && (
        <p role="status" className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-zinc-200">
          {t('canvasDesktopOnly')}
        </p>
      )}
      <div className="mt-4">
        {history ? (
          <DesignEditor history={history} onChange={change} readOnly={!editable} />
        ) : (
          <p className="text-sm text-zinc-500">{t('designLoading')}</p>
        )}
      </div>
    </>
  )
}
