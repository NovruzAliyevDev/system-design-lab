// The Component Palette: every component type a Design can use, with its config schema and the
// per-instance defaults the Traffic Simulation starts from.

interface FieldBase {
  /** The field only applies while other fields have these values; otherwise it keeps its default. */
  onlyWhen?: Record<string, string>
}

/** One of a fixed set of values, e.g. a load balancer's algorithm. */
export interface ChoiceField<O extends string = string> extends FieldBase {
  kind: 'choice'
  options: readonly O[]
  default: O
}

/** A whole number from `min` to `max`, e.g. an instance count. */
export interface IntegerField extends FieldBase {
  kind: 'integer'
  min: number
  max: number
  default: number
}

/** Free text up to `maxLength` characters, e.g. a shard key; empty means not set. */
export interface TextField extends FieldBase {
  kind: 'text'
  maxLength: number
  default: string
}

export type ConfigField = ChoiceField | IntegerField | TextField

export type ConfigValue = string | number

/** A config read without knowing its component type, e.g. by a schema-driven panel. */
export type AnyConfig = Record<string, ConfigValue>

/**
 * The operations of the primer's "Latency numbers every programmer should know" that component
 * latencies are built from, with the primer's values. A content test checks them against the table.
 */
export const PRIMER_LATENCY_NS = {
  'Main memory reference': 100,
  'Send 1 KB bytes over 1 Gbps network': 10_000,
  'Read 4 KB randomly from SSD*': 150_000,
  'Read 1 MB sequentially from memory': 250_000,
  'Round trip within same datacenter': 500_000,
  'Read 1 MB sequentially from SSD*': 1_000_000,
  'HDD seek': 10_000_000,
  'Read 1 MB sequentially from HDD': 30_000_000,
} as const

export type PrimerOperation = keyof typeof PRIMER_LATENCY_NS

/** A part of a base latency: one of the primer's latency numbers, taken `times` times. */
export interface LatencyTerm {
  operation: PrimerOperation
  nanoseconds: number
  times: number
}

/** What one instance of a component handles, how long it takes and what it costs. Approximations, for learning. */
export interface SimulationDefaults {
  /** Requests per second one instance serves before it is overloaded. */
  capacityQps: number
  /** The latency of one request at low load: the sum of `latency`. */
  baseLatencyMs: number
  /** How `baseLatencyMs` is made up from the primer's latency numbers, so that it stays explainable. */
  latency: LatencyTerm[]
  monthlyCostUsd: number
}

export interface ComponentDefinition {
  /** Fields in the order the config panel shows them. */
  config: Record<string, ConfigField>
  /** Absent for the client, which sends traffic rather than serving it. */
  simulation?: SimulationDefaults
}

const choice = <const O extends string>(options: readonly O[], defaultValue: NoInfer<O>): ChoiceField<O> => ({
  kind: 'choice',
  options,
  default: defaultValue,
})

export const MAX_INSTANCES = 1000

const instances: IntegerField = { kind: 'integer', min: 1, max: MAX_INSTANCES, default: 1 }

/** How a stored copy relates to the others: written to (primary) or a read-only copy (replica). */
const role = choice(['primary', 'replica'], 'primary')
/** Read replicas of a primary's data; a replica has none of its own. */
const replicas: IntegerField = { kind: 'integer', min: 0, max: 15, default: 0, onlyWhen: { role: 'primary' } }
const shardKey: TextField = { kind: 'text', maxLength: 60, default: '' }

function simulation(capacityQps: number, terms: [PrimerOperation, number][], monthlyCostUsd: number): SimulationDefaults {
  const latency = terms.map(([operation, times]) => ({ operation, nanoseconds: PRIMER_LATENCY_NS[operation], times }))
  const nanoseconds = latency.reduce((sum, term) => sum + term.nanoseconds * term.times, 0)
  // Rounded to the microsecond, so sums of decimal fractions read cleanly.
  return { capacityQps, baseLatencyMs: Math.round(nanoseconds / 1000) / 1000, latency, monthlyCostUsd }
}

const ROUND_TRIP = 'Round trip within same datacenter'

const COMPONENTS = {
  client: { config: {} },
  dns: {
    config: { routing: choice(['simple', 'weighted-round-robin', 'latency-based', 'geolocation'], 'simple'), instances },
    // Answers are cached close to the client, so a lookup costs about one nearby round trip.
    simulation: simulation(100_000, [[ROUND_TRIP, 1]], 1),
  },
  cdn: {
    config: { kind: choice(['pull', 'push'], 'pull'), instances },
    simulation: simulation(50_000, [[ROUND_TRIP, 1], ['Read 1 MB sequentially from SSD*', 1]], 50),
  },
  'load-balancer': {
    config: {
      layer: choice(['l4', 'l7'], 'l7'),
      algorithm: choice(['round-robin', 'least-connections', 'hashing'], 'round-robin'),
      instances,
    },
    simulation: simulation(20_000, [[ROUND_TRIP, 1]], 25),
  },
  'reverse-proxy': {
    config: { instances },
    simulation: simulation(10_000, [[ROUND_TRIP, 1], ['Send 1 KB bytes over 1 Gbps network', 1]], 70),
  },
  'web-server': {
    config: { instances },
    simulation: simulation(1_000, [[ROUND_TRIP, 1], ['Send 1 KB bytes over 1 Gbps network', 2]], 70),
  },
  'app-service': {
    config: { instances },
    simulation: simulation(500, [[ROUND_TRIP, 1], ['Read 1 MB sequentially from memory', 4]], 140),
  },
  cache: {
    config: {
      strategy: choice(['cache-aside', 'write-through', 'write-behind', 'refresh-ahead'], 'cache-aside'),
      eviction: choice(['lru', 'lfu', 'fifo'], 'lru'),
      instances,
    },
    simulation: simulation(50_000, [[ROUND_TRIP, 1], ['Main memory reference', 10]], 100),
  },
  'sql-database': {
    config: { role, replicas, shardKey, instances },
    simulation: simulation(1_000, [[ROUND_TRIP, 1], ['Read 4 KB randomly from SSD*', 4]], 250),
  },
  'nosql-store': {
    config: { kind: choice(['key-value', 'document', 'wide-column', 'graph'], 'key-value'), role, replicas, shardKey, instances },
    simulation: simulation(5_000, [[ROUND_TRIP, 1], ['Read 4 KB randomly from SSD*', 2]], 200),
  },
  'object-store': {
    config: { instances },
    simulation: simulation(2_000, [[ROUND_TRIP, 1], ['HDD seek', 1], ['Read 1 MB sequentially from HDD', 1]], 25),
  },
  'message-queue': {
    config: { instances },
    simulation: simulation(10_000, [[ROUND_TRIP, 1], ['Read 4 KB randomly from SSD*', 1]], 40),
  },
  'task-queue': {
    config: { instances },
    simulation: simulation(200, [[ROUND_TRIP, 1], ['Read 1 MB sequentially from memory', 4]], 70),
  },
  'search-index': {
    config: { shardKey, instances },
    simulation: simulation(1_000, [[ROUND_TRIP, 1], ['Read 4 KB randomly from SSD*', 4], ['Read 1 MB sequentially from memory', 1]], 200),
  },
  analytics: {
    config: { instances },
    simulation: simulation(50, [[ROUND_TRIP, 1], ['Read 1 MB sequentially from SSD*', 100]], 500),
  },
  'data-warehouse': {
    config: { instances },
    simulation: simulation(100, [[ROUND_TRIP, 1], ['Read 1 MB sequentially from SSD*', 50]], 1000),
  },
} satisfies Record<string, ComponentDefinition>

export type ComponentType = keyof typeof COMPONENTS

type FieldValue<F> = F extends ChoiceField<infer O> ? O : F extends IntegerField ? number : string

/** The config of one component type, e.g. `{ layer: 'l4' | 'l7'; algorithm: …; instances: number }`. */
export type ComponentConfig<T extends ComponentType = ComponentType> = {
  -readonly [K in keyof (typeof COMPONENTS)[T]['config']]: FieldValue<(typeof COMPONENTS)[T]['config'][K]>
}

type Configs = (typeof COMPONENTS)[ComponentType]['config']
type KeysOf<C> = C extends unknown ? keyof C : never
type OptionsOf<C> = C extends unknown ? { [K in keyof C]: C[K] extends ChoiceField<infer O> ? O : never }[keyof C] : never

/** The key of any component type's config field, e.g. `'replicas'`. */
export type ConfigFieldKey = KeysOf<Configs>

/** Any option of any choice field, e.g. `'least-connections'`. */
export type ConfigOption = OptionsOf<Configs>

/** Every component type, in the order the palette lists them. */
export const PALETTE = Object.keys(COMPONENTS) as ComponentType[]

export function isComponentType(value: unknown): value is ComponentType {
  return typeof value === 'string' && Object.hasOwn(COMPONENTS, value)
}

export function componentDefinition(componentType: ComponentType): ComponentDefinition {
  return COMPONENTS[componentType]
}

export function defaultConfig<T extends ComponentType>(componentType: T): ComponentConfig<T> {
  const fields = Object.entries(componentDefinition(componentType).config)
  return Object.fromEntries(fields.map(([key, field]) => [key, field.default])) as ComponentConfig<T>
}

/** Why a value does not fit a config field. */
export type ConfigProblem =
  | 'unknown-field'
  | 'not-an-option'
  | 'not-an-integer'
  | 'out-of-range'
  | 'not-text'
  | 'too-long'
  | 'not-applicable'

/** Whether a field applies to a config, given the values of the fields it depends on. */
export function isFieldApplicable(field: ConfigField, config: Record<string, unknown>): boolean {
  return Object.entries(field.onlyWhen ?? {}).every(([key, value]) => config[key] === value)
}

/**
 * Why `value` cannot be the `key` field of a component type's config, or undefined when it can.
 * Given the rest of the config, a field that does not apply to it must keep its default.
 */
export function configProblem(
  componentType: ComponentType,
  key: string,
  value: unknown,
  config?: Record<string, unknown>,
): ConfigProblem | undefined {
  const fields = componentDefinition(componentType).config
  if (!Object.hasOwn(fields, key)) return 'unknown-field'
  const field = fields[key]
  if (config && !isFieldApplicable(field, config) && value !== field.default) return 'not-applicable'
  switch (field.kind) {
    case 'choice':
      return field.options.includes(value as string) ? undefined : 'not-an-option'
    case 'integer':
      if (!Number.isInteger(value)) return 'not-an-integer'
      return (value as number) < field.min || (value as number) > field.max ? 'out-of-range' : undefined
    case 'text':
      if (typeof value !== 'string') return 'not-text'
      return value.length > field.maxLength ? 'too-long' : undefined
  }
}
