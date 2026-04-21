#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * Scans each package's public index.ts for named VALUE exports (e.g.
 * `export { foo, bar }`) and verifies each symbol is referenced by at
 * least one test file. Type-only exports (`export type { ... }`) are
 * intentionally skipped — they are validated structurally by
 * `tsc --noEmit` and don't need runtime-style test coverage.
 */

const packages = ['packages/core/src/index.ts', 'packages/react/src/index.ts']

// Matches `export { ... }` but NOT `export type { ... }`.
// Negative lookahead `(?!type\s+)` between `export` and `{`.
const valueExportRe = /^export\s+(?!type\s+)\{([^}]+)\}/gm
const gaps = []

for (const indexPath of packages) {
  const content = readFileSync(indexPath, 'utf8')
  const exports = []
  for (const match of content.matchAll(valueExportRe)) {
    exports.push(
      ...match[1]
        .split(',')
        .map((s) => s.trim().replace(/\s+as\s+.+$/, ''))
        // Strip any inline `type` keyword — `export { type Foo, bar }` is legal
        // and `type Foo` should be treated as a type, not a value.
        .filter((s) => s && !s.startsWith('type ') && !s.startsWith('//'))
    )
  }
  for (const symbol of exports) {
    const cmd = `grep -rE "\\b${symbol}\\b" packages/*/src --include='*.test.ts' --include='*.test.tsx' -l || true`
    const out = execSync(cmd, { encoding: 'utf8' }).trim()
    if (!out) gaps.push({ indexPath, symbol })
  }
}

if (gaps.length > 0) {
  console.error('Public value exports with no test references:')
  for (const g of gaps) console.error(`  ${g.indexPath} → ${g.symbol}`)
  process.exit(1)
}
console.log('All public value exports referenced in tests.')
