import type { ComponentType, ConfigFieldKey, ConfigOption } from '../../core/design/components'
import type { EdgeMode, EdgeTraffic } from '../../core/design/design'
import { t, type StringKey } from '../i18n'

const COMPONENT_NAMES: Record<ComponentType, StringKey> = {
  client: 'componentClient',
  dns: 'componentDns',
  cdn: 'componentCdn',
  'load-balancer': 'componentLoadBalancer',
  'reverse-proxy': 'componentReverseProxy',
  'web-server': 'componentWebServer',
  'app-service': 'componentAppService',
  cache: 'componentCache',
  'sql-database': 'componentSqlDatabase',
  'nosql-store': 'componentNosqlStore',
  'object-store': 'componentObjectStore',
  'message-queue': 'componentMessageQueue',
  'task-queue': 'componentTaskQueue',
  'search-index': 'componentSearchIndex',
  analytics: 'componentAnalytics',
  'data-warehouse': 'componentDataWarehouse',
}

export const componentName = (componentType: ComponentType) => t(COMPONENT_NAMES[componentType])

/** The short tag a Node shows beside its label, e.g. "LB". */
export const COMPONENT_TAGS: Record<ComponentType, string> = {
  client: 'USR',
  dns: 'DNS',
  cdn: 'CDN',
  'load-balancer': 'LB',
  'reverse-proxy': 'GW',
  'web-server': 'WEB',
  'app-service': 'APP',
  cache: 'MEM',
  'sql-database': 'SQL',
  'nosql-store': 'NoSQL',
  'object-store': 'OBJ',
  'message-queue': 'MQ',
  'task-queue': 'WRK',
  'search-index': 'IDX',
  analytics: 'MR',
  'data-warehouse': 'DWH',
}

const FIELD_LABELS: Record<ConfigFieldKey, StringKey> = {
  routing: 'fieldRouting',
  kind: 'fieldKind',
  layer: 'fieldLayer',
  algorithm: 'fieldAlgorithm',
  strategy: 'fieldStrategy',
  eviction: 'fieldEviction',
  role: 'fieldRole',
  replicas: 'fieldReplicas',
  shardKey: 'fieldShardKey',
  instances: 'fieldInstances',
}

/** A config field's label; fields are listed by their schema, so every key has one. */
export const fieldLabel = (key: string) => t(FIELD_LABELS[key as ConfigFieldKey])

const OPTION_LABELS: Record<ConfigOption, StringKey> = {
  simple: 'optionSimple',
  'weighted-round-robin': 'optionWeightedRoundRobin',
  'latency-based': 'optionLatencyBased',
  geolocation: 'optionGeolocation',
  pull: 'optionPull',
  push: 'optionPush',
  l4: 'optionL4',
  l7: 'optionL7',
  'round-robin': 'optionRoundRobin',
  'least-connections': 'optionLeastConnections',
  hashing: 'optionHashing',
  'cache-aside': 'optionCacheAside',
  'write-through': 'optionWriteThrough',
  'write-behind': 'optionWriteBehind',
  'refresh-ahead': 'optionRefreshAhead',
  lru: 'optionLru',
  lfu: 'optionLfu',
  fifo: 'optionFifo',
  primary: 'optionPrimary',
  replica: 'optionReplica',
  'key-value': 'optionKeyValue',
  document: 'optionDocument',
  'wide-column': 'optionWideColumn',
  graph: 'optionGraph',
}

/** A choice field's option label; options are listed by their schema, so every value has one. */
export const optionLabel = (value: string) => t(OPTION_LABELS[value as ConfigOption])

export const EDGE_MODE_LABELS: Record<EdgeMode, StringKey> = { sync: 'edgeModeSync', async: 'edgeModeAsync' }

export const TRAFFIC_LABELS: Record<EdgeTraffic, StringKey> = { read: 'trafficRead', write: 'trafficWrite', both: 'trafficBoth' }
