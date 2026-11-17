import { describe, expect, test } from 'vitest'
import { KEYS, createStore, memoryStorage, passcodeOk, sanitizeInitials } from '../src/engine/persist'
import { DEFAULT_TUNABLES } from '../src/engine/tunables'
import { end, failChallenge, land, miss, newGame, next } from './helpers'

describe('persistence', () => {
  test('session round-trips through storage mid-attempt', () => {
    const mem = memoryStorage()
    const store = createStore(mem)
    let s = newGame()
    s = next(land(s))
    s = miss(s)
    store.saveSession(s)
    const restored = createStore(mem).loadSession()!
    expect(restored.current!.display).toBe(s.current!.display)
    expect(restored.current!.attempt).toBe(2)
    expect(restored.score).toBe(s.score)
    expect(restored.history).toHaveLength(1)
    expect(restored.rng).toBe(s.rng)
  })

  test('corrupt session is backed up, cleared and reported, app still boots', () => {
    const mem = memoryStorage()
    mem.setItem(KEYS.session, '{not json')
    mem.setItem(KEYS.settings, JSON.stringify({ v: 1, data: { level: 99, mode: 'weird', filters: { obstacles: ['flat', 'moon'] } } }))
    const store = createStore(mem, () => 123)
    expect(store.loadSession()).toBeNull()
    expect(store.issues[0].key).toBe(KEYS.session)
    expect(mem.getItem(`${KEYS.session}:corrupt:123`)).toBe('{not json')
    const settings = store.loadSettings()
    expect(settings.level).toBe(3)
    expect(settings.mode).toBe('skate')
    expect(settings.filters.obstacles).toEqual(['flat'])
  })

  test('wrong schema / invalid states are rejected', () => {
    const mem = memoryStorage()
    const s = newGame()
    mem.setItem(KEYS.session, JSON.stringify({ v: 1, data: { ...s, schema: 999 } }))
    expect(createStore(mem).loadSession()).toBeNull()
    mem.setItem(KEYS.session, JSON.stringify({ v: 1, data: { ...s, current: { ...s.current, attempt: 4 } } }))
    expect(createStore(mem).loadSession()).toBeNull()
  })

  test('finalize is idempotent; only completed runs get high scores', () => {
    const mem = memoryStorage()
    const store = createStore(mem)
    let s = newGame()
    s = next(land(s))
    for (let i = 0; i < 5; i++) s = failChallenge(s.status === 'result' ? next(s) : s)
    expect(s.endReason).toBe('skate')
    const r1 = store.finalize(s)
    const r2 = store.finalize(s)
    expect(r1.isNewBest).toBe(true)
    expect(r2.isNewBest).toBe(true)
    expect(store.loadHistory()).toHaveLength(1)
    // Nothing on the board until initials are entered
    expect(store.loadScores()).toHaveLength(0)
    expect(store.postScore(s.id, '')).toBeNull()
    store.postScore(s.id, 'h.n!x')
    store.postScore(s.id, 'hjn')
    expect(store.loadScores()).toHaveLength(1)
    expect(store.loadScores()[0]).toMatchObject({ board: 'skate', value: s.score, initials: 'HJN' })
    // Manually ended: history yes, high score no
    const e = end(next(land(newGame({ seed: 9 }))))
    store.finalize(e)
    expect(store.loadHistory()).toHaveLength(2)
    expect(store.loadHistory()[0].endReason).toBe('ended')
    expect(store.postScore(e.id, 'ABC')).toBeNull()
    expect(store.loadScores()).toHaveLength(1)
    // Removing a score keeps the history
    store.removeScore(s.id)
    expect(store.loadScores()).toHaveLength(0)
    expect(store.loadHistory()).toHaveLength(2)
  })

  test('initials and passcode helpers', () => {
    expect(sanitizeInitials('ab-cd')).toBe('ABC')
    expect(sanitizeInitials(42)).toBe('')
    expect(passcodeOk('Corndog')).toBe(true)
    expect(passcodeOk(' corndog ')).toBe(true)
    expect(passcodeOk('corn dog')).toBe(false)
    const mem = memoryStorage()
    mem.setItem(KEYS.settings, JSON.stringify({ v: 1, data: { soloLength: 5, initials: 'zz9top' } }))
    expect(createStore(mem).loadSettings()).toMatchObject({ soloLength: 5, initials: 'ZZ9' })
  })

  test('tunables: hard-locked AI / Stack Builder flags cannot be enabled from storage', () => {
    const mem = memoryStorage()
    mem.setItem(KEYS.tunables, JSON.stringify({ v: 1, data: { ...DEFAULT_TUNABLES, runtimeAiEnabled: true, nlStackBuilderEnabled: true, skipPenaltyPoints: 75 } }))
    const t = createStore(mem).loadTunables()
    expect(t.runtimeAiEnabled).toBe(false)
    expect(t.nlStackBuilderEnabled).toBe(false)
    expect(t.skipPenaltyPoints).toBe(75)
  })
})
