import {
  BANS,
  CONFIG,
  EXPERIMENTAL_RULES,
  GRIND_ENTRY_FLIPS,
  GRIND_ENTRY_OBSTACLES,
  NAMED_GATES,
  OBSTACLE_GATE,
  PATTERN_GATE,
  SPIN_ONLY_OBSTACLES,
  SPIN_RULES,
  STANCE_GATE,
} from './rules'
import { OBSTACLES, STANCES, type Filters, type Trick } from './types'

export interface ValidationResult {
  ok: boolean
  reasons: string[]
  /** Highest level gate among the trick's components */
  gate: number
  /** True when legal only through the opt-in experimental lane */
  experimental: boolean
}

export interface ValidateOptions {
  filters?: Filters
  /** Rounded player level; components gated above this are rejected */
  gateLevel?: number
  experimental?: boolean
}

const PATTERN_PARTS: Record<Trick['pattern'], { flip: boolean; grind: boolean; manual: boolean }> = {
  'flip-only': { flip: true, grind: false, manual: false },
  'grind-only': { flip: false, grind: true, manual: false },
  'manual-only': { flip: false, grind: false, manual: true },
  'flip→grind': { flip: true, grind: true, manual: false },
  'flip→manual': { flip: true, grind: false, manual: true },
  'spin-only': { flip: false, grind: false, manual: false },
}

const sub = (fam: string, name: string) => CONFIG.families[fam]?.subs?.[name]

/**
 * The single source of truth for "can this be emitted?". Every generated
 * challenge must pass this, with the same filters and gate level used to pick it.
 */
export function validateTrick(t: Trick, opts: ValidateOptions = {}): ValidationResult {
  const reasons: string[] = []
  let experimental = false
  const gates: number[] = []
  const no = (r: string) => reasons.push(r)

  if (!(OBSTACLES as readonly string[]).includes(t.obstacle)) no(`Unknown obstacle "${t.obstacle}"`)
  if (!(STANCES as readonly string[]).includes(t.stance)) no(`Unknown stance "${t.stance}"`)
  const parts = PATTERN_PARTS[t.pattern]
  if (!parts) {
    no(`Unknown pattern "${t.pattern}"`)
    return { ok: false, reasons, gate: 99, experimental }
  }

  // Pattern must be defined for the obstacle (legacy config) or be the spin-only extension
  const obstaclePatterns = CONFIG.obstacles[t.obstacle]?.patterns ?? []
  if (t.pattern === 'spin-only') {
    if (!SPIN_ONLY_OBSTACLES.includes(t.obstacle)) no(`Standalone spins aren't set on ${t.obstacle}`)
  } else if (!obstaclePatterns.includes(t.pattern)) {
    no(`Pattern ${t.pattern} not available on ${t.obstacle}`)
  }
  if (t.pattern === 'flip→manual' && t.obstacle !== 'manual pad') no('Flip to manual only on a manual pad')

  // Exactly the components the pattern requires
  if (parts.flip !== !!t.flip) no(parts.flip ? 'Missing flip' : 'Unexpected flip')
  if (parts.grind !== !!t.grind) no(parts.grind ? 'Missing grind' : 'Unexpected grind')
  if (parts.grind && !t.direction) no('Grind needs FS/BS direction')
  if (!parts.grind && t.direction) no('Direction without grind')
  if (parts.manual !== !!t.manual) no(parts.manual ? 'Missing manual' : 'Unexpected manual')
  if (t.pattern === 'spin-only' && !t.spin) no('Missing spin')

  gates.push(OBSTACLE_GATE[t.obstacle] ?? 99, STANCE_GATE[t.stance] ?? 99, PATTERN_GATE[t.pattern])

  if (t.flip) {
    const f = sub('flips', t.flip)
    if (!f) no(`Unknown flip "${t.flip}"`)
    else {
      gates.push(f.minLevel)
      if (t.pattern === 'flip→grind') {
        const entry = GRIND_ENTRY_FLIPS[t.flip]
        if (entry === undefined) no(`${t.flip} isn't used as a grind entry`)
        else gates.push(entry)
        if (!GRIND_ENTRY_OBSTACLES.includes(t.obstacle)) no(`No flip-in grinds on ${t.obstacle}`)
      } else if (f.allowed_obstacles && !f.allowed_obstacles.includes(t.obstacle)) {
        no(`${t.flip} not allowed on ${t.obstacle}`)
      }
    }
  }
  if (t.grind) {
    const g = sub('grinds', t.grind)
    if (!g) no(`Unknown grind "${t.grind}"`)
    else {
      gates.push(g.minLevel)
      if (g.allowed_obstacles && !g.allowed_obstacles.includes(t.obstacle)) no(`${t.grind} not allowed on ${t.obstacle}`)
    }
  }
  if (t.manual) {
    const m = sub('manuals', t.manual)
    if (!m) no(`Unknown manual "${t.manual}"`)
    else {
      gates.push(m.minLevel)
      if (m.allowed_obstacles && !m.allowed_obstacles.includes(t.obstacle)) no(`${t.manual} not allowed on ${t.obstacle}`)
    }
    if (t.obstacle === 'handrail') no('No manuals on a handrail')
  }
  if (t.spin) {
    const s = sub('spins', String(t.spin.deg))
    if (!s) no(`Unknown spin ${t.spin.deg}`)
    else gates.push(s.minLevel)
    if (t.spin.deg > SPIN_RULES.maxDegrees) no('No 540+ in fingerboard mode')
    if (t.spin.dir !== 'FS' && t.spin.dir !== 'BS') no('Spin needs FS/BS')
    switch (t.pattern) {
      case 'spin-only':
        break
      case 'flip-only': {
        if (!SPIN_RULES.flipOnlyObstacles.includes(t.obstacle)) no(`No spin flips on ${t.obstacle}`)
        const f = sub('flips', t.flip ?? '')
        if (t.spin.deg === 180 && f && f.diff > SPIN_RULES.flip180MaxDiff) no(`No 180 ${t.flip}`)
        if (t.spin.deg === 360 && !SPIN_RULES.flip360.includes(t.flip ?? '')) no(`No 360 ${t.flip}`)
        if (t.spin.deg === 360 && !SPIN_RULES.flip360Obstacles.includes(t.obstacle)) no(`No 360 flips on ${t.obstacle}`)
        break
      }
      case 'manual-only':
        if (t.spin.deg !== 180) no('Only 180s into manuals')
        if (!SPIN_RULES.manualObstacles.includes(t.obstacle)) no(`No spin to manual on ${t.obstacle}`)
        break
      case 'grind-only':
        if (t.spin.deg !== 180) no('Only 180s into grinds')
        if (!SPIN_RULES.grinds.includes(t.grind ?? '')) no(`No 180 into ${t.grind}`)
        if (!EXPERIMENTAL_RULES.spinGrindObstacles.includes(t.obstacle)) no(`No spin-in grinds on ${t.obstacle}`)
        experimental = true
        break
      case 'flip→grind':
        if (EXPERIMENTAL_RULES.spinIntoFlipGrind && t.spin.deg === 180) experimental = true
        else no('No spins on flip-in grinds')
        break
      case 'flip→manual':
        no('No spins on flip to manual')
        break
    }
  }

  // Spec named gates / bans (classes not generated in v1, enforced if introduced)
  const names = [t.flip, t.grind, t.manual].filter(Boolean).join(' ')
  for (const g of NAMED_GATES) if (g.match.test(names)) gates.push(g.level)
  for (const b of BANS) if (b.match.test(names) && b.obstacles.includes(t.obstacle)) no(b.reason)

  const gate = Math.max(...gates)

  if (opts.filters) reasons.push(...filterViolations(t, opts.filters))
  if (opts.gateLevel !== undefined && gate > opts.gateLevel) no(`Gated to level ${gate} (player ${opts.gateLevel})`)
  if (experimental && !opts.experimental) no('Experimental combination (lane is off)')

  return { ok: reasons.length === 0, reasons, gate, experimental }
}

export function filterViolations(t: Trick, f: Filters): string[] {
  const out: string[] = []
  if (!f.obstacles.includes(t.obstacle)) out.push(`Obstacle ${t.obstacle} disabled`)
  if (!f.stances.includes(t.stance)) out.push(`Stance ${t.stance} disabled`)
  const check = (fam: 'flips' | 'grinds' | 'manuals' | 'spins', name?: string) => {
    if (!name) return
    if (!f.families.includes(fam)) out.push(`Family ${fam} disabled`)
    else if (!f.subs[fam]?.includes(name)) out.push(`${name} disabled`)
  }
  check('flips', t.flip)
  check('grinds', t.grind)
  check('manuals', t.manual)
  check('spins', t.spin ? String(t.spin.deg) : undefined)
  return out
}
