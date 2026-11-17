import { describe, expect, test } from 'vitest'
import { reduce, sessionStats, type GameState } from '../src/engine/game'
import { scoreLanding } from '../src/engine/score'
import { end, failChallenge, land, miss, newGame, next, reload, skip } from './helpers'

describe('attempt lifecycle', () => {
  test('land on attempt 2 → single award, result state until Next', () => {
    let s = newGame()
    s = miss(s)
    expect(s.status).toBe('playing')
    expect(s.current!.attempt).toBe(2)
    const expected = scoreLanding(s.current!.trick, 2, 0).total
    s = land(s)
    expect(s.status).toBe('result')
    expect(s.score).toBe(expected)
    expect(s.current!.receipt).toMatchObject({ kind: 'landed', attemptM: 0.85, total: expected })
    // Double tap / stale actions do nothing
    const again = land(s)
    expect(again).toBe(s)
    expect(miss(s)).toBe(s)
    expect(skip(s)).toBe(s)
    // Stays on result until Next
    const id = s.current!.id
    s = next(s)
    expect(s.status).toBe('playing')
    expect(s.current!.id).not.toBe(id)
    expect(s.current!.attempt).toBe(1)
  })

  test('stale challengeId is ignored', () => {
    const s = newGame()
    expect(reduce(s, { type: 'land', challengeId: 'old', at: 1 })).toBe(s)
  })

  test('Next does nothing while playing', () => {
    const s = newGame()
    expect(next(s)).toBe(s)
  })

  test('3 misses in SKATE → exactly one letter + result (not auto-next)', () => {
    let s = newGame()
    s = failChallenge(s)
    expect(s.status).toBe('result')
    expect(s.letters).toBe(1)
    expect(s.current!.letter).toBe('S')
    expect(s.current!.outcome).toBe('failed')
    expect(s.score).toBe(0)
    expect(miss(s).letters).toBe(1)
  })

  test('5 SKATE letters → session over immediately, no extra trick', () => {
    let s = newGame()
    for (let i = 0; i < 4; i++) s = next(failChallenge(s))
    expect(s.letters).toBe(4)
    s = failChallenge(s)
    expect(s.status).toBe('over')
    expect(s.endReason).toBe('skate')
    expect(s.letters).toBe(5)
    expect(s.history).toHaveLength(5)
    expect(next(s)).toBe(s)
    expect(s.history.map((c) => c.letter).join('')).toBe('SKATE')
  })

  test('skip → configurable penalty, result + Next, no letter, streak cleared', () => {
    let s = newGame()
    s = next(land(s))
    s = next(land(s))
    const before = s.score
    expect(s.flow).toBe(2)
    s = skip(s)
    expect(s.status).toBe('result')
    expect(s.letters).toBe(0)
    expect(s.flow).toBe(0)
    expect(s.score).toBe(before - 50)
    expect(s.current!.outcome).toBe('skipped')
    expect(s.current!.receipt).toMatchObject({ kind: 'skipped', skipDelta: -50, provisional: true })
  })

  test('skip penalty tunable: 120 points, and floored at zero', () => {
    let s = newGame({ tunables: { skipPenaltyPoints: 120 } })
    s = skip(s)
    expect(s.score).toBe(0)
    expect(s.current!.delta).toBe(-0)
    s = next(s)
    s = reduce(s, { type: 'tune', tunables: { ...s.tunables, skipPenaltyEnabled: false }, at: 1 })
    s = next(land(s))
    const before = s.score
    expect(skip(s).score).toBe(before)
  })

  test('flow: consecutive lands +3%; any miss breaks it (provisional rule)', () => {
    let s = newGame()
    s = next(land(s))
    s = next(land(s))
    expect(s.history[1].receipt).toMatchObject({ flowCount: 1, flowM: 1.03 })
    s = miss(s)
    expect(s.flow).toBe(0)
    s = land(s)
    expect(s.current!.receipt).toMatchObject({ flowCount: 0, flowM: 1 })
  })

  test('flow reset rule switchable to failed-challenge only', () => {
    let s = newGame({ tunables: { flowResetOn: 'failed-challenge' } })
    s = next(land(s))
    s = miss(s)
    s = land(s)
    expect(s.current!.receipt).toMatchObject({ flowCount: 1 })
  })

  test('manual end → distinct status, unresolved challenge recorded as abandoned', () => {
    let s = newGame()
    s = next(land(s))
    s = miss(s)
    s = end(s)
    expect(s.status).toBe('over')
    expect(s.endReason).toBe('ended')
    expect(s.history.at(-1)!.outcome).toBe('abandoned')
  })
})

describe('Solo lengths', () => {
  for (const n of [10, 25, 50] as const) {
    test(`Solo ${n} ends after exactly ${n} resolved challenges (mixed land/fail/skip)`, () => {
      let s = newGame({ mode: 'solo', soloLength: n, seed: n })
      let i = 0
      while (s.status !== 'over') {
        expect(s.status).toBe('playing')
        s = i % 3 === 0 ? land(s) : i % 3 === 1 ? failChallenge(s) : skip(s)
        expect(s.status).toBe('result')
        s = next(s)
        i++
        if (i > 100) throw new Error('runaway')
      }
      expect(i).toBe(n)
      expect(s.endReason).toBe('solo-complete')
      expect(s.history).toHaveLength(n)
      expect(s.letters).toBe(0)
    })
  }
})

describe('reload / resume', () => {
  test('reload after first miss → same trick and attempt 2, continues identically', () => {
    let s = newGame({ seed: 5 })
    s = next(land(s))
    s = miss(s)
    const r = reload(s)
    expect(r.current!.display).toBe(s.current!.display)
    expect(r.current!.attempt).toBe(2)
    expect(r.score).toBe(s.score)
    expect(r.flow).toBe(s.flow)
    expect(r.rng).toBe(s.rng)
    // Same future after reload (RNG state persisted)
    const a = next(land(s))
    const b = next(land(r))
    expect(b.current!.display).toBe(a.current!.display)
    expect(b.score).toBe(a.score)
  })

  test('reload on result screen does not re-award', () => {
    let s = land(newGame())
    const score = s.score
    s = reload(s)
    expect(land(s).score).toBe(score)
    expect(next(s).score).toBe(score)
  })
})

describe('integration: full seeded sessions', () => {
  function play(s: GameState, outcome: (i: number) => 'land1' | 'land2' | 'land3' | 'fail' | 'skip') {
    let i = 0
    let total = 0
    while (s.status !== 'over' && i < 500) {
      const o = outcome(i++)
      if (o === 'land2') s = miss(s)
      if (o === 'land3') s = miss(miss(s))
      s = o === 'fail' ? failChallenge(s) : o === 'skip' ? skip(s) : land(s)
      total += s.current!.delta ?? 0
      if (s.status === 'result') s = next(s)
    }
    return { s, total }
  }

  test('SKATE session to S-K-A-T-E; score equals sum of receipts', () => {
    const seq = ['land1', 'land2', 'fail', 'land1', 'skip', 'fail', 'land3', 'fail', 'land1', 'fail', 'land1', 'fail'] as const
    const { s, total } = play(newGame({ seed: 11, level: 5 }), (i) => seq[i % seq.length])
    expect(s.endReason).toBe('skate')
    expect(s.letters).toBe(5)
    expect(s.score).toBe(Math.max(0, total))
    const st = sessionStats(s)
    expect(st.failed).toBe(5)
    expect(s.history.every((c) => c.receipt)).toBe(true)
    expect(s.events.filter((e) => e.type === 'generate')).toHaveLength(s.history.length)
  })

  test('Solo 25 session with seeded outcomes is deterministic', () => {
    const outcome = (i: number) => (['land1', 'land2', 'fail', 'land1', 'skip'] as const)[(i * 7) % 5]
    const a = play(newGame({ mode: 'solo', soloLength: 25, seed: 3 }), outcome).s
    const b = play(newGame({ mode: 'solo', soloLength: 25, seed: 3 }), outcome).s
    expect(a.history.map((c) => c.display)).toEqual(b.history.map((c) => c.display))
    expect(a.score).toBe(b.score)
    expect(a.history).toHaveLength(25)
  })

  test('no consecutive identical prompts across a long session', () => {
    const { s } = play(newGame({ mode: 'solo', soloLength: 50, seed: 8, level: 2 }), () => 'land1')
    for (let i = 1; i < s.history.length; i++) expect(s.history[i].key).not.toBe(s.history[i - 1].key)
  })

  test('blocked start with impossible filters, then explicit stretch override', () => {
    let s = newGame({ level: 1, filters: { ...newGame().filters, obstacles: ['handrail'] } })
    expect(s.status).toBe('blocked')
    expect(s.current).toBeNull()
    expect(s.blocked!.messages.length).toBeGreaterThan(0)
    s = reduce(s, { type: 'allowStretch', at: 1 })
    expect(s.status).toBe('playing')
    expect(s.current!.trick.obstacle).toBe('handrail')
  })
})
