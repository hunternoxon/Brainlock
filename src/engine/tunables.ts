/**
 * Developer-tunable knobs. Every value here is a PROVISIONAL playtest default,
 * not a user decision (see docs/08 and output/WORK_LOG.md).
 */
export interface Tunables {
  // Skip (decision 9: penalty + admin flag; magnitude undecided)
  skipPenaltyEnabled: boolean
  skipPenaltyPoints: number
  scoreFloorZero: boolean
  // Flow (+3%/land, cap 15% from config). What breaks it is undecided.
  flowResetOn: 'any-miss' | 'failed-challenge'
  // Repeats (decision 24: fairness-first)
  repeatPenaltyEnabled: boolean
  repeatCooldown: number
  // Adaptation (decisions 13, 14, 32)
  adaptiveDifficultyEnabled: boolean
  adaptationRate: number
  adaptationWindow: number
  adaptationWarmup: number
  adaptationStepLimit: number
  evidenceLand1: number
  evidenceLand2: number
  evidenceLand3: number
  evidenceFail: number
  evidenceSkip: number
  /** How much a trick's rating vs player skill scales the evidence */
  evidenceDifficultyWeight: number
  // Selection band
  difficultyBand: number
  maxStretch: number
  mixEasy: number
  mixStretch: number
  easyOffset: number
  stretchOffset: number
  // Lanes / flags
  experimentalEnabled: boolean
  nlStackBuilderEnabled: false
  runtimeAiEnabled: false
}

export const DEFAULT_TUNABLES: Tunables = {
  skipPenaltyEnabled: true,
  skipPenaltyPoints: 50,
  scoreFloorZero: true,
  flowResetOn: 'any-miss',
  repeatPenaltyEnabled: false,
  repeatCooldown: 12,
  adaptiveDifficultyEnabled: true,
  adaptationRate: 0.08,
  adaptationWindow: 8,
  adaptationWarmup: 4,
  adaptationStepLimit: 0.15,
  evidenceLand1: 1.0,
  evidenceLand2: 0.5,
  evidenceLand3: 0.15,
  evidenceFail: -0.9,
  evidenceSkip: -0.2,
  evidenceDifficultyWeight: 0.5,
  difficultyBand: 0.6,
  maxStretch: 1.25,
  mixEasy: 0.2,
  mixStretch: 0.25,
  easyOffset: -0.8,
  stretchOffset: 0.6,
  experimentalEnabled: false,
  nlStackBuilderEnabled: false,
  runtimeAiEnabled: false,
}

export function sanitizeTunables(t: Partial<Tunables> | undefined): Tunables {
  const out = { ...DEFAULT_TUNABLES }
  if (!t || typeof t !== 'object') return out
  for (const k of Object.keys(DEFAULT_TUNABLES) as (keyof Tunables)[]) {
    const v = (t as Record<string, unknown>)[k]
    if (v !== undefined && typeof v === typeof DEFAULT_TUNABLES[k]) (out as Record<string, unknown>)[k] = v
  }
  // Hard-locked flags: never enabled from storage
  out.nlStackBuilderEnabled = false
  out.runtimeAiEnabled = false
  return out
}
