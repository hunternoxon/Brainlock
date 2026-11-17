import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { defaultFilters, diagnosePool, fullCatalog } from '../src/engine/catalog'
import { CONFIG } from '../src/engine/rules'
import { Rng } from '../src/engine/rng'
import { mainComponent, selectChallenge, type RecentPick } from '../src/engine/select'
import { DEFAULT_TUNABLES } from '../src/engine/tunables'
import { OBSTACLES, type Filters, type RatedTrick, type Trick } from '../src/engine/types'
import { validateTrick } from '../src/engine/validate'

function run(filters: Filters, level: number, n: number, seed = 7, tun = DEFAULT_TUNABLES): RatedTrick[] {
  const rng = new Rng(seed)
  const recent: RecentPick[] = []
  const out: RatedTrick[] = []
  for (let i = 0; i < n; i++) {
    const r = selectChallenge({ filters, skill: level, recent, rng, tun })
    if (!r.ok) throw new Error('empty pool: ' + r.diagnosis.messages.join(' '))
    out.push(r.pick)
    recent.push({ key: r.pick.key, pattern: r.pick.trick.pattern, obstacle: r.pick.trick.obstacle, main: mainComponent(r.pick) })
  }
  return out
}
const filtersWith = (p: Partial<Filters>): Filters => ({ ...defaultFilters(), ...p })

describe('config', () => {
  test('working config is a byte-identical copy of legacy model-config.json', () => {
    const a = readFileSync('src/engine/data/legacy-model-config.json', 'utf8')
    const b = readFileSync('import/Brainlock_OpenCode_Handoff/legacy/v4.5.2/model-config.json', 'utf8')
    expect(a).toBe(b)
  })
  test('all 12 obstacles and 4 families, no freestyle', () => {
    expect(Object.keys(CONFIG.obstacles).sort()).toEqual([...OBSTACLES].sort())
    expect(Object.keys(CONFIG.families).sort()).toEqual(['flips', 'grinds', 'manuals', 'spins'])
    expect(defaultFilters().obstacles).toHaveLength(12)
  })
  test('every one of the 12 obstacles has legal tricks', () => {
    for (const o of OBSTACLES) expect(fullCatalog().filter((c) => c.trick.obstacle === o && !c.experimental).length, o).toBeGreaterThan(0)
  })
})

describe('hard legality rules', () => {
  const v = (t: Trick) => validateTrick(t)
  test('no manual on handrail', () => {
    expect(v({ obstacle: 'handrail', stance: 'regular', pattern: 'manual-only', manual: 'manual' }).ok).toBe(false)
    expect(fullCatalog().some((c) => c.trick.manual && c.trick.obstacle === 'handrail')).toBe(false)
  })
  test('flip→manual on manual pad only, never plain flat', () => {
    expect(v({ obstacle: 'flat', stance: 'regular', pattern: 'flip→manual', flip: 'kickflip', manual: 'manual' }).ok).toBe(false)
    expect(v({ obstacle: 'manual pad', stance: 'regular', pattern: 'flip→manual', flip: 'kickflip', manual: 'manual' }).ok).toBe(true)
    expect(fullCatalog().filter((c) => c.trick.pattern === 'flip→manual').every((c) => c.trick.obstacle === 'manual pad')).toBe(true)
  })
  test('flip→grind (repaired) is valid on ledge/rail/flatbar/hubba/handrail', () => {
    for (const obstacle of ['ledge', 'rail', 'flatbar', 'hubba', 'handrail'] as const) {
      expect(v({ obstacle, stance: 'regular', pattern: 'flip→grind', flip: 'kickflip', grind: '50-50', direction: 'FS' }).ok, obstacle).toBe(true)
    }
  })
  test('no 540+, no primo slide on handrail (ban table), named gates enforced', () => {
    expect(v({ obstacle: 'flat', stance: 'regular', pattern: 'spin-only', spin: { deg: 540 as 360, dir: 'FS' } }).ok).toBe(false)
    expect(v({ obstacle: 'handrail', stance: 'regular', pattern: 'grind-only', grind: 'primo slide', direction: 'FS' }).reasons).toContain('No primo slide on a handrail')
    expect(fullCatalog().every((c) => !c.trick.spin || c.trick.spin.deg <= 360)).toBe(true)
  })
  test('level gates from config: noseblunt ≥8, laser ≥8, tre ≥6, flip→grind ≥5', () => {
    const at = (t: Trick, L: number) => validateTrick(t, { gateLevel: L }).ok
    const noseblunt: Trick = { obstacle: 'ledge', stance: 'regular', pattern: 'grind-only', grind: 'noseblunt', direction: 'BS' }
    expect(at(noseblunt, 7)).toBe(false)
    expect(at(noseblunt, 8)).toBe(true)
    const tre: Trick = { obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'tre flip' }
    expect(at(tre, 5)).toBe(false)
    expect(at(tre, 6)).toBe(true)
    const fg: Trick = { obstacle: 'ledge', stance: 'regular', pattern: 'flip→grind', flip: 'kickflip', grind: '50-50', direction: 'FS' }
    expect(at(fg, 4)).toBe(false)
    expect(at(fg, 5)).toBe(true)
  })
  test('a trick needing missing components is rejected (no "on rail" partials)', () => {
    expect(v({ obstacle: 'rail', stance: 'regular', pattern: 'grind-only' } as Trick).ok).toBe(false)
    expect(v({ obstacle: 'rail', stance: 'regular', pattern: 'flip-only', flip: 'kickflip' }).ok).toBe(false)
  })
})

describe('seeded generator properties', () => {
  test('1000+ picks per level 1–10: all validate, non-empty, gated, near level, no immediate repeats', () => {
    for (let L = 1; L <= 10; L++) {
      const picks = run(defaultFilters(), L, 120, L)
      let last = ''
      for (const p of picks) {
        const vr = validateTrick(p.trick, { filters: defaultFilters(), gateLevel: L })
        expect(vr.ok, `${p.key}: ${vr.reasons}`).toBe(true)
        expect(p.rating).toBeLessThanOrEqual(L + DEFAULT_TUNABLES.maxStretch + 1e-9)
        expect(p.key).not.toBe(last)
        last = p.key
      }
    }
  })
  test('flip→grind generated on rail/ledge with both families on at level ≥5', () => {
    const picks = run(filtersWith({ obstacles: ['ledge', 'rail'] }), 7, 300)
    expect(picks.filter((p) => p.trick.pattern === 'flip→grind').length).toBeGreaterThan(20)
  })
  test('spins disabled → 0 spins in 2000 seeded picks', () => {
    const picks = run(filtersWith({ families: ['flips', 'grinds', 'manuals'] }), 8, 2000)
    expect(picks.filter((p) => p.trick.spin).length).toBe(0)
  })
  test('spin sub-option disabled → that spin never appears', () => {
    const f = defaultFilters()
    f.subs.spins = ['180']
    expect(run(f, 7, 1000).filter((p) => p.trick.spin?.deg === 360).length).toBe(0)
  })
  for (const fam of ['flips', 'grinds', 'manuals'] as const) {
    test(`${fam} disabled → none generated`, () => {
      const picks = run(filtersWith({ families: (['flips', 'grinds', 'manuals', 'spins'] as const).filter((f) => f !== fam) }), 6, 800)
      const has = (t: Trick) => (fam === 'flips' ? t.flip : fam === 'grinds' ? t.grind : t.manual)
      expect(picks.filter((p) => has(p.trick)).length).toBe(0)
    })
  }
  test('narrowed obstacle and stance filters are respected', () => {
    const picks = run(filtersWith({ obstacles: ['flat', 'ledge', 'flatbar'], stances: ['regular', 'fakie'] }), 4, 500)
    expect(new Set(picks.map((p) => p.trick.obstacle)).size).toBeLessThanOrEqual(3)
    expect(picks.every((p) => ['flat', 'ledge', 'flatbar'].includes(p.trick.obstacle))).toBe(true)
    expect(picks.every((p) => ['regular', 'fakie'].includes(p.trick.stance))).toBe(true)
  })
  test('experimental combos never appear with the lane off', () => {
    expect(run(defaultFilters(), 9, 1000).some((p) => p.experimental)).toBe(false)
  })
  test('same seed → identical sequence (reproducible)', () => {
    expect(run(defaultFilters(), 5, 50, 99).map((p) => p.key)).toEqual(run(defaultFilters(), 5, 50, 99).map((p) => p.key))
  })
  test('cooldown: no exact repeat within 12 prompts when the pool allows', () => {
    const keys = run(defaultFilters(), 3, 500).map((p) => p.key)
    for (let i = 0; i < keys.length; i++) expect(keys.slice(Math.max(0, i - 12), i)).not.toContain(keys[i])
  })
})

describe('empty / narrow pools: explicit, never a fallback', () => {
  test('handrail only at level 1 → empty with an explanation', () => {
    const r = selectChallenge({ filters: filtersWith({ obstacles: ['handrail'] }), skill: 1, recent: [], rng: new Rng(1), tun: DEFAULT_TUNABLES })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.diagnosis.atLevel).toBe(0)
      expect(r.diagnosis.messages.join(' ')).toMatch(/level 6/)
    }
  })
  test('manuals only + handrail → explains which family would work', () => {
    const d = diagnosePool(filtersWith({ obstacles: ['handrail'], families: ['manuals'] }), 10, 10)
    expect(d.anyLevel).toBe(0)
    expect(d.messages.join(' ')).toMatch(/Grinds\/Slides/)
  })
  test('lifting the level cap still only yields legal tricks', () => {
    const r = selectChallenge({ filters: filtersWith({ obstacles: ['handrail'] }), skill: 1, recent: [], rng: new Rng(1), tun: DEFAULT_TUNABLES, allowStretchBeyondCap: true })
    expect(r.ok).toBe(true)
    if (r.ok) expect(validateTrick(r.pick.trick).ok).toBe(true)
  })
  test('tiny pool repeats only after exhausting alternatives, and says so', () => {
    const f: Filters = { obstacles: ['flat'], stances: ['regular'], families: ['flips'], subs: { ...defaultFilters().subs, flips: ['kickflip', 'heelflip'] } }
    const rng = new Rng(3)
    const recent: RecentPick[] = []
    const keys: string[] = []
    const notes: string[] = []
    for (let i = 0; i < 6; i++) {
      const r = selectChallenge({ filters: f, skill: 1, recent, rng, tun: DEFAULT_TUNABLES })
      if (!r.ok) throw new Error()
      keys.push(r.pick.key)
      notes.push(...r.trace.notes)
      recent.push({ key: r.pick.key, pattern: r.pick.trick.pattern, obstacle: r.pick.trick.obstacle, main: mainComponent(r.pick) })
    }
    for (let i = 1; i < keys.length; i++) expect(keys[i]).not.toBe(keys[i - 1])
    expect(notes.some((n) => /cooldown/.test(n))).toBe(true)
  })
})
