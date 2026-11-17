import { anchorSkill, gateLevelOf, updateSkill, type Resolution, type SkillState, type SkillUpdate } from './adapt'
import type { PoolDiagnosis } from './catalog'
import { displayText, obstaclePhrase, trickName } from './format'
import { Rng } from './rng'
import { scoreLanding, skipReceipt, FORMULA_VERSION, type Receipt } from './score'
import { mainComponent, selectChallenge, type RecentPick, type SelectionTrace } from './select'
import type { Tunables } from './tunables'
import type { Filters, Outcome, Trick } from './types'

export const SESSION_SCHEMA = 1
export const LETTERS = ['S', 'K', 'A', 'T', 'E'] as const
export const SOLO_LENGTHS = [10, 25, 50] as const
export type SoloLength = (typeof SOLO_LENGTHS)[number]
export type Mode = 'skate' | 'solo'

export interface Challenge {
  id: string
  index: number
  trick: Trick
  key: string
  signature: string
  name: string
  where: string
  display: string
  rating: number
  experimental: boolean
  /** Effective skill when generated */
  skillAtStart: number
  startLevel: number
  selection: SelectionTrace
  /** 1–3: the attempt the player is on (or resolved on) */
  attempt: number
  attempts: ('miss' | 'land')[]
  outcome?: Outcome
  receipt?: Receipt
  /** Points applied to session score (negative for skip) */
  delta?: number
  letter?: string
  skill?: SkillUpdate
  createdAt: number
  resolvedAt?: number
}

export interface GameEvent {
  seq: number
  at: number
  type: 'start' | 'generate' | 'land' | 'miss' | 'skip' | 'next' | 'end' | 'blocked' | 'tune' | 'stretch'
  challengeId?: string
  attempt?: number
  note?: string
}

export type Status = 'playing' | 'result' | 'blocked' | 'over'
export type EndReason = 'skate' | 'solo-complete' | 'ended' | 'abandoned'

export interface GameState {
  schema: number
  id: string
  mode: Mode
  soloLength: SoloLength
  seed: number
  rng: number
  status: Status
  endReason?: EndReason
  filters: Filters
  tunables: Tunables
  startLevel: number
  skillStart: number
  skill: SkillState
  score: number
  letters: number
  /** Consecutive landed challenges (flow streak) */
  flow: number
  bestFlow: number
  resolved: number
  current: Challenge | null
  history: Challenge[]
  recent: RecentPick[]
  landedSignatures: Record<string, number>
  events: GameEvent[]
  blocked?: PoolDiagnosis
  allowStretch: boolean
  startedAt: number
  updatedAt: number
  endedAt?: number
}

export type Action =
  | { type: 'land'; challengeId: string; at: number }
  | { type: 'miss'; challengeId: string; at: number }
  | { type: 'skip'; challengeId: string; at: number }
  | { type: 'next'; at: number }
  | { type: 'end'; at: number }
  | { type: 'abandon'; at: number }
  | { type: 'allowStretch'; at: number }
  | { type: 'tune'; tunables: Tunables; at: number }

export interface StartOptions {
  mode: Mode
  soloLength: SoloLength
  filters: Filters
  startLevel: number
  /** Persisted adaptive state; re-anchored if its anchor differs from startLevel */
  skill?: SkillState
  tunables: Tunables
  seed: number
  at: number
}

function event(s: GameState, e: Omit<GameEvent, 'seq'>): GameEvent[] {
  return [...s.events, { seq: s.events.length, ...e }]
}

export function startSession(o: StartOptions): GameState {
  const skill = o.skill && o.skill.anchor === o.startLevel ? o.skill : anchorSkill(o.startLevel)
  const s: GameState = {
    schema: SESSION_SCHEMA,
    id: `s${o.at.toString(36)}-${o.seed.toString(36)}`,
    mode: o.mode,
    soloLength: o.soloLength,
    seed: o.seed >>> 0,
    rng: o.seed >>> 0,
    status: 'playing',
    filters: o.filters,
    tunables: o.tunables,
    startLevel: o.startLevel,
    skillStart: skill.effective,
    skill,
    score: 0,
    letters: 0,
    flow: 0,
    bestFlow: 0,
    resolved: 0,
    current: null,
    history: [],
    recent: [],
    landedSignatures: {},
    events: [],
    allowStretch: false,
    startedAt: o.at,
    updatedAt: o.at,
  }
  s.events = event(s, { at: o.at, type: 'start', note: `${o.mode}${o.mode === 'solo' ? ` ${o.soloLength}` : ''} L${o.startLevel} skill ${skill.effective.toFixed(2)} seed ${s.seed}` })
  return generate(s, o.at)
}

function generate(s: GameState, at: number): GameState {
  const rng = new Rng(s.rng)
  const res = selectChallenge({ filters: s.filters, skill: s.skill.effective, recent: s.recent, rng, tun: s.tunables, allowStretchBeyondCap: s.allowStretch })
  if (!res.ok) {
    return { ...s, rng: rng.state, status: 'blocked', current: null, blocked: res.diagnosis, updatedAt: at, events: event(s, { at, type: 'blocked', note: res.diagnosis.messages.join(' ') }) }
  }
  const { pick, trace } = res
  const index = s.history.length
  const c: Challenge = {
    id: `${s.id}-c${index + 1}`,
    index,
    trick: pick.trick,
    key: pick.key,
    signature: pick.signature,
    name: trickName(pick.trick),
    where: obstaclePhrase(pick.trick.obstacle),
    display: displayText(pick.trick),
    rating: pick.rating,
    experimental: pick.experimental,
    skillAtStart: s.skill.effective,
    startLevel: s.startLevel,
    selection: trace,
    attempt: 1,
    attempts: [],
    createdAt: at,
  }
  const recent = [...s.recent, { key: pick.key, pattern: pick.trick.pattern, obstacle: pick.trick.obstacle, main: mainComponent(pick) }].slice(-50)
  return {
    ...s,
    rng: rng.state,
    status: 'playing',
    blocked: undefined,
    current: c,
    recent,
    updatedAt: at,
    events: event(s, { at, type: 'generate', challengeId: c.id, note: `${c.display} [${c.rating}] target ${trace.target} (${trace.mix})` }),
  }
}

function resolve(s: GameState, c: Challenge, r: Resolution, at: number, patch: Partial<Challenge>, statePatch: Partial<GameState>): GameState {
  const { skill, update } = updateSkill(s.skill, r, c.rating, s.tunables)
  const done: Challenge = { ...c, ...patch, outcome: r.outcome, skill: update, resolvedAt: at }
  const next: GameState = { ...s, ...statePatch, skill, current: done, resolved: s.resolved + 1, status: 'result', updatedAt: at }
  if (s.mode === 'skate' && next.letters >= LETTERS.length) {
    return { ...next, status: 'over', endReason: 'skate', endedAt: at, history: [...s.history, done] }
  }
  return next
}

export function reduce(s: GameState, a: Action): GameState {
  const c = s.current
  switch (a.type) {
    case 'land': {
      if (s.status !== 'playing' || !c || c.id !== a.challengeId) return s
      const prior = s.landedSignatures[c.signature] ?? 0
      const receipt = scoreLanding(c.trick, c.attempt, s.flow, { priorLands: prior, repeatPenaltyEnabled: s.tunables.repeatPenaltyEnabled })
      const flow = s.flow + 1
      const ev = event(s, { at: a.at, type: 'land', challengeId: c.id, attempt: c.attempt, note: `+${receipt.total}` })
      return resolve(
        s,
        c,
        { outcome: 'landed', attempt: c.attempt },
        a.at,
        { attempts: [...c.attempts, 'land'], receipt, delta: receipt.total },
        {
          score: s.score + receipt.total,
          flow,
          bestFlow: Math.max(s.bestFlow, flow),
          landedSignatures: { ...s.landedSignatures, [c.signature]: prior + 1 },
          events: ev,
        },
      )
    }
    case 'miss': {
      if (s.status !== 'playing' || !c || c.id !== a.challengeId) return s
      const attempts = [...c.attempts, 'miss' as const]
      const ev = event(s, { at: a.at, type: 'miss', challengeId: c.id, attempt: c.attempt })
      if (c.attempt < 3) {
        const flow = s.tunables.flowResetOn === 'any-miss' ? 0 : s.flow
        return { ...s, flow, current: { ...c, attempts, attempt: c.attempt + 1 }, updatedAt: a.at, events: ev }
      }
      const letter = s.mode === 'skate' ? LETTERS[s.letters] : null
      const receipt: Receipt = { kind: 'failed', formulaVersion: FORMULA_VERSION, total: 0, letter }
      return resolve(
        s,
        c,
        { outcome: 'failed' },
        a.at,
        { attempts, receipt, delta: 0, letter: letter ?? undefined },
        { flow: 0, letters: s.mode === 'skate' ? s.letters + 1 : s.letters, events: ev },
      )
    }
    case 'skip': {
      if (s.status !== 'playing' || !c || c.id !== a.challengeId) return s
      const t = s.tunables
      const receipt = skipReceipt(s.score, t.skipPenaltyEnabled, t.skipPenaltyPoints, t.scoreFloorZero)
      const ev = event(s, { at: a.at, type: 'skip', challengeId: c.id, attempt: c.attempt, note: `${receipt.skipDelta}` })
      return resolve(s, c, { outcome: 'skipped' }, a.at, { receipt, delta: receipt.skipDelta }, { score: s.score + receipt.skipDelta, flow: 0, events: ev })
    }
    case 'next': {
      if (s.status !== 'result' || !c) return s
      const base: GameState = { ...s, history: [...s.history, c], current: null, events: event(s, { at: a.at, type: 'next', challengeId: c.id }) }
      if (s.mode === 'solo' && s.resolved >= s.soloLength) {
        return { ...base, status: 'over', endReason: 'solo-complete', endedAt: a.at, updatedAt: a.at }
      }
      return generate(base, a.at)
    }
    case 'end':
    case 'abandon': {
      if (s.status === 'over') return s
      let history = s.history
      if (c && s.status === 'result') history = [...history, c]
      else if (c) history = [...history, { ...c, outcome: 'abandoned', resolvedAt: a.at }]
      const reason: EndReason = a.type === 'end' ? 'ended' : 'abandoned'
      return { ...s, history, status: 'over', endReason: reason, endedAt: a.at, updatedAt: a.at, events: event(s, { at: a.at, type: 'end', note: reason }) }
    }
    case 'allowStretch': {
      if (s.status !== 'blocked') return s
      return generate({ ...s, allowStretch: true, events: event(s, { at: a.at, type: 'stretch' }) }, a.at)
    }
    case 'tune':
      return { ...s, tunables: a.tunables, events: event(s, { at: a.at, type: 'tune' }) }
  }
}

/** Remaining Solo challenges, or null in SKATE. */
export function soloRemaining(s: GameState): number | null {
  return s.mode === 'solo' ? s.soloLength - s.resolved : null
}

export function sessionStats(s: GameState) {
  const all = s.history
  return {
    landed: all.filter((c) => c.outcome === 'landed').length,
    failed: all.filter((c) => c.outcome === 'failed').length,
    skipped: all.filter((c) => c.outcome === 'skipped').length,
    firstTry: all.filter((c) => c.outcome === 'landed' && c.attempt === 1).length,
    skillDelta: s.skill.effective - s.skillStart,
  }
}

export { gateLevelOf }
