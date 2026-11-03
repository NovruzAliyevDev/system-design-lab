import { useEffect, useState, type ChangeEvent } from 'react'
import { MAX_STREAK_MIN_ACTIVITIES } from '../core/activity/streak'
import {
  CANVAS_STYLES,
  InvalidProgressFileError,
  isNewCardLimit,
  isStreakMinimum,
  MAX_NEW_CARDS_PER_DAY,
  THEMES,
  type CanvasStyle,
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

const CANVAS_STYLE_LABELS: Record<CanvasStyle, StringKey> = { clean: 'canvasStyleClean', sketch: 'canvasStyleSketch' }

const IMPORT_ERRORS: Record<InvalidProgressFileReason, StringKey> = {
  'not-json': 'importNotJson',
  malformed: 'importMalformed',
  'unsupported-version': 'importUnsupportedVersion',
}

/** What a reset clears: one area, or everything. */
type ResetTarget = ProgressArea | 'all'

const RESETS: { target: ResetTarget; label: StringKey }[] = [
  { target: 'reading', label: 'resetReading' },
  { target: 'flashcards', label: 'resetFlashcards' },
  { target: 'quizzes', label: 'resetQuizzes' },
  { target: 'designs', label: 'resetDesigns' },
  { target: 'challenges', label: 'resetChallenges' },
  { target: 'activity', label: 'resetActivity' },
  { target: 'settings', label: 'resetSettings' },
  { target: 'all', label: 'resetAll' },
]

const buttonClass = 'inline-flex min-h-11 items-center rounded border border-border px-3 text-sm text-text hover:border-text-muted sm:min-h-8'
const sectionClass = 'mt-8 border-t border-border pt-6'

/** File name for an export file, dated by when it was exported. */
const exportFileName = (kind: 'progress' | 'backup', file: ProgressExport) =>
  `system-design-lab-${kind}-${file.exportedAt.slice(0, 10)}.json`

export function SettingsPage() {
  const { progress, setTheme, setNewCardsPerDay, setCanvasStyle, setStreakMinActivities, importProgress, reset } = useProgress()
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
      <h1 className="text-2xl font-semibold text-text">{t('settingsTitle')}</h1>

      <fieldset className="mt-6" disabled={!progress}>
        <legend className="text-lg font-medium text-text">{t('appearanceTitle')}</legend>
        <div className="mt-3 flex gap-4">
          {THEMES.map((theme) => (
            <label key={theme} className="flex min-h-11 items-center gap-2 text-sm text-text sm:min-h-8">
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
        <p className="mt-4 text-sm text-text">{t('canvasStyleTitle')}</p>
        <div className="mt-2 flex gap-4">
          {CANVAS_STYLES.map((canvasStyle) => (
            <label key={canvasStyle} className="flex min-h-11 items-center gap-2 text-sm text-text sm:min-h-8">
              <input
                type="radio"
                name="canvas-style"
                checked={progress?.settings.canvasStyle === canvasStyle}
                onChange={() => void setCanvasStyle(canvasStyle)}
              />
              {t(CANVAS_STYLE_LABELS[canvasStyle])}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={sectionClass} disabled={!progress}>
        <legend className="float-left text-lg font-medium text-text">{t('flashcardsSettingsTitle')}</legend>
        <label className="clear-left block pt-3 text-sm text-text">
          {t('newCardsPerDay')}
          <CountInput value={progress?.settings.newCardsPerDay} min={0} max={MAX_NEW_CARDS_PER_DAY} isValid={isNewCardLimit} onChange={setNewCardsPerDay} />
        </label>
        <p className="mt-2 max-w-prose text-xs text-text-muted">{t('newCardsPerDayDescription')}</p>
      </fieldset>

      <fieldset className={sectionClass} disabled={!progress}>
        <legend className="float-left text-lg font-medium text-text">{t('streakSettingsTitle')}</legend>
        <label className="clear-left block pt-3 text-sm text-text">
          {t('streakMinActivities')}
          <CountInput
            value={progress?.settings.streakMinActivities}
            min={1}
            max={MAX_STREAK_MIN_ACTIVITIES}
            isValid={isStreakMinimum}
            onChange={setStreakMinActivities}
          />
        </label>
        <p className="mt-2 max-w-prose text-xs text-text-muted">{t('streakMinActivitiesDescription')}</p>
      </fieldset>

      <div className={sectionClass}>
        <h2 className="text-lg font-medium text-text">{t('progressTitle')}</h2>
        <p className="mt-1 max-w-prose text-sm text-text-muted">{t('progressDescription')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => void exportProgress()}>
            {t('exportProgress')}
          </button>
          <label className={`${buttonClass} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`}>
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
        <p className="mt-2 max-w-prose text-xs text-text-muted">{t('importDescription')}</p>
      </div>

      <div className={sectionClass}>
        <h2 className="text-lg font-medium text-text">{t('resetTitle')}</h2>
        <ul className="mt-4 space-y-3">
          {RESETS.map(({ target, label }) => (
            <li key={target}>
              {confirming === target ? (
                <div role="group" aria-label={t(label)} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-text">{t('resetConfirm')}</span>
                  <button
                    type="button"
                    className="min-h-11 rounded border border-danger bg-danger px-3 font-medium text-surface hover:opacity-90 sm:min-h-8"
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

      <p role="status" className={`mt-8 text-sm ${message?.isError ? 'text-danger' : 'text-success'}`}>
        {message?.text}
      </p>
    </section>
  )
}

/** A number typed into a field; NaN when the field is empty. */
const parseCount = (text: string) => (text.trim() === '' ? NaN : Number(text))

interface CountInputProps {
  value: number | undefined
  min: number
  max: number
  isValid: (count: number) => boolean
  onChange: (count: number) => Promise<void>
}

/** A count setting, such as the daily new-card limit; what is typed is stored once it is valid. */
function CountInput({ value, min, max, isValid, onChange }: CountInputProps) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const [shownValue, setShownValue] = useState(value)
  // A value that changed elsewhere (loading, a reset or an import) replaces what was typed.
  if (value !== shownValue) {
    setShownValue(value)
    if (text === '' || Number(text) !== value) setText(value === undefined ? '' : String(value))
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      aria-invalid={!isValid(parseCount(text))}
      className="mt-1 block min-h-11 w-24 rounded border border-border bg-surface-raised px-2 text-text aria-invalid:border-danger sm:min-h-8"
      value={text}
      onChange={(event) => {
        setText(event.currentTarget.value)
        const count = parseCount(event.currentTarget.value)
        if (isValid(count) && count !== value) void onChange(count)
      }}
      // What was typed reads back as stored (e.g. "05" as "5"), or as the stored value when it was not valid.
      onBlur={() => setText(value === undefined ? '' : String(value))}
    />
  )
}
