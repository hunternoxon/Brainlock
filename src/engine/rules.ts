/**
 * Legality and difficulty rules layered on top of the untouched legacy
 * model-config.json. Everything here that is not in the legacy config is a
 * documented repair or extension (see output/WORK_LOG.md, "Rules layer").
 */
import legacy from './data/legacy-model-config.json'
import type { Obstacle, Pattern, Stance } from './types'

type LevelWeights = number[]
interface SubDef {
  diff: number
  minLevel: number
  allowed_obstacles?: string[]
  weight_by_level?: LevelWeights
}
export interface LegacyConfig {
  obstacles: Record<string, { tier: number; tall: boolean; patterns: string[]; weight_by_level: LevelWeights }>
  stances: Record<string, { weight_by_level: LevelWeights }>
  families: Record<string, { label: string; subs: Record<string, SubDef> }>
  scoring: {
    stance: Record<string, number>
    flip: Record<string, number>
    spin: Record<string, number>
    manual: Record<string, number>
    grind_base: Record<string, number>
    grind_dir_mult: Record<string, { FS: number; BS: number }>
    obstacle_add: Record<string, number>
    attempt_mult: Record<string, number>
    flow_mult_cap: number
    flow_step: number
    combo_mult: Record<string, number>
    scale: number
  }
}

export const CONFIG = legacy as unknown as LegacyConfig

/** First level (1–10) where a legacy weight table becomes non-zero. */
export function introLevel(weights: LevelWeights | undefined): number {
  if (!weights) return 1
  const i = weights.findIndex((w) => w > 0)
  return i < 0 ? 99 : i + 1
}

// Obstacle and stance intro levels come straight from legacy weight tables:
// the legacy picker never chose a zero-weight option, so these were de-facto gates.
export const OBSTACLE_GATE = Object.fromEntries(
  Object.entries(CONFIG.obstacles).map(([k, v]) => [k, introLevel(v.weight_by_level)]),
) as Record<Obstacle, number>

export const STANCE_GATE = Object.fromEntries(
  Object.entries(CONFIG.stances).map(([k, v]) => [k, introLevel(v.weight_by_level)]),
) as Record<Stance, number>

/** Pattern intro levels, from legacy patternPool weights (flip→grind 0 below L5, flip→manual 0 below L2). */
export const PATTERN_GATE: Record<Pattern, number> = {
  'flip-only': 1,
  'manual-only': 1,
  'grind-only': 1,
  'flip→grind': 5,
  'flip→manual': 2,
  'spin-only': 2,
}

/**
 * REPAIR: legacy flip.allowed_obstacles describes flips done *on/over* an
 * obstacle. A flip used as the *entry* into a grind is a different context.
 * This table says which flips can enter a grind, from which level.
 */
export const GRIND_ENTRY_FLIPS: Record<string, number> = {
  kickflip: 5,
  heelflip: 5,
  'varial kickflip': 7,
  'varial heelflip': 7,
  hardflip: 8,
  'inward heelflip': 8,
  'tre flip': 9,
}
export const GRIND_ENTRY_OBSTACLES: Obstacle[] = ['ledge', 'hubba', 'flatbar', 'rail', 'handrail']

/** EXTENSION: standalone spins (e.g. "BS 180") so the spins family works without flips. */
export const SPIN_ONLY_OBSTACLES: Obstacle[] = ['flat', 'gap', 'bank']

/** Spin modifier compatibility (realism). Spins never join flip→grind / flip→manual in the normal lane. */
export const SPIN_RULES = {
  flipOnlyObstacles: ['flat', 'gap', 'bank', 'manual pad'] as Obstacle[],
  flip360Obstacles: ['flat', 'gap'] as Obstacle[],
  /** 180 + any flip with legacy diff <= this */
  flip180MaxDiff: 3,
  /** 360 only with these flips */
  flip360: ['kickflip', 'heelflip'],
  manualObstacles: ['manual pad', 'box', 'curb', 'bank'] as Obstacle[],
  /** spin-in to grind: 180 only, these grinds. Experimental lane only (reads oddly, e.g. "BS 180 FS noseslide"). */
  grinds: ['50-50', '5-0', 'nosegrind', 'crooked', 'noseslide', 'tailslide', 'boardslide'],
  /** Spec: 540+ excluded in fingerboard mode */
  maxDegrees: 360,
}

/** Experimental lane (opt-in, default OFF). Only these relaxations exist. */
export const EXPERIMENTAL_RULES = {
  spinIntoFlipGrind: true,
  spinGrindObstacles: ['box', 'curb', 'ledge', 'flatbar', 'hubba', 'rail'] as Obstacle[],
}

/** Spec §9 level gates for trick classes. Not generated in v1 (not in config), but enforced if introduced. */
export const NAMED_GATES: { match: RegExp; level: number }[] = [
  { match: /pressure flip/, level: 5 },
  { match: /no.?comply/, level: 6 },
  { match: /late flip/, level: 7 },
  { match: /primo/, level: 7 },
  { match: /darkslide/, level: 8 },
  { match: /hospital|triple|impossible late/, level: 9 },
]
/** Spec §8 bans. */
export const BANS: { match: RegExp; obstacles: Obstacle[]; reason: string }[] = [
  { match: /primo slide/, obstacles: ['handrail'], reason: 'No primo slide on a handrail' },
]

/**
 * Difficulty rating (1–10) inputs. PROVISIONAL mapping, separate from points.
 * rating = max(raw, gate + modifierWeight × modifiers), clamped to [1,10].
 */
export const DIFFICULTY = {
  stance: { regular: 0, fakie: 0.5, nollie: 1.0, switch: 1.5 } as Record<Stance, number>,
  obstacle: {
    flat: 0,
    'manual pad': 0,
    box: 0,
    curb: 0,
    bank: 0.25,
    ledge: 0.5,
    flatbar: 0.75,
    gap: 0.75,
    quarterpipe: 0.75,
    rail: 1.0,
    hubba: 1.0,
    handrail: 2.0,
  } as Record<Obstacle, number>,
  spin: { 180: 1, 360: 3 } as Record<number, number>,
  combo: { flipGrind: 1.0, flipManual: 0.5, spinFlip180: 0.5, spinFlip360: 1.0, spinGrind: 1.0, spinManual: 0.5 },
  /** Directional grind nuance: (dirMult - 1) × this */
  directionWeight: 2,
  /** How much stance/obstacle/direction push a trick above its gate */
  modifierWeight: 0.4,
}
