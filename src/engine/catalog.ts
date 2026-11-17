import { rateTrick } from './difficulty'
import { trickKey, trickSignature } from './format'
import { CONFIG } from './rules'
import { FAMILIES, OBSTACLES, STANCES, type Dir, type Filters, type Pattern, type RatedTrick, type Spin, type Trick } from './types'
import { filterViolations, validateTrick } from './validate'

const DIRS: Dir[] = ['FS', 'BS']
const subsOf = (fam: string) => Object.keys(CONFIG.families[fam]?.subs ?? {})
const SPINS: (Spin | undefined)[] = [undefined]
for (const deg of subsOf('spins').map(Number) as (180 | 360)[]) for (const dir of DIRS) SPINS.push({ deg, dir })

let cache: RatedTrick[] | null = null

/**
 * Every structurally legal trick (ignoring player filters and level), rated.
 * Enumerating up front means selection never "tries and falls back": it picks
 * from a pool where every member already passed validateTrick.
 */
export function fullCatalog(): RatedTrick[] {
  if (cache) return cache
  const out: RatedTrick[] = []
  const seen = new Set<string>()
  const push = (t: Trick) => {
    const v = validateTrick(t, { experimental: true })
    if (!v.ok) return
    const key = trickKey(t)
    if (seen.has(key)) return
    seen.add(key)
    out.push({ trick: t, key, signature: trickSignature(t), rating: rateTrick(t, v.gate).rating, gate: v.gate, experimental: v.experimental })
  }
  const patterns: Pattern[] = ['flip-only', 'manual-only', 'grind-only', 'flip→grind', 'flip→manual', 'spin-only']
  for (const obstacle of OBSTACLES)
    for (const stance of STANCES)
      for (const pattern of patterns)
        for (const spin of SPINS) {
          const base = { obstacle, stance, pattern, ...(spin ? { spin } : {}) } as Trick
          switch (pattern) {
            case 'flip-only':
              for (const flip of subsOf('flips')) push({ ...base, flip })
              break
            case 'manual-only':
              for (const manual of subsOf('manuals')) push({ ...base, manual })
              break
            case 'grind-only':
              for (const grind of subsOf('grinds')) for (const direction of DIRS) push({ ...base, grind, direction })
              break
            case 'flip→grind':
              for (const flip of subsOf('flips'))
                for (const grind of subsOf('grinds')) for (const direction of DIRS) push({ ...base, flip, grind, direction })
              break
            case 'flip→manual':
              for (const flip of subsOf('flips')) for (const manual of subsOf('manuals')) push({ ...base, flip, manual })
              break
            case 'spin-only':
              push(base)
              break
          }
        }
  cache = out
  return out
}

export function defaultFilters(): Filters {
  return {
    obstacles: [...OBSTACLES],
    stances: [...STANCES],
    families: [...FAMILIES],
    subs: Object.fromEntries(FAMILIES.map((f) => [f, subsOf(f)])) as Filters['subs'],
  }
}

/** Repair saved filters against the current config (unknown values dropped). */
export function sanitizeFilters(f: Partial<Filters> | undefined): Filters {
  const d = defaultFilters()
  if (!f) return d
  const keep = <T extends string>(arr: unknown, allowed: readonly T[]): T[] =>
    Array.isArray(arr) ? (arr.filter((x) => (allowed as readonly string[]).includes(x)) as T[]) : [...allowed]
  return {
    obstacles: keep(f.obstacles, OBSTACLES),
    stances: keep(f.stances, STANCES),
    families: keep(f.families, FAMILIES),
    subs: Object.fromEntries(FAMILIES.map((fam) => [fam, keep(f.subs?.[fam], d.subs[fam])])) as Filters['subs'],
  }
}

const filteredCache = new Map<string, RatedTrick[]>()
export function filteredCatalog(filters: Filters, experimental: boolean): RatedTrick[] {
  const k = JSON.stringify([filters, experimental])
  let hit = filteredCache.get(k)
  if (!hit) {
    hit = fullCatalog().filter((c) => (experimental || !c.experimental) && filterViolations(c.trick, filters).length === 0)
    if (filteredCache.size > 50) filteredCache.clear()
    filteredCache.set(k, hit)
  }
  return hit
}

export interface PoolDiagnosis {
  /** Legal tricks under filters, any level */
  anyLevel: number
  /** Legal tricks available right now at this level */
  atLevel: number
  /** Lowest level at which anything becomes available, or null */
  minLevel: number | null
  messages: string[]
}

const FAMILY_LABEL: Record<string, string> = { flips: 'Flips', grinds: 'Grinds/Slides', manuals: 'Manuals', spins: 'Spins' }

/** Explain an empty or thin pool in player terms, with concrete fixes. */
export function diagnosePool(filters: Filters, gateLevel: number, maxRating: number, experimental = false): PoolDiagnosis {
  const pool = filteredCatalog(filters, experimental)
  const atLevel = pool.filter((c) => c.gate <= gateLevel && c.rating <= maxRating).length
  const minLevel = pool.length ? Math.min(...pool.map((c) => Math.max(c.gate, Math.ceil(c.rating - (maxRating - gateLevel))))) : null
  const messages: string[] = []
  if (!filters.obstacles.length) messages.push('No obstacles selected. Pick at least one.')
  if (!filters.stances.length) messages.push('No stances selected. Turn on at least Regular.')
  const activeFamilies = filters.families.filter((f) => filters.subs[f]?.length)
  if (!activeFamilies.length) messages.push('No trick families selected.')
  else if (activeFamilies.length === 1 && activeFamilies[0] === 'spins' && !filters.obstacles.some((o) => ['flat', 'gap', 'bank'].includes(o)))
    messages.push('Spins on their own need flat, a gap or a bank.')
  if (pool.length === 0 && messages.length === 0) {
    // Which families would make these obstacles work?
    const unlock = new Set<string>()
    for (const c of fullCatalog()) {
      if (c.experimental || !filters.obstacles.includes(c.trick.obstacle)) continue
      if (c.trick.flip) unlock.add('flips')
      if (c.trick.grind) unlock.add('grinds')
      if (c.trick.manual) unlock.add('manuals')
    }
    const names = [...unlock].map((f) => FAMILY_LABEL[f])
    messages.push(
      `Nothing on ${filters.obstacles.join(', ')} matches your trick families.` + (names.length ? ` Try enabling ${names.join(' or ')}.` : ''),
    )
  } else if (pool.length > 0 && atLevel === 0 && minLevel !== null) {
    messages.push(`These obstacles and tricks start around level ${minLevel}. Add easier obstacles (flat, manual pad, curb) or raise your level.`)
  }
  return { anyLevel: pool.length, atLevel, minLevel, messages }
}
