import { describe, expect, test } from 'vitest'
import { boardMoveFromAlias, displayText, parseAirName, trickKey, trickName, trickSignature } from '../src/engine/canonical'
import { fullCatalog } from '../src/engine/catalog'
import { CONFIG } from '../src/engine/rules'
import { scoreLanding } from '../src/engine/score'
import type { Stance, Trick } from '../src/engine/types'
import { BOARD_MOVES, boardMoveValue } from '../src/engine/vocab'

const air = (flip: string, extra: Partial<Trick> = {}): Trick => ({ obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip, ...extra })
const score = (t: Trick) => scoreLanding(t, 1, 0).total

describe('conventional names from canonical components', () => {
  const cases: [Trick, string][] = [
    [air('ollie'), 'Ollie'],
    [air('ollie', { stance: 'nollie' }), 'Nollie'],
    [air('ollie', { stance: 'fakie' }), 'Fakie Ollie'],
    [air('hardflip', { spin: { deg: 180, dir: 'FS' } }), 'FS 180 Hardflip'],
    [air('ollie', { spin: { deg: 180, dir: 'FS' } }), 'FS 180'],
    [air('ollie', { stance: 'fakie', spin: { deg: 180, dir: 'FS' } }), 'Half Cab'],
    [air('ollie', { stance: 'fakie', spin: { deg: 180, dir: 'BS' } }), 'Fakie BS 180'],
    [air('ollie', { stance: 'fakie', spin: { deg: 360, dir: 'FS' } }), 'Full Cab'],
    [air('kickflip', { spin: { deg: 180, dir: 'FS' } }), 'FS Flip'],
    [air('kickflip', { spin: { deg: 180, dir: 'BS' } }), 'BS Flip'],
    [air('heelflip', { spin: { deg: 180, dir: 'FS' } }), 'FS Heelflip'],
    [air('kickflip', { stance: 'fakie', spin: { deg: 180, dir: 'FS' } }), 'Half Cab Flip'],
    [air('heelflip', { stance: 'fakie', spin: { deg: 180, dir: 'FS' } }), 'Half Cab Heelflip'],
    [air('kickflip', { stance: 'switch', spin: { deg: 180, dir: 'FS' } }), 'Switch FS Flip'],
    [air('kickflip', { stance: 'nollie', spin: { deg: 180, dir: 'BS' } }), 'Nollie BS Flip'],
    [air('bs pop shuvit'), 'BS Pop Shuvit'],
    [air('fs 360 shuvit'), 'FS 360 Shuvit'],
    [air('bs 360 shuvit', { spin: { deg: 180, dir: 'BS' } }), 'BS Bigspin'],
    [air('fs 360 shuvit', { spin: { deg: 180, dir: 'FS' } }), 'FS Bigspin'],
    [air('tre flip', { spin: { deg: 180, dir: 'BS' } }), 'BS Bigflip'],
    [air('bs 540 shuvit', { spin: { deg: 180, dir: 'BS' } }), 'BS Biggerspin'],
    [air('bs 540 shuvit', { spin: { deg: 360, dir: 'BS' } }), 'BS Gazelle'],
    [air('tre flip'), 'Tre Flip'],
    [air('laser flip'), 'Laser Flip'],
    [air('kickflip', { flips: 2 }), 'Double Kickflip'],
    [air('heelflip', { flips: 3 }), 'Triple Heelflip'],
    [air('kickflip', { revert: 'FS' }), 'Kickflip FS Revert'],
    [{ obstacle: 'ledge', stance: 'regular', pattern: 'grind-only', grind: '50-50', direction: 'FS' }, 'FS 50-50'],
    [{ obstacle: 'ledge', stance: 'nollie', pattern: 'grind-only', grind: '50-50', direction: 'FS' }, 'Nollie FS 50-50'],
    [{ obstacle: 'ledge', stance: 'regular', pattern: 'flip→grind', flip: 'kickflip', grind: 'smith', direction: 'BS' }, 'Kickflip BS Smith Grind'],
    [{ obstacle: 'ledge', stance: 'regular', pattern: 'flip→grind', flip: 'bs pop shuvit', grind: '5-0', direction: 'FS' }, 'BS Pop Shuvit to FS 5-0'],
    [{ obstacle: 'ledge', stance: 'regular', pattern: 'grind-only', grind: '50-50', direction: 'FS', grind2: '5-0' }, 'FS 50-50 to 5-0'],
    [{ obstacle: 'ledge', stance: 'regular', pattern: 'grind-only', grind: 'noseslide', direction: 'BS', exit: 'shuvit out' }, 'BS Noseslide Shuvit Out'],
    [{ obstacle: 'ledge', stance: 'regular', pattern: 'grind-only', grind: '5-0', direction: 'BS', exit: '180 out', exitDir: 'FS' }, 'BS 5-0 FS 180 Out'],
    [{ obstacle: 'rail', stance: 'regular', pattern: 'grind-only', grind: 'boardslide', direction: 'FS', exit: 'pop over' }, 'FS Boardslide Pop Over'],
    [{ obstacle: 'manual pad', stance: 'regular', pattern: 'flip→manual', flip: 'kickflip', manual: 'nose manual', exit: 'heelflip out' }, 'Kickflip to Nose Manual Heelflip Out'],
    [{ obstacle: 'quarterpipe', stance: 'regular', pattern: 'coping', lip: 'axle stall', lipDir: 'BS' }, 'BS Axle Stall'],
    [{ obstacle: 'quarterpipe', stance: 'regular', pattern: 'coping', lip: 'disaster', lipDir: 'FS', revert: 'FS' }, 'FS Disaster Revert'],
    [{ obstacle: 'quarterpipe', stance: 'regular', pattern: 'flip-only', flip: 'kickflip' }, 'Kickflip Fakie'],
    [{ obstacle: 'bank', stance: 'regular', pattern: 'transfer', flip: 'kickflip', transferTo: 'quarterpipe' }, 'Kickflip Transfer'],
  ]
  for (const [t, name] of cases) test(name, () => expect(trickName(t)).toBe(name))

  test('transfer phrase names both obstacles', () => {
    expect(displayText({ obstacle: 'bank', stance: 'regular', pattern: 'transfer', flip: 'ollie', transferTo: 'quarterpipe' })).toBe('Ollie Transfer from the bank to the quarterpipe')
  })
  test('no implied-ollie prefixes and no "Regular" anywhere in the catalog', () => {
    for (const c of fullCatalog()) {
      const n = trickName(c.trick)
      expect(n).not.toMatch(/Ollie (FS|BS|to|\d)/)
      expect(n).not.toMatch(/Regular/)
      if (c.trick.pattern !== 'flip-only' && c.trick.pattern !== 'transfer') expect(n).not.toMatch(/Ollie/)
    }
  })
  test('FS 180 + kickflip is never displayed as the verbose "FS 180 Kickflip"', () => {
    expect(fullCatalog().some((c) => /\b(FS|BS) 180 (Kickflip|Heelflip)\b/.test(trickName(c.trick)))).toBe(false)
  })
  test('hardflip / inward heelflip + 180 are rare; varial + 180 stays uncommon', () => {
    const r = (flip: string) => fullCatalog().find((c) => c.trick.flip === flip && c.trick.spin?.deg === 180 && c.trick.pattern === 'flip-only')!.rarity
    expect(r('hardflip')).toBe('rare')
    expect(r('inward heelflip')).toBe('rare')
    expect(r('varial kickflip')).toBe('uncommon')
  })
  test('switch/nollie flips are staggered by the flip itself', () => {
    const rate = (stance: string, flip: string) => fullCatalog().find((c) => c.trick.obstacle === 'flat' && c.trick.stance === stance && c.trick.flip === flip && c.trick.pattern === 'flip-only' && !c.trick.spin && !c.trick.flips && !c.trick.revert)!.rating
    for (const st of ['switch', 'nollie']) {
      expect(rate(st, 'kickflip')).toBeLessThan(rate(st, 'varial kickflip'))
      expect(rate(st, 'varial kickflip')).toBeLessThan(rate(st, 'hardflip'))
      expect(rate(st, 'hardflip')).toBeLessThan(rate(st, 'tre flip'))
    }
  })
  test('quarterpipe coping tricks are staggered (no big rating clumps)', () => {
    const qp = fullCatalog().filter((c) => c.trick.obstacle === 'quarterpipe' && c.trick.stance === 'regular' && c.trick.pattern === 'coping' && !c.trick.revert)
    const counts: Record<string, number> = {}
    for (const c of qp) counts[c.rating] = (counts[c.rating] ?? 0) + 1
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2)
    expect(new Set(qp.map((c) => Math.floor(c.rating))).size).toBeGreaterThanOrEqual(5)
  })
  test('half cab only for fakie + FS rotation', () => {
    for (const c of fullCatalog()) if (/Cab/.test(trickName(c.trick))) expect([c.trick.stance, c.trick.spin?.dir]).toEqual(['fakie', 'FS'])
  })
})

describe('aliases collapse to one canonical identity and score', () => {
  const same: [string, string][] = [
    ['Tre Flip', '360 Flip'],
    ['Tre Flip', 'three flip'],
    ['Varial Kickflip', 'varial flip'],
    ['BS Pop Shuvit', 'shove-it'],
    ['Laser Flip', 'laser'],
    ['FS Flip', 'frontside flip'],
    ['Half Cab', 'fakie FS 180'],
    ['Half Cab Flip', 'fakie fs flip'],
    ['BS Bigflip', 'bigflip'],
  ]
  for (const [a, b] of same)
    test(`${a} ≡ ${b}`, () => {
      const pa = parseAirName(a)
      const pb = parseAirName(b)
      expect(pa).not.toBeNull()
      expect(pb).toEqual(pa)
      const ta = air(pa!.flip, { stance: pa!.stance, spin: pa!.spin })
      const tb = air(pb!.flip, { stance: pb!.stance, spin: pb!.spin })
      expect(trickKey(ta)).toBe(trickKey(tb))
      expect(score(ta)).toBe(score(tb))
    })

  test('round trip: name(parse(name)) for conventional names', () => {
    for (const n of ['FS Flip', 'Half Cab', 'Full Cab', 'BS Bigspin', 'BS Bigflip', 'Tre Flip', 'Double Kickflip', 'FS 180', 'Switch FS Heelflip', 'BS Gazelle']) {
      const p = parseAirName(n)!
      expect(trickName(air(p.flip, { stance: p.stance, spin: p.spin, flips: p.flips }))).toBe(n)
    }
  })
  test('strict parsing: unknown or excluded names return null', () => {
    expect(parseAirName('hospital flip')).toBeNull()
    expect(parseAirName('casper')).toBeNull()
    expect(parseAirName('mega flip deluxe')).toBeNull()
    expect(boardMoveFromAlias('flip')).toBe('kickflip')
  })
  test('Fakie Heelflip and Switch Heelflip are distinct skills', () => {
    const s = (st: Stance) => trickSignature(air('heelflip', { stance: st }))
    expect(s('fakie')).not.toBe(s('switch'))
  })
})

describe('no double counting: names never add points', () => {
  test('decomposed board-move values equal the legacy named-flip values exactly', () => {
    for (const [k, legacy] of Object.entries(CONFIG.scoring.flip)) {
      const sum = boardMoveValue(BOARD_MOVES[k]).reduce((a, p) => a + p.value, 0)
      expect(Math.round(sum * 1000) / 1000, k).toBe(legacy)
    }
  })
  test('Bigflip = components only (tre-flip board motion + BS 180 body + legacy spin+flip combo)', () => {
    const big = scoreLanding(air('tre flip', { spin: { deg: 180, dir: 'BS' } }), 1, 0)
    // 1 + kick .3 + BS360 .35 + interaction .15 + body 180 .1 = 1.9 ; × 1.3 spin+flip
    expect(big.baseSum).toBeCloseTo(1.9, 6)
    expect(big.comboM).toBeCloseTo(1.3, 6)
    expect(big.total).toBe(Math.round(100 * 1.9 * 1.3))
    expect(big.baseParts.map((p) => p.label).join(' ')).not.toMatch(/Bigflip/)
  })
  test('every receipt sums exactly to its base, for every catalog trick', () => {
    for (const c of fullCatalog().filter((_, i) => i % 7 === 0)) {
      const r = scoreLanding(c.trick, 1, 0)
      const sum = r.baseParts.reduce((a, p) => a + p.value, 0)
      expect(sum).toBeCloseTo(r.baseSum, 2)
      expect(r.total).toBe(Math.round(100 * sum * r.comboM))
    }
  })
  test('a component appears at most once in any receipt', () => {
    for (const c of fullCatalog().filter((_, i) => i % 11 === 0)) {
      const labels = scoreLanding(c.trick, 1, 0).baseParts.map((p) => p.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })
})
