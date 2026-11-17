import type { Tunables } from './tunables'
import type { Family } from './types'

export interface SkillState {
  /** Player-chosen starting level, 1–10 */
  anchor: number
  /** Hidden effective target, 1–10, moves slowly */
  effective: number
  /** Recent evidence values, newest last */
  window: number[]
  /** Total resolved challenges since anchoring */
  n: number
  /** Consecutive first-try lands (for hot-streak acceleration) */
  firstTryStreak?: number
  /** Per-family offsets (lightweight; only applied when familySkillEnabled) */
  family?: Partial<Record<Family, number>>
}

export interface SkillUpdate {
  before: number
  after: number
  evidence: number
  delta: number
  reason: string
}

export const clampLevel = (x: number) => Math.min(10, Math.max(1, x))
export const gateLevelOf = (effective: number) => clampLevel(Math.round(effective))

export function anchorSkill(level: number): SkillState {
  const l = clampLevel(Math.round(level))
  return { anchor: l, effective: l, window: [], n: 0, firstTryStreak: 0, family: {} }
}

export type Resolution = { outcome: 'landed'; attempt: number } | { outcome: 'failed' } | { outcome: 'skipped' }

/**
 * Evidence from one resolved challenge: outcome + attempt, scaled by how hard
 * the trick was relative to the player. Never points.
 */
export function evidenceFor(r: Resolution, rating: number, effective: number, tun: Tunables): { e: number; why: string } {
  const diff = rating - effective
  const k = tun.evidenceDifficultyWeight
  const clampF = (x: number) => Math.min(1.5, Math.max(0.25, x))
  let base: number
  let why: string
  if (r.outcome === 'landed') {
    base = r.attempt === 1 ? tun.evidenceLand1 : r.attempt === 2 ? tun.evidenceLand2 : tun.evidenceLand3
    why = `landed try ${r.attempt}`
  } else if (r.outcome === 'failed') {
    base = tun.evidenceFail
    why = 'three misses'
  } else {
    base = tun.evidenceSkip
    why = 'skipped'
  }
  const f = base >= 0 ? clampF(1 + k * diff) : clampF(1 - k * diff)
  const e = Math.round(base * f * 1000) / 1000
  const rel = diff > 0.3 ? 'stretch' : diff < -0.3 ? 'easy' : 'on-level'
  return { e, why: `${why} on ${rel} trick (${rating.toFixed(1)} vs ${effective.toFixed(2)})` }
}

export function updateSkill(s: SkillState, r: Resolution, rating: number, tun: Tunables, family?: Family): { skill: SkillState; update: SkillUpdate } {
  const { e, why } = evidenceFor(r, rating, s.effective, tun)
  const window = [...s.window, e].slice(-tun.adaptationWindow)
  const n = s.n + 1
  const firstTryStreak = r.outcome === 'landed' && r.attempt === 1 ? (s.firstTryStreak ?? 0) + 1 : 0
  const fam = { ...(s.family ?? {}) }
  if (family) fam[family] = Math.max(-tun.familySkillCap, Math.min(tun.familySkillCap, (fam[family] ?? 0) + tun.familySkillRate * e))
  if (!tun.adaptiveDifficultyEnabled) {
    return {
      skill: { ...s, window, n, firstTryStreak, family: fam },
      update: { before: s.effective, after: s.effective, evidence: e, delta: 0, reason: `${why}; adaptation off` },
    }
  }
  const mean = window.reduce((a, b) => a + b, 0) / window.length
  const confidence = Math.min(1, n / tun.adaptationWarmup)
  const hot = firstTryStreak >= tun.hotStreakStart
  let delta = tun.adaptationRate * mean * confidence * (hot && mean > 0 ? tun.hotStreakMultiplier : 1)
  delta = Math.max(-tun.adaptationStepLimit, Math.min(tun.adaptationStepLimit, delta))
  const after = Math.round(clampLevel(s.effective + delta) * 1000) / 1000
  delta = Math.round((after - s.effective) * 1000) / 1000
  const reason = `${why}; evidence ${e >= 0 ? '+' : ''}${e.toFixed(2)}, recent avg ${mean >= 0 ? '+' : ''}${mean.toFixed(2)} over ${window.length}${confidence < 1 ? `, warm-up ${Math.round(confidence * 100)}%` : ''}${hot ? `, hot streak ×${tun.hotStreakMultiplier}` : ''} → ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`
  return { skill: { ...s, effective: after, window, n, firstTryStreak, family: fam }, update: { before: s.effective, after, evidence: e, delta, reason } }
}

/** Bounded nudge from an accepted "Too easy / Too hard" tap. */
export function applyFeedback(s: SkillState, value: 'too-easy' | 'too-hard', tun: Tunables): SkillState {
  if (!tun.adaptiveDifficultyEnabled) return s
  const d = value === 'too-easy' ? tun.feedbackSkillStep : -tun.feedbackSkillStep
  return { ...s, effective: Math.round(clampLevel(s.effective + d) * 1000) / 1000 }
}
