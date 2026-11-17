import { describe, expect, test } from 'vitest'
import { reduce, type GameState } from '../src/engine/game'
import { computeLongTermSkill, type LearnableSession } from '../src/engine/learning'
import { createStore, memoryStorage } from '../src/engine/persist'
import { DEFAULT_TUNABLES as T } from '../src/engine/tunables'
import { end, failChallenge, land, newGame, next } from './helpers'

/** Play n challenges with a fixed outcome pattern; returns the state at the result screen of the last one. */
function play(s: GameState, outcomes: ('L1' | 'F')[]): GameState {
  for (const o of outcomes) {
    if (s.status === 'result') s = next(s)
    s = o === 'L1' ? land(s) : failChallenge(s)
  }
  return s
}

describe('in-session challenge: hot streak and recovery', () => {
  test('a level-6 hot streak reaches 7–8 challenges, never 9+', () => {
    let s = newGame({ level: 6, mode: 'solo', soloLength: 50, seed: 2 })
    let maxRating = 0
    let maxCap = 0
    for (let i = 0; i < 30; i++) {
      maxRating = Math.max(maxRating, s.current!.rating)
      maxCap = Math.max(maxCap, s.current!.selection.maxRating)
      s = next(land(s))
    }
    expect(s.boost).toBeGreaterThan(0)
    expect(s.boost).toBeLessThanOrEqual(T.maxBoost)
    expect(maxRating).toBeGreaterThanOrEqual(7)
    // Skill itself rises during the run, but each pick stays within skill + 2 levels
    for (const c of s.history) expect(c.rating - c.skillAtStart).toBeLessThanOrEqual(T.maxStretch + T.maxBoost + 1e-9)
    expect(s.history.slice(0, 12).every((c) => c.rating < 9)).toBe(true)
    void maxCap
  })
  test('boost collapses after a failed challenge', () => {
    let s = newGame({ level: 5, seed: 3 })
    s = play(s, ['L1', 'L1', 'L1', 'L1'])
    expect(s.boost).toBeGreaterThan(0)
    s = play(s, ['F'])
    expect(s.boost).toBe(0)
  })
  test('after repeated fails, a modestly easier recovery challenge is offered (no pity points)', () => {
    let s = newGame({ level: 6, seed: 4, mode: 'solo', soloLength: 25 })
    s = play(s, ['F', 'F'])
    s = next(s)
    expect(s.current!.selection.mix).toBe('recovery')
    expect(s.current!.selection.target).toBeLessThan(s.skill.effective)
    // Score is the normal formula for whatever was assigned
    const t = land(s)
    expect(t.current!.receipt!.kind).toBe('landed')
    // Cooldown: not every following pick is a recovery
    let r = 0
    let x = next(t)
    for (let i = 0; i < 3; i++) {
      if (x.current!.selection.mix === 'recovery') r++
      x = next(land(x))
    }
    expect(r).toBe(0)
  })
})

describe('too easy / too hard', () => {
  test('bounded effect with cooldown: repeated taps cannot game the model', () => {
    let s = newGame({ level: 5, seed: 5 })
    s = land(s)
    const before = s.skill.effective
    s = reduce(s, { type: 'feedback', challengeId: s.current!.id, value: 'too-easy', at: 1 })
    expect(s.current!.feedback!.accepted).toBe(true)
    expect(s.skill.effective - before).toBeCloseTo(T.feedbackSkillStep, 5)
    // Second tap on the same challenge: ignored
    const again = reduce(s, { type: 'feedback', challengeId: s.current!.id, value: 'too-easy', at: 2 })
    expect(again).toBe(s)
    // Next challenge, inside cooldown: recorded but no effect
    s = land(next(s))
    const mid = s.skill.effective
    s = reduce(s, { type: 'feedback', challengeId: s.current!.id, value: 'too-easy', at: 3 })
    expect(s.current!.feedback!.accepted).toBe(false)
    expect(s.skill.effective).toBe(mid)
  })
  test('feedback only on a result screen and never changes legality', () => {
    const s = newGame({ level: 5, seed: 6 })
    expect(reduce(s, { type: 'feedback', challengeId: s.current!.id, value: 'too-hard', at: 1 })).toBe(s)
  })
})

describe('long-term learning', () => {
  const completed = (seed: number, outcomes: ('L1' | 'F')[], level = 4): GameState => {
    let s = newGame({ level, seed, mode: 'solo', soloLength: 10 })
    s = play(s, outcomes)
    while (s.status !== 'over') s = s.status === 'result' ? next(s) : land(s)
    return s
  }
  const entry = (s: GameState, at: number): LearnableSession => ({ id: s.id, endReason: s.endReason!, startLevel: s.startLevel, startedAt: at, session: s })

  test('only completed sessions train long-term skill; ended-early/abandoned do not', () => {
    const good = completed(1, Array(10).fill('L1'))
    const ended = end(play(newGame({ level: 4, seed: 2 }), Array(6).fill('L1')))
    const abandoned = { ...end(play(newGame({ level: 4, seed: 3 }), Array(6).fill('L1'))), endReason: 'abandoned' as const }
    const r = computeLongTermSkill([entry(good, 1), entry(ended, 2), entry(abandoned, 3)], 4, 0, T)
    expect(r.used).toEqual([good.id])
    expect(r.excluded.map((e) => e.why).sort()).toEqual(['abandoned', 'ended early'])
    expect(r.skill.effective).toBeGreaterThan(4)
    const onlyUnfinished = computeLongTermSkill([entry(ended, 2), entry(abandoned, 3)], 4, 0, T)
    expect(onlyUnfinished.skill.effective).toBe(4)
  })

  test('forgetting a completed session (with reason) removes its influence after recompute', () => {
    const mem = memoryStorage()
    const store = createStore(mem)
    const a = completed(10, Array(10).fill('L1'))
    const b = completed(11, Array(10).fill('F'))
    store.finalize(a)
    store.finalize(b)
    const both = computeLongTermSkill(store.loadHistory(), 4, 0, T).skill.effective
    expect(() => store.forgetSession(b.id, '', undefined, false)).toThrow()
    store.forgetSession(b.id, 'Injury / off day', 'jammed finger', false)
    const h = store.loadHistory()
    expect(h).toHaveLength(2) // history kept
    expect(h.find((x) => x.id === b.id)!.forgotten).toMatchObject({ reason: 'Injury / off day', note: 'jammed finger' })
    expect(store.loadScores().some((x) => x.sessionId === b.id)).toBe(true) // score kept
    const without = computeLongTermSkill(h, 4, 0, T)
    const onlyA = computeLongTermSkill([store.loadHistory().find((x) => x.id === a.id)!], 4, 0, T)
    expect(without.skill.effective).toBe(onlyA.skill.effective) // no stale influence
    expect(without.skill.effective).toBeGreaterThan(both)
    store.unforgetSession(b.id)
    expect(computeLongTermSkill(store.loadHistory(), 4, 0, T).skill.effective).toBe(both)
  })

  test('forget + delete removes history and score only when explicitly chosen', () => {
    const store = createStore(memoryStorage())
    const a = completed(12, Array(10).fill('L1'))
    store.finalize(a)
    store.forgetSession(a.id, 'Accidental taps', undefined, true)
    expect(store.loadHistory()).toHaveLength(0)
    expect(store.loadScores()).toHaveLength(0)
  })

  test('reset-to-level ignores earlier sessions; other start levels are separate', () => {
    const a = completed(13, Array(10).fill('L1'))
    expect(computeLongTermSkill([entry(a, 100)], 4, 200, T).skill.effective).toBe(4)
    expect(computeLongTermSkill([entry(a, 100)], 6, 0, T).skill.effective).toBe(6)
  })
})
