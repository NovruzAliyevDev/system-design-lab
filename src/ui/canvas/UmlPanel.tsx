import { useId, useState } from 'react'
import {
  CLASS_KINDS,
  edgeId,
  LABEL_MAX_LENGTH,
  MAX_MEMBERS,
  MEMBER_MAX_LENGTH,
  MULTIPLICITIES,
  RELATION_KINDS,
  reverseRelation,
  updateClass,
  updateRelation,
  type ClassKind,
  type Design,
  type DesignClass,
  type DesignRelation,
  type Multiplicity,
  type RelationKind,
} from '../../core/design/design'
import { t } from '../i18n'
import type { CommitDesign } from './ConfigPanel'
import { CLASS_KIND_LABELS, MULTIPLICITY_LABELS, RELATION_KIND_HINTS, RELATION_KIND_LABELS } from './umlText'

interface EditProps {
  design: Design
  onCommit: CommitDesign
  /** Called when the learner leaves a field: typing there again starts a new undo step. */
  onEndEdit: () => void
}

const inputClass = 'mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 aria-invalid:border-red-500 disabled:opacity-70'
const labelClass = 'mt-3 block text-xs font-medium text-zinc-400'

/** The UML Class Builder's panel: the selected class or relation, one at a time. */
export function UmlPanel({
  classId,
  relationId,
  selectedCount,
  readOnly,
  onSelectRelation,
  ...edit
}: EditProps & {
  classId?: string
  relationId?: string
  selectedCount: number
  readOnly: boolean
  /** Selects a relation, e.g. the one a reversal made. */
  onSelectRelation: (relationId: string) => void
}) {
  const { design } = edit
  const umlClass = design.classes.find((candidate) => candidate.id === classId)
  const relation = design.relations.find((candidate) => candidate.id === relationId)
  return (
    <section aria-label={t('umlPanelTitle')} className="text-sm">
      <h2 className="font-semibold text-zinc-100">{t('umlPanelTitle')}</h2>
      {readOnly && <p className="mt-1 text-xs text-zinc-500">{t('configReadOnly')}</p>}
      {umlClass ? (
        // Keyed by the class, so that member drafts do not carry over to another class.
        <fieldset key={umlClass.id} disabled={readOnly}>
          <ClassConfig umlClass={umlClass} {...edit} />
        </fieldset>
      ) : relation ? (
        <fieldset key={relation.id} disabled={readOnly}>
          <RelationConfig relation={relation} readOnly={readOnly} onSelectRelation={onSelectRelation} {...edit} />
        </fieldset>
      ) : (
        <p className="mt-2 text-zinc-500">{selectedCount > 1 ? t('configManySelected', { count: selectedCount }) : t(readOnly ? 'umlNothingSelectedReadOnly' : 'umlNothingSelected')}</p>
      )}
    </section>
  )
}

function ClassConfig({ design, umlClass, onCommit, onEndEdit }: EditProps & { umlClass: DesignClass }) {
  const id = useId()
  return (
    <>
      <label className={labelClass} htmlFor={`${id}-name`}>
        {t('umlClassName')}
      </label>
      <input
        id={`${id}-name`}
        className={`${inputClass} font-mono`}
        lang="en"
        value={umlClass.name}
        maxLength={LABEL_MAX_LENGTH}
        onBlur={onEndEdit}
        onChange={(event) => onCommit(updateClass(design, umlClass.id, { name: event.target.value }), `class-name:${umlClass.id}`)}
      />
      <label className={labelClass} htmlFor={`${id}-kind`}>
        {t('umlClassKind')}
      </label>
      <select
        id={`${id}-kind`}
        className={inputClass}
        value={umlClass.kind}
        onChange={(event) => onCommit(updateClass(design, umlClass.id, { kind: event.target.value as ClassKind }))}
      >
        {CLASS_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(CLASS_KIND_LABELS[kind])}
          </option>
        ))}
      </select>
      <MemberList
        label={t('umlFields')}
        members={umlClass.fields}
        onChange={(fields) => onCommit(updateClass(design, umlClass.id, { fields }), `class-fields:${umlClass.id}`)}
        onEndEdit={onEndEdit}
      />
      <MemberList
        label={t('umlMethods')}
        members={umlClass.methods}
        onChange={(methods) => onCommit(updateClass(design, umlClass.id, { methods }), `class-methods:${umlClass.id}`)}
        onEndEdit={onEndEdit}
      />
      <p className="mt-2 text-xs text-zinc-500">{t('umlMembersHint')}</p>
    </>
  )
}

/**
 * Fields or methods, one per line. The draft keeps the lines as typed, blank ones too, while the class
 * gets the non-blank ones; a list the class cannot take is shown as invalid and not committed.
 */
function MemberList({ label, members, onChange, onEndEdit }: { label: string; members: string[]; onChange: (members: string[]) => void; onEndEdit: () => void }) {
  const id = useId()
  const [draft, setDraft] = useState(members.join('\n'))
  const [invalid, setInvalid] = useState(false)
  return (
    <>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={`${inputClass} font-mono`}
        lang="en"
        rows={Math.min(8, Math.max(3, members.length + 1))}
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onBlur={onEndEdit}
        onChange={(event) => {
          setDraft(event.target.value)
          const lines = event.target.value
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '')
          try {
            onChange(lines)
            setInvalid(false)
          } catch (error) {
            if (!(error instanceof RangeError)) throw error
            setInvalid(true)
          }
        }}
      />
      {invalid && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-400">
          {t('umlMembersTooMany', { members: MAX_MEMBERS, length: MEMBER_MAX_LENGTH })}
        </p>
      )}
    </>
  )
}

function RelationConfig({
  design,
  relation,
  readOnly,
  onCommit,
  onSelectRelation,
}: EditProps & { relation: DesignRelation; readOnly: boolean; onSelectRelation: (relationId: string) => void }) {
  const id = useId()
  const nameOf = (classId: string) => design.classes.find((candidate) => candidate.id === classId)?.name || t('umlUnnamedClass')
  const [source, target] = [nameOf(relation.source), nameOf(relation.target)]
  const reverseTaken = design.relations.some((other) => other.source === relation.target && other.target === relation.source)
  const multiplicity = (end: 'sourceMultiplicity' | 'targetMultiplicity', name: string) => (
    <>
      <label className={labelClass} htmlFor={`${id}-${end}`}>
        {t('umlMultiplicityAt', { name })}
      </label>
      <select
        id={`${id}-${end}`}
        className={inputClass}
        value={relation[end] ?? ''}
        onChange={(event) => onCommit(updateRelation(design, relation.id, { [end]: (event.target.value || undefined) as Multiplicity | undefined }))}
      >
        <option value="">{t('umlMultiplicityNone')}</option>
        {MULTIPLICITIES.map((value) => (
          <option key={value} value={value}>
            {t(MULTIPLICITY_LABELS[value])}
          </option>
        ))}
      </select>
    </>
  )
  return (
    <>
      <p className="mt-1 font-mono text-xs text-zinc-300" lang="en">
        {source} → {target}
      </p>
      <label className={labelClass} htmlFor={`${id}-kind`}>
        {t('umlRelationKind')}
      </label>
      <select
        id={`${id}-kind`}
        className={inputClass}
        value={relation.kind}
        onChange={(event) => onCommit(updateRelation(design, relation.id, { kind: event.target.value as RelationKind }))}
      >
        {RELATION_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(RELATION_KIND_LABELS[kind])}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-zinc-400">{t(RELATION_KIND_HINTS[relation.kind], { source, target })}</p>
      {multiplicity('sourceMultiplicity', source)}
      {multiplicity('targetMultiplicity', target)}
      {!readOnly && (
        <>
          <button
            type="button"
            className="mt-3 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-40"
            disabled={reverseTaken}
            onClick={() => {
              onCommit(reverseRelation(design, relation.id))
              // Reversed, the relation goes by the id of its new direction.
              onSelectRelation(edgeId(relation.target, relation.source))
            }}
          >
            {t('umlReverse')}
          </button>
          {reverseTaken && <p className="mt-1 text-xs text-zinc-500">{t('umlReverseTaken')}</p>}
        </>
      )}
    </>
  )
}
