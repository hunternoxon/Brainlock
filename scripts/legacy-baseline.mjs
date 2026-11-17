// Phase A baseline: measure what the legacy v4.5.2 generator actually does.
// Reads legacy/ read-only, repairs the known parse error in memory only, and
// writes measurements to output/legacy-baseline.json.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const legacyDir = join(root, 'import/Brainlock_OpenCode_Handoff/legacy/v4.5.2')
const original = readFileSync(join(legacyDir, 'trick_model.js'), 'utf8')
const cfg = JSON.parse(readFileSync(join(legacyDir, 'model-config.json'), 'utf8'))

const tmp = mkdtempSync(join(tmpdir(), 'brainlock-legacy-'))
const report = { parse: {}, defects: {} }

// 1. Original fails to parse
writeFileSync(join(tmp, 'original.mjs'), original)
try {
  execFileSync(process.execPath, ['--check', join(tmp, 'original.mjs')], { stdio: 'pipe' })
  report.parse.original = 'ok'
} catch (e) {
  report.parse.original = 'SyntaxError: ' + String(e.stderr).split('\n').find((l) => l.startsWith('SyntaxError'))
}

// 2. One-character repair
const BAD = 'Object.keys(this.cfg?.obstacles||{"flat":{});'
const GOOD = 'Object.keys(this.cfg?.obstacles||{"flat":{}});'
if (!original.includes(BAD)) throw new Error('Expected defect not found; legacy source changed?')
const fixed = original.replace(BAD, GOOD)
writeFileSync(join(tmp, 'fixed.mjs'), fixed)
execFileSync(process.execPath, ['--check', join(tmp, 'fixed.mjs')])
report.parse.fixed = 'ok'

// Deterministic Math.random for reproducibility
let seed = 12345
Math.random = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

let fetchResolve
globalThis.fetch = () => new Promise((r) => (fetchResolve = r))
const { default: BrainlockModel } = await import(pathToFileURL(join(tmp, 'fixed.mjs')).href)

// 3. Init race: options are initialized before config arrives
const raced = new BrainlockModel()
const obstaclesBeforeConfig = [...raced.state.obstacles]
fetchResolve({ json: async () => cfg })
await raced.ready
report.defects.initRace = {
  obstaclesAfterConfigLoad: [...raced.state.obstacles],
  note: 'Set initialized from fallback {flat} before config loaded; never expanded to 12.',
  obstaclesBeforeConfig,
}

function freshModel(mut) {
  const m = new BrainlockModel()
  m.cfg = cfg
  m.state = null
  m.ensureSetsInitialized()
  m.reset()
  mut?.(m)
  return m
}

function sample(m, n) {
  const out = { total: n, fallback: 0, flipToGrind: 0, spins: 0, manualOnHandrail: 0, immediateRepeats: 0, byPattern: {} }
  let last = null
  for (let i = 0; i < n; i++) {
    const t = m.selectTrick()
    if (m.state.why === 'fallback') out.fallback++
    if (t.pattern === 'flip→grind') out.flipToGrind++
    if (t.spin) out.spins++
    if (t.manual && t.obstacle === 'handrail') out.manualOnHandrail++
    const key = m.trickText(t)
    if (key === last) out.immediateRepeats++
    last = key
    out.byPattern[t.pattern] = (out.byPattern[t.pattern] || 0) + 1
  }
  return out
}

// 4. flip→grind is unreachable even at level 10 with every option on
report.defects.flipToGrindAllOn_L10 = sample(freshModel((m) => (m.state.level = 10)), 2000)
// 5. Spins appear even with the spins family disabled
report.defects.spinsDisabled_L8 = sample(
  freshModel((m) => {
    m.state.level = 8
    m.state.families.delete('spins')
  }),
  2000,
)
// 6. Narrow filters fall back to unvalidated tricks
report.defects.handrailOnly_L1 = sample(
  freshModel((m) => {
    m.state.level = 1
    m.state.obstacles = new Set(['handrail'])
  }),
  200,
)
report.defects.handrailOnly_L1.examples = (() => {
  const m = freshModel((mm) => {
    mm.state.level = 1
    mm.state.obstacles = new Set(['handrail'])
  })
  return Array.from({ length: 3 }, () => m.trickText(m.selectTrick()))
})()

// 7. Scoring golden check via legacy scorer
const sm = freshModel()
report.legacyScoring = [1, 2, 3].map(
  (a) => sm.scoreTrick({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'kickflip', signature: 'x' }, a).total,
)

writeFileSync(join(root, 'output/legacy-baseline.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
