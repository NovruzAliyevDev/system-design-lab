import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { DesignClass } from '../../core/design/design'
import { t } from '../i18n'

export type ClassFlowNode = Node<{ umlClass: DesignClass }, 'class'>

/** The width the UML Class Builder draws a class box at; its height follows its members. */
export const CLASS_WIDTH = 220

/**
 * A class as UML draws it: a keyword for an abstract class or interface, the name (in italics when
 * abstract), then the fields and the methods, each in a compartment of their own.
 */
export function ClassNode({ data: { umlClass }, selected, isConnectable }: NodeProps<ClassFlowNode>) {
  const { name, kind, fields, methods } = umlClass
  return (
    <div
      className={`rounded-md border bg-zinc-900 text-left shadow ${selected ? 'border-sky-400 ring-1 ring-sky-400' : 'border-zinc-600'}`}
      style={{ width: CLASS_WIDTH }}
      data-testid={`class-${umlClass.id}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="!h-3 !w-3 !border-zinc-950 !bg-zinc-400" />
      <div className="border-b border-zinc-600 px-3 py-1.5 text-center">
        {kind !== 'class' && <div className="text-[11px] text-zinc-400">«{kind}»</div>}
        <div className={`truncate text-sm font-semibold text-zinc-50 ${kind === 'abstract' ? 'italic' : ''}`}>{name || t('umlUnnamedClass')}</div>
      </div>
      <Compartment members={fields} empty={t('umlNoFields')} />
      <Compartment members={methods} empty={t('umlNoMethods')} last />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="!h-3 !w-3 !border-zinc-950 !bg-sky-400" />
    </div>
  )
}

function Compartment({ members, empty, last = false }: { members: string[]; empty: string; last?: boolean }) {
  return (
    <ul className={`px-3 py-1 font-mono text-xs ${last ? '' : 'border-b border-zinc-600'}`} lang="en">
      {members.length === 0 ? (
        <li className="text-zinc-600" lang="az">
          {empty}
        </li>
      ) : (
        members.map((member, i) => (
          <li key={i} className="truncate text-zinc-200">
            {member}
          </li>
        ))
      )}
    </ul>
  )
}
