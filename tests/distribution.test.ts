// Seeded distribution report across levels 1–10 → output/distribution-report.txt
import { writeFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { defaultFilters, fullCatalog } from '../src/engine/catalog'
import { displayText } from '../src/engine/format'
import { Rng } from '../src/engine/rng'
import { mainComponent, selectChallenge, type RecentPick } from '../src/engine/select'
import { DEFAULT_TUNABLES } from '../src/engine/tunables'

test('distribution report (1000 seeded picks per level)', () => {
  const lines: string[] = []
  const cat = fullCatalog()
  lines.push(`catalog: ${cat.length} legal tricks (${cat.filter((c) => c.experimental).length} experimental-lane only)`)
  for (let L = 1; L <= 10; L++) {
    const rng = new Rng(1000 + L)
    const recent: RecentPick[] = []
    const pat: Record<string, number> = {}
    const obs: Record<string, number> = {}
    const ex: string[] = []
    let sum = 0, spins = 0, min = 99, max = 0, immediateRepeats = 0
    const N = 1000
    for (let i = 0; i < N; i++) {
      const r = selectChallenge({ filters: defaultFilters(), skill: L, recent, rng, tun: DEFAULT_TUNABLES })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      const t = r.pick.trick
      if (recent.at(-1)?.key === r.pick.key) immediateRepeats++
      recent.push({ key: r.pick.key, pattern: t.pattern, obstacle: t.obstacle, main: mainComponent(r.pick) })
      pat[t.pattern] = (pat[t.pattern] ?? 0) + 1
      obs[t.obstacle] = (obs[t.obstacle] ?? 0) + 1
      sum += r.pick.rating
      min = Math.min(min, r.pick.rating)
      max = Math.max(max, r.pick.rating)
      if (t.spin) spins++
      if (i < 8) ex.push(`${displayText(t)}  [${r.pick.rating}]`)
    }
    expect(immediateRepeats).toBe(0)
    lines.push(
      `\nL${L}: avg rating ${(sum / N).toFixed(2)} (min ${min}, max ${max}), spins ${((spins / N) * 100).toFixed(0)}%, immediate repeats ${immediateRepeats}`,
      `  patterns ${JSON.stringify(pat)}`,
      `  obstacles ${JSON.stringify(obs)}`,
      ...ex.map((e) => '  · ' + e),
    )
  }
  writeFileSync('output/distribution-report.txt', lines.join('\n') + '\n')
})

import { reduce, startSession, type GameState } from '../src/engine/game'
import { nextRandom } from '../src/engine/rng'

// Simulated player: per-attempt land chance falls off as rating exceeds true skill.
function simulate(anchor: number, trueSkill: number, n: number, seed: number) {
  let s: GameState = startSession({ mode: 'solo', soloLength: 50, filters: defaultFilters(), startLevel: anchor, tunables: DEFAULT_TUNABLES, seed, at: 0 })
  let r = seed
  const path: number[] = [s.skill.effective]
  for (let i = 0; i < n; i++) {
    if (s.status === 'over') s = startSession({ mode: 'solo', soloLength: 50, filters: defaultFilters(), startLevel: anchor, skill: s.skill, tunables: DEFAULT_TUNABLES, seed: seed + i, at: i })
    const c = s.current!
    const p = 1 / (1 + Math.exp(1.6 * (c.rating - trueSkill)))
    let done = false
    while (!done) {
      const [v, nr] = nextRandom(r)
      r = nr
      s = reduce(s, { type: v < p ? 'land' : 'miss', challengeId: c.id, at: i })
      done = s.status !== 'playing'
    }
    path.push(s.skill.effective)
    if (s.status === 'result') s = reduce(s, { type: 'next', at: i })
  }
  return path
}

test('adaptation convergence report (simulated players)', () => {
  const lines = [
    '\n== Adaptation convergence: simulated player, effective level after N challenges ==',
    '"true" = rating where the player lands 50% of single attempts. With default evidence weights the',
    'equilibrium sits ~1 level ABOVE that (≈60% of challenges cleared within 3 tries, ≈26% first try).',
  ]
  const cases: [number, number][] = [[3, 6], [8, 4], [5, 5], [1, 3]]
  for (const [anchor, truth] of cases) {
    const path = simulate(anchor, truth, 100, 77)
    const at = (k: number) => path[k].toFixed(2)
    const maxStep = Math.max(...path.slice(1).map((x, i) => Math.abs(x - path[i])))
    lines.push(`start ${anchor}, true ${truth}: after 10 → ${at(10)}, 25 → ${at(25)}, 50 → ${at(50)}, 100 → ${at(100)}  (max single step ${maxStep.toFixed(3)})`)
    expect(maxStep).toBeLessThanOrEqual(DEFAULT_TUNABLES.adaptationStepLimit + 1e-9)
    // Moves in the right direction when the anchor is wrong
    if (truth > anchor) expect(path[50]).toBeGreaterThan(anchor + 0.5)
    if (truth < anchor) expect(path[50]).toBeLessThan(anchor - 0.5)
  }
  const { appendFileSync } = require('node:fs') as typeof import('node:fs')
  appendFileSync('output/distribution-report.txt', lines.join('\n') + '\n')
})
