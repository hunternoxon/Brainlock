/**
 * Canonical identity + skater-convention naming.
 * The Trick components are the source of truth. Names are derived here and
 * never parsed back for scoring, legality or deduplication.
 */
import { BOARD_MOVES, EXITS, GRINDS, LIPS, MANUAL_LABEL } from './vocab'
import type { Dir, Obstacle, Spin, Stance, Trick } from './types'

const STANCE_LABEL: Record<Stance, string> = { regular: '', fakie: 'Fakie', nollie: 'Nollie', switch: 'Switch' }

const OBSTACLE_PHRASE: Record<Obstacle, string> = {
  flat: 'on flat',
  'manual pad': 'on the manual pad',
  box: 'on the box',
  curb: 'on the curb',
  bank: 'on the bank',
  ledge: 'on the ledge',
  hubba: 'on the hubba',
  flatbar: 'on the flatbar',
  rail: 'on the rail',
  handrail: 'on the handrail',
  gap: 'over the gap',
  quarterpipe: 'on the quarterpipe',
}

const THE: Record<Obstacle, string> = {
  flat: 'flat ground',
  'manual pad': 'the manual pad',
  box: 'the box',
  curb: 'the curb',
  bank: 'the bank',
  ledge: 'the ledge',
  hubba: 'the hubba',
  flatbar: 'the flatbar',
  rail: 'the rail',
  handrail: 'the handrail',
  gap: 'the gap',
  quarterpipe: 'the quarterpipe',
}

export function wherePhrase(t: Trick): string {
  if (t.pattern === 'transfer' && t.transferTo) return `from ${THE[t.obstacle]} to ${THE[t.transferTo]}`
  if (t.obstacle === 'quarterpipe' && (t.pattern === 'coping' || t.pattern === 'grind-only')) return 'on the quarterpipe coping'
  return OBSTACLE_PHRASE[t.obstacle]
}

/**
 * Name of an air maneuver with stance + body rotation, using conventional names:
 * FS Flip, Half Cab, Full Cab Flip, BS Bigspin, Bigflip, Biggerspin, Gazelle…
 * Returns [name, stanceConsumed].
 */
export function airName(stance: Stance, key: string, flips: number | undefined, spin: Spin | undefined): [string, boolean] {
  const m = BOARD_MOVES[key]
  if (!m) return [`?${key}`, false]
  const multi = flips === 3 ? 'Triple ' : flips === 2 ? 'Double ' : ''
  const base = multi + m.label
  // A nollie ollie is just "Nollie"
  if (!spin && m.key === 'ollie' && stance === 'nollie') return ['Nollie', true]
  if (!spin) return [base, false]
  const d = spin.dir
  const fakieFS = stance === 'fakie' && d === 'FS'
  const simpleFlip = (m.key === 'kickflip' || m.key === 'heelflip') && !flips
  const flipWord = m.key === 'kickflip' ? 'Flip' : 'Heelflip'

  if (m.key === 'ollie') {
    if (fakieFS) return [spin.deg === 180 ? 'Half Cab' : 'Full Cab', true]
    return [`${d} ${spin.deg}`, false]
  }
  if (simpleFlip && spin.deg === 180) return fakieFS ? [`Half Cab ${flipWord}`, true] : [`${d} ${flipWord}`, false]
  if (simpleFlip && spin.deg === 360) return fakieFS ? [`Full Cab ${flipWord}`, true] : [`${d} 360 ${m.key === 'kickflip' ? 'Kickflip' : 'Heelflip'}`, false]
  // Bigspin family: 360 shuvit + 180 body, same direction
  if (m.board && m.board.dir === d && spin.deg === 180 && m.board.deg === 360) {
    if (!m.flip) return [`${d} Bigspin`, false]
    if (m.flip === 'kick') return [`${d} Bigflip`, false]
    if (m.flip === 'heel') return [`${d} Bigspin Heelflip`, false]
  }
  if (m.board && m.board.dir === d && m.board.deg === 540 && !m.flip) {
    if (spin.deg === 180) return [`${d} Biggerspin`, false]
    if (spin.deg === 360) return [`${d} Gazelle`, false]
  }
  return [`${d} ${spin.deg} ${base}`, false]
}

const grindName = (g: string, dir?: Dir) => `${dir ? dir + ' ' : ''}${GRINDS[g]?.label ?? g}`

/** Full trick name without the obstacle phrase, e.g. "Switch Kickflip BS Smith Grind Heelflip Out". */
export function trickName(t: Trick): string {
  const parts: string[] = []
  let stanceUsed = false
  switch (t.pattern) {
    case 'flip-only':
    case 'transfer': {
      const [n, consumed] = airName(t.stance, t.flip ?? 'ollie', t.flips, t.spin)
      stanceUsed = consumed
      parts.push(n)
      if (t.pattern === 'transfer') parts.push('Transfer')
      if (t.obstacle === 'quarterpipe' && !t.spin && t.pattern === 'flip-only') parts.push('Fakie')
      if (t.revert) parts.push(`${t.revert} Revert`)
      break
    }
    case 'grind-only':
    case 'flip→grind': {
      if (t.pattern === 'flip→grind' && t.flip) {
        const [n, consumed] = airName(t.stance, t.flip, t.flips, t.spin)
        stanceUsed = consumed
        parts.push(BOARD_MOVES[t.flip]?.flip ? n : `${n} to`)
      } else if (t.spin) parts.push(`${t.spin.dir} ${t.spin.deg} to`)
      parts.push(grindName(t.grind!, t.direction))
      if (t.grind2) parts.push(`to ${GRINDS[t.grind2]?.label ?? t.grind2}`)
      break
    }
    case 'manual-only':
    case 'flip→manual': {
      if (t.flip) {
        const [n, consumed] = airName(t.stance, t.flip, t.flips, undefined)
        stanceUsed = consumed
        parts.push(`${n} to`)
      } else if (t.spin) parts.push(`${t.spin.dir} ${t.spin.deg} to`)
      parts.push(MANUAL_LABEL[t.manual!] ?? t.manual!)
      if (t.revert) parts.push(`${t.revert} Revert`)
      break
    }
    case 'coping': {
      const l = LIPS[t.lip!]
      parts.push(l ? `${t.lipDir ? t.lipDir + ' ' : ''}${l.label}` : `?${t.lip}`)
      if (t.revert) parts.push('Revert')
      break
    }
  }
  if (t.exit) {
    const e = EXITS[t.exit]
    parts.push(e?.directional && t.exitDir ? `${t.exitDir} ${e.label}` : (e?.label ?? t.exit))
  }
  const stance = !stanceUsed && STANCE_LABEL[t.stance] ? STANCE_LABEL[t.stance] + ' ' : ''
  return (stance + parts.join(' ')).replace(/\s+/g, ' ').trim()
}

export function displayText(t: Trick): string {
  return `${trickName(t)} ${wherePhrase(t)}`
}

const spinKey = (s?: Spin) => (s ? `${s.dir}${s.deg}` : '')

/** Canonical skill identity: every mechanical component, obstacle excluded. */
export function trickSignature(t: Trick): string {
  return [
    t.stance,
    t.flip ?? '',
    t.flips ?? '',
    spinKey(t.spin),
    t.grind ?? '',
    t.direction ?? '',
    t.grind2 ?? '',
    t.manual ?? '',
    t.lip ?? '',
    t.lipDir ?? '',
    t.exit ?? '',
    t.exitDir ?? '',
    t.revert ?? '',
  ].join('|')
}

/** Exact challenge identity: skill identity + where. */
export function trickKey(t: Trick): string {
  return `${trickSignature(t)}@${t.obstacle}${t.transferTo ? '>' + t.transferTo : ''}`
}

// ---------------------------------------------------------------------------
// Alias parsing (air maneuvers). Used by tests and future Stack Builder only.
// Strict: returns null rather than guessing.
// ---------------------------------------------------------------------------

const ALIASES: Record<string, string> = {}
for (const m of Object.values(BOARD_MOVES)) {
  ALIASES[m.key] = m.key
  ALIASES[m.label.toLowerCase()] = m.key
  for (const a of m.aliases ?? []) ALIASES[a] = m.key
}

export function boardMoveFromAlias(name: string): string | null {
  return ALIASES[name.trim().toLowerCase().replace(/\s+/g, ' ')] ?? null
}

export interface ParsedAir {
  stance: Stance
  flip: string
  flips?: 2 | 3
  spin?: Spin
}

/** Parse a conventional air-trick name into canonical components, or null. */
export function parseAirName(input: string): ParsedAir | null {
  let s = input.trim().toLowerCase().replace(/\s+/g, ' ')
  s = s.replace(/\bfrontside\b/g, 'fs').replace(/\bbackside\b/g, 'bs')
  let stance: Stance = 'regular'
  const st = s.match(/^(fakie|nollie|switch) /)
  if (st) {
    stance = st[1] as Stance
    s = s.slice(st[0].length)
  }
  const named: [RegExp, (m: RegExpMatchArray) => ParsedAir | null][] = [
    [/^half cab$/, () => ({ stance: 'fakie', flip: 'ollie', spin: { deg: 180, dir: 'FS' } })],
    [/^full cab$/, () => ({ stance: 'fakie', flip: 'ollie', spin: { deg: 360, dir: 'FS' } })],
    [/^half cab (flip|kickflip|heelflip)$/, (m) => ({ stance: 'fakie', flip: m[1] === 'heelflip' ? 'heelflip' : 'kickflip', spin: { deg: 180, dir: 'FS' } })],
    [/^full cab (flip|kickflip|heelflip)$/, (m) => ({ stance: 'fakie', flip: m[1] === 'heelflip' ? 'heelflip' : 'kickflip', spin: { deg: 360, dir: 'FS' } })],
    [/^(fs|bs) (flip|heelflip)$/, (m) => ({ stance, flip: m[2] === 'flip' ? 'kickflip' : 'heelflip', spin: { deg: 180, dir: m[1].toUpperCase() as Dir } })],
    [/^(fs|bs) (180|360)$/, (m) => ({ stance, flip: 'ollie', spin: { deg: Number(m[2]) as 180 | 360, dir: m[1].toUpperCase() as Dir } })],
    [/^(fs|bs) bigspin$/, (m) => ({ stance, flip: `${m[1]} 360 shuvit`, spin: { deg: 180, dir: m[1].toUpperCase() as Dir } })],
    [/^(?:(fs|bs) )?bigflip$/, (m) => ({ stance, flip: (m[1] ?? 'bs') === 'bs' ? 'tre flip' : '360 hardflip', spin: { deg: 180, dir: (m[1] ?? 'bs').toUpperCase() as Dir } })],
    [/^(fs|bs) biggerspin$/, (m) => ({ stance, flip: `${m[1]} 540 shuvit`, spin: { deg: 180, dir: m[1].toUpperCase() as Dir } })],
    [/^(fs|bs) gazelle$/, (m) => ({ stance, flip: `${m[1]} 540 shuvit`, spin: { deg: 360, dir: m[1].toUpperCase() as Dir } })],
    [/^(fs|bs) (180|360) (.+)$/, (m) => {
      const k = boardMoveFromAlias(m[3])
      return k ? { stance, flip: k, spin: { deg: Number(m[2]) as 180 | 360, dir: m[1].toUpperCase() as Dir } } : null
    }],
    [/^(double|triple) (.+)$/, (m) => {
      const k = boardMoveFromAlias(m[2])
      return k ? { stance, flip: k, flips: m[1] === 'double' ? 2 : 3 } : null
    }],
  ]
  for (const [re, f] of named) {
    const m = s.match(re)
    if (m) {
      const r = f(m)
      if (r && st && r.stance !== stance && r.stance === 'fakie') return null // "nollie half cab" is not a thing
      return r
    }
  }
  const k = boardMoveFromAlias(s)
  return k ? { stance, flip: k } : null
}
