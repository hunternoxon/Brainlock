import { defaultFilters } from '../src/engine/catalog'
import { reduce, startSession, type GameState, type Mode, type SoloLength } from '../src/engine/game'
import { Rng } from '../src/engine/rng'
import { recentOf, selectChallenge, type RecentPick } from '../src/engine/select'
import { DEFAULT_TUNABLES, type Tunables } from '../src/engine/tunables'
import type { Filters, RatedTrick } from '../src/engine/types'

export function newGame(o: Partial<{ mode: Mode; soloLength: SoloLength; level: number; seed: number; filters: Filters; tunables: Partial<Tunables> }> = {}): GameState {
  return startSession({
    mode: o.mode ?? 'skate',
    soloLength: o.soloLength ?? 10,
    filters: o.filters ?? defaultFilters(),
    startLevel: o.level ?? 4,
    tunables: { ...DEFAULT_TUNABLES, ...o.tunables },
    seed: o.seed ?? 42,
    at: 1_700_000_000_000,
  })
}

let clock = 1_700_000_000_000
const at = () => (clock += 1000)

export const land = (s: GameState) => reduce(s, { type: 'land', challengeId: s.current!.id, at: at() })
export const miss = (s: GameState) => reduce(s, { type: 'miss', challengeId: s.current!.id, at: at() })
export const skip = (s: GameState) => reduce(s, { type: 'skip', challengeId: s.current!.id, at: at() })
export const next = (s: GameState) => reduce(s, { type: 'next', at: at() })
export const end = (s: GameState) => reduce(s, { type: 'end', at: at() })
export const failChallenge = (s: GameState) => miss(miss(miss(s)))

/** JSON round-trip, as a reload through localStorage would do */
export const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s))

/** Seeded selector run (no game state), for distribution/property tests */
export function run(filters: Filters, level: number, n: number, seed = 7, tun = DEFAULT_TUNABLES): RatedTrick[] {
  const rng = new Rng(seed)
  const recent: RecentPick[] = []
  const out: RatedTrick[] = []
  for (let i = 0; i < n; i++) {
    const r = selectChallenge({ filters, skill: level, recent, rng, tun })
    if (!r.ok) throw new Error('empty pool: ' + r.diagnosis.messages.join(' '))
    out.push(r.pick)
    recent.push(recentOf(r.pick))
  }
  return out
}
