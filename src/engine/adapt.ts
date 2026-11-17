import type { Tunables } from './tunables'

export interface SkillState {
  /** Player-chosen starting level, 1–10 */
  anchor: number
  /** Hidden effective target, 1–10, moves slowly */
  effective: number
  /** Recent evidence values, newest last */
  window: number[]
  /** Total resolved challenges since anchoring */
  n: number
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
  return { anchor: l, effective: l, window: [], n: 0 }
}

export type Resolution = { outcome: 'landed'; attempt: number } | { outcome: 'failed' } | { outcome: 'skipped' }

/**
 * Evidence from one resolved challenge. Based on outcome and attempt, scaled by
 * how hard the trick was relative to the player — never by points.
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
  // Landing a stretch counts more; landing an easy one counts less.
  // Failing an easy one counts more; failing a stretch counts less.
  const f = base >= 0 ? clampF(1 + k * diff) : clampF(1 - k * diff)
  const e = Math.round(base * f * 1000) / 1000
  const rel = diff > 0.3 ? 'stretch' : diff < -0.3 ? 'easy' : 'on-level'
  return { e, why: `${why} on ${rel} trick (${rating.toFixed(1)} vs ${effective.toFixed(2)})` }
}

export function updateSkill(s: SkillState, r: Resolution, rating: number, tun: Tunables): { skill: SkillState; update: SkillUpdate } {
  const { e, why } = evidenceFor(r, rating, s.effective, tun)
  const window = [...s.window, e].slice(-tun.adaptationWindow)
  const n = s.n + 1
  if (!tun.adaptiveDifficultyEnabled) {
    return {
      skill: { ...s, window, n },
      update: { before: s.effective, after: s.effective, evidence: e, delta: 0, reason: `${why}; adaptation off` },
    }
  }
  const mean = window.reduce((a, b) => a + b, 0) / window.length
  const confidence = Math.min(1, n / tun.adaptationWarmup)
  let delta = tun.adaptationRate * mean * confidence
  delta = Math.max(-tun.adaptationStepLimit, Math.min(tun.adaptationStepLimit, delta))
  const after = Math.round(clampLevel(s.effective + delta) * 1000) / 1000
  delta = Math.round((after - s.effective) * 1000) / 1000
  const reason = `${why}; evidence ${e >= 0 ? '+' : ''}${e.toFixed(2)}, recent avg ${mean >= 0 ? '+' : ''}${mean.toFixed(2)} over ${window.length}${confidence < 1 ? `, warm-up ${Math.round(confidence * 100)}%` : ''} → ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`
  return { skill: { ...s, effective: after, window, n }, update: { before: s.effective, after, evidence: e, delta, reason } }
}
