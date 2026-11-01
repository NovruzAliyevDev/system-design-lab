import { describe, expect, it } from 'vitest'
import { generateRequests, type RequestsInput } from './requests'

const input: RequestsInput = { rate: 40, writeShare: 0.3, keyCount: 10, duration: 4000, seed: 3 }

describe('client requests', () => {
  it('draws the same requests for the same seed, and others for another seed', () => {
    expect(generateRequests(input)).toEqual(generateRequests(input))
    expect(generateRequests({ ...input, seed: 4 })).not.toEqual(generateRequests(input))
  })

  it('arrive in time order within the duration, at about the rate, on the keys', () => {
    const requests = generateRequests(input)

    // 40 a second for 4 seconds.
    expect(requests.length).toBeGreaterThan(120)
    expect(requests.length).toBeLessThan(200)
    expect(requests.every((request, i) => i === 0 || request.time >= requests[i - 1].time)).toBe(true)
    expect(requests.every((request) => request.time >= 0 && request.time < 4000)).toBe(true)
    expect(requests.every((request) => request.key >= 0 && request.key < 10 && request.route >= 0 && request.route < 1)).toBe(true)
  })

  it('makes about the write share of the requests writes', () => {
    const requests = generateRequests({ ...input, duration: 100_000 })
    const writes = requests.filter((request) => request.kind === 'write').length

    expect(writes / requests.length).toBeCloseTo(0.3, 1)
  })
})
