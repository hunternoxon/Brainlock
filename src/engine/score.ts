import { CONFIG } from './rules'
import { BOARD_MOVES, EXITS, EXTRA_FLIP_VALUE, GRINDS, LIPS, REVERT, TRANSFER, TRANSITION, boardMoveValue } from './vocab'
import type { Trick } from './types'

export const FORMULA_VERSION = 'spec-2025-08-13/v4.5.2-weights/2'

export interface ScorePart {
  label: string
  value: number
}
export interface Multiplier {
  label: string
  mult: number
}

export interface LandReceipt {
  kind: 'landed'
  formulaVersion: string
  scale: number
  baseParts: ScorePart[]
  baseSum: number
  combos: Multiplier[]
  comboM: number
  attempt: number
  attemptM: number
  flowCount: number
  flowM: number
  repeatCount: number
  repeatM: number
  repeatNote: string
  total: number
}
export interface SkipReceipt {
  kind: 'skipped'
  formulaVersion: string
  requestedPenalty: number
  skipDelta: number
  provisional: true
}
export interface FailReceipt {
  kind: 'failed'
  formulaVersion: string
  total: 0
  letter: string | null
}
export type Receipt = LandReceipt | SkipReceipt | FailReceipt

const S = () => CONFIG.scoring

export function attemptMult(a: number): number {
  return S().attempt_mult[String(a)] ?? 1
}
export function flowMult(flowCount: number): number {
  return 1 + Math.min(flowCount * S().flow_step, S().flow_mult_cap)
}
/** Legacy semantics: counted against prior lands of the same signature. */
export function repeatMult(priorLands: number): number {
  return priorLands <= 2 ? 1 : Math.max(0, 1 - 0.1 * (priorLands - 2))
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Additive base components, from canonical components only (never names).
 * Each mechanical component is counted exactly once.
 */
export function baseParts(t: Trick): ScorePart[] {
  const sc = S()
  const parts: ScorePart[] = [{ label: 'Base', value: 1 }]
  const stance = sc.stance[t.stance] ?? 0
  if (stance) parts.push({ label: `Stance: ${t.stance}`, value: stance })
  if (t.spin) parts.push({ label: `Body spin: ${t.spin.dir} ${t.spin.deg}`, value: sc.spin[String(t.spin.deg)] ?? 0 })
  const m = t.flip ? BOARD_MOVES[t.flip] : undefined
  if (m) {
    const prefix = t.pattern === 'flip→grind' || t.pattern === 'flip→manual' ? 'Entry ' : ''
    for (const p of boardMoveValue(m)) parts.push({ label: prefix + p.label, value: p.value })
    if (t.flips) parts.push({ label: `Extra flip rotation ×${t.flips - 1}`, value: r3(EXTRA_FLIP_VALUE * (t.flips - 1)) })
  }
  if (t.grind) {
    const g = GRINDS[t.grind]
    const dm = t.direction && g?.dirMult ? g.dirMult[t.direction] : 1
    parts.push({
      label: dm !== 1 ? `Grind: ${t.direction} ${g?.label} (${g?.value} × ${dm})` : `Grind: ${t.direction ?? ''} ${g?.label ?? t.grind}`.replace('  ', ' '),
      value: r3((g?.value ?? 0) * dm),
    })
  }
  if (t.grind2) parts.push({ label: `Transition to ${GRINDS[t.grind2]?.label}`, value: r3((GRINDS[t.grind2]?.value ?? 0) * TRANSITION.valueShare) })
  if (t.manual) parts.push({ label: `Manual: ${t.manual}`, value: sc.manual[t.manual] ?? 0 })
  if (t.lip) parts.push({ label: `Lip trick: ${LIPS[t.lip]?.label}`, value: LIPS[t.lip]?.value ?? 0 })
  if (t.exit) parts.push({ label: `Exit: ${EXITS[t.exit]?.label}`, value: EXITS[t.exit]?.value ?? 0 })
  if (t.revert) parts.push({ label: 'Revert', value: REVERT.value })
  if (t.transferTo) parts.push({ label: 'Transfer', value: TRANSFER.value })
  const oa = Math.max(sc.obstacle_add[t.obstacle] ?? 0, t.transferTo ? (sc.obstacle_add[t.transferTo] ?? 0) : 0)
  parts.push({ label: `Obstacle: ${t.transferTo ? `${t.obstacle} → ${t.transferTo}` : t.obstacle}`, value: oa })
  return parts
}

export function comboMultipliers(t: Trick): Multiplier[] {
  const cm = S().combo_mult
  const m = t.flip ? BOARD_MOVES[t.flip] : undefined
  const isFlip = !!m?.flip
  const entry = (t.pattern === 'flip→grind' || t.pattern === 'flip→manual') && !!m
  const out: Multiplier[] = []
  if (entry && t.grind) out.push({ label: isFlip ? 'Flip into grind' : 'Shuvit into grind', mult: cm['flip&grind'] ?? 1 })
  if (isFlip && t.spin) out.push({ label: 'Spin + flip', mult: cm['flip&spin'] ?? 1 })
  if (t.spin && t.grind) out.push({ label: 'Spin into grind', mult: cm['spin&grind'] ?? 1 })
  if (t.manual && (entry || t.spin)) out.push({ label: 'Into manual', mult: cm['manual&(flip|spin)'] ?? 1 })
  if (t.obstacle === 'gap' && isFlip && t.spin) out.push({ label: 'Gap spin + flip', mult: cm['gap&flip&spin'] ?? 1 })
  return out
}

/**
 * points = round(SCALE × BaseSum × ComboM × AttemptM × FlowM × RepeatM)
 * Legacy formula and weights; receipts list every component once.
 */
export function scoreLanding(
  t: Trick,
  attempt: number,
  flowCount: number,
  opts: { priorLands?: number; repeatPenaltyEnabled?: boolean; playerChosen?: boolean } = {},
): LandReceipt {
  const sc = S()
  const parts = baseParts(t)
  const baseSum = parts.reduce((a, p) => a + p.value, 0)
  const combos = comboMultipliers(t)
  const comboM = combos.reduce((m, c) => m * c.mult, 1)
  const attemptM = attemptMult(attempt)
  const flowM = flowMult(flowCount)
  const priorLands = opts.priorLands ?? 0
  // Fairness: the generator assigns every prompt in v1, so a repeat is never the player's choice.
  // The legacy penalty only applies to player-chosen tricks (none exist yet).
  const applies = !!opts.repeatPenaltyEnabled && !!opts.playerChosen
  const repeatM = applies ? repeatMult(priorLands) : 1
  const repeatNote = applies ? (repeatM < 1 ? `Landed this ${priorLands}× already this session` : 'No repeat penalty') : 'No repeat penalty (game-assigned trick)'
  const total = Math.round(sc.scale * baseSum * attemptM * flowM * repeatM * comboM)
  return {
    kind: 'landed',
    formulaVersion: FORMULA_VERSION,
    scale: sc.scale,
    baseParts: parts,
    baseSum: r3(baseSum),
    combos,
    comboM,
    attempt,
    attemptM,
    flowCount,
    flowM,
    repeatCount: priorLands,
    repeatM,
    repeatNote,
    total,
  }
}

export function skipReceipt(currentScore: number, enabled: boolean, points: number, floorZero: boolean): SkipReceipt {
  const requested = enabled ? Math.abs(points) : 0
  const applied = floorZero ? Math.min(requested, Math.max(0, currentScore)) : requested
  return { kind: 'skipped', formulaVersion: FORMULA_VERSION, requestedPenalty: -requested, skipDelta: -applied, provisional: true }
}
