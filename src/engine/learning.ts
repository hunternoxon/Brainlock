import { anchorSkill, applyFeedback, updateSkill, type Resolution, type SkillState } from './adapt'
import type { Challenge } from './game'
import type { Tunables } from './tunables'

/** Minimal shape needed from a stored history entry. */
export interface LearnableSession {
  id: string
  endReason: string
  startLevel: number
  startedAt: number
  forgotten?: { reason: string; note?: string; at: number }
  session: { history: Challenge[] }
}

export const FORGET_REASONS = ['Accidental taps', 'Injury / off day', 'Device issue', 'Not representative', 'Other'] as const

export function isLearnable(h: LearnableSession): { ok: boolean; why: string } {
  if (h.forgotten) return { ok: false, why: `forgotten: ${h.forgotten.reason}` }
  if (h.endReason !== 'skate' && h.endReason !== 'solo-complete') return { ok: false, why: h.endReason === 'ended' ? 'ended early' : 'abandoned' }
  return { ok: true, why: 'completed' }
}

export interface LongTermSkill {
  skill: SkillState
  used: string[]
  excluded: { id: string; why: string }[]
}

/**
 * Long-term skill = replay of every learnable session (completed, not forgotten,
 * same starting level, after the last manual reset) from the anchor.
 * Pure: recomputed from history every time, so forgetting a session leaves no residue.
 */
export function computeLongTermSkill(history: LearnableSession[], level: number, resetAt: number, tun: Tunables): LongTermSkill {
  let skill = anchorSkill(level)
  const used: string[] = []
  const excluded: { id: string; why: string }[] = []
  const ordered = [...history].sort((a, b) => a.startedAt - b.startedAt)
  for (const h of ordered) {
    if (h.startLevel !== level || h.startedAt < resetAt) continue
    const l = isLearnable(h)
    if (!l.ok) {
      excluded.push({ id: h.id, why: l.why })
      continue
    }
    used.push(h.id)
    for (const c of h.session.history ?? []) {
      let r: Resolution | null = null
      if (c.outcome === 'landed') r = { outcome: 'landed', attempt: c.attempt }
      else if (c.outcome === 'failed') r = { outcome: 'failed' }
      else if (c.outcome === 'skipped') r = { outcome: 'skipped' }
      if (!r) continue
      skill = updateSkill(skill, r, c.rating, tun, c.family).skill
      if (c.feedback?.accepted) skill = applyFeedback(skill, c.feedback.value, tun)
    }
  }
  return { skill, used, excluded }
}
