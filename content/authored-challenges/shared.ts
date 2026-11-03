// Building blocks the authored Challenges share beyond those of the primer Challenges: the same Rules,
// with Hints that explain them without pointing at a primer diagram these questions do not have, and the
// selectors and predicates several of them use.
import type { NodeSelector, Predicate, Rule } from '../../src/core/challenges/rules'
import type { ComponentType } from '../../src/core/design/components'
import { loadBalancerRule as primerLoadBalancerRule, QUEUES, scaleOutRule as primerScaleOutRule } from '../primer-challenges/shared'

/** The primer Challenges' Rule for the Scaling Stage: requests reach the application servers through a load balancer. */
export const loadBalancerRule: Rule = {
  ...primerLoadBalancerRule,
  hints: [
    'Bir server yükü daşıya bilməsə, sorğuları bir neçə serverə kim paylayacaq?',
    'Client ilə tətbiq serverləri arasına load balancer qoyun ki, onlara gedən hər yol ondan keçsin.',
    'Load balancer sorğuları eyni serverin bir neçə nüsxəsi arasında bölür və sıradan çıxan nüsxəni dövrədən çıxarır: həm yük bölünür, həm də bir serverin çökməsi servisi dayandırmır. Load balancer-in özü də tək nöqtə olmasın deyə bir neçə nüsxədə işləyir.',
  ],
}

/** The primer Challenges' Rule for the Scaling Stage: every web server and application service runs on several instances. */
export const scaleOutRule: Rule = {
  ...primerScaleOutRule,
  hints: [
    'Load balancer arxasında yalnız bir server nüsxəsi olsa, nə qazanırsınız?',
    'Web server-in və hər application service-in tənzimləməsində "instances" sahəsini 2 və ya daha çox edin.',
    'Horizontal scaling-də eyni serverin bir neçə nüsxəsi load balancer arxasında işləyir: stateless servislər belə asan miqyaslanır, bir nüsxənin çökməsi isə servisi dayandırmır. Hər servis öz yükünə görə ayrıca miqyaslanır: yükü artan servisin nüsxələri artırılır, digərləri olduğu kimi qalır.',
  ],
}

/** Some node of the component type exists, and none runs on a single instance. */
export const scaledOutNodes = (component: ComponentType): Predicate => ({
  type: 'all-of',
  predicates: [
    { type: 'node', node: component },
    { type: 'node', node: { component, config: { instances: 1 } }, max: 0 },
  ],
})

/** Client writes reach a node of one of the selectors, every path through a queue: nothing on the way waits for it. */
export const queuedWrites = (selectors: NodeSelector[]): Predicate => ({
  type: 'any-of',
  predicates: selectors.map((selector) => ({ type: 'path', from: 'client', to: selector, through: QUEUES, traffic: 'write' })),
})

/** The provider of mobile push notifications: APNs and FCM. */
export const MOBILE_PUSH: NodeSelector = { component: 'push-service', config: { channel: 'mobile-push' } }
