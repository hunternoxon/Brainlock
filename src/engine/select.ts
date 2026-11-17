import { gateLevelOf } from './adapt'
import { diagnosePool, filteredCatalog, type PoolDiagnosis } from './catalog'
import { CONFIG } from './rules'
import type { Rng } from './rng'
import type { Tunables } from './tunables'
import { FAMILIES, type Family, type Filters, type Pattern, type RatedTrick, type RarityLevel } from './types'
import { validateTrick } from './validate'
import { GRINDS } from './vocab'

export interface RecentPick {
  key: string
  signature?: string
  pattern: Pattern
  obstacle: string
  main: string
  family?: Family
  stance?: string
  exit?: string
}

export type Mix = 'easy' | 'core' | 'stretch' | 'recovery'

export interface SelectionTrace {
  skill: number
  /** Temporary in-session challenge boost applied to the target */
  boost: number
  gateLevel: number
  mix: Mix
  target: number
  maxRating: number
  band: number
  poolSize: number
  bandSize: number
  rarityRoll: string
  spinRoll: string
  pattern: string
  notes: string[]
}

export type SelectResult = { ok: true; pick: RatedTrick; trace: SelectionTrace } | { ok: false; diagnosis: PoolDiagnosis }

const lw = (w: number[] | undefined, level: number, floor: number) => Math.max(floor, w?.[level - 1] ?? 1)

/** Legacy patternPool weights by level, plus v2 patterns. */
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
    case 'coping':
      return 6
    case 'transfer':
      return 2
  }
}

/** Spec §9 spin frequency profile A. */
export function spinFrequency(L: number): number {
  return L <= 3 ? 0.08 : L <= 6 ? 0.28 : 0.5
}

/** The quarterpipe is a coping obstacle first: plain flip airs there are de-emphasised. */
const PATTERN_AFFINITY: Partial<Record<string, Partial<Record<Pattern, number>>>> = { quarterpipe: { 'flip-only': 0.35 } }

const RARITY_SCALE: Record<RarityLevel, number> = { off: 0, 'very-low': 1, low: 2.5, normal: 5 }

export const mainComponent = (c: RatedTrick) => c.trick.lip ?? c.trick.grind ?? c.trick.manual ?? (c.trick.flip === 'ollie' && c.trick.spin ? `spin${c.trick.spin.deg}` : c.trick.flip ?? '')

export function recentOf(c: RatedTrick): RecentPick {
  return { key: c.key, signature: c.signature, pattern: c.trick.pattern, obstacle: c.trick.obstacle, main: mainComponent(c), family: c.family, stance: c.trick.stance, exit: c.trick.exit }
}

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

export interface SelectArgs {
  filters: Filters
  skill: number
  recent: RecentPick[]
  rng: Rng
  tun: Tunables
  /** Player-approved override for narrow filters: lift level gates, never legality */
  allowStretchBeyondCap?: boolean
  /** Temporary in-session challenge boost (≤ maxBoost; may be negative after "too hard") */
  boost?: number
  /** Offer one modestly easier challenge */
  recovery?: boolean
  /** Skills already seen this session (signature) */
  seen?: Set<string>
  /** Per-family offsets (only used when familySkillEnabled) */
  familySkill?: Partial<Record<Family, number>>
}

/**
 * Pick the next challenge from tricks that already passed validateTrick for
 * these filters and level. Nothing outside that pool can ever be returned.
 */
export function selectChallenge(a: SelectArgs): SelectResult {
  const { filters, skill, recent, rng, tun } = a
  const boost = Math.max(-tun.maxBoost, Math.min(tun.maxBoost, a.boost ?? 0))
  const level = gateLevelOf(skill)
  const gateLevel = a.allowStretchBeyondCap ? 10 : gateLevelOf(skill + Math.max(0, boost))
  const maxRating = a.allowStretchBeyondCap ? 10 : skill + tun.maxStretch + boost
  // Ratings are rounded to 0.1, so allow half a step at the cap
  const pool = filteredCatalog(filters).filter((c) => c.gate <= gateLevel && c.rating <= maxRating + 0.05)
  if (!pool.length) return { ok: false, diagnosis: diagnosePool(filters, gateLevel, maxRating) }

  const notes: string[] = []
  const famAdj = (c: RatedTrick) => (tun.familySkillEnabled ? (a.familySkill?.[c.family] ?? 0) : 0)

  // 1. Exact-challenge cooldown; relaxed only if it empties the pool
  const cooldown = new Set(recent.slice(-tun.repeatCooldown).map((r) => r.key))
  let fresh = pool.filter((c) => !cooldown.has(c.key))
  if (!fresh.length) {
    const last = recent[recent.length - 1]?.key
    fresh = pool.filter((c) => c.key !== last)
    notes.push(`Pool exhausted by ${tun.repeatCooldown}-prompt cooldown; allowing an older repeat`)
    if (!fresh.length) {
      fresh = pool
      notes.push('Only one possible trick with these filters; it repeats')
    }
  }

  // 2. Difficulty target
  let mix: Mix
  if (a.recovery) mix = 'recovery'
  else {
    const roll = rng.next()
    mix = roll < tun.mixEasy ? 'easy' : roll < tun.mixEasy + tun.mixStretch ? 'stretch' : 'core'
  }
  const offset = mix === 'recovery' ? tun.recoveryOffset : mix === 'easy' ? tun.easyOffset : mix === 'stretch' ? tun.stretchOffset : 0
  const target = skill + offset + (mix === 'recovery' || mix === 'easy' ? Math.min(0, boost) : boost)

  // 3. Band around the target, widened only as needed
  let band = tun.difficultyBand
  const dist = (c: RatedTrick) => Math.abs(c.rating - famAdj(c) - target)
  let inBand = fresh.filter((c) => dist(c) <= band)
  while (!inBand.length) {
    band += 0.4
    inBand = fresh.filter((c) => dist(c) <= band)
  }
  if (band > tun.difficultyBand) notes.push(`Band widened to ±${band.toFixed(1)} (nothing closer under your filters)`)

  // 4. Rarity tier roll: rare tricks exist but never flood
  const scale = RARITY_SCALE[filters.rarity]
  const rare = inBand.filter((c) => c.rarity === 'rare')
  const vrare = inBand.filter((c) => c.rarity === 'very-rare' || c.rarity === 'experimental')
  const normal = inBand.filter((c) => c.rarity === 'core' || c.rarity === 'uncommon')
  const r = rng.next()
  let cands = normal
  let rarityRoll = 'normal'
  if (vrare.length && r < tun.veryRareRate * scale) {
    cands = vrare
    rarityRoll = 'very rare'
  } else if (rare.length && r < (tun.veryRareRate + tun.rareRate) * scale) {
    cands = rare
    rarityRoll = 'rare'
  } else if (!normal.length) {
    cands = rare.length ? rare : vrare
    rarityRoll = 'rare (only option in band)'
  }

  // 5. Spin frequency profile
  const withSpin = cands.filter((c) => c.trick.spin)
  const noSpin = cands.filter((c) => !c.trick.spin)
  let spinRoll = 'n/a'
  if (withSpin.length && noSpin.length) {
    const p = spinFrequency(level)
    const yes = rng.next() < p
    cands = yes ? withSpin : noSpin
    spinRoll = `${yes ? 'spin' : 'no spin'} (p=${p})`
  }

  // 6–8. One weighted pick that preserves the pattern → obstacle → trick structure
  // (legacy pattern/obstacle weights) while letting variety and closeness
  // penalties steer which group wins: w = patternW × obstacleShare × trickW / groupSize.
  const last = recent[recent.length - 1]
  const recent3 = recent.slice(-3)
  const recent5 = recent.slice(-5)
  const window = recent.slice(-10)
  const present = new Set(cands.map((c) => c.family))
  const expected = 1 / Math.max(1, present.size)
  const share = (f: Family) => (window.length ? window.filter((x) => x.family === f).length / window.length : expected)
  const balance = (f: Family) => Math.min(1.4, Math.max(0.4, 1 - tun.familyBalanceStrength * (share(f) - expected)))

  const byPattern = groupBy(cands, (c) => c.trick.pattern)
  const patternW = new Map<string, number>()
  const obstacleShare = new Map<string, number>()
  const groupSize = new Map<string, number>()
  for (const [p, group] of byPattern) {
    const affinity = group.reduce((a, c) => a + (PATTERN_AFFINITY[c.trick.obstacle]?.[p as Pattern] ?? 1), 0) / group.length
    patternW.set(p, patternWeight(p as Pattern, level) * affinity * (last?.pattern === p ? 0.45 : 1))
    const byObstacle = groupBy(group, (c) => c.trick.obstacle)
    const ow = new Map<string, number>()
    for (const o of byObstacle.keys()) {
      let w = lw(CONFIG.obstacles[o]?.weight_by_level, level, 2)
      if (last?.obstacle === o) w *= 0.4
      else if (recent3.some((x) => x.obstacle === o)) w *= 0.75
      ow.set(o, w)
    }
    const total = [...ow.values()].reduce((a, b) => a + b, 0)
    for (const [o, g] of byObstacle) {
      obstacleShare.set(`${p}@${o}`, ow.get(o)! / total)
      groupSize.set(`${p}@${o}`, g.length)
    }
  }

  // Legacy flavor weights (stance/flip/grind/manual by level) only shape choices *within* a
  // pattern@obstacle group, so they're normalised by the group mean.
  const flavor = (c: RatedTrick) => {
    const t = c.trick
    let f = lw(CONFIG.stances[t.stance]?.weight_by_level, level, 1)
    if (t.flip && CONFIG.families.flips.subs[t.flip]) f *= lw(CONFIG.families.flips.subs[t.flip].weight_by_level, level, 1)
    if (t.grind) f *= lw(GRINDS[t.grind]?.weights, level, 1)
    if (t.manual) f *= lw(CONFIG.families.manuals.subs[t.manual]?.weight_by_level, level, 1)
    return f
  }
  const flavorMean = new Map<string, number>()
  for (const c of cands) {
    const g = `${c.trick.pattern}@${c.trick.obstacle}`
    flavorMean.set(g, (flavorMean.get(g) ?? 0) + flavor(c) / groupSize.get(g)!)
  }

  const sigma = 0.5
  const recentSigs = new Set(recent.slice(-tun.signatureCooldown).map((x) => x.signature))
  const pick = rng.pick(cands, (c) => {
    const t = c.trick
    const g = `${t.pattern}@${t.obstacle}`
    let w = (patternW.get(t.pattern)! * obstacleShare.get(g)!) / groupSize.get(g)!
    w *= Math.exp(-((c.rating - famAdj(c) - target) ** 2) / (2 * sigma * sigma))
    w *= flavor(c) / flavorMean.get(g)!
    if (c.rarity === 'uncommon') w *= tun.uncommonWeight
    if (recentSigs.has(c.signature)) w *= tun.signatureRecentPenalty
    else if (a.seen && !a.seen.has(c.signature)) w *= tun.noveltyBoost
    const main = mainComponent(c)
    if (last?.main === main) w *= 0.3
    else if (recent5.some((x) => x.main === main)) w *= 0.5
    if (t.exit && recent5.some((x) => x.exit === t.exit)) w *= 0.5
    if (t.stance !== 'regular' && last?.stance === t.stance) w *= 0.6
    w *= balance(c.family)
    return w
  })!
  const pattern = pick.trick.pattern

  const v = validateTrick(pick.trick, { filters, gateLevel })
  if (!v.ok) throw new Error(`Selector produced invalid trick: ${v.reasons.join('; ')}`)

  return {
    ok: true,
    pick,
    trace: {
      skill,
      boost,
      gateLevel,
      mix,
      target: Math.round(target * 100) / 100,
      maxRating: Math.round(maxRating * 100) / 100,
      band,
      poolSize: pool.length,
      bandSize: inBand.length,
      rarityRoll,
      spinRoll,
      pattern,
      notes,
    },
  }
}

export { FAMILIES }
