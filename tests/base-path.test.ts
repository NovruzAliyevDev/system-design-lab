import { describe, expect, it } from 'vitest'
import { siteBase } from '../scripts/base-path'

describe('site base path', () => {
  it('serves from the root when no base path is given', () => {
    expect(siteBase(undefined)).toBe('/')
    expect(siteBase('')).toBe('/')
    expect(siteBase('/')).toBe('/')
  })

  it('turns the GitHub Pages base path into a Vite base with both slashes', () => {
    // actions/configure-pages reports the project-site path without a trailing slash.
    expect(siteBase('/system-design-lab')).toBe('/system-design-lab/')
    expect(siteBase('system-design-lab')).toBe('/system-design-lab/')
    expect(siteBase('/system-design-lab/')).toBe('/system-design-lab/')
  })
})
