import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Core must stay free of UI and platform code; the no-DOM tsconfig catches browser globals,
// this catches imports.
const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core')
const FORBIDDEN_IMPORT = /^(react|react-dom|react-router-dom|dexie|zustand|@xyflow\/.*|node:.*|fs|path|child_process)(\/.*)?$/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : []
  })
}

function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
}

describe('Core', () => {
  it('imports no React, browser storage or Node modules', () => {
    const violations = sourceFiles(CORE_DIR).flatMap((file) =>
      importsOf(readFileSync(file, 'utf8'))
        .filter((specifier) => FORBIDDEN_IMPORT.test(specifier))
        .map((specifier) => `${relative(CORE_DIR, file)} imports ${specifier}`),
    )

    expect(violations).toEqual([])
  })
})
