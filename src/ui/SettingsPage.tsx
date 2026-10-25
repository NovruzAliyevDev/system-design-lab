import { useEffect, useState, type ChangeEvent } from 'react'
import {
  InvalidProgressFileError,
  THEMES,
  type InvalidProgressFileReason,
  type ProgressArea,
  type ProgressExport,
  type Theme,
} from '../core/progress/progress'
import { downloadJson } from './download'
import { t, type StringKey } from './i18n'
import { progressRepository } from './progress/repository'
import { useProgress } from './progress/store'

const THEME_LABELS: Record<Theme, StringKey> = { dark: 'themeDark', light: 'themeLight' }

const IMPORT_ERRORS: Record<InvalidProgressFileReason, StringKey> = {
  'not-json': 'importNotJson',
  malformed: 'importMalformed',
  'unsupported-version': 'importUnsupportedVersion',
}

/** What a reset clears: one area, or everything. */
type ResetTarget = ProgressArea | 'all'

const RESETS: { target: ResetTarget; label: StringKey }[] = [
  { target: 'reading', label: 'resetReading' },
  { target: 'settings', label: 'resetSettings' },
  { target: 'all', label: 'resetAll' },
]

const buttonClass = 'rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500'
const sectionClass = 'mt-8 border-t border-zinc-800 pt-6'

/** File name for an export file, dated by when it was exported. */
const exportFileName = (kind: 'progress' | 'backup', file: ProgressExport) =>
  `system-design-lab-${kind}-${file.exportedAt.slice(0, 10)}.json`

export function SettingsPage() {
  const { progress, setTheme, importProgress, reset } = useProgress()
  const [message, setMessage] = useState<{ text: string; isError: boolean }>()
  const [backup, setBackup] = useState<ProgressExport>()
  const [confirming, setConfirming] = useState<ResetTarget>()

  useEffect(() => {
    void progressRepository.latestBackup().then(setBackup)
  }, [])

  async function exportProgress() {
    const file = await progressRepository.exportAll(new Date())
    downloadJson(exportFileName('progress', file), file)
  }

  async function importChosenFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Clear the input so that choosing the same file again imports it again.
    input.value = ''
    if (!file) return
    try {
      await importProgress(await file.text())
      setBackup(await progressRepository.latestBackup())
      setMessage({ text: t('importSucceeded'), isError: false })
    } catch (error) {
      const key = error instanceof InvalidProgressFileError ? IMPORT_ERRORS[error.reason] : 'importFailed'
      setMessage({ text: t(key), isError: true })
    }
  }

  async function confirmReset(target: ResetTarget) {
    setConfirming(undefined)
    await reset(target === 'all' ? undefined : target)
    setMessage({ text: t('resetDone'), isError: false })
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-zinc-50">{t('settingsTitle')}</h1>

      <fieldset className="mt-6" disabled={!progress}>
        <legend className="text-lg font-medium text-zinc-100">{t('appearanceTitle')}</legend>
        <div className="mt-3 flex gap-4">
          {THEMES.map((theme) => (
            <label key={theme} className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="radio"
                name="theme"
                checked={progress?.settings.theme === theme}
                onChange={() => void setTheme(theme)}
              />
              {t(THEME_LABELS[theme])}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={sectionClass}>
        <h2 className="text-lg font-medium text-zinc-100">{t('progressTitle')}</h2>
        <p className="mt-1 text-sm text-zinc-400">{t('progressDescription')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => void exportProgress()}>
            {t('exportProgress')}
          </button>
          <label className={`${buttonClass} cursor-pointer focus-within:outline focus-within:outline-sky-400`}>
            {t('importProgress')}
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void importChosenFile(event)} />
          </label>
          {backup && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => downloadJson(exportFileName('backup', backup), backup)}
            >
              {t('downloadBackup')}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">{t('importDescription')}</p>
      </div>

      <div className={sectionClass}>
        <h2 className="text-lg font-medium text-zinc-100">{t('resetTitle')}</h2>
        <ul className="mt-4 space-y-3">
          {RESETS.map(({ target, label }) => (
            <li key={target}>
              {confirming === target ? (
                <div role="group" aria-label={t(label)} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-zinc-300">{t('resetConfirm')}</span>
                  <button
                    type="button"
                    className="rounded bg-red-600 px-3 py-1.5 text-white hover:bg-red-500"
                    onClick={() => void confirmReset(target)}
                  >
                    {t('resetConfirmYes')}
                  </button>
                  <button type="button" className={buttonClass} onClick={() => setConfirming(undefined)}>
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <button type="button" className={buttonClass} onClick={() => setConfirming(target)}>
                  {t(label)}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p role="status" className={`mt-8 text-sm ${message?.isError ? 'text-red-500' : 'text-emerald-500'}`}>
        {message?.text}
      </p>
    </section>
  )
}
