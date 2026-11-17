import { describe, expect, test } from 'vitest'
import { displayText } from '../src/engine/canonical'
import { defaultFilters, fullCatalog } from '../src/engine/catalog'
import { DEFAULT_TUNABLES } from '../src/engine/tunables'
import type { Filters, RatedTrick } from '../src/engine/types'
import { run } from './helpers'

const filtersWith = (p: Partial<Filters>): Filters => ({ ...defaultFilters(), ...p })
const names = (ps: RatedTrick[]) => ps.map((p) => displayText(p.trick))

describe('fundamentals', () => {
  test('Ollie is a valid beginner prompt', () => {
    const ollie = fullCatalog().find((c) => c.trick.flip === 'ollie' && !c.trick.spin && c.trick.obstacle === 'flat' && c.trick.stance === 'regular')
    expect(ollie?.rating).toBe(1)
    expect(names(run(defaultFilters(), 1, 300))).toContain('Ollie on flat')
  })
  test('low-level pools include FS and BS pop shuvits', () => {
    const n = names(run(defaultFilters(), 2, 400)).join('|')
    expect(n).toMatch(/BS Pop Shuvit/)
    expect(n).toMatch(/FS Pop Shuvit/)
  })
  test('Fakie Heelflip and Switch Heelflip can both be generated (each at its own level)', () => {
    expect(names(run(filtersWith({ obstacles: ['flat'] }), 2, 1500))).toContain('Fakie Heelflip on flat')
    expect(names(run(filtersWith({ obstacles: ['flat'] }), 6, 1500))).toContain('Switch Heelflip on flat')
  })
  test('no plain flat Ollie at level 10', () => {
    expect(names(run(defaultFilters(), 10, 800)).some((n) => n === 'Ollie on flat')).toBe(false)
  })
  test('level 10 still sometimes gets basic tricks in meaningful contexts', () => {
    const picks = run(defaultFilters(), 10, 800)
    expect(picks.some((p) => ['kickflip', 'heelflip', 'bs pop shuvit'].includes(p.trick.flip ?? '') && p.trick.grind)).toBe(true)
  })
})

describe('quarterpipe coping (critical)', () => {
  const qpOnly = (lvl: number, rarity: Filters['rarity'] = 'very-low') => run(filtersWith({ obstacles: ['quarterpipe'], rarity }), lvl, 300, lvl)
  test('quarterpipe-only at level 1 still produces real coping tricks', () => {
    const n = new Set(names(qpOnly(1)))
    expect([...n].some((x) => /Tail Stall/.test(x))).toBe(true)
  })
  for (const lvl of [3, 5, 8]) {
    test(`quarterpipe-only L${lvl}: diverse stalls/grinds/lip tricks, not just flip airs`, () => {
      const picks = qpOnly(lvl)
      const kinds = new Set(picks.map((p) => p.trick.pattern))
      const distinct = new Set(picks.map((p) => p.trick.lip ?? p.trick.grind ?? p.trick.flip))
      expect(kinds.has('coping')).toBe(true)
      expect(kinds.has('grind-only')).toBe(true)
      // Quarterpipe vocabulary tops out around level 7.5 (known limit), so L8 is a little narrower
      expect(distinct.size).toBeGreaterThanOrEqual(lvl >= 8 ? 5 : 6)
      const airShare = picks.filter((p) => p.trick.pattern === 'flip-only').length / picks.length
      expect(airShare).toBeLessThan(0.5)
    })
  }
  test('quarterpipe + stalls only (no grinds, no flips) still works', () => {
    const picks = run(filtersWith({ obstacles: ['quarterpipe'], families: ['stalls'] }), 4, 100)
    expect(picks.every((p) => p.trick.pattern === 'coping')).toBe(true)
  })
  test('stalls are distinguished from moving coping grinds', () => {
    const qp = fullCatalog().filter((c) => c.trick.obstacle === 'quarterpipe')
    expect(qp.some((c) => c.trick.lip === 'axle stall')).toBe(true)
    expect(qp.some((c) => c.trick.grind === '50-50')).toBe(true)
    expect(qp.find((c) => c.trick.lip === 'axle stall')!.family).toBe('stalls')
    expect(qp.find((c) => c.trick.grind === 'slash grind')!.family).toBe('grinds')
  })
})

describe('flags and rarity', () => {
  test('Double Flips off → no doubles; Triple Flips off → no triples', () => {
    const noDoubles = run(filtersWith({ doubles: false, rarity: 'normal' }), 9, 1500)
    expect(noDoubles.some((p) => p.trick.flips === 2)).toBe(false)
    const def = run(filtersWith({ rarity: 'normal' }), 10, 1500)
    expect(def.some((p) => p.trick.flips === 3)).toBe(false)
  })
  test('Triple Flips on → triples exist (L9+) but stay extremely rare', () => {
    const picks = run(filtersWith({ triples: true, rarity: 'normal', obstacles: ['flat', 'gap'] }), 10, 3000, 4)
    const triples = picks.filter((p) => p.trick.flips === 3).length
    expect(triples / picks.length).toBeLessThan(0.03)
  })
  test('Transfers off → none; on → only compatible pairs, rare', () => {
    expect(run(filtersWith({ rarity: 'normal' }), 7, 1500).some((p) => p.trick.transferTo)).toBe(false)
    const on = run(filtersWith({ transfers: true, rarity: 'normal', obstacles: ['box', 'manual pad', 'bank', 'quarterpipe'] }), 7, 2000)
    const t = on.filter((p) => p.trick.transferTo)
    for (const p of t) expect([['manual pad', 'box'], ['box', 'manual pad'], ['bank', 'quarterpipe'], ['quarterpipe', 'bank']]).toContainEqual([p.trick.obstacle, p.trick.transferTo])
    expect(t.length / on.length).toBeLessThan(0.15)
  })
  test('Rare = Off: no rare/very-rare tricks, core vocabulary intact', () => {
    const picks = run(filtersWith({ rarity: 'off' }), 9, 1500)
    expect(picks.some((p) => p.rarity === 'rare' || p.rarity === 'very-rare' || p.rarity === 'experimental')).toBe(false)
    expect(picks.length).toBe(1500)
  })
  test('Rare = Very low (default): rare + very-rare stay under ~8% of picks', () => {
    for (const lvl of [5, 8, 10]) {
      const picks = run(defaultFilters(), lvl, 2000, lvl)
      const r = picks.filter((p) => p.rarity === 'rare' || p.rarity === 'very-rare').length / picks.length
      expect(r, `L${lvl}`).toBeLessThan(0.08)
    }
  })
  test('high-level rare flips do not appear at low levels', () => {
    const picks = run(filtersWith({ rarity: 'normal' }), 3, 1500)
    expect(picks.some((p) => /late|540|laser|360 hardflip|impossible|pressure/.test(p.trick.flip ?? ''))).toBe(false)
  })
  test('defaults: doubles on, triples off, transfers off, rarity very low', () => {
    const d = defaultFilters()
    expect([d.doubles, d.triples, d.transfers, d.rarity]).toEqual([true, false, false, 'very-low'])
    expect(DEFAULT_TUNABLES.familySkillEnabled).toBe(false)
  })
})

describe('soft balance and variety', () => {
  test('a long session mixes families (no family above ~60%) and stances', () => {
    const picks = run(defaultFilters(), 6, 300, 21)
    const share: Record<string, number> = {}
    for (const p of picks) share[p.family] = (share[p.family] ?? 0) + 1 / picks.length
    for (const v of Object.values(share)) expect(v).toBeLessThan(0.6)
    expect(Object.keys(share).length).toBeGreaterThanOrEqual(4)
    expect(new Set(picks.map((p) => p.trick.stance)).size).toBe(4)
  })
  test('FS/BS grinds roughly even', () => {
    const g = run(filtersWith({ obstacles: ['ledge', 'rail', 'box'] }), 6, 800).filter((p) => p.trick.direction)
    const fs = g.filter((p) => p.trick.direction === 'FS').length / g.length
    expect(fs).toBeGreaterThan(0.35)
    expect(fs).toBeLessThan(0.65)
  })
})
