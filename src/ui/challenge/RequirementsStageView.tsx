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
      {!over && <p className="text-xs text-zinc-500">{t('requirementsHint')}</p>}
      <div className="mt-2 grid gap-6 lg:grid-cols-2">
        {SECTIONS.map(({ section, title }) => (
          <fieldset key={section} disabled={!editable || over}>
            <legend className="font-medium text-zinc-100">{t(title)}</legend>
            <ul className="mt-2 space-y-2">
              {stage.items.map((item, index) => {
                if (item.section !== section) return null
                const picked = chosen.has(index)
                const border = !over ? 'border-zinc-800' : picked === item.correct ? 'border-emerald-500/50' : 'border-rose-500/50'
                return (
                  <li key={index} className={`rounded border ${border} px-3 py-2`}>
                    <label className="flex cursor-pointer items-start gap-2 text-zinc-200">
                      <input type="checkbox" className="mt-1" checked={picked} onChange={() => toggle(index)} />
                      <span>{item.text}</span>
                    </label>
                    {over && (
                      <div className="mt-1 pl-6 text-sm">
                        <p>
                          <Verdict passed={picked === item.correct} label={t(item.correct ? 'requirementInScope' : 'requirementOutOfScope')} />
                          {picked !== item.correct && <span className="text-zinc-500"> · {t(item.correct ? 'requirementMissed' : 'requirementWrongPick')}</span>}
                        </p>
                        <p className="text-zinc-400">{item.explanation}</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </fieldset>
        ))}
      </div>
      <label htmlFor={notesId} className="mt-6 block font-medium text-zinc-100">
        {t('requirementsNotes')}
      </label>
      <textarea
        id={notesId}
        className="mt-2 block min-h-24 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-70"
        placeholder={t('requirementsNotesPlaceholder')}
        value={work.notes}
        readOnly={!editable || over}
        onChange={(event) => onChange({ ...work, notes: event.target.value })}
      />
    </div>
  )
}
