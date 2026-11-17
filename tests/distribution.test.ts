// Seeded generation report → output/distribution-report.txt (npm run sim)
import { writeFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { displayText } from '../src/engine/canonical'
import { defaultFilters, fullCatalog } from '../src/engine/catalog'
import { reduce, startSession, type GameState } from '../src/engine/game'
import { nextRandom } from '../src/engine/rng'
import { DEFAULT_TUNABLES } from '../src/engine/tunables'
import type { Filters } from '../src/engine/types'
import { validateTrick } from '../src/engine/validate'
import { run } from './helpers'

const lines: string[] = []
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`

test('catalog + per-level samples', { timeout: 120_000 }, () => {
  const t0 = performance.now()
  const cat = fullCatalog()
  const ms = performance.now() - t0
  const tiers: Record<string, number> = {}
  for (const c of cat) tiers[c.rarity] = (tiers[c.rarity] ?? 0) + 1
  lines.push(`catalog: ${cat.length} legal tricks, built in ${ms.toFixed(0)} ms (first call; cached after). Tiers ${JSON.stringify(tiers)}`)
  const invalid: string[] = []
  for (let L = 1; L <= 10; L++) {
    const picks = run(defaultFilters(), L, 1000, 1000 + L)
    const fam: Record<string, number> = {}
    const tier: Record<string, number> = {}
    let sum = 0
    let immediate = 0
    picks.forEach((p, i) => {
      const v = validateTrick(p.trick, { filters: defaultFilters(), gateLevel: L })
      if (!v.ok) invalid.push(`seed ${1000 + L} #${i} ${JSON.stringify(p.trick)} ${v.reasons.join('; ')}`)
      fam[p.family] = (fam[p.family] ?? 0) + 1
      tier[p.rarity] = (tier[p.rarity] ?? 0) + 1
      sum += p.rating
      if (i && picks[i - 1].key === p.key) immediate++
    })
    expect(immediate).toBe(0)
    lines.push(`\nL${L}: avg rating ${(sum / picks.length).toFixed(2)} · families ${JSON.stringify(fam)} · rarity ${JSON.stringify(tier)} · immediate repeats ${immediate}`)
    if ([2, 5, 8, 10].includes(L)) for (const p of picks.slice(0, 12)) lines.push(`  · ${displayText(p.trick)}  [${p.rating}${p.rarity !== 'core' ? ', ' + p.rarity : ''}]`)
  }
  lines.push(`\ninvalid samples: ${invalid.length}${invalid.length ? '\n' + invalid.slice(0, 20).join('\n') : ''}`)
  expect(invalid).toEqual([])
})

test('quarterpipe-only samples', () => {
  const f: Filters = { ...defaultFilters(), obstacles: ['quarterpipe'] }
  lines.push('\n== Quarterpipe only (default families, rarity very low) ==')
  for (const L of [1, 3, 5, 7]) {
    const picks = run(f, L, 200, 50 + L)
    const distinct = [...new Set(picks.map((p) => displayText(p.trick)))]
    const air = picks.filter((p) => p.trick.pattern === 'flip-only').length
    lines.push(`L${L}: ${distinct.length} distinct, flip-air share ${pct(air, picks.length)}: ${distinct.slice(0, 12).join(' · ')}`)
  }
})

test('rarity estimates from sampled sessions', { timeout: 120_000 }, () => {
  lines.push('\n== Rarity (share of picks, 3000 per row, all obstacles) ==')
  const rows: [string, Partial<Filters>, number][] = [
    ['very low (default) L5', {}, 5],
    ['very low (default) L8', {}, 8],
    ['very low (default) L10', {}, 10],
    ['off L8', { rarity: 'off' }, 8],
    ['low L8', { rarity: 'low' }, 8],
    ['normal L8', { rarity: 'normal' }, 8],
    ['normal + triples + transfers L10', { rarity: 'normal', triples: true, transfers: true }, 10],
  ]
  for (const [label, p, L] of rows) {
    const picks = run({ ...defaultFilters(), ...p }, L, 3000, L * 13)
    const c = (f: (x: (typeof picks)[number]) => boolean) => pct(picks.filter(f).length, picks.length)
    lines.push(
      `${label}: rare ${c((x) => x.rarity === 'rare')}, very-rare ${c((x) => x.rarity === 'very-rare')}, experimental ${c((x) => x.rarity === 'experimental')}, doubles ${c((x) => x.trick.flips === 2)}, triples ${c((x) => x.trick.flips === 3)}, transfers ${c((x) => !!x.trick.transferTo)}, exits ${c((x) => !!x.trick.exit)}, reverts ${c((x) => !!x.trick.revert)}`,
    )
  }
})

function simulate(anchor: number, trueSkill: number, n: number, seed: number) {
  let s: GameState = startSession({ mode: 'solo', soloLength: 50, filters: defaultFilters(), startLevel: anchor, tunables: DEFAULT_TUNABLES, seed, at: 0 })
  let r = seed
  const path: number[] = [s.skill.effective]
  for (let i = 0; i < n; i++) {
    if (s.status === 'over') s = startSession({ mode: 'solo', soloLength: 50, filters: defaultFilters(), startLevel: anchor, skill: s.skill, tunables: DEFAULT_TUNABLES, seed: seed + i, at: i })
    const c = s.current!
    const p = 1 / (1 + Math.exp(1.6 * (c.rating - trueSkill)))
    while (s.status === 'playing') {
      const [v, nr] = nextRandom(r)
      r = nr
      s = reduce(s, { type: v < p ? 'land' : 'miss', challengeId: c.id, at: i })
    }
    path.push(s.skill.effective)
    if (s.status === 'result') s = reduce(s, { type: 'next', at: i })
  }
  return path
}

test('adaptation convergence (simulated players) + write report', () => {
  lines.push(
    '\n== Adaptation convergence: simulated player, effective level after N challenges ==',
    '"true" = rating where the player lands 50% of single attempts; equilibrium sits ~1 level above that.',
  )
  for (const [anchor, truth] of [
    [3, 6],
    [8, 4],
    [5, 5],
    [1, 3],
  ] as const) {
    const path = simulate(anchor, truth, 100, 77)
    const maxStep = Math.max(...path.slice(1).map((x, i) => Math.abs(x - path[i])))
    lines.push(`start ${anchor}, true ${truth}: 10 → ${path[10].toFixed(2)}, 25 → ${path[25].toFixed(2)}, 50 → ${path[50].toFixed(2)}, 100 → ${path[100].toFixed(2)} (max step ${maxStep.toFixed(3)})`)
    expect(maxStep).toBeLessThanOrEqual(DEFAULT_TUNABLES.adaptationStepLimit + DEFAULT_TUNABLES.feedbackSkillStep + 1e-9)
    if (truth > anchor) expect(path[50]).toBeGreaterThan(anchor + 0.5)
    if (truth < anchor) expect(path[50]).toBeLessThan(anchor - 0.5)
  }
  writeFileSync('output/distribution-report.txt', lines.join('\n') + '\n')
})
