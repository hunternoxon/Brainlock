import { describe, expect, test } from 'vitest'
import { defaultFilters } from '../src/engine/catalog'
import { activePlayer, alivePlayers, matchAct, matchEnd, matchNext, startMatch, type MatchState } from '../src/engine/match'
import { DEFAULT_TUNABLES } from '../src/engine/tunables'

let clock = 1
const at = () => ++clock
const mk = (o: Partial<{ mode: 'skate' | 'solo'; soloLength: 10 | 25 | 50; shared: boolean; n: number; levels: number[] }> = {}) =>
  startMatch({
    mode: o.mode ?? 'skate',
    soloLength: o.soloLength ?? 10,
    filters: defaultFilters(),
    tunables: DEFAULT_TUNABLES,
    players: Array.from({ length: o.n ?? 2 }, (_, i) => ({ name: `P${i + 1}`, level: o.levels?.[i] ?? 4 })),
    shared: o.shared ?? true,
    seed: 99,
    at: 0,
  })
const act = (m: MatchState, type: 'land' | 'miss' | 'skip') => matchAct(m, { type, challengeId: activePlayer(m).session.current!.id, at: at() })
const fail = (m: MatchState) => act(act(act(m, 'miss'), 'miss'), 'miss')

describe('local multiplayer', () => {
  test('turns rotate and shared rounds give everyone the same trick', () => {
    let m = mk({ n: 3 })
    expect(m.turn).toBe(0)
    const trick = activePlayer(m).session.current!.display
    m = matchNext(act(m, 'land'), at())
    expect(m.turn).toBe(1)
    expect(activePlayer(m).session.current!.display).toBe(trick)
    m = matchNext(act(m, 'land'), at())
    expect(activePlayer(m).session.current!.display).toBe(trick)
    m = matchNext(act(m, 'land'), at())
    expect(m.turn).toBe(0)
    expect(m.round).toBe(2)
  })
  test('own-level mode: each player gets tricks matched to their own level', () => {
    let m = mk({ shared: false, levels: [2, 9] })
    const r1 = activePlayer(m).session.current!.rating
    m = matchNext(act(m, 'land'), at())
    const r2 = activePlayer(m).session.current!.rating
    expect(r2).toBeGreaterThan(r1 + 3)
  })
  test('Next does nothing before the active player resolves', () => {
    const m = mk()
    expect(matchNext(m, at())).toBe(m)
  })
  test('SKATE: S-K-A-T-E knocks a player out; last one standing wins', () => {
    let m = mk({ n: 3 })
    // P1 fails every trick, P2 and P3 land; then P2 fails out too
    for (let r = 0; r < 5; r++) {
      m = matchNext(fail(m), at()) // P1
      m = matchNext(act(m, 'land'), at()) // P2
      m = matchNext(act(m, 'land'), at()) // P3
    }
    expect(m.players[0].session.endReason).toBe('skate')
    expect(alivePlayers(m)).toHaveLength(2)
    expect(activePlayer(m).id).toBe('p2') // P1 is skipped
    for (let r = 0; r < 5 && m.status === 'playing'; r++) {
      m = matchNext(fail(m), at()) // P2
      if (m.status === 'playing') m = matchNext(act(m, 'land'), at()) // P3
    }
    expect(m.status).toBe('over')
    expect(m.winners).toEqual(['p3'])
    expect(m.endReason).toBe('won')
  })
  test('Marathon: everyone plays exactly N; highest score wins', () => {
    let m = mk({ mode: 'solo', soloLength: 10 })
    let turns = 0
    while (m.status === 'playing' && turns < 100) {
      m = activePlayer(m).id === 'p1' ? act(m, 'land') : fail(m)
      m = matchNext(m, at())
      turns++
    }
    expect(turns).toBe(20)
    expect(m.players.every((p) => p.session.history.length === 10)).toBe(true)
    expect(m.winners).toEqual(['p1'])
  })
  test('ending early closes all sessions, records standings', () => {
    let m = matchNext(act(mk(), 'land'), at())
    m = matchEnd(m, at())
    expect(m.status).toBe('over')
    expect(m.endReason).toBe('ended')
    expect(m.players.every((p) => p.session.status === 'over')).toBe(true)
    expect(m.winners).toEqual(['p1'])
  })
  test('survives a JSON round-trip mid-turn', () => {
    let m = act(matchNext(act(mk(), 'land'), at()), 'miss')
    const r: MatchState = JSON.parse(JSON.stringify(m))
    expect(activePlayer(r).session.current!.attempt).toBe(2)
    expect(matchNext(act(r, 'land'), at()).turn).toBe(0)
  })
})
