/**
 * Local pass-and-play multiplayer (2–4 players, one device). Each player has a
 * normal GameState session (same rules, scoring, receipts, adaptation); the
 * match only orchestrates turns. No network.
 *
 * SKATE: players take turns; three misses = a letter; S-K-A-T-E = out; last one standing wins.
 * Marathon: everyone plays the same number of challenges in turn; highest score wins.
 * Shared tricks (default on): each round, every player gets the same trick, picked
 * for the average level of the players still in.
 */
import { gateLevelOf } from './adapt'
import { reduce, startSession, type Action, type GameState, type Mode, type SoloLength } from './game'
import { Rng } from './rng'
import { recentOf, selectChallenge, type RecentPick } from './select'
import type { Tunables } from './tunables'
import type { Filters, RatedTrick } from './types'

export const MATCH_SCHEMA = 1
export const MAX_PLAYERS = 4

export interface MatchPlayer {
  id: string
  name: string
  level: number
  session: GameState
}

export interface MatchState {
  schema: number
  id: string
  mode: Mode
  soloLength: SoloLength
  shared: boolean
  players: MatchPlayer[]
  turn: number
  round: number
  rng: number
  recent: RecentPick[]
  roundPick: RatedTrick | null
  status: 'playing' | 'over'
  endReason?: 'won' | 'ended'
  winners: string[]
  startedAt: number
  updatedAt: number
  endedAt?: number
}

export interface MatchSetup {
  mode: Mode
  soloLength: SoloLength
  filters: Filters
  tunables: Tunables
  players: { name: string; level: number }[]
  shared: boolean
  seed: number
  at: number
}

export type TurnAction = Extract<Action, { type: 'land' | 'miss' | 'skip' | 'feedback' | 'allowStretch' }>

const isOut = (p: MatchPlayer) => p.session.status === 'over'
export const alivePlayers = (m: MatchState) => m.players.filter((p) => !isOut(p))
export const activePlayer = (m: MatchState) => m.players[m.turn]

export function startMatch(o: MatchSetup): MatchState {
  if (o.players.length < 2 || o.players.length > MAX_PLAYERS) throw new Error('Multiplayer needs 2–4 players')
  const players: MatchPlayer[] = o.players.map((p, i) => ({
    id: `p${i + 1}`,
    name: p.name.trim() || `Player ${i + 1}`,
    level: p.level,
    session: startSession({
      mode: o.mode,
      soloLength: o.soloLength,
      filters: o.filters,
      startLevel: p.level,
      tunables: o.tunables,
      seed: (o.seed + i * 7919) >>> 0,
      at: o.at,
      deferFirst: true,
    }),
  }))
  const m: MatchState = {
    schema: MATCH_SCHEMA,
    id: `m${o.at.toString(36)}-${(o.seed >>> 0).toString(36)}`,
    mode: o.mode,
    soloLength: o.soloLength,
    shared: o.shared,
    players,
    turn: 0,
    round: 1,
    rng: o.seed >>> 0,
    recent: [],
    roundPick: null,
    status: 'playing',
    winners: [],
    startedAt: o.at,
    updatedAt: o.at,
  }
  return beginTurn(m, 0, o.at)
}

function withPlayer(m: MatchState, i: number, session: GameState): MatchState {
  return { ...m, players: m.players.map((p, j) => (j === i ? { ...p, session } : p)) }
}

/** Start player i's turn (shared trick picked once per round). */
function beginTurn(m: MatchState, i: number, at: number): MatchState {
  let next = { ...m, turn: i, updatedAt: at }
  let pick: RatedTrick | undefined
  if (m.shared) {
    if (!next.roundPick) {
      const alive = alivePlayers(next)
      const skill = alive.reduce((a, p) => a + p.session.skill.effective, 0) / Math.max(1, alive.length)
      const rng = new Rng(next.rng)
      const res = selectChallenge({ filters: m.players[i].session.filters, skill, recent: next.recent, rng, tun: m.players[i].session.tunables })
      next = { ...next, rng: rng.state }
      // If no shared trick fits, players fall back to their own picks (and their own diagnostics)
      if (res.ok) next = { ...next, roundPick: res.pick, recent: [...next.recent, recentOf(res.pick)].slice(-50) }
    }
    pick = next.roundPick ?? undefined
  }
  return withPlayer(next, i, reduce(next.players[i].session, { type: 'assign', pick, at }))
}

/** Land / Miss / Skip / feedback for the active player. */
export function matchAct(m: MatchState, a: TurnAction): MatchState {
  if (m.status !== 'playing') return m
  const p = activePlayer(m)
  const s = reduce(p.session, a)
  if (s === p.session) return m
  return { ...withPlayer(m, m.turn, s), updatedAt: a.at }
}

/** Ranking: SKATE = still in, then fewer letters, then score. Marathon = score. */
export function standings(m: MatchState): MatchPlayer[] {
  return [...m.players].sort((a, b) => {
    if (m.mode === 'skate') {
      const outA = a.session.endReason === 'skate' ? 1 : 0
      const outB = b.session.endReason === 'skate' ? 1 : 0
      if (outA !== outB) return outA - outB
      if (a.session.letters !== b.session.letters) return a.session.letters - b.session.letters
    }
    return b.session.score - a.session.score
  })
}

function topGroup(m: MatchState): string[] {
  const s = standings(m)
  const first = s[0]
  const same = (p: MatchPlayer) =>
    m.mode === 'skate'
      ? (p.session.endReason === 'skate') === (first.session.endReason === 'skate') && p.session.letters === first.session.letters && p.session.score === first.session.score
      : p.session.score === first.session.score
  return s.filter(same).map((p) => p.id)
}

function finish(m: MatchState, at: number, reason: 'won' | 'ended'): MatchState {
  // Close any unfinished player sessions (their records stay in the match)
  const players = m.players.map((p) => (p.session.status === 'over' ? p : { ...p, session: reduce(p.session, { type: 'end', at }) }))
  const done = { ...m, players }
  return { ...done, status: 'over', endReason: reason, endedAt: at, updatedAt: at, winners: reason === 'won' && m.mode === 'skate' ? alivePlayers(m).map((p) => p.id) : topGroup(done) }
}

/** Next: park the active player's result, then hand over to the next player still in. */
export function matchNext(m: MatchState, at: number): MatchState {
  if (m.status !== 'playing') return m
  const cur = activePlayer(m)
  const st = cur.session.status
  if (st !== 'result' && st !== 'over') return m
  let next = st === 'result' ? withPlayer(m, m.turn, reduce(cur.session, { type: 'park', at })) : m
  const alive = alivePlayers(next)
  if (next.mode === 'skate' && alive.length <= 1) return finish(next, at, 'won')
  if (alive.length === 0) return finish(next, at, 'won')
  let j = m.turn
  do j = (j + 1) % next.players.length
  while (isOut(next.players[j]))
  if (j <= m.turn) next = { ...next, round: next.round + 1, roundPick: null }
  return beginTurn(next, j, at)
}

export function matchEnd(m: MatchState, at: number): MatchState {
  return m.status === 'over' ? m : finish(m, at, 'ended')
}

/** The level a shared round targets (for display / diagnostics). */
export function sharedLevel(m: MatchState): number {
  const alive = alivePlayers(m)
  return gateLevelOf(alive.reduce((a, p) => a + p.session.skill.effective, 0) / Math.max(1, alive.length))
}
