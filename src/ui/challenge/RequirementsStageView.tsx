import { useId } from 'react'
import type { StageWork } from '../../core/challenges/attempt'
import type { RequirementSection, RequirementsStage } from '../../core/challenges/challenge'
import { t, type StringKey } from '../i18n'
import { Verdict } from './shared'

const SECTIONS: { section: RequirementSection; title: StringKey }[] = [
  { section: 'use-case', title: 'requirementsUseCases' },
  { section: 'constraint', title: 'requirementsConstraints' },
]

type RequirementsWork = Extract<StageWork, { type: 'requirements' }>

/** The checklist of candidate use cases and constraints, with notes. Once the Stage is over, every item is marked and explained. */
export function RequirementsStageView(props: {
  stage: RequirementsStage
  work: RequirementsWork
  editable: boolean
  onChange(work: RequirementsWork): void
}) {
  const { stage, work, editable, onChange } = props
  const over = work.outcome !== undefined
  const notesId = useId()
  const chosen = new Set(work.chosen)

  function toggle(index: number) {
    const next = chosen.has(index) ? work.chosen.filter((item) => item !== index) : [...work.chosen, index].sort((a, b) => a - b)
    onChange({ ...work, chosen: next })
  }

  return (
    <div className="mt-4 max-w-4xl">
      {!over && <p className="text-xs text-text-muted">{t('requirementsHint')}</p>}
      <div className="mt-2 grid gap-6 lg:grid-cols-2">
        {SECTIONS.map(({ section, title }) => (
          <fieldset key={section} disabled={!editable || over}>
            <legend className="font-medium text-text">{t(title)}</legend>
            <ul className="mt-2 space-y-2">
              {stage.items.map((item, index) => {
                if (item.section !== section) return null
                const picked = chosen.has(index)
                const border = !over ? 'border-border' : picked === item.correct ? 'border-success/60' : 'border-danger/60'
                return (
                  <li key={index} className={`rounded border ${border} px-3`}>
                    <label className="flex cursor-pointer items-start gap-2 py-2.5 text-text">
                      <input type="checkbox" className="mt-1" checked={picked} onChange={() => toggle(index)} />
                      <span>{item.text}</span>
                    </label>
                    {over && (
                      <div className="pb-2.5 pl-6 text-sm">
                        <p>
                          <Verdict passed={picked === item.correct} label={t(item.correct ? 'requirementInScope' : 'requirementOutOfScope')} />
                          {picked !== item.correct && <span className="text-text-muted"> · {t(item.correct ? 'requirementMissed' : 'requirementWrongPick')}</span>}
                        </p>
                        <p className="text-text-muted">{item.explanation}</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </fieldset>
        ))}
      </div>
      <label htmlFor={notesId} className="mt-6 block font-medium text-text">
        {t('requirementsNotes')}
      </label>
      <textarea
        id={notesId}
        className="mt-2 block min-h-24 w-full rounded border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-text-muted disabled:opacity-70"
        placeholder={t('requirementsNotesPlaceholder')}
        value={work.notes}
        readOnly={!editable || over}
        onChange={(event) => onChange({ ...work, notes: event.target.value })}
      />
    </div>
  )
}
