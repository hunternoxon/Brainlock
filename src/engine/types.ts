export const OBSTACLES = [
  'flat',
  'manual pad',
  'box',
  'curb',
  'bank',
  'ledge',
  'hubba',
  'flatbar',
  'rail',
  'handrail',
  'gap',
  'quarterpipe',
] as const
export type Obstacle = (typeof OBSTACLES)[number]

export const STANCES = ['regular', 'fakie', 'nollie', 'switch'] as const
export type Stance = (typeof STANCES)[number]

export const FAMILIES = ['flips', 'grinds', 'manuals', 'spins', 'stalls'] as const
export type Family = (typeof FAMILIES)[number]

/**
 * flip-only: any standalone air maneuver (ollie, shuvit, flip, body spin, or combos)
 * coping:    quarterpipe stalls / lip tricks
 * transfer:  air from one obstacle to a compatible other one
 */
export type Pattern = 'flip-only' | 'grind-only' | 'flip→grind' | 'manual-only' | 'flip→manual' | 'coping' | 'transfer'
export type Dir = 'FS' | 'BS'

/** Body rotation (the skater turns). Board rotation lives in the board move. */
export interface Spin {
  deg: 180 | 360
  dir: Dir
}

/**
 * Canonical mechanical representation of one challenge. Every field is a
 * canonical key; display names (Tre Flip, Bigflip, Half Cab…) are derived.
 */
export interface Trick {
  obstacle: Obstacle
  stance: Stance
  pattern: Pattern
  /** Board move key (vocab BOARD_MOVES): the standalone air, or the entry into a grind/manual */
  flip?: string
  /** Total flip rotations when more than one (doubles/triples) */
  flips?: 2 | 3
  /** Body rotation */
  spin?: Spin
  grind?: string
  /** Approach side for grinds/slides */
  direction?: Dir
  /** Grind-to-grind transition target (same direction) */
  grind2?: string
  manual?: string
  /** Quarterpipe stall / lip trick key */
  lip?: string
  lipDir?: Dir
  /** Exit key (vocab EXITS) */
  exit?: string
  /** Direction for body-rotation exits ("FS 180 Out") */
  exitDir?: Dir
  revert?: Dir
  transferTo?: Obstacle
}

export interface Filters {
  /** Filter schema version (2 = trick-intelligence v2) */
  v: 2
  obstacles: Obstacle[]
  stances: Stance[]
  families: Family[]
  subs: Record<Family, string[]>
  doubles: boolean
  triples: boolean
  transfers: boolean
  rarity: RarityLevel
}

export type Rarity = 'core' | 'uncommon' | 'rare' | 'very-rare' | 'experimental'
export const RARITY_LEVELS = ['off', 'very-low', 'low', 'normal'] as const
export type RarityLevel = (typeof RARITY_LEVELS)[number]

export interface RatedTrick {
  trick: Trick
  /** Exact challenge identity (includes obstacle) */
  key: string
  /** Canonical skill identity (excludes obstacle) */
  signature: string
  /** 1–10 skill rating, one decimal. Not the same thing as points. */
  rating: number
  /** Highest hard level gate among the components */
  gate: number
  rarity: Rarity
  /** Primary family, for soft balancing and per-family learning */
  family: Family
}

export type Outcome = 'landed' | 'failed' | 'skipped' | 'abandoned'
