import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { STACK_BUILDER_ENABLED } from '../src/features/stack-builder'
// @ts-expect-error legacy JS module without types
import { NLParser } from '../src/features/stack-builder/nl_engine.legacy.js'
import { DEFAULT_TUNABLES } from '../src/engine/tunables'

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
const appFiles = [...walk('src/ui'), ...walk('src/engine'), 'src/main.tsx'].filter((f) => /\.(ts|tsx)$/.test(f))

test('Stack Builder and runtime AI are off', () => {
  expect(STACK_BUILDER_ENABLED).toBe(false)
  expect(DEFAULT_TUNABLES.nlStackBuilderEnabled).toBe(false)
  expect(DEFAULT_TUNABLES.runtimeAiEnabled).toBe(false)
})

test('app code never imports the Stack Builder or makes network calls', () => {
  for (const f of appFiles) {
    const src = readFileSync(f, 'utf8')
    expect(src, f).not.toMatch(/stack-builder|nl_engine/)
    expect(src, f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|api[_-]?key/i)
  }
})

test('preserved legacy NL parser still parses (heritage check)', () => {
  const tables = JSON.parse(readFileSync('src/features/stack-builder/nl-tables.legacy.json', 'utf8'))
  const p = new NLParser(tables).parse('switch kickflip backside smith on rail')
  expect(p.stance).toBe('switch')
  expect(p.direction).toBe('BS')
})
