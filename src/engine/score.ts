import { CONFIG } from './rules'
import type { Trick } from './types'

export const FORMULA_VERSION = 'spec-2025-08-13/v4.5.2-weights/1'

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
  /** Signed delta actually applied (after floor) */
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

const r2 = (n: number) => Math.round(n * 1000) / 1000

/**
 * points = round(SCALE × BaseSum × ComboM × AttemptM × FlowM × RepeatM)
 * Ported from legacy BrainlockModel.scoreTrick with identical weights, plus a receipt.
 */
export function scoreLanding(
  t: Trick,
  attempt: number,
  flowCount: number,
  opts: { priorLands?: number; repeatPenaltyEnabled?: boolean } = {},
): LandReceipt {
  const sc = S()
  const parts: ScorePart[] = [{ label: 'Base', value: 1 }]
  const stance = sc.stance[t.stance] ?? 0
  if (stance) parts.push({ label: `Stance: ${t.stance}`, value: stance })
  if (t.spin) parts.push({ label: `Spin: ${t.spin.dir} ${t.spin.deg}`, value: sc.spin[String(t.spin.deg)] ?? 0 })
  if (t.flip) parts.push({ label: `Flip: ${t.flip}`, value: sc.flip[t.flip] ?? 0 })
  if (t.grind) {
    const base = sc.grind_base[t.grind] ?? 0
    const dm = sc.grind_dir_mult[t.grind]?.[t.direction ?? 'FS'] ?? 1
    parts.push({
      label: dm !== 1 ? `Grind: ${t.direction} ${t.grind} (${base} × ${dm} ${t.direction})` : `Grind: ${t.direction} ${t.grind}`,
      value: r2(base * dm),
    })
  }
  if (t.manual) parts.push({ label: `Manual: ${t.manual}`, value: sc.manual[t.manual] ?? 0 })
  parts.push({ label: `Obstacle: ${t.obstacle}`, value: sc.obstacle_add[t.obstacle] ?? 0 })

  // Sum unrounded components exactly like the legacy scorer
  let baseSum = 1 + stance + (t.spin ? (sc.spin[String(t.spin.deg)] ?? 0) : 0) + (t.flip ? (sc.flip[t.flip] ?? 0) : 0)
  if (t.grind) baseSum += (sc.grind_base[t.grind] ?? 0) * (sc.grind_dir_mult[t.grind]?.[t.direction ?? 'FS'] ?? 1)
  if (t.manual) baseSum += sc.manual[t.manual] ?? 0
  baseSum += sc.obstacle_add[t.obstacle] ?? 0

  const combos: Multiplier[] = []
  const cm = sc.combo_mult
  if (t.flip && t.grind) combos.push({ label: 'Flip into grind', mult: cm['flip&grind'] ?? 1 })
  if (t.flip && t.spin) combos.push({ label: 'Spin + flip', mult: cm['flip&spin'] ?? 1 })
  if (t.spin && t.grind) combos.push({ label: 'Spin into grind', mult: cm['spin&grind'] ?? 1 })
  if (t.manual && (t.flip || t.spin)) combos.push({ label: 'Into manual', mult: cm['manual&(flip|spin)'] ?? 1 })
  if (t.obstacle === 'gap' && t.flip && t.spin) combos.push({ label: 'Gap spin + flip', mult: cm['gap&flip&spin'] ?? 1 })
  const comboM = combos.reduce((m, c) => m * c.mult, 1)

  const attemptM = attemptMult(attempt)
  const flowM = flowMult(flowCount)
  const priorLands = opts.priorLands ?? 0
  const repeatM = opts.repeatPenaltyEnabled ? repeatMult(priorLands) : 1
  const repeatNote = opts.repeatPenaltyEnabled
    ? repeatM < 1
      ? `Landed this ${priorLands}× already this session`
      : 'No repeat penalty'
    : 'Repeat penalty off (fairness-first)'
  const total = Math.round(sc.scale * baseSum * attemptM * flowM * repeatM * comboM)

  return {
    kind: 'landed',
    formulaVersion: FORMULA_VERSION,
    scale: sc.scale,
    baseParts: parts,
    baseSum: r2(baseSum),
    combos,
    comboM: r2(comboM),
    attempt,
    attemptM,
    flowCount,
    flowM: r2(flowM),
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
