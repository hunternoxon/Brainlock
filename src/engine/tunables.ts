/**
 * Developer-tunable knobs. Every value here is a PROVISIONAL playtest default,
 * not a user decision (docs/08, docs/TRICK_INTELLIGENCE_V2_DECISIONS.md).
 */
export interface Tunables {
  // Skip (decision 9: penalty + admin flag; magnitude undecided)
  skipPenaltyEnabled: boolean
  skipPenaltyPoints: number
  scoreFloorZero: boolean
  // Flow (+3%/land, cap 15% from config)
  flowResetOn: 'any-miss' | 'failed-challenge'
  // Repeats: legacy penalty only ever applies to player-chosen tricks (none in v1)
  repeatPenaltyEnabled: boolean
  repeatCooldown: number
  /** Same skill (any obstacle) within this many prompts is strongly avoided */
  signatureCooldown: number
  signatureRecentPenalty: number
  /** Preference for skills not yet seen this session */
  noveltyBoost: number
  /** Soft family balance strength (0 = off) */
  familyBalanceStrength: number
  // Long-term adaptation
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
  evidenceDifficultyWeight: number
  /** First-try lands in a row before long-term adaptation speeds up */
  hotStreakStart: number
  hotStreakMultiplier: number
  // In-session temporary challenge boost
  boostStartStreak: number
  boostStep: number
  maxBoost: number
  // Recovery
  recoveryAfterFails: number
  recoveryOffset: number
  recoveryCooldown: number
  // Too easy / too hard
  feedbackCooldown: number
  feedbackSkillStep: number
  feedbackBoost: number
  // Per-family learning (lightweight, off by default)
  familySkillEnabled: boolean
  familySkillRate: number
  familySkillCap: number
  // Selection band
  difficultyBand: number
  maxStretch: number
  mixEasy: number
  mixStretch: number
  easyOffset: number
  stretchOffset: number
  // Rarity (probability a pick is drawn from the rare / very-rare tier at "Very low"; Low ×2.5, Normal ×5)
  rareRate: number
  veryRareRate: number
  uncommonWeight: number
  // Locked
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
  signatureCooldown: 8,
  signatureRecentPenalty: 0.25,
  noveltyBoost: 1.25,
  familyBalanceStrength: 0.8,
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
  hotStreakStart: 4,
  hotStreakMultiplier: 1.5,
  boostStartStreak: 3,
  boostStep: 0.25,
  maxBoost: 0.75,
  recoveryAfterFails: 2,
  recoveryOffset: -1.0,
  recoveryCooldown: 3,
  feedbackCooldown: 3,
  feedbackSkillStep: 0.05,
  feedbackBoost: 0.25,
  familySkillEnabled: false,
  familySkillRate: 0.05,
  familySkillCap: 0.75,
  difficultyBand: 0.6,
  maxStretch: 1.25,
  mixEasy: 0.2,
  mixStretch: 0.25,
  easyOffset: -0.8,
  stretchOffset: 0.6,
  rareRate: 0.03,
  veryRareRate: 0.006,
  uncommonWeight: 0.5,
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
  out.nlStackBuilderEnabled = false
  out.runtimeAiEnabled = false
  return out
}
