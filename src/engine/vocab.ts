/**
 * Trick vocabulary v2: component tables, not full-trick strings.
 * Legacy weights from model-config.json are reused where they exist; every
 * value marked PROVISIONAL is a tunable playtest default.
 * See docs/TRICK_INTELLIGENCE_V2_DECISIONS.md.
 */
import { CONFIG } from './rules'
import type { Dir, Family, Obstacle, Rarity } from './types'

export type FlipKind = 'kick' | 'heel' | 'impossible' | 'pressure'

export interface BoardMove {
  key: string
  /** Conventional name, Title Case */
  label: string
  flip?: FlipKind
  /** Shuvit (board) rotation */
  board?: { deg: 180 | 360 | 540; dir: Dir }
  late?: boolean
  gate: number
  /** Difficulty points (rating), separate from score value */
  diff: number
  rarity: Rarity
  /** Obstacles where it can be done as a standalone air */
  air: Obstacle[]
  /** Level gate when used as a grind entry (flip-in / shuvit-in); absent = not an entry */
  grindEntry?: number
  /** Level gate when used as a manual entry (manual pad only); absent = not an entry */
  manualEntry?: number
  /** Max flip count (2 = can be doubled, 3 = can be tripled) */
  maxFlips?: 2 | 3
  /** Settings group */
  advanced?: boolean
  aliases?: string[]
}

const FLAT3: Obstacle[] = ['flat', 'bank', 'gap']
const FLAT4: Obstacle[] = ['flat', 'bank', 'gap']

export const BOARD_MOVES: Record<string, BoardMove> = Object.fromEntries(
  (
    [
      { key: 'ollie', label: 'Ollie', gate: 1, diff: 0.5, rarity: 'core', air: ['flat', 'gap'] },
      { key: 'bs pop shuvit', label: 'BS Pop Shuvit', board: { deg: 180, dir: 'BS' }, gate: 1, diff: 1, rarity: 'core', air: FLAT4, grindEntry: 5, manualEntry: 2, aliases: ['pop shuvit', 'shuvit', 'pop shove-it', 'shove-it', 'backside pop shuvit'] },
      { key: 'fs pop shuvit', label: 'FS Pop Shuvit', board: { deg: 180, dir: 'FS' }, gate: 2, diff: 1.3, rarity: 'core', air: FLAT4, grindEntry: 6, manualEntry: 3, aliases: ['frontside pop shuvit', 'fs shuvit', 'frontside shove-it'] },
      { key: 'kickflip', label: 'Kickflip', flip: 'kick', gate: 1, diff: 1, rarity: 'core', air: ['flat', 'bank', 'gap', 'quarterpipe'], grindEntry: 5, manualEntry: 2, maxFlips: 3, aliases: ['flip'] },
      { key: 'heelflip', label: 'Heelflip', flip: 'heel', gate: 1, diff: 1, rarity: 'core', air: ['flat', 'bank', 'gap', 'quarterpipe'], grindEntry: 5, manualEntry: 2, maxFlips: 3, aliases: ['heel'] },
      { key: 'bs 360 shuvit', label: 'BS 360 Shuvit', board: { deg: 360, dir: 'BS' }, gate: 3, diff: 2.5, rarity: 'core', air: FLAT3, grindEntry: 8, aliases: ['360 shuvit', '360 shove-it', 'backside 360 shuvit'] },
      { key: 'fs 360 shuvit', label: 'FS 360 Shuvit', board: { deg: 360, dir: 'FS' }, gate: 4, diff: 3, rarity: 'core', air: FLAT3, aliases: ['frontside 360 shuvit'] },
      { key: 'varial kickflip', label: 'Varial Kickflip', flip: 'kick', board: { deg: 180, dir: 'BS' }, gate: 3, diff: 2, rarity: 'core', air: ['flat', 'bank', 'gap', 'quarterpipe'], grindEntry: 7, manualEntry: 4, maxFlips: 2, aliases: ['varial flip'] },
      { key: 'varial heelflip', label: 'Varial Heelflip', flip: 'heel', board: { deg: 180, dir: 'FS' }, gate: 3, diff: 2, rarity: 'core', air: ['flat', 'bank', 'gap', 'quarterpipe'], grindEntry: 7, manualEntry: 4, maxFlips: 2, aliases: ['varial heel'] },
      { key: 'hardflip', label: 'Hardflip', flip: 'kick', board: { deg: 180, dir: 'FS' }, gate: 4, diff: 3, rarity: 'core', air: FLAT3, grindEntry: 8, manualEntry: 6, maxFlips: 2 },
      { key: 'inward heelflip', label: 'Inward Heelflip', flip: 'heel', board: { deg: 180, dir: 'BS' }, gate: 4, diff: 3, rarity: 'core', air: FLAT3, grindEntry: 8, maxFlips: 2, aliases: ['inward heel'] },
      { key: 'tre flip', label: 'Tre Flip', flip: 'kick', board: { deg: 360, dir: 'BS' }, gate: 6, diff: 5, rarity: 'core', air: FLAT3, grindEntry: 9, manualEntry: 8, maxFlips: 2, aliases: ['360 flip', 'three flip', '3 flip', 'tre'] },
      { key: 'laser flip', label: 'Laser Flip', flip: 'heel', board: { deg: 360, dir: 'FS' }, gate: 8, diff: 6, rarity: 'core', air: FLAT3, aliases: ['laser', '360 heelflip'] },
      // Advanced & rare
      { key: 'impossible', label: 'Impossible', flip: 'impossible', gate: 8, diff: 5, rarity: 'uncommon', air: FLAT3, advanced: true },
      { key: 'pressure flip', label: 'Pressure Flip', flip: 'pressure', gate: 5, diff: 4, rarity: 'rare', air: ['flat'], advanced: true },
      { key: 'late kickflip', label: 'Late Kickflip', flip: 'kick', late: true, gate: 7, diff: 5, rarity: 'rare', air: FLAT3, advanced: true },
      { key: 'late heelflip', label: 'Late Heelflip', flip: 'heel', late: true, gate: 7, diff: 5, rarity: 'rare', air: FLAT3, advanced: true },
      { key: 'late bs shuvit', label: 'Late BS Shuvit', board: { deg: 180, dir: 'BS' }, late: true, gate: 7, diff: 4, rarity: 'rare', air: FLAT3, advanced: true },
      { key: 'late fs shuvit', label: 'Late FS Shuvit', board: { deg: 180, dir: 'FS' }, late: true, gate: 7, diff: 4.3, rarity: 'rare', air: FLAT3, advanced: true },
      { key: '360 hardflip', label: '360 Hardflip', flip: 'kick', board: { deg: 360, dir: 'FS' }, gate: 9, diff: 7, rarity: 'rare', air: ['flat', 'gap'], advanced: true },
      { key: '360 inward heelflip', label: '360 Inward Heelflip', flip: 'heel', board: { deg: 360, dir: 'BS' }, gate: 9, diff: 7, rarity: 'rare', air: ['flat', 'gap'], advanced: true },
      { key: 'bs 540 shuvit', label: 'BS 540 Shuvit', board: { deg: 540, dir: 'BS' }, gate: 9, diff: 6, rarity: 'rare', air: ['flat', 'gap'], advanced: true },
      { key: 'fs 540 shuvit', label: 'FS 540 Shuvit', board: { deg: 540, dir: 'FS' }, gate: 9, diff: 6.5, rarity: 'rare', air: ['flat', 'gap'], advanced: true },
    ] satisfies BoardMove[]
  ).map((m) => [m.key, m]),
)

/** Explicitly out of scope in this pass. Never generated, never parsed. */
export const EXCLUDED_MOVES = ['hospital flip', 'casper flip', 'casper', 'primo', 'no comply', 'darkslide']

// ---- Score values (PROVISIONAL decomposition; reproduces legacy named-flip values exactly) ----
export const FLIP_VALUE: Record<FlipKind, number> = { kick: 0.3, heel: 0.35, impossible: 0.9, pressure: 0.55 }
export const BOARD_VALUE: Record<number, number> = { 180: 0.15, 360: 0.35, 540: 0.6 }
/** Mechanical difficulty of combining a flip with a shuvit direction (hardflip, inward, tre, laser…). Not a name bonus. */
export function interactionValue(flip: FlipKind | undefined, board: BoardMove['board']): number {
  if (!flip || !board) return 0
  const k = `${flip}:${board.dir}${board.deg}`
  return ({ 'kick:FS180': 0.1, 'heel:BS180': 0.1, 'kick:BS360': 0.15, 'heel:FS360': 0.15, 'kick:FS360': 0.25, 'heel:BS360': 0.25 } as Record<string, number>)[k] ?? 0
}
export const LATE_VALUE = 0.4
export const EXTRA_FLIP_VALUE = 0.35
export const EXTRA_FLIP_DIFF = 2

export function boardMoveValue(m: BoardMove): { label: string; value: number }[] {
  const parts: { label: string; value: number }[] = []
  if (m.flip) parts.push({ label: m.flip === 'kick' ? 'Kickflip rotation' : m.flip === 'heel' ? 'Heelflip rotation' : m.label, value: FLIP_VALUE[m.flip] })
  if (m.board) parts.push({ label: `${m.board.dir} ${m.board.deg} shuvit rotation`, value: BOARD_VALUE[m.board.deg] })
  const ix = interactionValue(m.flip, m.board)
  if (ix) parts.push({ label: 'Flip + shuvit direction', value: ix })
  if (m.late) parts.push({ label: 'Late timing', value: LATE_VALUE })
  return parts
}

// ---- Grinds / slides (legacy 13 + new) ----
export interface GrindDef {
  diff: number
  minLevel: number
  allowed: Obstacle[]
  value: number
  dirMult?: { FS: number; BS: number }
  weights?: number[]
  rarity: Rarity
  label: string
  advanced?: boolean
}
const GRIND_LABEL: Record<string, string> = {
  '50-50': '50-50',
  '5-0': '5-0',
  boardslide: 'Boardslide',
  noseslide: 'Noseslide',
  tailslide: 'Tailslide',
  lipslide: 'Lipslide',
  smith: 'Smith Grind',
  feeble: 'Feeble Grind',
  crooked: 'Crooked Grind',
  nosegrind: 'Nosegrind',
  overcrook: 'Overcrook',
  bluntslide: 'Bluntslide',
  noseblunt: 'Noseblunt Slide',
}
/** EXTENSION: coping grinds on quarterpipe for these legacy grinds */
const QP_GRINDS = ['50-50', '5-0', 'smith', 'feeble', 'lipslide', 'tailslide']
/** EXTENSION: flip-ins on box/curb (legacy limited flip→grind to ledge/rails) */
export const GRINDS: Record<string, GrindDef> = {
  ...Object.fromEntries(
    Object.entries(CONFIG.families.grinds.subs).map(([k, s]) => [
      k,
      {
        diff: s.diff,
        minLevel: s.minLevel,
        allowed: [...(s.allowed_obstacles as Obstacle[]), ...(QP_GRINDS.includes(k) ? (['quarterpipe'] as Obstacle[]) : [])],
        value: CONFIG.scoring.grind_base[k] ?? 0,
        dirMult: CONFIG.scoring.grind_dir_mult[k],
        weights: s.weight_by_level,
        rarity: 'core' as Rarity,
        label: GRIND_LABEL[k] ?? k,
      },
    ]),
  ),
  salad: { diff: 5, minLevel: 6, allowed: ['ledge', 'box', 'hubba', 'flatbar', 'rail'], value: 0.65, rarity: 'uncommon', label: 'Salad Grind' },
  willy: { diff: 5, minLevel: 6, allowed: ['ledge', 'box', 'hubba', 'flatbar', 'rail'], value: 0.6, rarity: 'uncommon', label: 'Willy Grind' },
  hurricane: { diff: 7, minLevel: 8, allowed: ['ledge', 'box', 'hubba', 'flatbar', 'rail'], value: 0.85, rarity: 'rare', label: 'Hurricane', advanced: true },
  'slash grind': { diff: 3, minLevel: 3, allowed: ['quarterpipe'], value: 0.45, rarity: 'core', label: 'Slash Grind' },
}

/** Grind-to-grind transitions (same direction). Rare, high level. */
export const TRANSITIONS: [string, string][] = [
  ['50-50', '5-0'],
  ['5-0', '50-50'],
  ['nosegrind', 'crooked'],
  ['crooked', 'nosegrind'],
  ['50-50', 'nosegrind'],
]
export const TRANSITION = { gate: 8, diff: 1.5, valueShare: 0.5, rarity: 'rare' as Rarity, obstacles: ['ledge', 'box', 'hubba', 'flatbar', 'rail'] as Obstacle[] }

// ---- Manuals ----
export const MANUAL_LABEL: Record<string, string> = { manual: 'Manual', 'nose manual': 'Nose Manual' }

// ---- Quarterpipe stalls & lip tricks ----
export interface LipDef {
  label: string
  directional: boolean
  gate: number
  diff: number
  value: number
  rarity: Rarity
  /** Allows the disaster-style revert landing */
  revert?: boolean
}
export const LIPS: Record<string, LipDef> = {
  // Difficulties staggered so coping tricks spread across levels 1–7 instead of stacking on gates (PROVISIONAL)
  'tail stall': { label: 'Tail Stall', directional: false, gate: 1, diff: 0.5, value: 0.25, rarity: 'core' },
  'rock to fakie': { label: 'Rock to Fakie', directional: false, gate: 1, diff: 0.9, value: 0.3, rarity: 'core' },
  'axle stall': { label: 'Axle Stall', directional: true, gate: 1, diff: 1.2, value: 0.3, rarity: 'core' },
  'nose stall': { label: 'Nose Stall', directional: false, gate: 2, diff: 1.6, value: 0.3, rarity: 'core' },
  '5-0 stall': { label: '5-0 Stall', directional: true, gate: 2, diff: 2.0, value: 0.35, rarity: 'core' },
  'rock and roll': { label: 'Rock and Roll', directional: false, gate: 3, diff: 2.5, value: 0.4, rarity: 'core' },
  nosepick: { label: 'Nosepick', directional: false, gate: 3, diff: 2.9, value: 0.4, rarity: 'core' },
  disaster: { label: 'Disaster', directional: true, gate: 4, diff: 3.3, value: 0.5, rarity: 'core', revert: true },
  'smith stall': { label: 'Smith Stall', directional: true, gate: 4, diff: 3.8, value: 0.55, rarity: 'core' },
  'feeble stall': { label: 'Feeble Stall', directional: true, gate: 5, diff: 4.3, value: 0.55, rarity: 'core' },
  'blunt to fakie': { label: 'Blunt to Fakie', directional: true, gate: 5, diff: 4.8, value: 0.6, rarity: 'core' },
  'noseblunt stall': { label: 'Noseblunt Stall', directional: true, gate: 6, diff: 5.5, value: 0.7, rarity: 'uncommon' },
}

// ---- Exits ----
export interface ExitDef {
  label: string
  gate: number
  diff: number
  value: number
  rarity: Rarity
  /** Grinds this exit works from */
  grinds: string[]
  grindObstacles: Obstacle[]
  /** Manual exits */
  manualObstacles: Obstacle[]
  /** Needs exitDir (body rotation out) */
  directional?: boolean
  /** Required family + any-of subs to be enabled */
  requires?: { family: Family; anyOf: string[] }
}
const OUT_GRINDS = ['50-50', '5-0', 'nosegrind', 'crooked', 'noseslide', 'tailslide', 'smith', 'feeble', 'boardslide', 'lipslide', 'salad', 'willy']
const OUT_OBS: Obstacle[] = ['ledge', 'box', 'curb', 'hubba', 'flatbar', 'rail']
export const EXITS: Record<string, ExitDef> = {
  'kickflip out': { label: 'Kickflip Out', gate: 6, diff: 1.5, value: 0.3, rarity: 'uncommon', grinds: OUT_GRINDS, grindObstacles: OUT_OBS, manualObstacles: ['manual pad', 'box', 'curb'], requires: { family: 'flips', anyOf: ['kickflip'] } },
  'heelflip out': { label: 'Heelflip Out', gate: 6, diff: 1.6, value: 0.35, rarity: 'uncommon', grinds: OUT_GRINDS, grindObstacles: OUT_OBS, manualObstacles: ['manual pad', 'box', 'curb'], requires: { family: 'flips', anyOf: ['heelflip'] } },
  'shuvit out': { label: 'Shuvit Out', gate: 5, diff: 1, value: 0.15, rarity: 'uncommon', grinds: ['50-50', '5-0', 'nosegrind', 'noseslide', 'tailslide', 'boardslide', 'lipslide', 'bluntslide', 'noseblunt'], grindObstacles: OUT_OBS, manualObstacles: ['manual pad', 'box', 'curb'], requires: { family: 'flips', anyOf: ['bs pop shuvit', 'fs pop shuvit'] } },
  '180 out': { label: '180 Out', gate: 7, diff: 1.5, value: 0.1, rarity: 'rare', directional: true, grinds: ['50-50', '5-0', 'nosegrind', 'crooked', 'noseslide', 'tailslide', 'smith', 'feeble'], grindObstacles: ['ledge', 'box', 'curb', 'hubba'], manualObstacles: ['manual pad'], requires: { family: 'spins', anyOf: ['180'] } },
  'pop over': { label: 'Pop Over', gate: 6, diff: 1, value: 0.15, rarity: 'rare', grinds: ['boardslide', 'lipslide'], grindObstacles: ['flatbar', 'rail', 'handrail'], manualObstacles: [] },
}
/** Entry + exit on the same grind/manual */
export const SEQUENCE = { gate: 8, diff: 1, rarity: 'very-rare' as Rarity }

// ---- Reverts ----
export const REVERT = { gate: 5, diff: 1, value: 0.1, rarity: 'rare' as Rarity, airObstacles: ['flat', 'bank'] as Obstacle[], manualObstacles: ['manual pad', 'box'] as Obstacle[] }

// ---- Transfers ----
// Manual pad transfers removed: every manual pad trick must include a manual
export const TRANSFER_PAIRS: [Obstacle, Obstacle][] = [
  ['bank', 'quarterpipe'],
  ['quarterpipe', 'bank'],
]
export const TRANSFER = { gate: 5, diff: 1.5, value: 0.2, rarity: 'rare' as Rarity, moves: ['ollie', 'kickflip', 'heelflip', 'bs pop shuvit'] }

// ---- Body spin compatibility for standalone airs ----
export const SPIN_AIR_OBSTACLES: Record<number, Obstacle[]> = { 180: ['flat', 'gap', 'bank'], 360: ['flat', 'gap', 'bank'] }

/** Rarity for doubles/triples */
export const MULTI_FLIP = { 2: { gate: 7, rarity: 'rare' as Rarity }, 3: { gate: 9, rarity: 'very-rare' as Rarity } }

// ---- Settings families ----
export const FAMILY_LABEL: Record<Family, string> = { flips: 'Flips & shuvits', grinds: 'Grinds & slides', manuals: 'Manuals', spins: 'Spins', stalls: 'Stalls & lip tricks' }

export function familySubs(): Record<Family, { core: string[]; advanced: string[] }> {
  const moves = Object.values(BOARD_MOVES)
  const grinds = Object.entries(GRINDS)
  return {
    flips: { core: moves.filter((m) => !m.advanced).map((m) => m.key), advanced: moves.filter((m) => m.advanced).map((m) => m.key) },
    grinds: { core: grinds.filter(([, g]) => !g.advanced).map(([k]) => k), advanced: grinds.filter(([, g]) => g.advanced).map(([k]) => k) },
    manuals: { core: Object.keys(CONFIG.families.manuals.subs), advanced: [] },
    spins: { core: Object.keys(CONFIG.families.spins.subs), advanced: [] },
    stalls: { core: Object.keys(LIPS), advanced: [] },
  }
}

export function subLabel(family: Family, key: string): string {
  if (family === 'flips') return BOARD_MOVES[key]?.label ?? key
  if (family === 'grinds') return GRINDS[key]?.label ?? key
  if (family === 'manuals') return MANUAL_LABEL[key] ?? key
  if (family === 'stalls') return LIPS[key]?.label ?? key
  return `${key}°`
}

export function subGate(family: Family, key: string): number {
  if (family === 'flips') return BOARD_MOVES[key]?.gate ?? 1
  if (family === 'grinds') return GRINDS[key]?.minLevel ?? 1
  if (family === 'stalls') return LIPS[key]?.gate ?? 1
  if (family === 'manuals') return CONFIG.families.manuals.subs[key]?.minLevel ?? 1
  return CONFIG.families.spins.subs[key]?.minLevel ?? 1
}
