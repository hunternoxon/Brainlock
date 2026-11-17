import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { displayText, trickName } from '../src/engine/canonical'
import { defaultFilters, diagnosePool, filteredCatalog, fullCatalog } from '../src/engine/catalog'
import { CONFIG } from '../src/engine/rules'
import { Rng } from '../src/engine/rng'
import { recentOf, selectChallenge, type RecentPick } from '../src/engine/select'
import { run } from './helpers'
import { DEFAULT_TUNABLES } from '../src/engine/tunables'
import { FAMILIES, OBSTACLES, type Filters, type Trick } from '../src/engine/types'
import { validateTrick } from '../src/engine/validate'

const filtersWith = (p: Partial<Filters>): Filters => ({ ...defaultFilters(), ...p })

describe('config', () => {
  test('working config is a byte-identical copy of legacy model-config.json', () => {
    const a = readFileSync('src/engine/data/legacy-model-config.json', 'utf8')
    const b = readFileSync('import/Brainlock_OpenCode_Handoff/legacy/v4.5.2/model-config.json', 'utf8')
    expect(a).toBe(b)
  })
  test('all 12 obstacles, 5 families, no freestyle', () => {
    expect(Object.keys(CONFIG.obstacles).sort()).toEqual([...OBSTACLES].sort())
    expect([...FAMILIES]).toEqual(['flips', 'grinds', 'manuals', 'spins', 'stalls'])
    expect(defaultFilters().obstacles).toHaveLength(12)
  })
  test('every one of the 12 obstacles has core (non-rare) tricks', () => {
    for (const o of OBSTACLES) expect(fullCatalog().filter((c) => c.trick.obstacle === o && c.rarity === 'core').length, o).toBeGreaterThan(0)
  })
  test('every catalog entry validates and has a clean, defined name', () => {
    for (const c of fullCatalog()) {
      const name = displayText(c.trick)
      expect(validateTrick(c.trick).ok).toBe(true)
      expect(name, JSON.stringify(c.trick)).not.toMatch(/undefined|\?|NaN|  /)
      expect(trickName(c.trick)).not.toMatch(/^Ollie .+(50-50|5-0|Grind|slide|Manual|Stall)/i)
    }
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
  test('flip→grind valid on ledge/rail/flatbar/hubba/handrail/box/curb', () => {
    for (const obstacle of ['ledge', 'rail', 'flatbar', 'hubba', 'handrail', 'box', 'curb'] as const) {
      expect(v({ obstacle, stance: 'regular', pattern: 'flip→grind', flip: 'kickflip', grind: '50-50', direction: 'FS' }).ok, obstacle).toBe(true)
    }
  })
  test('ollie is never an entry into grinds or manuals', () => {
    expect(v({ obstacle: 'ledge', stance: 'regular', pattern: 'flip→grind', flip: 'ollie', grind: '50-50', direction: 'FS' }).ok).toBe(false)
    expect(v({ obstacle: 'manual pad', stance: 'regular', pattern: 'flip→manual', flip: 'ollie', manual: 'manual' }).ok).toBe(false)
  })
  test('no 540+ body spins; 540 board rotations are allowed (rare, L9+)', () => {
    expect(v({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'ollie', spin: { deg: 540 as 360, dir: 'FS' } }).ok).toBe(false)
    const r = v({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'bs 540 shuvit' })
    expect(r.ok).toBe(true)
    expect(r.gate).toBeGreaterThanOrEqual(9)
    expect(r.rarity).toBe('rare')
  })
  test('bans: primo slide on handrail, hospital & casper anywhere', () => {
    expect(v({ obstacle: 'handrail', stance: 'regular', pattern: 'grind-only', grind: 'primo slide', direction: 'FS' }).reasons).toContain('No primo slide on a handrail')
    expect(v({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'hospital flip' }).ok).toBe(false)
    expect(fullCatalog().some((c) => /hospital|casper/i.test(displayText(c.trick)))).toBe(false)
  })
  test('level gates: noseblunt ≥8, tre ≥6, flip→grind ≥5, pressure ≥5, late ≥7, triples ≥9', () => {
    const at = (t: Trick, L: number) => validateTrick(t, { gateLevel: L }).ok
    expect(at({ obstacle: 'ledge', stance: 'regular', pattern: 'grind-only', grind: 'noseblunt', direction: 'BS' }, 7)).toBe(false)
    expect(at({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'tre flip' }, 5)).toBe(false)
    expect(at({ obstacle: 'ledge', stance: 'regular', pattern: 'flip→grind', flip: 'kickflip', grind: '50-50', direction: 'FS' }, 4)).toBe(false)
    expect(at({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'pressure flip' }, 4)).toBe(false)
    expect(at({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'late kickflip' }, 6)).toBe(false)
    expect(at({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'kickflip', flips: 3 }, 8)).toBe(false)
    expect(at({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'kickflip', flips: 3 }, 9)).toBe(true)
  })
  test('partial tricks are rejected (no bare "on rail")', () => {
    expect(v({ obstacle: 'rail', stance: 'regular', pattern: 'grind-only' } as Trick).ok).toBe(false)
    expect(v({ obstacle: 'rail', stance: 'regular', pattern: 'flip-only', flip: 'kickflip' }).ok).toBe(false)
  })
  test('stalls only on the quarterpipe; pop-overs only on bars/rails', () => {
    expect(v({ obstacle: 'ledge', stance: 'regular', pattern: 'coping', lip: 'axle stall', lipDir: 'BS' }).ok).toBe(false)
    expect(v({ obstacle: 'quarterpipe', stance: 'regular', pattern: 'coping', lip: 'axle stall', lipDir: 'BS' }).ok).toBe(true)
    expect(fullCatalog().filter((c) => c.trick.exit === 'pop over').every((c) => ['flatbar', 'rail', 'handrail'].includes(c.trick.obstacle))).toBe(true)
  })
})

describe('seeded generator properties', () => {
  test('all levels 1–10: picks validate, are gated, near level, no immediate repeats', () => {
    for (let L = 1; L <= 10; L++) {
      const picks = run(defaultFilters(), L, 120, L)
      let last = ''
      for (const p of picks) {
        const vr = validateTrick(p.trick, { filters: defaultFilters(), gateLevel: L })
        expect(vr.ok, `seed ${L} ${JSON.stringify(p.trick)}: ${vr.reasons}`).toBe(true)
        expect(p.rating).toBeLessThanOrEqual(L + DEFAULT_TUNABLES.maxStretch + 0.05 + 1e-9)
        expect(p.key).not.toBe(last)
        last = p.key
      }
    }
  })
  test('flip→grind generated on rail/ledge with both families on at level ≥5', () => {
    expect(run(filtersWith({ obstacles: ['ledge', 'rail'] }), 7, 300).filter((p) => p.trick.pattern === 'flip→grind').length).toBeGreaterThan(20)
  })
  test('spins disabled → 0 body spins in 2000 seeded picks', () => {
    expect(run(filtersWith({ families: ['flips', 'grinds', 'manuals', 'stalls'] }), 8, 2000).filter((p) => p.trick.spin || p.trick.exitDir).length).toBe(0)
  })
  test('360 sub disabled → no 360 body spins', () => {
    const f = defaultFilters()
    f.subs.spins = ['180']
    expect(run(f, 7, 1000).filter((p) => p.trick.spin?.deg === 360).length).toBe(0)
  })
  for (const fam of ['flips', 'grinds', 'manuals', 'stalls'] as const) {
    test(`${fam} disabled → none generated`, () => {
      const picks = run(filtersWith({ families: FAMILIES.filter((f) => f !== fam) }), 6, 800)
      expect(picks.filter((p) => p.family === fam).length).toBe(0)
      if (fam === 'flips') expect(picks.filter((p) => p.trick.flip && p.trick.flip !== 'ollie').length).toBe(0)
    })
  }
  test('narrowed obstacle and stance filters are respected', () => {
    const picks = run(filtersWith({ obstacles: ['flat', 'ledge', 'flatbar'], stances: ['regular', 'fakie'] }), 4, 500)
    expect(picks.every((p) => ['flat', 'ledge', 'flatbar'].includes(p.trick.obstacle))).toBe(true)
    expect(picks.every((p) => ['regular', 'fakie'].includes(p.trick.stance))).toBe(true)
  })
  test('experimental combos never appear unless Rare = Normal', () => {
    for (const rarity of ['off', 'very-low', 'low'] as const) expect(filteredCatalog(filtersWith({ rarity })).some((c) => c.rarity === 'experimental'), rarity).toBe(false)
  })
  test('same seed → identical sequence', () => {
    expect(run(defaultFilters(), 5, 50, 99).map((p) => p.key)).toEqual(run(defaultFilters(), 5, 50, 99).map((p) => p.key))
  })
  test('cooldown: no exact repeat within 12 prompts when the pool allows', () => {
    const keys = run(defaultFilters(), 3, 500).map((p) => p.key)
    for (let i = 0; i < keys.length; i++) expect(keys.slice(Math.max(0, i - 12), i)).not.toContain(keys[i])
  })
  test('obstacle is not a loophole: same skill rarely repeats within 8 prompts', () => {
    const sigs = run(defaultFilters(), 6, 400).map((p) => p.signature)
    let hits = 0
    for (let i = 0; i < sigs.length; i++) if (sigs.slice(Math.max(0, i - 8), i).includes(sigs[i])) hits++
    expect(hits / sigs.length).toBeLessThan(0.05)
  })
})

describe('empty / narrow pools: explicit, never a fallback', () => {
  test('handrail only at level 1 → empty with an explanation', () => {
    const r = selectChallenge({ filters: filtersWith({ obstacles: ['handrail'] }), skill: 1, recent: [], rng: new Rng(1), tun: DEFAULT_TUNABLES })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.diagnosis.messages.join(' ')).toMatch(/level 6/)
  })
  test('manuals only + handrail → explains which family would work', () => {
    const d = diagnosePool(filtersWith({ obstacles: ['handrail'], families: ['manuals'] }), 10, 10)
    expect(d.anyLevel).toBe(0)
    expect(d.messages.join(' ')).toMatch(/Grinds & slides/)
  })
  test('no obstacles → clear message', () => {
    expect(diagnosePool(filtersWith({ obstacles: [] }), 5, 6).messages[0]).toMatch(/No obstacles selected/)
  })
  test('lifting the level cap still only yields legal tricks', () => {
    const r = selectChallenge({ filters: filtersWith({ obstacles: ['handrail'] }), skill: 1, recent: [], rng: new Rng(1), tun: DEFAULT_TUNABLES, allowStretchBeyondCap: true })
    expect(r.ok).toBe(true)
    if (r.ok) expect(validateTrick(r.pick.trick).ok).toBe(true)
  })
  test('tiny pool repeats only after exhausting alternatives, and says so', () => {
    const f: Filters = { ...defaultFilters(), obstacles: ['flat'], stances: ['regular'], families: ['flips'], subs: { ...defaultFilters().subs, flips: ['kickflip', 'heelflip'] } }
    const rng = new Rng(3)
    const recent: RecentPick[] = []
    const keys: string[] = []
    const notes: string[] = []
    for (let i = 0; i < 6; i++) {
      const r = selectChallenge({ filters: f, skill: 1, recent, rng, tun: DEFAULT_TUNABLES })
      if (!r.ok) throw new Error()
      keys.push(r.pick.key)
      notes.push(...r.trace.notes)
      recent.push(recentOf(r.pick))
    }
    for (let i = 1; i < keys.length; i++) expect(keys[i]).not.toBe(keys[i - 1])
    expect(notes.some((n) => /cooldown/.test(n))).toBe(true)
  })
})
