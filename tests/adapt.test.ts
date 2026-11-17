import { describe, expect, test } from 'vitest'
import { anchorSkill, updateSkill, type Resolution, type SkillState } from '../src/engine/adapt'
import { DEFAULT_TUNABLES as T } from '../src/engine/tunables'
import { failChallenge, land, newGame, next } from './helpers'

const run = (s: SkillState, rs: Resolution[], rating?: number) => {
  const path: number[] = [s.effective]
  for (const r of rs) {
    s = updateSkill(s, r, rating ?? s.effective, T).skill
    path.push(s.effective)
  }
  return { s, path }
}
const L1 = { outcome: 'landed', attempt: 1 } as const
const L3 = { outcome: 'landed', attempt: 3 } as const
const F = { outcome: 'failed' } as const

describe('adaptive skill', () => {
  test('many first-try lands → gradual rise (not a jump)', () => {
    const { s, path } = run(anchorSkill(4), Array(10).fill(L1))
    expect(s.effective).toBeGreaterThan(4.3)
    expect(s.effective).toBeLessThan(5.0)
    for (let i = 1; i < path.length; i++) expect(path[i] - path[i - 1]).toBeLessThanOrEqual(T.adaptationStepLimit + 1e-9)
  })
  test('many failed challenges → gradual fall', () => {
    const { s } = run(anchorSkill(6), Array(10).fill(F))
    expect(s.effective).toBeLessThan(5.7)
    expect(s.effective).toBeGreaterThan(5.0)
  })
  test('one land cannot move more than a fraction of a level', () => {
    const { s } = run(anchorSkill(5), [L1], 7)
    expect(s.effective - 5).toBeGreaterThan(0)
    expect(s.effective - 5).toBeLessThan(0.05)
  })
  test('bounded to [1,10]', () => {
    expect(run(anchorSkill(10), Array(60).fill(L1)).s.effective).toBe(10)
    expect(run(anchorSkill(1), Array(60).fill(F)).s.effective).toBe(1)
  })
  test('third-attempt land is weaker evidence than first-attempt land', () => {
    expect(run(anchorSkill(5), Array(6).fill(L3)).s.effective).toBeLessThan(run(anchorSkill(5), Array(6).fill(L1)).s.effective)
  })
  test('landing a stretch counts more than landing an easy trick', () => {
    const easy = updateSkill(anchorSkill(5), L1, 4, T).update.evidence
    const hard = updateSkill(anchorSkill(5), L1, 6, T).update.evidence
    expect(hard).toBeGreaterThan(easy)
  })
  test('failing an easy trick hurts more than failing a stretch', () => {
    const easy = updateSkill(anchorSkill(5), F, 4, T).update.evidence
    const hard = updateSkill(anchorSkill(5), F, 6, T).update.evidence
    expect(easy).toBeLessThan(hard)
  })
  test('moves both directions within one run (up then down)', () => {
    const { path } = run(anchorSkill(5), [...Array(10).fill(L1), ...Array(14).fill(F)])
    const peak = Math.max(...path)
    expect(peak).toBeGreaterThan(5.2)
    expect(path.at(-1)!).toBeLessThan(peak - 0.3)
  })
  test('adaptation off → never moves', () => {
    let s = anchorSkill(5)
    for (let i = 0; i < 10; i++) s = updateSkill(s, L1, 5, { ...T, adaptiveDifficultyEnabled: false }).skill
    expect(s.effective).toBe(5)
  })
  test('every resolved challenge logs target before/after and a reason', () => {
    let g = newGame({ level: 4 })
    g = next(land(g))
    g = failChallenge(g)
    const u = g.current!.skill!
    expect(u.reason).toMatch(/three misses/)
    expect(typeof u.before).toBe('number')
    expect(g.history[0].skill!.after).toBeGreaterThan(g.history[0].skill!.before)
    expect(g.current!.selection.target).toBeTypeOf('number')
  })
  test('adapted skill feeds generation: higher skill → harder tricks', () => {
    let lo = newGame({ level: 2, seed: 1, mode: 'solo', soloLength: 50 })
    let hi = newGame({ level: 8, seed: 1, mode: 'solo', soloLength: 50 })
    let sumLo = 0
    let sumHi = 0
    for (let i = 0; i < 20; i++) {
      sumLo += lo.current!.rating
      sumHi += hi.current!.rating
      lo = next(land(lo))
      hi = next(land(hi))
    }
    expect(sumHi / 20).toBeGreaterThan(sumLo / 20 + 4)
  })
})
