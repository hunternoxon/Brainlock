import {
  BANS,
  CONFIG,
  COPING_STANCES,
  EXPERIMENTAL_RULES,
  NAMED_GATES,
  OBSTACLE_GATE,
  OBSTACLE_PATTERNS,
  PATTERN_GATE,
  STANCE_GATE,
} from './rules'
import {
  BOARD_MOVES,
  EXCLUDED_MOVES,
  EXITS,
  GRINDS,
  LIPS,
  MULTI_FLIP,
  REVERT,
  SEQUENCE,
  SPIN_AIR_OBSTACLES,
  TRANSFER,
  TRANSFER_PAIRS,
  TRANSITION,
  TRANSITIONS,
} from './vocab'
import { OBSTACLES, STANCES, type Filters, type Rarity, type RarityLevel, type Trick } from './types'

export interface ValidationResult {
  ok: boolean
  reasons: string[]
  gate: number
  rarity: Rarity
}

export interface ValidateOptions {
  filters?: Filters
  /** Rounded player level; components gated above this are rejected */
  gateLevel?: number
}

const RANK: Record<Rarity, number> = { core: 0, uncommon: 1, rare: 2, 'very-rare': 3, experimental: 4 }
const maxRarity = (a: Rarity, b: Rarity): Rarity => (RANK[b] > RANK[a] ? b : a)

/** Which rarity tiers each user setting allows to exist at all. */
export function rarityAllowed(level: RarityLevel, r: Rarity): boolean {
  if (r === 'core' || r === 'uncommon') return true
  if (level === 'off') return false
  if (r === 'experimental') return level === 'normal'
  return true
}

const PARTS: Record<Trick['pattern'], { flip: 'no' | 'yes' | 'any'; grind: boolean; manual: boolean; lip: boolean }> = {
  'flip-only': { flip: 'yes', grind: false, manual: false, lip: false },
  'grind-only': { flip: 'no', grind: true, manual: false, lip: false },
  'flip→grind': { flip: 'yes', grind: true, manual: false, lip: false },
  'manual-only': { flip: 'no', grind: false, manual: true, lip: false },
  'flip→manual': { flip: 'yes', grind: false, manual: true, lip: false },
  coping: { flip: 'no', grind: false, manual: false, lip: true },
  transfer: { flip: 'yes', grind: false, manual: false, lip: false },
}

/**
 * The single source of truth for "can this be emitted?". Structural legality
 * always; filters and level gate when given.
 */
export function validateTrick(t: Trick, opts: ValidateOptions = {}): ValidationResult {
  const reasons: string[] = []
  const gates: number[] = []
  let rarity: Rarity = 'core'
  const no = (r: string) => reasons.push(r)
  const tier = (r: Rarity) => (rarity = maxRarity(rarity, r))

  if (!(OBSTACLES as readonly string[]).includes(t.obstacle)) no(`Unknown obstacle "${t.obstacle}"`)
  if (!(STANCES as readonly string[]).includes(t.stance)) no(`Unknown stance "${t.stance}"`)
  const parts = PARTS[t.pattern]
  if (!parts) return { ok: false, reasons: [`Unknown pattern "${t.pattern}"`], gate: 99, rarity }

  if (t.pattern !== 'transfer' && !OBSTACLE_PATTERNS[t.obstacle]?.includes(t.pattern)) no(`Pattern ${t.pattern} not available on ${t.obstacle}`)
  if (t.pattern === 'flip→manual' && t.obstacle !== 'manual pad') no('Flip to manual only on a manual pad')

  // Exactly the components the pattern requires
  if (parts.flip === 'yes' && !t.flip) no('Missing board move')
  if (parts.flip === 'no' && t.flip) no('Unexpected board move')
  if (parts.grind !== !!t.grind) no(parts.grind ? 'Missing grind' : 'Unexpected grind')
  if (parts.grind && !t.direction) no('Grind needs FS/BS direction')
  if (!parts.grind && t.direction) no('Direction without grind')
  if (!t.grind && t.grind2) no('Transition without grind')
  if (parts.manual !== !!t.manual) no(parts.manual ? 'Missing manual' : 'Unexpected manual')
  if (parts.lip !== !!t.lip) no(parts.lip ? 'Missing lip trick' : 'Unexpected lip trick')
  if (!!t.transferTo !== (t.pattern === 'transfer')) no('Transfer target mismatch')
  if (t.flips !== undefined && t.flips !== 2 && t.flips !== 3) no('Flip count must be 2 or 3 when set')

  // Legacy quarterpipe intro (L3) was for flip airs; coping stalls/grinds carry their own gates
  const qpCoping = t.obstacle === 'quarterpipe' && (t.pattern === 'coping' || t.pattern === 'grind-only')
  gates.push(qpCoping ? 1 : (OBSTACLE_GATE[t.obstacle] ?? 99), STANCE_GATE[t.stance] ?? 99, PATTERN_GATE[t.pattern])

  // ---- Board move (standalone air or entry) ----
  const m = t.flip ? BOARD_MOVES[t.flip] : undefined
  if (t.flip && !m) no(`Unknown board move "${t.flip}"`)
  if (m) {
    gates.push(m.gate)
    tier(m.rarity)
    if (t.flips) {
      if (!m.maxFlips || t.flips > m.maxFlips || !m.flip) no(`No ${t.flips === 2 ? 'double' : 'triple'} ${m.label}`)
      gates.push(MULTI_FLIP[t.flips].gate)
      tier(MULTI_FLIP[t.flips].rarity)
    }
    if (t.pattern === 'flip-only') {
      if (!m.air.includes(t.obstacle)) no(`${m.label} isn't set on ${t.obstacle}`)
      if (t.obstacle === 'quarterpipe' && (t.spin || t.flips || t.revert)) no('Quarterpipe airs are plain flips to fakie')
    } else if (t.pattern === 'flip→grind') {
      if (t.flip === 'ollie') no('Ollie is implied in grinds; never an entry')
      else if (m.grindEntry === undefined) no(`${m.label} isn't used as a grind entry`)
      else gates.push(m.grindEntry)
      if (t.flips) no('No multi-flip entries')
    } else if (t.pattern === 'flip→manual') {
      if (t.flip === 'ollie') no('Ollie is implied in manuals; never an entry')
      else if (m.manualEntry === undefined) no(`${m.label} isn't used as a manual entry`)
      else gates.push(m.manualEntry)
      if (t.flips) no('No multi-flip entries')
    } else if (t.pattern === 'transfer') {
      if (!TRANSFER.moves.includes(t.flip!)) no(`No ${m.label} transfers`)
      if (t.flips) no('No multi-flip transfers')
    }
  }

  // ---- Body spin ----
  if (t.spin) {
    const s = CONFIG.families.spins.subs[String(t.spin.deg)]
    if (!s) no(`Unknown spin ${t.spin.deg}`)
    else gates.push(s.minLevel)
    if (t.spin.deg !== 180 && t.spin.deg !== 360) no('Body spins are 180 or 360 (no 540+ body spins)')
    if (t.spin.dir !== 'FS' && t.spin.dir !== 'BS') no('Spin needs FS/BS')
    switch (t.pattern) {
      case 'flip-only': {
        if (!m) break
        if (!SPIN_AIR_OBSTACLES[t.spin.deg]?.includes(t.obstacle)) no(`No ${t.spin.deg} airs on ${t.obstacle}`)
        if (t.flips || m.late || m.flip === 'impossible' || m.flip === 'pressure') no(`No body spin with ${m.label}`)
        const sameDir = m.board?.dir === t.spin.dir
        if (m.key === 'ollie') break
        if ((m.key === 'kickflip' || m.key === 'heelflip') && t.spin.deg === 180) break
        if ((m.key === 'kickflip' || m.key === 'heelflip') && t.spin.deg === 360) {
          if (!['flat', 'gap'].includes(t.obstacle)) no('360 flips only on flat or over a gap')
          gates.push(8)
          tier('rare')
          break
        }
        if (m.board?.deg === 180 && m.flip && t.spin.deg === 180) {
          // BS 180 Varial Kickflip: uncommon. 180 Hardflip / 180 Inward Heelflip: rare.
          tier(m.key === 'hardflip' || m.key === 'inward heelflip' ? 'rare' : 'uncommon')
          break
        }
        if (m.board?.deg === 360 && t.spin.deg === 180 && sameDir) {
          // Bigspin / Bigflip / Bigspin Heelflip
          if (!m.flip) gates.push(m.board.dir === 'BS' ? 5 : 6)
          else if (m.key === 'tre flip') gates.push(7)
          else {
            gates.push(9)
            tier('rare')
          }
          if (m.flip) tier('uncommon')
          break
        }
        if (m.board?.deg === 540 && sameDir && !m.flip) {
          gates.push(t.spin.deg === 180 ? 9 : 10)
          tier(t.spin.deg === 180 ? 'rare' : 'very-rare')
          break
        }
        no(`No ${t.spin.dir} ${t.spin.deg} with ${m.label}`)
        break
      }
      case 'manual-only':
        if (t.spin.deg !== 180) no('Only 180s into manuals')
        if (!['manual pad', 'box', 'curb', 'bank'].includes(t.obstacle)) no(`No spin to manual on ${t.obstacle}`)
        if (t.exit || t.revert) no('Spin-to-manual has no exit')
        break
      case 'grind-only':
        if (t.spin.deg !== 180) no('Only 180s into grinds')
        if (!EXPERIMENTAL_RULES.spinGrinds.includes(t.grind ?? '')) no(`No 180 into ${t.grind}`)
        if (!EXPERIMENTAL_RULES.spinGrindObstacles.includes(t.obstacle)) no(`No spin-in grinds on ${t.obstacle}`)
        tier('experimental')
        break
      case 'flip→grind':
        if (EXPERIMENTAL_RULES.spinIntoFlipGrind && t.spin.deg === 180 && m?.flip && !m.board) tier('experimental')
        else no('No spins on this flip-in')
        break
      case 'transfer':
        if (t.flip !== 'ollie' || t.spin.deg !== 180) no('Only FS/BS 180 transfers')
        break
      default:
        no(`No body spin on ${t.pattern}`)
    }
  }

  // ---- Grinds ----
  if (t.grind) {
    const g = GRINDS[t.grind]
    if (!g) no(`Unknown grind "${t.grind}"`)
    else {
      gates.push(g.minLevel)
      tier(g.rarity)
      if (!g.allowed.includes(t.obstacle)) no(`${g.label} not on ${t.obstacle}`)
      if (t.grind === 'hurricane' && (t.flip || t.spin)) no('Hurricane has its own 180 setup; no extra entry')
      if (t.obstacle === 'quarterpipe' && (t.flip || t.spin || t.exit || t.grind2)) no('Coping grinds are plain grinds')
    }
    if (t.grind2) {
      const g2 = GRINDS[t.grind2]
      if (!TRANSITIONS.some(([a, b]) => a === t.grind && b === t.grind2)) no(`No ${t.grind} to ${t.grind2} transition`)
      if (!TRANSITION.obstacles.includes(t.obstacle) || !g2?.allowed.includes(t.obstacle)) no(`No transitions on ${t.obstacle}`)
      if (t.flip || t.spin || t.exit) no('Transitions are standalone')
      gates.push(TRANSITION.gate, g2?.minLevel ?? 99)
      tier(TRANSITION.rarity)
    }
  }

  // ---- Manuals ----
  if (t.manual) {
    const mm = CONFIG.families.manuals.subs[t.manual]
    if (!mm) no(`Unknown manual "${t.manual}"`)
    else {
      gates.push(mm.minLevel)
      if (mm.allowed_obstacles && !mm.allowed_obstacles.includes(t.obstacle)) no(`${t.manual} not on ${t.obstacle}`)
    }
    if (t.obstacle === 'handrail') no('No manuals on a handrail')
  }

  // ---- Coping ----
  if (t.lip) {
    const l = LIPS[t.lip]
    if (!l) no(`Unknown lip trick "${t.lip}"`)
    else {
      gates.push(l.gate)
      tier(l.rarity)
      if (l.directional !== !!t.lipDir) no(l.directional ? `${l.label} needs FS/BS` : `${l.label} has no FS/BS`)
      if (t.revert && !l.revert) no(`No revert on ${l.label}`)
    }
    if (t.obstacle !== 'quarterpipe') no('Stalls / lip tricks are quarterpipe only')
    if (!COPING_STANCES.includes(t.stance)) no(`No ${t.stance} coping tricks`)
    if (t.revert) {
      gates.push(REVERT.gate)
      tier(REVERT.rarity)
    }
  }
  if (t.obstacle === 'quarterpipe' && t.pattern === 'grind-only' && !COPING_STANCES.includes(t.stance)) no(`No ${t.stance} coping grinds`)

  // ---- Exits ----
  if (t.exit) {
    const e = EXITS[t.exit]
    if (!e) no(`Unknown exit "${t.exit}"`)
    else {
      gates.push(e.gate)
      tier(e.rarity)
      if (!!e.directional !== !!t.exitDir) no(e.directional ? `${e.label} needs FS/BS` : 'Exit direction not applicable')
      if (t.grind) {
        if (!e.grinds.includes(t.grind) || !e.grindObstacles.includes(t.obstacle)) no(`No ${e.label} from ${t.grind} on ${t.obstacle}`)
      } else if (t.manual) {
        if (!e.manualObstacles.includes(t.obstacle)) no(`No ${e.label} from a manual on ${t.obstacle}`)
      } else no(`${e.label} needs a grind or manual`)
      if (t.flip && t.pattern !== 'flip-only') {
        gates.push(SEQUENCE.gate)
        tier(SEQUENCE.rarity)
        if (m?.board && m.flip) no('Sequences use simple flip-ins')
      }
    }
  } else if (t.exitDir) no('Exit direction without exit')

  // ---- Reverts ----
  if (t.revert) {
    gates.push(REVERT.gate)
    if (t.pattern === 'flip-only') {
      if (!REVERT.airObstacles.includes(t.obstacle) || t.spin || t.flips || !m || m.key === 'ollie' || (m.board?.deg && m.board.deg > 180) || m.late) no('Reverts only after a simple flip or shuvit on flat/bank')
      tier(REVERT.rarity)
    } else if (t.pattern === 'manual-only') {
      if (!REVERT.manualObstacles.includes(t.obstacle) || t.exit || t.spin) no('Manual reverts only at the end of a pad/box manual')
      tier(REVERT.rarity)
    } else if (t.pattern !== 'coping') no(`No reverts on ${t.pattern}`)
  }

  // ---- Transfers ----
  if (t.transferTo) {
    if (!TRANSFER_PAIRS.some(([a, b]) => a === t.obstacle && b === t.transferTo)) no(`No transfer from ${t.obstacle} to ${t.transferTo}`)
    gates.push(TRANSFER.gate, OBSTACLE_GATE[t.transferTo] ?? 99)
    tier(TRANSFER.rarity)
  }

  // Spec gates + bans
  const names = [t.flip, t.grind, t.manual, t.lip, t.grind2].filter(Boolean).join(' ')
  for (const g of NAMED_GATES) if (g.match.test(names)) gates.push(g.level)
  if (t.flips === 3) gates.push(9)
  for (const b of BANS) if (b.match.test(names) && (b.obstacles === 'all' || b.obstacles.includes(t.obstacle))) no(b.reason)
  for (const x of EXCLUDED_MOVES) if (names.includes(x)) no(`${x} is out of scope`)

  const gate = Math.max(...gates)
  if (opts.filters) reasons.push(...filterViolations(t, opts.filters, rarity))
  if (opts.gateLevel !== undefined && gate > opts.gateLevel) no(`Gated to level ${gate} (player ${opts.gateLevel})`)

  return { ok: reasons.length === 0, reasons, gate, rarity }
}

export function filterViolations(t: Trick, f: Filters, rarity?: Rarity): string[] {
  const out: string[] = []
  if (!f.obstacles.includes(t.obstacle)) out.push(`Obstacle ${t.obstacle} disabled`)
  if (t.transferTo) {
    if (!f.transfers) out.push('Transfers off')
    if (!f.obstacles.includes(t.transferTo)) out.push(`Obstacle ${t.transferTo} disabled`)
  }
  if (!f.stances.includes(t.stance)) out.push(`Stance ${t.stance} disabled`)
  const check = (fam: keyof Filters['subs'], name?: string) => {
    if (!name) return
    if (!f.families.includes(fam)) out.push(`Family ${fam} disabled`)
    else if (!f.subs[fam]?.includes(name)) out.push(`${name} disabled`)
  }
  // Implied ollie: only a plain Ollie prompt needs the Ollie chip
  if (t.flip && !(t.flip === 'ollie' && (t.spin || t.pattern === 'transfer'))) check('flips', t.flip)
  if (t.flips === 2 && !f.doubles) out.push('Double flips off')
  if (t.flips === 3 && !f.triples) out.push('Triple flips off')
  check('grinds', t.grind)
  check('grinds', t.grind2)
  check('manuals', t.manual)
  check('stalls', t.lip)
  check('spins', t.spin ? String(t.spin.deg) : undefined)
  if (t.exit) {
    const req = EXITS[t.exit]?.requires
    if (req && (!f.families.includes(req.family) || !req.anyOf.some((s) => f.subs[req.family]?.includes(s)))) out.push(`${t.exit} needs ${req.anyOf.join(' or ')}`)
  }
  if (rarity && !rarityAllowed(f.rarity, rarity)) out.push(`Rarity ${rarity} not allowed at "${f.rarity}"`)
  return out
}
