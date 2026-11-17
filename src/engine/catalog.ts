import { trickKey, trickSignature } from './canonical'
import { rateTrick } from './difficulty'
import { CONFIG, OBSTACLE_PATTERNS } from './rules'
import { BOARD_MOVES, EXITS, FAMILY_LABEL, GRINDS, LIPS, TRANSFER, TRANSFER_PAIRS, TRANSITIONS, familySubs } from './vocab'
import {
  FAMILIES,
  OBSTACLES,
  RARITY_LEVELS,
  STANCES,
  type Dir,
  type Family,
  type Filters,
  type Obstacle,
  type RatedTrick,
  type Spin,
  type Trick,
} from './types'
import { filterViolations, validateTrick } from './validate'

const DIRS: Dir[] = ['FS', 'BS']
const SPINS: Spin[] = [180, 360].flatMap((deg) => DIRS.map((dir) => ({ deg: deg as 180 | 360, dir })))
const MOVES = Object.keys(BOARD_MOVES)
const GRIND_KEYS = Object.keys(GRINDS)
const MANUALS = Object.keys(CONFIG.families.manuals.subs)

export function familyOf(t: Trick): Family {
  if (t.pattern === 'coping') return 'stalls'
  if (t.grind) return 'grinds'
  if (t.manual) return 'manuals'
  if (t.flip === 'ollie' && t.spin) return 'spins'
  return 'flips'
}

let cache: RatedTrick[] | null = null

/**
 * Every structurally legal trick (ignoring player filters and level), rated.
 * Enumerated once with pruning (entries/exits only where their tables allow),
 * so selection always picks from tricks that already passed validateTrick.
 */
export function fullCatalog(): RatedTrick[] {
  if (cache) return cache
  const out: RatedTrick[] = []
  const seen = new Set<string>()
  const push = (t: Trick) => {
    const v = validateTrick(t)
    if (!v.ok) return
    const key = trickKey(t)
    if (seen.has(key)) return
    seen.add(key)
    out.push({ trick: t, key, signature: trickSignature(t), rating: rateTrick(t, v.gate).rating, gate: v.gate, rarity: v.rarity, family: familyOf(t) })
  }
  const exitVariants = (base: Trick, from: 'grind' | 'manual'): Trick[] => {
    const res: Trick[] = [base]
    for (const [k, e] of Object.entries(EXITS)) {
      if (from === 'grind' && (!e.grinds.includes(base.grind!) || !e.grindObstacles.includes(base.obstacle))) continue
      if (from === 'manual' && !e.manualObstacles.includes(base.obstacle)) continue
      if (e.directional) for (const d of DIRS) res.push({ ...base, exit: k, exitDir: d })
      else res.push({ ...base, exit: k })
    }
    return res
  }

  for (const obstacle of OBSTACLES) {
    const patterns = OBSTACLE_PATTERNS[obstacle]
    for (const stance of STANCES) {
      const b = { obstacle, stance }
      if (patterns.includes('flip-only')) {
        for (const flip of MOVES) {
          const base: Trick = { ...b, pattern: 'flip-only', flip }
          push(base)
          for (const flips of [2, 3] as const) push({ ...base, flips })
          for (const spin of SPINS) push({ ...base, spin })
          for (const d of DIRS) push({ ...base, revert: d })
        }
      }
      if (patterns.includes('grind-only') || patterns.includes('flip→grind')) {
        for (const grind of GRIND_KEYS) {
          if (!GRINDS[grind].allowed.includes(obstacle)) continue
          for (const direction of DIRS) {
            const g: Trick = { ...b, pattern: 'grind-only', grind, direction }
            for (const t of exitVariants(g, 'grind')) push(t)
            for (const [a, c] of TRANSITIONS) if (a === grind) push({ ...g, grind2: c })
            push({ ...g, spin: { deg: 180, dir: 'FS' } })
            push({ ...g, spin: { deg: 180, dir: 'BS' } })
            if (patterns.includes('flip→grind'))
              for (const flip of MOVES) {
                if (BOARD_MOVES[flip].grindEntry === undefined) continue
                const fg: Trick = { ...g, pattern: 'flip→grind', flip }
                push(fg)
                for (const spin of SPINS) if (spin.deg === 180) push({ ...fg, spin })
                for (const t of exitVariants(fg, 'grind').slice(1)) push(t)
              }
          }
        }
      }
      if (patterns.includes('manual-only') || patterns.includes('flip→manual')) {
        for (const manual of MANUALS) {
          const mt: Trick = { ...b, pattern: 'manual-only', manual }
          for (const t of exitVariants(mt, 'manual')) push(t)
          for (const d of DIRS) push({ ...mt, revert: d })
          for (const dir of DIRS) push({ ...mt, spin: { deg: 180, dir } })
          if (patterns.includes('flip→manual'))
            for (const flip of MOVES) {
              if (BOARD_MOVES[flip].manualEntry === undefined) continue
              const fm: Trick = { ...mt, pattern: 'flip→manual', flip }
              for (const t of exitVariants(fm, 'manual')) push(t)
            }
        }
      }
      if (patterns.includes('coping')) {
        for (const [lip, l] of Object.entries(LIPS)) {
          const dirs: (Dir | undefined)[] = l.directional ? DIRS : [undefined]
          for (const lipDir of dirs) {
            const c: Trick = { ...b, pattern: 'coping', lip, ...(lipDir ? { lipDir } : {}) }
            push(c)
            if (l.revert) push({ ...c, revert: 'FS' })
          }
        }
      }
      for (const [from, to] of TRANSFER_PAIRS) {
        if (from !== obstacle) continue
        for (const flip of TRANSFER.moves) push({ ...b, pattern: 'transfer', flip, transferTo: to })
        for (const dir of DIRS) push({ ...b, pattern: 'transfer', flip: 'ollie', spin: { deg: 180, dir }, transferTo: to })
      }
    }
  }
  cache = out
  return out
}

/** All sub-options in settings order (core, then advanced). */
export function allSubs(): Filters['subs'] {
  const fs = familySubs()
  return Object.fromEntries(FAMILIES.map((f) => [f, [...fs[f].core, ...fs[f].advanced]])) as Filters['subs']
}

export function defaultFilters(): Filters {
  return {
    v: 2,
    obstacles: [...OBSTACLES],
    stances: [...STANCES],
    families: [...FAMILIES],
    subs: allSubs(),
    doubles: true,
    triples: false,
    transfers: false,
    rarity: 'very-low',
  }
}

/** v1 vocabulary per family: anything not listed here is new in v2 and starts enabled for old saves. */
const V1_SUBS: Record<Family, string[]> = {
  flips: ['kickflip', 'heelflip', 'varial kickflip', 'varial heelflip', 'hardflip', 'inward heelflip', 'tre flip', 'laser flip'],
  grinds: Object.keys(CONFIG.families.grinds.subs),
  manuals: Object.keys(CONFIG.families.manuals.subs),
  spins: Object.keys(CONFIG.families.spins.subs),
  stalls: [],
}

/** Repair saved filters against the current vocabulary (unknown values dropped; new v2 options enabled for v1 saves). */
export function sanitizeFilters(f: Partial<Filters> | undefined): Filters {
  const d = defaultFilters()
  if (!f || typeof f !== 'object') return d
  const keep = <T extends string>(arr: unknown, allowed: readonly T[]): T[] =>
    Array.isArray(arr) ? (arr.filter((x) => (allowed as readonly string[]).includes(x)) as T[]) : [...allowed]
  const fromV1 = f.v !== 2
  const families = keep(f.families, FAMILIES)
  if (fromV1 && !families.includes('stalls')) families.push('stalls')
  const subs = Object.fromEntries(
    FAMILIES.map((fam) => {
      const saved = f.subs?.[fam] as unknown
      if (!Array.isArray(saved)) return [fam, [...d.subs[fam]]]
      return [fam, d.subs[fam].filter((x) => saved.includes(x) || (fromV1 && !V1_SUBS[fam].includes(x)))]
    }),
  ) as Filters['subs']
  return {
    v: 2,
    obstacles: keep(f.obstacles, OBSTACLES),
    stances: keep(f.stances, STANCES),
    families,
    subs,
    doubles: typeof f.doubles === 'boolean' ? f.doubles : d.doubles,
    triples: typeof f.triples === 'boolean' ? f.triples : d.triples,
    transfers: typeof f.transfers === 'boolean' ? f.transfers : d.transfers,
    rarity: (RARITY_LEVELS as readonly string[]).includes(f.rarity as string) ? (f.rarity as Filters['rarity']) : d.rarity,
  }
}

const filteredCache = new Map<string, RatedTrick[]>()
export function filteredCatalog(filters: Filters): RatedTrick[] {
  const k = JSON.stringify(filters)
  let hit = filteredCache.get(k)
  if (!hit) {
    hit = fullCatalog().filter((c) => filterViolations(c.trick, filters, c.rarity).length === 0)
    if (filteredCache.size > 50) filteredCache.clear()
    filteredCache.set(k, hit)
  }
  return hit
}

export interface PoolDiagnosis {
  anyLevel: number
  atLevel: number
  minLevel: number | null
  messages: string[]
  /** Per-family availability at this level (for settings hints) */
  byFamily: Record<Family, number>
}

/** Explain an empty or thin pool in player terms, with concrete fixes. */
export function diagnosePool(filters: Filters, gateLevel: number, maxRating: number): PoolDiagnosis {
  const pool = filteredCatalog(filters)
  const at = pool.filter((c) => c.gate <= gateLevel && c.rating <= maxRating + 0.05)
  const byFamily = Object.fromEntries(FAMILIES.map((f) => [f, at.filter((c) => c.family === f).length])) as Record<Family, number>
  const minLevel = pool.length ? Math.min(...pool.map((c) => Math.max(c.gate, Math.ceil(c.rating - (maxRating - gateLevel))))) : null
  const messages: string[] = []
  if (!filters.obstacles.length) messages.push('No obstacles selected. Pick the ones you have (or tap All).')
  if (!filters.stances.length) messages.push('No stances selected. Turn on at least Regular.')
  const activeFamilies = filters.families.filter((f) => filters.subs[f]?.length)
  if (!activeFamilies.length) messages.push('No trick types selected. Turn on at least one family.')
  if (pool.length === 0 && messages.length === 0) {
    const unlock = new Set<Family>()
    for (const c of fullCatalog()) {
      if (c.rarity !== 'core' || !filters.obstacles.includes(c.trick.obstacle)) continue
      unlock.add(c.family)
    }
    const names = [...unlock].filter((f) => !activeFamilies.includes(f)).map((f) => FAMILY_LABEL[f])
    messages.push(
      `Nothing on ${filters.obstacles.join(', ')} matches your trick types.` + (names.length ? ` Try turning on ${names.join(' or ')}.` : ' Try more stances or trick options.'),
    )
  } else if (pool.length > 0 && at.length === 0 && minLevel !== null) {
    messages.push(`These obstacles and tricks start around level ${minLevel}. Add easier obstacles (flat, manual pad, curb) or raise your level.`)
  }
  return { anyLevel: pool.length, atLevel: at.length, minLevel, messages, byFamily }
}

export function obstaclesFor(family: Family): Obstacle[] {
  return OBSTACLES.filter((o) => fullCatalog().some((c) => c.family === family && c.trick.obstacle === o))
}
