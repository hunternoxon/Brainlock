import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { flowMult, scoreLanding, skipReceipt } from '../src/engine/score'
import type { Trick } from '../src/engine/types'

const fixtures = JSON.parse(readFileSync('import/Brainlock_OpenCode_Handoff/tests/acceptance_cases.json', 'utf8'))

describe('golden scoring fixtures (tests/acceptance_cases.json)', () => {
  for (const c of fixtures.scoring) {
    test(c.name, () => {
      const t: Trick = { obstacle: c.input.obstacle, stance: c.input.stance, pattern: 'flip-only', flip: c.input.flip }
      expect(scoreLanding(t, c.input.attempt, c.input.flow).total).toBe(c.expectedPoints)
    })
  }
})

describe('score formula', () => {
  const grind = (grind: string, direction: 'FS' | 'BS'): Trick => ({ obstacle: 'ledge', stance: 'regular', pattern: 'grind-only', grind, direction })
  const pts = (t: Trick) => scoreLanding(t, 1, 0).total

  test('directional nuance: BS smith > FS smith, FS feeble > BS feeble, FS crook > BS crook, BS overcrook > FS overcrook', () => {
    expect(pts(grind('smith', 'BS'))).toBeGreaterThan(pts(grind('smith', 'FS')))
    expect(pts({ ...grind('feeble', 'FS'), obstacle: 'rail' })).toBeGreaterThan(pts({ ...grind('feeble', 'BS'), obstacle: 'rail' }))
    expect(pts(grind('crooked', 'FS'))).toBeGreaterThan(pts(grind('crooked', 'BS')))
    expect(pts(grind('overcrook', 'BS'))).toBeGreaterThan(pts(grind('overcrook', 'FS')))
  })

  test('receipt reconciles with the formula', () => {
    const t: Trick = { obstacle: 'rail', stance: 'switch', pattern: 'flip→grind', flip: 'kickflip', grind: 'smith', direction: 'BS' }
    const r = scoreLanding(t, 2, 3)
    const partsSum = r.baseParts.reduce((a, p) => a + p.value, 0)
    expect(partsSum).toBeCloseTo(r.baseSum, 2)
    // 1 + .25 switch + .3 kickflip + .6*1.2 smith + .45 rail = 2.72; ×1.25 combo ×.85 ×1.09 flow
    expect(r.baseSum).toBeCloseTo(2.72, 3)
    expect(r.comboM).toBe(1.25)
    expect(r.attemptM).toBe(0.85)
    expect(r.flowM).toBeCloseTo(1.09, 5)
    expect(r.total).toBe(Math.round(100 * 2.72 * 1.25 * 0.85 * 1.09))
  })

  test('combo multipliers stack multiplicatively (spin+flip on gap)', () => {
    const t: Trick = { obstacle: 'gap', stance: 'regular', pattern: 'flip-only', flip: 'kickflip', spin: { deg: 180, dir: 'BS' } }
    const r = scoreLanding(t, 1, 0)
    expect(r.combos.map((c) => c.mult)).toEqual([1.3, 1.1])
    expect(r.comboM).toBeCloseTo(1.43, 5)
  })

  test('flow +3% steps, capped at +15%', () => {
    expect([0, 1, 2, 5, 6, 20].map(flowMult).map((x) => Math.round(x * 100) / 100)).toEqual([1, 1.03, 1.06, 1.15, 1.15, 1.15])
  })

  test('repeat penalty never hits game-assigned tricks, even when enabled', () => {
    const t: Trick = { obstacle: 'flat', stance: 'regular', pattern: 'flip-only', flip: 'kickflip' }
    expect(scoreLanding(t, 1, 0, { priorLands: 5 }).repeatM).toBe(1)
    expect(scoreLanding(t, 1, 0, { priorLands: 5, repeatPenaltyEnabled: true }).repeatM).toBe(1)
    expect(scoreLanding(t, 1, 0, { priorLands: 5, repeatPenaltyEnabled: true }).repeatNote).toMatch(/game-assigned/)
    // Legacy semantics kept for future player-chosen tricks
    expect(scoreLanding(t, 1, 0, { priorLands: 2, repeatPenaltyEnabled: true, playerChosen: true }).repeatM).toBe(1)
    expect(scoreLanding(t, 1, 0, { priorLands: 4, repeatPenaltyEnabled: true, playerChosen: true }).repeatM).toBeCloseTo(0.8)
  })

  test('skip penalty: configurable, floored at 0, disable-able', () => {
    expect(skipReceipt(500, true, 50, true).skipDelta).toBe(-50)
    expect(skipReceipt(20, true, 50, true).skipDelta).toBe(-20)
    expect(skipReceipt(0, true, 50, true).skipDelta).toBe(-0)
    expect(skipReceipt(20, true, 50, false).skipDelta).toBe(-50)
    expect(skipReceipt(500, false, 50, true).skipDelta).toBe(-0)
    expect(skipReceipt(500, true, 120, true).skipDelta).toBe(-120)
  })
})
