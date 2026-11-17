/**
 * Legality and difficulty rules layered on top of the untouched legacy
 * model-config.json. Anything not in the legacy config is a documented repair
 * or extension (output/WORK_LOG.md, docs/TRICK_INTELLIGENCE_V2_DECISIONS.md).
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

// Obstacle/stance intro levels come from legacy weight tables (the legacy picker
// never chose a zero-weight option, so these were de-facto gates).
export const OBSTACLE_GATE = Object.fromEntries(
  Object.entries(CONFIG.obstacles).map(([k, v]) => [k, introLevel(v.weight_by_level)]),
) as Record<Obstacle, number>

export const STANCE_GATE = Object.fromEntries(
  Object.entries(CONFIG.stances).map(([k, v]) => [k, introLevel(v.weight_by_level)]),
) as Record<Stance, number>

export const PATTERN_GATE: Record<Pattern, number> = {
  'flip-only': 1,
  'manual-only': 1,
  'grind-only': 1,
  'flip→grind': 5,
  'flip→manual': 2,
  coping: 1,
  transfer: 5,
}

/**
 * Patterns per obstacle: legacy lists plus v2 extensions —
 * flat/gap/bank/manual pad airs now include ollies + shuvits (still 'flip-only'),
 * box/curb gain flip-in grinds, quarterpipe gains coping grinds + stalls.
 */
export const OBSTACLE_PATTERNS: Record<Obstacle, Pattern[]> = Object.fromEntries(
  Object.entries(CONFIG.obstacles).map(([k, v]) => {
    const p = new Set(v.patterns as Pattern[])
    if (k === 'box' || k === 'curb') p.add('flip→grind')
    if (k === 'quarterpipe') {
      p.add('grind-only')
      p.add('coping')
    }
    return [k, [...p]]
  }),
) as Record<Obstacle, Pattern[]>

/** Coping tricks: stance limits (fakie/nollie into a stall changes the trick's meaning) */
export const COPING_STANCES: Stance[] = ['regular', 'switch']

/** Experimental lane (only at Rare = Normal). */
export const EXPERIMENTAL_RULES = {
  spinIntoFlipGrind: true,
  spinGrindObstacles: ['box', 'curb', 'ledge', 'flatbar', 'hubba', 'rail'] as Obstacle[],
  spinGrinds: ['50-50', '5-0', 'nosegrind', 'crooked', 'noseslide', 'tailslide', 'boardslide'],
}

/** Spec §9 level gates for trick classes. */
export const NAMED_GATES: { match: RegExp; level: number }[] = [
  { match: /pressure flip/, level: 5 },
  { match: /no.?comply/, level: 6 },
  { match: /late /, level: 7 },
  { match: /primo/, level: 7 },
  { match: /darkslide/, level: 8 },
  { match: /impossible late|triple/, level: 9 },
]
/** Spec §8 bans + v2 scope exclusions. */
export const BANS: { match: RegExp; obstacles: Obstacle[] | 'all'; reason: string }[] = [
  { match: /primo slide/, obstacles: ['handrail'], reason: 'No primo slide on a handrail' },
  { match: /hospital|casper/, obstacles: 'all', reason: 'Hospital and casper flips are out of scope' },
]

/**
 * Difficulty rating (1–10) inputs. PROVISIONAL mapping, separate from points.
 * rating = max(raw, gate + modifierWeight × (modifiers + combo/2)), clamped to [1,10].
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
  combo: { flipGrind: 1.0, flipManual: 0.5, spinFlip180: 0.5, spinFlip360: 1.0, spinBoard: 0.5, spinGrind: 1.0, spinManual: 0.5 },
  directionWeight: 2,
  modifierWeight: 0.4,
}
