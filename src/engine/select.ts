import { gateLevelOf } from './adapt'
import { diagnosePool, filteredCatalog, type PoolDiagnosis } from './catalog'
import { CONFIG } from './rules'
import type { Rng } from './rng'
import type { Tunables } from './tunables'
import type { Filters, Pattern, RatedTrick } from './types'
import { validateTrick } from './validate'

export interface RecentPick {
  key: string
  pattern: Pattern
  obstacle: string
  main: string
}

export interface SelectionTrace {
  skill: number
  gateLevel: number
  mix: 'easy' | 'core' | 'stretch'
  target: number
  band: number
  poolSize: number
  bandSize: number
  spinRoll: string
  pattern: string
  notes: string[]
}

export type SelectResult =
  | { ok: true; pick: RatedTrick; trace: SelectionTrace }
  | { ok: false; diagnosis: PoolDiagnosis }

const lw = (w: number[] | undefined, level: number, floor: number) => Math.max(floor, w?.[level - 1] ?? 1)

/** Legacy patternPool weights, by level. */
function patternWeight(p: Pattern, L: number): number {
  switch (p) {
    case 'flip-only':
      return L <= 4 ? 8 : 5
    case 'manual-only':
      return L <= 3 ? 6 : 3
    case 'grind-only':
      return L <= 4 ? 3 : 6
    case 'flip→grind':
      return L >= 5 ? L - 3 : 0.5
    case 'flip→manual':
      return L >= 2 ? 5 : 0.5
    case 'spin-only':
      return 2
  }
}

/** Spec §9 spin frequency profile A. */
export function spinFrequency(L: number): number {
  return L <= 3 ? 0.08 : L <= 6 ? 0.28 : 0.5
}

export const mainComponent = (c: RatedTrick) => c.trick.flip ?? c.trick.grind ?? c.trick.manual ?? `spin${c.trick.spin?.deg}`

function groupBy<T>(xs: T[], f: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = f(x)
    const arr = m.get(k)
    if (arr) arr.push(x)
    else m.set(k, [x])
  }
  return m
}

/**
 * Pick the next challenge. Pool = only tricks that already passed validateTrick
 * for these filters and level; nothing outside it can ever be returned.
 */
export function selectChallenge(args: {
  filters: Filters
  skill: number
  recent: RecentPick[]
  rng: Rng
  tun: Tunables
  allowStretchBeyondCap?: boolean
}): SelectResult {
  const { filters, skill, recent, rng, tun } = args
  const level = gateLevelOf(skill)
  // Player-approved override for narrow filters: lift level gates, never legality
  const gateLevel = args.allowStretchBeyondCap ? 10 : level
  const maxRating = args.allowStretchBeyondCap ? 10 : skill + tun.maxStretch
  const pool = filteredCatalog(filters, tun.experimentalEnabled).filter((c) => c.gate <= gateLevel && c.rating <= maxRating)
  if (!pool.length) return { ok: false, diagnosis: diagnosePool(filters, gateLevel, maxRating, tun.experimentalEnabled) }

  const notes: string[] = []
  // 1. Exact-repeat cooldown. Only relaxed if it would empty the pool.
  const cooldown = recent.slice(-tun.repeatCooldown).map((r) => r.key)
  let fresh = pool.filter((c) => !cooldown.includes(c.key))
  if (!fresh.length) {
    const last = recent[recent.length - 1]?.key
    fresh = pool.filter((c) => c.key !== last)
    notes.push(`Pool exhausted by ${tun.repeatCooldown}-prompt cooldown; allowing an older repeat`)
    if (!fresh.length) {
      fresh = pool
      notes.push('Only one possible trick with these filters; it repeats')
    }
  }

  // 2. Difficulty target for this challenge: easy / core / stretch mix
  const roll = rng.next()
  const mix = roll < tun.mixEasy ? 'easy' : roll < tun.mixEasy + tun.mixStretch ? 'stretch' : 'core'
  const target = skill + (mix === 'easy' ? tun.easyOffset : mix === 'stretch' ? tun.stretchOffset : 0)

  // 3. Band around the target, widened only as needed
  let band = tun.difficultyBand
  let inBand = fresh.filter((c) => Math.abs(c.rating - target) <= band)
  while (!inBand.length) {
    band += 0.4
    inBand = fresh.filter((c) => Math.abs(c.rating - target) <= band)
  }
  if (band > tun.difficultyBand) notes.push(`Band widened to ±${band.toFixed(1)} (nothing closer under your filters)`)

  // 4. Spin frequency profile
  const withSpin = inBand.filter((c) => c.trick.spin)
  const noSpin = inBand.filter((c) => !c.trick.spin)
  let spinRoll = 'n/a'
  let cands = inBand
  if (withSpin.length && noSpin.length) {
    const p = spinFrequency(level)
    const yes = rng.next() < p
    cands = yes ? withSpin : noSpin
    spinRoll = `${yes ? 'spin' : 'no spin'} (p=${p})`
  }

  // 5. Pattern, with variety against the last pick
  const last = recent[recent.length - 1]
  const recent3 = recent.slice(-3)
  const byPattern = groupBy(cands, (c) => c.trick.pattern)
  const pattern = rng.pick([...byPattern.keys()] as Pattern[], (p) => patternWeight(p, level) * (last?.pattern === p ? 0.45 : 1))!
  cands = byPattern.get(pattern)!

  // 6. Obstacle (legacy weights, floored so user choices always count), with variety
  const byObstacle = groupBy(cands, (c) => c.trick.obstacle)
  const obstacle = rng.pick([...byObstacle.keys()], (o) => {
    let w = lw(CONFIG.obstacles[o]?.weight_by_level, level, 2)
    if (last?.obstacle === o) w *= 0.4
    else if (recent3.some((r) => r.obstacle === o)) w *= 0.75
    return w
  })!
  cands = byObstacle.get(obstacle)!

  // 7. Candidate: closeness to target × legacy stance/component weights × novelty
  const sigma = 0.5
  const pick = rng.pick(cands, (c) => {
    const t = c.trick
    let w = Math.exp(-((c.rating - target) ** 2) / (2 * sigma * sigma))
    w *= lw(CONFIG.stances[t.stance]?.weight_by_level, level, 1)
    if (t.flip) w *= lw(CONFIG.families.flips.subs[t.flip]?.weight_by_level, level, 1)
    if (t.grind) w *= lw(CONFIG.families.grinds.subs[t.grind]?.weight_by_level, level, 1)
    if (t.manual) w *= lw(CONFIG.families.manuals.subs[t.manual]?.weight_by_level, level, 1)
    const main = mainComponent(c)
    if (last?.main === main) w *= 0.3
    else if (recent3.some((r) => r.main === main)) w *= 0.7
    return w
  })!

  // Belt and braces: the same validator, same filters and level, must agree
  const v = validateTrick(pick.trick, { filters, gateLevel, experimental: tun.experimentalEnabled })
  if (!v.ok) throw new Error(`Selector produced invalid trick: ${v.reasons.join('; ')}`)

  return {
    ok: true,
    pick,
    trace: { skill, gateLevel, mix, target: Math.round(target * 100) / 100, band, poolSize: pool.length, bandSize: inBand.length, spinRoll, pattern, notes },
  }
}
