// Building blocks the authored Challenges share: node selectors for what the primer's diagrams have in
// common, predicates built from them, and the helpers that lay out Reference Solutions.
import type { NodeSelector, Predicate, Rule, TrafficKind } from '../../src/core/challenges/rules'
import { MAX_REPLICAS, type ComponentType, type ConfigValue } from '../../src/core/design/components'
import type { EdgeMode, EdgeTraffic } from '../../src/core/design/design'

/** Whatever sits in front of the application servers and forwards requests to them. */
export const ENTRY: NodeSelector = ['web-server', 'reverse-proxy', 'load-balancer']

/** Either kind of queue: a message queue or a task queue. */
export const QUEUES: NodeSelector = ['message-queue', 'task-queue']

/** Any number of read replicas a primary can have. */
export const SOME_REPLICAS = Array.from({ length: MAX_REPLICAS }, (_, i) => i + 1)

/** Some node matches one of the selectors. */
export const anyNode = (selectors: NodeSelector[]): Predicate => ({ type: 'any-of', predicates: selectors.map((selector) => ({ type: 'node', node: selector })) })

/** Client requests carrying `traffic` reach a node of one of the selectors, every path through an application service. */
export const apiPath = (selectors: NodeSelector[], traffic: TrafficKind): Predicate => ({
  type: 'any-of',
  predicates: selectors.map((selector) => ({ type: 'path', from: 'client', to: selector, through: 'app-service', traffic })),
})

/** Client requests reach the application services only through a web server, reverse proxy or load balancer. */
export const entryPath: Predicate = { type: 'path', from: 'client', to: 'app-service', through: ENTRY }

/** Client requests reach the application servers through a load balancer. */
export const loadBalancerPath: Predicate = { type: 'path', from: 'client', to: 'app-service', through: 'load-balancer' }

/** No web server or application service runs on a single instance. */
export const scaledOut: Predicate = {
  type: 'all-of',
  predicates: [
    { type: 'node', node: { component: 'app-service', config: { instances: 1 } }, max: 0 },
    { type: 'node', node: { component: ['web-server', 'reverse-proxy'], config: { instances: 1 } }, max: 0 },
  ],
}

/** An application service puts jobs on a queue, which a service (a worker) pulls from. */
export const queuedJobs: Predicate = {
  type: 'all-of',
  predicates: [
    { type: 'path', from: 'client', to: QUEUES, through: 'app-service', traffic: 'write' },
    { type: 'edge', from: QUEUES, to: 'app-service', traffic: 'write' },
  ],
}

/** Client requests carrying writes and those carrying reads both reach a node of one of the selectors through an application service. */
export const readAndWritePaths = (selectors: NodeSelector[]): Predicate => ({ type: 'all-of', predicates: [apiPath(selectors, 'write'), apiPath(selectors, 'read')] })

/** Some SQL or NoSQL database is split into shards: a shard key set, over more than one instance. */
export const shardedDatabase: Predicate = { type: 'custom', name: 'sharded-database' }

/** Writes are not all taken by one SQL master: a database is sharded, or SQL is federated over several primaries. */
export const writesSpread: Predicate = {
  type: 'any-of',
  predicates: [shardedDatabase, { type: 'node', node: { component: 'sql-database', config: { role: 'primary' } }, min: 2 }],
}

/**
 * Client reads reach a store of the type (`sql-database` or a key-value `nosql-store`) that serves them from
 * replicas: a replica node, or a primary configured with replicas.
 */
export function readReplicas(componentType: 'sql-database' | 'nosql-store'): Predicate[] {
  const kind: Record<string, string> = componentType === 'nosql-store' ? { kind: 'key-value' } : {}
  return [
    { type: 'path', from: 'client', to: { component: componentType, config: { ...kind, role: 'replica' } }, traffic: 'read' },
    { type: 'node', node: { component: componentType, config: { ...kind, role: 'primary', replicas: SOME_REPLICAS } } },
  ]
}

/** A Rule every design Stage ends with: nothing on the canvas stands apart. `example` names an edge that gives a component its role. */
export function allConnectedRule(example: string): Rule {
  return {
    id: 'all-connected',
    weight: 1,
    description: 'Dizaynda kənarda qalan, heç nəyə bağlı olmayan komponent yoxdur.',
    hints: [
      'Kətandakı hər komponent nə üçündür? Onlardan hansısa heç bir məlumat axınında iştirak etmirmi?',
      'Hər komponenti ən azı bir xətlə dizaynın qalanına bağlayın və ya artıq olanı silin.',
      `Bağlantısı olmayan komponent sistemdə heç bir iş görmür: ona sorğu gəlmir və o, heç nəyi oxumur. Ya onun rolunu xətlərlə göstərin (məsələn, ${example}), ya da onu silin.`,
    ],
    check: { type: 'custom', name: 'all-connected' },
  }
}

/** A Rule for the Scaling Stage: the Client resolves the domain with DNS. */
export function dnsRule(domain: string): Rule {
  return {
    id: 'dns',
    weight: 1,
    description: 'Client domen adını DNS ilə həll edir.',
    hints: [
      `Client ${domain} ünvanını hansı IP-yə göndərəcəyini haradan bilir?`,
      'DNS komponenti əlavə edin və Client-dən ona xətt çəkin.',
      'Primer-in miqyaslanmış diaqramı DNS ilə başlayır: Client əvvəlcə domeni DNS-də həll edir. DNS sorğuları coğrafiyaya və ya gecikməyə görə yönləndirə də bilər.',
    ],
    check: { type: 'edge', from: 'client', to: 'dns' },
  }
}

/** A Rule for the Scaling Stage: requests reach the application servers through a load balancer. */
export const loadBalancerRule: Rule = {
  id: 'load-balancer',
  weight: 2,
  description: 'Client sorğuları tətbiq serverlərinə load balancer vasitəsilə çatır.',
  hints: [
    'Bir web server yükü daşıya bilməsə, sorğuları bir neçə serverə kim paylayacaq?',
    'Client ilə web server arasına load balancer qoyun ki, tətbiq serverlərinə gedən hər yol ondan keçsin.',
    'Primer-in miqyaslanmış diaqramında Client sorğuları Load Balancer-ə göndərir, o da onları bir neçə Web Server arasında paylayır. Bu, həm yükü bölür, həm də bir serverin sıradan çıxması servisi dayandırmır.',
  ],
  check: loadBalancerPath,
}

/** A Rule for the Scaling Stage: every web server and application service runs on several instances. */
export const scaleOutRule: Rule = {
  id: 'scale-out',
  weight: 2,
  description: 'Web server və tətbiq servisləri üfüqi miqyaslanıb: hər biri bir neçə nüsxədə işləyir.',
  hints: [
    'Load balancer arxasında yalnız bir server nüsxəsi olsa, nə qazanırsınız?',
    'Web server-in və hər application service-in tənzimləməsində "instances" sahəsini 2 və ya daha çox edin.',
    'Primer horizontal scaling-i seçir: eyni serverin bir neçə nüsxəsi load balancer arxasında işləyir. Hər servis öz yükünə görə ayrıca miqyaslanır: yükü artan servisin nüsxələri artırılır, digərləri olduğu kimi qalır.',
  ],
  check: scaledOut,
}

export const node = (id: string, componentType: ComponentType, label: string, x: number, y: number, config: Record<string, ConfigValue> = {}) => ({
  id,
  componentType,
  label,
  notes: '',
  config,
  position: { x, y },
})

export const edge = (source: string, target: string, traffic: EdgeTraffic, mode: EdgeMode = 'sync') => ({
  id: `${source}->${target}`,
  source,
  target,
  mode,
  traffic,
})
