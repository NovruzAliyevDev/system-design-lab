import { describe, expect, it } from 'vitest'
import { simulateLoadBalancer, type LoadBalancerInput } from './load-balancer'

const base: LoadBalancerInput = {
  algorithm: 'round-robin',
  serverSpeeds: [1, 3, 5],
  arrivalRate: 6,
  clientCount: 20,
  ticks: 60,
  seed: 7,
}

describe('load balancer simulation', () => {
  it('round robin gives every server the same number of requests, whatever its speed', () => {
    const { servers } = simulateLoadBalancer(base)
    const assigned = servers.map((server) => server.assigned)

    expect(Math.max(...assigned) - Math.min(...assigned)).toBeLessThanOrEqual(1)
    expect(assigned.reduce((sum, count) => sum + count, 0)).toBeGreaterThan(300)
  })

  it('least connections sends more requests to faster servers, keeping their queues short', () => {
    const leastConnections = simulateLoadBalancer({ ...base, algorithm: 'least-connections' })
    const roundRobin = simulateLoadBalancer(base)
    const [slow, , fast] = leastConnections.servers

    expect(fast.assigned).toBeGreaterThan(2 * slow.assigned)
    // Round robin gives the slowest server a third of the load, beyond its speed, so its queue keeps growing.
    expect(roundRobin.servers[0].maxQueue).toBeGreaterThan(20)
    expect(Math.max(...leastConnections.servers.map((server) => server.maxQueue))).toBeLessThan(5)
  })

  it('hashing sends every request of a client to the same server', () => {
    const oneClient = simulateLoadBalancer({ ...base, algorithm: 'hashing', clientCount: 1 })
    const manyClients = simulateLoadBalancer({ ...base, algorithm: 'hashing', clientCount: 50 })

    expect(oneClient.servers.filter((server) => server.assigned > 0)).toHaveLength(1)
    expect(manyClients.servers.every((server) => server.assigned > 0)).toBe(true)
  })

  it('is the same run for the same seed, and a different one for another seed', () => {
    const input = { ...base, algorithm: 'least-connections' } as const

    expect(simulateLoadBalancer(input)).toEqual(simulateLoadBalancer(input))
    expect(simulateLoadBalancer({ ...input, seed: 8 })).not.toEqual(simulateLoadBalancer(input))
  })

  it('records the queues and the requests given so far at the end of every tick', () => {
    const { ticks, servers } = simulateLoadBalancer(base)

    expect(ticks).toHaveLength(base.ticks)
    expect(ticks.at(-1)?.assigned).toEqual(servers.map((server) => server.assigned))
    expect(ticks.at(-1)?.queueLengths).toEqual(servers.map((server) => server.assigned - server.completed))
  })
})
