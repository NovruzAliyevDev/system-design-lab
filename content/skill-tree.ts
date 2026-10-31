// The authored Skill Tree: the primer's topics, each a set of its Lessons, with prerequisite edges
// to the topics best mastered first. The Content Pipeline validates it when it builds the catalog: an
// unknown Lesson or topic id, a Lesson in two topics, or a cycle of prerequisites fails the build.
//
// Topics follow the primer's own sections. The prerequisites follow its study order (scalability
// first, then the trade-offs, then each component from DNS inward) and what each topic builds on.
// Titles are Azerbaijani; technical terms stay English. Only the introduction and the meta sections
// (Anki, contributing, study guide, credits…) are outside every topic.
import type { SkillTopicInput } from '../src/core/skill-tree/skill-tree'

export const skillTree: SkillTopicInput[] = [
  {
    id: 'scalability-basics',
    title: 'Scalability-nin əsasları',
    lessonIds: ['system-design-topics-start-here', 'step-1-review-the-scalability-video-lecture', 'step-2-review-the-scalability-article', 'next-steps'],
    prerequisiteIds: [],
  },
  {
    id: 'performance-vs-scalability',
    title: 'Performance və scalability',
    lessonIds: ['performance-vs-scalability'],
    prerequisiteIds: ['scalability-basics'],
  },
  {
    id: 'latency-vs-throughput',
    title: 'Latency və throughput',
    lessonIds: ['latency-vs-throughput'],
    prerequisiteIds: ['scalability-basics'],
  },
  {
    id: 'estimation',
    title: 'Təxmini hesablamalar',
    lessonIds: ['back-of-the-envelope-calculations', 'appendix', 'powers-of-two-table', 'latency-numbers-every-programmer-should-know'],
    prerequisiteIds: ['latency-vs-throughput'],
  },
  {
    id: 'cap-theorem',
    title: 'CAP teoremi',
    lessonIds: ['cap-theorem'],
    prerequisiteIds: ['performance-vs-scalability', 'latency-vs-throughput'],
  },
  {
    id: 'consistency-patterns',
    title: 'Consistency pattern-ləri',
    lessonIds: ['consistency-patterns', 'weak-consistency', 'eventual-consistency', 'strong-consistency'],
    prerequisiteIds: ['cap-theorem'],
  },
  {
    id: 'availability-patterns',
    title: 'Availability pattern-ləri',
    lessonIds: ['availability-patterns', 'fail-over', 'disadvantages-failover', 'replication', 'availability-in-numbers'],
    prerequisiteIds: ['cap-theorem'],
  },
  {
    id: 'domain-name-system',
    title: 'DNS',
    lessonIds: ['domain-name-system', 'disadvantages-dns'],
    prerequisiteIds: ['latency-vs-throughput'],
  },
  {
    id: 'content-delivery-network',
    title: 'CDN',
    lessonIds: ['content-delivery-network', 'push-cdns', 'pull-cdns', 'disadvantages-cdn'],
    prerequisiteIds: ['domain-name-system'],
  },
  {
    id: 'load-balancer',
    title: 'Load balancer',
    lessonIds: ['load-balancer', 'layer-4-load-balancing', 'layer-7-load-balancing', 'horizontal-scaling', 'disadvantages-load-balancer'],
    prerequisiteIds: ['availability-patterns', 'domain-name-system'],
  },
  {
    id: 'reverse-proxy',
    title: 'Reverse proxy (web server)',
    lessonIds: ['reverse-proxy-web-server', 'load-balancer-vs-reverse-proxy', 'disadvantages-reverse-proxy'],
    prerequisiteIds: ['load-balancer'],
  },
  {
    id: 'application-layer',
    title: 'Application layer',
    lessonIds: ['application-layer', 'microservices', 'service-discovery', 'disadvantages-application-layer'],
    prerequisiteIds: ['reverse-proxy'],
  },
  {
    id: 'database',
    title: 'Database',
    lessonIds: ['database', 'relational-database-management-system-rdbms', 'nosql', 'sql-or-nosql'],
    prerequisiteIds: ['consistency-patterns', 'availability-patterns'],
  },
  {
    id: 'cache',
    title: 'Cache',
    lessonIds: [
      'cache',
      'client-caching',
      'cdn-caching',
      'web-server-caching',
      'database-caching',
      'application-caching',
      'caching-at-the-database-query-level',
      'caching-at-the-object-level',
      'when-to-update-the-cache',
      'disadvantages-cache',
    ],
    prerequisiteIds: ['database', 'content-delivery-network'],
  },
  {
    id: 'asynchronism',
    title: 'Asynchronism',
    lessonIds: ['asynchronism', 'message-queues', 'task-queues', 'back-pressure', 'disadvantages-asynchronism'],
    prerequisiteIds: ['application-layer'],
  },
  {
    id: 'communication',
    title: 'Communication',
    lessonIds: [
      'communication',
      'hypertext-transfer-protocol-http',
      'transmission-control-protocol-tcp',
      'user-datagram-protocol-udp',
      'remote-procedure-call-rpc',
      'representational-state-transfer-rest',
      'rpc-and-rest-calls-comparison',
    ],
    prerequisiteIds: ['application-layer'],
  },
  {
    id: 'security',
    title: 'Security',
    lessonIds: ['security'],
    prerequisiteIds: ['communication'],
  },
  {
    id: 'interview-approach',
    title: 'System design müsahibəsinə yanaşma',
    lessonIds: [
      'how-to-approach-a-system-design-interview-question',
      'step-1-outline-use-cases-constraints-and-assumptions',
      'step-2-create-a-high-level-design',
      'step-3-design-core-components',
      'step-4-scale-the-design',
    ],
    prerequisiteIds: ['estimation', 'load-balancer', 'database'],
  },
  {
    id: 'design-questions',
    title: 'System design sualları',
    lessonIds: [
      'system-design-interview-questions-with-solutions',
      'design-pastebincom-or-bitly',
      'design-the-twitter-timeline-and-search-or-facebook-feed-and-search',
      'design-a-web-crawler',
      'design-mintcom',
      'design-the-data-structures-for-a-social-network',
      'design-a-key-value-store-for-a-search-engine',
      'design-amazons-sales-ranking-by-category-feature',
      'design-a-system-that-scales-to-millions-of-users-on-aws',
      'additional-system-design-interview-questions',
    ],
    prerequisiteIds: ['interview-approach', 'cache', 'asynchronism', 'security'],
  },
  {
    id: 'object-oriented-design',
    title: 'Object-oriented design sualları',
    lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
    prerequisiteIds: ['interview-approach'],
  },
  {
    id: 'real-world-architectures',
    title: 'Real dünya arxitekturaları',
    lessonIds: ['real-world-architectures', 'company-architectures', 'company-engineering-blogs'],
    prerequisiteIds: ['design-questions'],
  },
]
