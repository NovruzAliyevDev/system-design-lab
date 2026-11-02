import type { ClassKind, Multiplicity, RelationKind } from '../../core/design/design'
import type { StringKey } from '../i18n'

// How the UML Class Builder names class kinds, relation kinds and multiplicities.

export const CLASS_KIND_LABELS: Record<ClassKind, StringKey> = {
  class: 'umlKindClass',
  abstract: 'umlKindAbstract',
  interface: 'umlKindInterface',
  enum: 'umlKindEnum',
}

/** The keyword UML writes above the name of a class of each kind but a plain one. */
export const CLASS_KIND_KEYWORDS: Record<Exclude<ClassKind, 'class'>, string> = {
  abstract: 'abstract',
  interface: 'interface',
  enum: 'enumeration',
}

export const RELATION_KIND_LABELS: Record<RelationKind, StringKey> = {
  inheritance: 'umlRelationInheritance',
  implementation: 'umlRelationImplementation',
  composition: 'umlRelationComposition',
  aggregation: 'umlRelationAggregation',
  association: 'umlRelationAssociation',
}

/** What a relation of each kind says about its classes, `{source}` and `{target}`. */
export const RELATION_KIND_HINTS: Record<RelationKind, StringKey> = {
  inheritance: 'umlRelationInheritanceHint',
  implementation: 'umlRelationImplementationHint',
  composition: 'umlRelationCompositionHint',
  aggregation: 'umlRelationAggregationHint',
  association: 'umlRelationAssociationHint',
}

export const MULTIPLICITY_LABELS: Record<Multiplicity, StringKey> = {
  '1': 'umlMultiplicityOne',
  '0..1': 'umlMultiplicityOptional',
  '*': 'umlMultiplicityMany',
  '1..*': 'umlMultiplicityAtLeastOne',
}
