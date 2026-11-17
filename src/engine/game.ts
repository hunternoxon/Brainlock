import { anchorSkill, applyFeedback, gateLevelOf, updateSkill, type Resolution, type SkillState, type SkillUpdate } from './adapt'
import type { PoolDiagnosis } from './catalog'
import { displayText, trickName, wherePhrase } from './canonical'
import { Rng } from './rng'
import { scoreLanding, skipReceipt, FORMULA_VERSION, type Receipt } from './score'
import { recentOf, selectChallenge, type RecentPick, type SelectionTrace } from './select'
import { validateTrick } from './validate'
import type { Tunables } from './tunables'
import type { Family, Filters, Outcome, Rarity, RatedTrick, Trick } from './types'

export const SESSION_SCHEMA = 2
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
  rarity: Rarity
  family: Family
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
  /** Optional "too easy / too hard" signal */
  feedback?: { value: 'too-easy' | 'too-hard'; accepted: boolean; note: string }
  createdAt: number
  resolvedAt?: number
}

export interface GameEvent {
  seq: number
  at: number
  type: 'start' | 'generate' | 'land' | 'miss' | 'skip' | 'next' | 'end' | 'blocked' | 'tune' | 'stretch' | 'feedback'
  challengeId?: string
  attempt?: number
  note?: string
}

/** 'waiting' = resolved and parked until this player's next turn (multiplayer) */
export type Status = 'playing' | 'result' | 'blocked' | 'over' | 'waiting'
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
  /** Skills seen this session (canonical signatures) */
  seen: string[]
  /** Temporary in-session challenge boost (hot streak / feedback) */
  boost: number
  /** Challenges since the last recovery pick */
  sinceRecovery: number
  /** Resolved count at the last accepted feedback */
  lastFeedbackAt: number | null
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
  | { type: 'feedback'; challengeId: string; value: 'too-easy' | 'too-hard'; at: number }
  /** Multiplayer: move the resolved challenge to history and wait for the next turn */
  | { type: 'park'; at: number }
  /** Multiplayer: start this player's turn, optionally with a shared trick */
  | { type: 'assign'; pick?: RatedTrick; at: number }

export interface StartOptions {
  mode: Mode
  soloLength: SoloLength
  filters: Filters
  startLevel: number
  /** Multiplayer: start in 'waiting' and let the match assign the first trick */
  deferFirst?: boolean
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
    seen: [],
    boost: 0,
    sinceRecovery: 99,
    lastFeedbackAt: null,
    events: [],
    allowStretch: false,
    startedAt: o.at,
    updatedAt: o.at,
  }
  s.events = event(s, { at: o.at, type: 'start', note: `${o.mode}${o.mode === 'solo' ? ` ${o.soloLength}` : ''} L${o.startLevel} skill ${skill.effective.toFixed(2)} seed ${s.seed}` })
  return o.deferFirst ? { ...s, status: 'waiting' } : generate(s, o.at)
}

function generate(s: GameState, at: number, forced?: RatedTrick): GameState {
  if (forced) return generateForced(s, at, forced)
  const rng = new Rng(s.rng)
  const t = s.tunables
  const last3 = s.history.slice(-3)
  const recovery = s.sinceRecovery >= t.recoveryCooldown && last3.filter((c) => c.outcome === 'failed').length >= t.recoveryAfterFails
  const res = selectChallenge({
    filters: s.filters,
    skill: s.skill.effective,
    recent: s.recent,
    rng,
    tun: t,
    allowStretchBeyondCap: s.allowStretch,
    boost: s.boost,
    recovery,
    seen: new Set(s.seen),
    familySkill: s.skill.family,
  })
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
    where: wherePhrase(pick.trick),
    display: displayText(pick.trick),
    rating: pick.rating,
    rarity: pick.rarity,
    family: pick.family,
    experimental: pick.rarity === 'experimental',
    skillAtStart: s.skill.effective,
    startLevel: s.startLevel,
    selection: trace,
    attempt: 1,
    attempts: [],
    createdAt: at,
  }
  const recent = [...s.recent, recentOf(pick)].slice(-50)
  return {
    ...s,
    rng: rng.state,
    seen: s.seen.includes(pick.signature) ? s.seen : [...s.seen, pick.signature],
    sinceRecovery: recovery ? 0 : s.sinceRecovery + 1,
    status: 'playing',
    blocked: undefined,
    current: c,
    recent,
    updatedAt: at,
    events: event(s, { at, type: 'generate', challengeId: c.id, note: `${c.display} [${c.rating}] target ${trace.target} (${trace.mix}${trace.boost ? `, boost ${trace.boost}` : ''}) ${trace.rarityRoll}` }),
  }
}

/** A shared (multiplayer) trick: same legality checks, no level gate (everyone gets the round's trick). */
function generateForced(s: GameState, at: number, pick: RatedTrick): GameState {
  const v = validateTrick(pick.trick, { filters: s.filters })
  if (!v.ok) return generate(s, at)
  const index = s.history.length
  const trace: SelectionTrace = {
    skill: s.skill.effective,
    boost: s.boost,
    gateLevel: 10,
    mix: 'core',
    target: pick.rating,
    maxRating: pick.rating,
    band: 0,
    poolSize: 1,
    bandSize: 1,
    rarityRoll: 'shared',
    spinRoll: 'shared',
    pattern: pick.trick.pattern,
    notes: ['Shared trick for this round'],
  }
  const c: Challenge = {
    id: `${s.id}-c${index + 1}`,
    index,
    trick: pick.trick,
    key: pick.key,
    signature: pick.signature,
    name: trickName(pick.trick),
    where: wherePhrase(pick.trick),
    display: displayText(pick.trick),
    rating: pick.rating,
    rarity: pick.rarity,
    family: pick.family,
    experimental: pick.rarity === 'experimental',
    skillAtStart: s.skill.effective,
    startLevel: s.startLevel,
    selection: trace,
    attempt: 1,
    attempts: [],
    createdAt: at,
  }
  return {
    ...s,
    status: 'playing',
    blocked: undefined,
    current: c,
    recent: [...s.recent, recentOf(pick)].slice(-50),
    seen: s.seen.includes(pick.signature) ? s.seen : [...s.seen, pick.signature],
    updatedAt: at,
    events: event(s, { at, type: 'generate', challengeId: c.id, note: `${c.display} [${c.rating}] shared` }),
  }
}

function resolve(s: GameState, c: Challenge, r: Resolution, at: number, patch: Partial<Challenge>, statePatch: Partial<GameState>): GameState {
  const t = s.tunables
  const { skill, update } = updateSkill(s.skill, r, c.rating, t, c.family)
  let boost = s.boost
  if (r.outcome === 'landed' && r.attempt === 1) {
    if ((skill.firstTryStreak ?? 0) >= t.boostStartStreak) boost = Math.min(t.maxBoost, boost + t.boostStep)
  } else if (r.outcome === 'failed') boost = Math.min(0, boost)
  else boost = boost > 0 ? boost / 2 : boost
  boost = Math.round(boost * 1000) / 1000
  const done: Challenge = { ...c, ...patch, outcome: r.outcome, skill: update, resolvedAt: at }
  const next: GameState = { ...s, ...statePatch, skill, boost, current: done, resolved: s.resolved + 1, status: 'result', updatedAt: at }
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
      const receipt = scoreLanding(c.trick, c.attempt, s.flow, { priorLands: prior, repeatPenaltyEnabled: s.tunables.repeatPenaltyEnabled, playerChosen: false })
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
    case 'park': {
      if (s.status !== 'result' || !c) return s
      const base: GameState = { ...s, history: [...s.history, c], current: null, updatedAt: a.at, events: event(s, { at: a.at, type: 'next', challengeId: c.id }) }
      if (s.mode === 'solo' && s.resolved >= s.soloLength) return { ...base, status: 'over', endReason: 'solo-complete', endedAt: a.at }
      return { ...base, status: 'waiting' }
    }
    case 'assign': {
      if (s.status !== 'waiting') return s
      return generate(s, a.at, a.pick)
    }
    case 'tune':
      return { ...s, tunables: a.tunables, events: event(s, { at: a.at, type: 'tune' }) }
    case 'feedback': {
      if (s.status !== 'result' || !c || c.id !== a.challengeId || c.feedback) return s
      const t = s.tunables
      const cooling = s.lastFeedbackAt !== null && s.resolved - s.lastFeedbackAt < t.feedbackCooldown
      if (cooling) {
        const fb = { value: a.value, accepted: false, note: `Noted; level unchanged (one nudge per ${t.feedbackCooldown} tricks)` }
        return { ...s, current: { ...c, feedback: fb }, events: event(s, { at: a.at, type: 'feedback', challengeId: c.id, note: `${a.value} ignored (cooldown)` }) }
      }
      const sign = a.value === 'too-easy' ? 1 : -1
      const boost = Math.max(-t.maxBoost, Math.min(t.maxBoost, s.boost + sign * t.feedbackBoost))
      const skill = applyFeedback(s.skill, a.value, t)
      const fb = { value: a.value, accepted: true, note: a.value === 'too-easy' ? 'Got it: a bit harder next.' : 'Got it: a bit easier next.' }
      return {
        ...s,
        skill,
        boost,
        lastFeedbackAt: s.resolved,
        current: { ...c, feedback: fb },
        events: event(s, { at: a.at, type: 'feedback', challengeId: c.id, note: `${a.value}: skill ${s.skill.effective.toFixed(2)}→${skill.effective.toFixed(2)}, boost ${s.boost}→${boost}` }),
      }
    }
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
