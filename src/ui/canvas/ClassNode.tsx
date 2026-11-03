import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { DesignClass } from '../../core/design/design'
import { t } from '../i18n'
import { CLASS_KIND_KEYWORDS } from './umlText'

export type ClassFlowNode = Node<{ umlClass: DesignClass }, 'class'>

/** The width the UML Class Builder draws a class box at; its height follows its members. */
export const CLASS_WIDTH = 220

/**
 * A class as UML draws it: a keyword for an abstract class, interface or enumeration, the name (in
 * italics when abstract), then the fields (an enumeration's values) and the methods, each in a
 * compartment of their own.
 */
export function ClassNode({ data: { umlClass }, selected, isConnectable }: NodeProps<ClassFlowNode>) {
  const { name, kind, fields, methods } = umlClass
  return (
    <div
      className={`rounded-md border bg-surface-raised text-left shadow ${selected ? 'border-accent ring-1 ring-accent' : 'border-border'}`}
      style={{ width: CLASS_WIDTH }}
      data-testid={`class-${umlClass.id}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="!h-3 !w-3 !border-surface !bg-text-muted" />
      <div className="border-b border-border px-3 py-1.5 text-center">
        {kind !== 'class' && <div className="text-[11px] text-text-muted">«{CLASS_KIND_KEYWORDS[kind]}»</div>}
        <div className={`truncate text-sm font-semibold text-text ${kind === 'abstract' ? 'italic' : ''}`}>{name || t('umlUnnamedClass')}</div>
      </div>
      <Compartment members={fields} empty={t('umlNoFields')} />
      <Compartment members={methods} empty={t('umlNoMethods')} last />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="!h-3 !w-3 !border-surface !bg-accent" />
    </div>
  )
}

function Compartment({ members, empty, last = false }: { members: string[]; empty: string; last?: boolean }) {
  return (
    <ul className={`px-3 py-1 font-mono text-xs ${last ? '' : 'border-b border-border'}`} lang="en">
      {members.length === 0 ? (
        <li className="text-text-muted" lang="az">
          {empty}
        </li>
      ) : (
        members.map((member, i) => (
          <li key={i} className="truncate text-text">
            {member}
          </li>
        ))
      )}
    </ul>
  )
}
