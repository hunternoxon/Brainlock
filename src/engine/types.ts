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

export const FAMILIES = ['flips', 'grinds', 'manuals', 'spins'] as const
export type Family = (typeof FAMILIES)[number]

export type Pattern = 'flip-only' | 'manual-only' | 'grind-only' | 'flip→grind' | 'flip→manual' | 'spin-only'
export type Dir = 'FS' | 'BS'

export interface Spin {
  deg: 180 | 360
  dir: Dir
}

/** Stable components of one generated challenge. Display text is derived. */
export interface Trick {
  obstacle: Obstacle
  stance: Stance
  pattern: Pattern
  flip?: string
  grind?: string
  direction?: Dir
  manual?: string
  spin?: Spin
}

export interface Filters {
  obstacles: Obstacle[]
  stances: Stance[]
  families: Family[]
  subs: Record<Family, string[]>
}

export interface RatedTrick {
  trick: Trick
  /** Exact prompt identity (includes obstacle): used for repeat avoidance. */
  key: string
  /** Historical spec signature (excludes obstacle): used for repeat penalty. */
  signature: string
  /** 1–10 skill rating, one decimal. Not the same thing as points. */
  rating: number
  /** Highest hard level gate among the components. */
  gate: number
  experimental: boolean
}

export type Outcome = 'landed' | 'failed' | 'skipped' | 'abandoned'
