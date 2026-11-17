import { CONFIG, DIFFICULTY } from './rules'
import { BOARD_MOVES, EXITS, EXTRA_FLIP_DIFF, GRINDS, LIPS, REVERT, SEQUENCE, TRANSFER, TRANSITION } from './vocab'
import type { Trick } from './types'

export interface RatingParts {
  raw: number
  gate: number
  modifiers: number
  rating: number
}

/**
 * 1–10 skill rating for a trick (PROVISIONAL mapping, independent of points).
 * raw = component difficulties + modifiers + combos; gated components can't rate below their gate.
 */
export function rateTrick(t: Trick, gate: number): RatingParts {
  const D = DIFFICULTY
  const m = t.flip ? BOARD_MOVES[t.flip] : undefined
  const stance = D.stance[t.stance]
  const obstacle = Math.max(D.obstacle[t.obstacle], t.transferTo ? D.obstacle[t.transferTo] : 0)
  let direction = 0
  if (t.grind && t.direction) {
    const dm = GRINDS[t.grind]?.dirMult
    if (dm) direction = (dm[t.direction] - 1) * D.directionWeight
  }
  const isFlip = !!m?.flip
  const entry = t.pattern === 'flip→grind' || t.pattern === 'flip→manual'
  let combo = 0
  if (entry && t.grind) combo += D.combo.flipGrind
  if (entry && t.manual) combo += D.combo.flipManual
  if (t.spin && isFlip) combo += t.spin.deg === 360 ? D.combo.spinFlip360 : D.combo.spinFlip180
  if (t.spin && m?.board && !isFlip) combo += D.combo.spinBoard
  if (t.spin && t.grind) combo += D.combo.spinGrind
  if (t.spin && t.manual) combo += D.combo.spinManual
  if (t.exit && entry) combo += SEQUENCE.diff

  let core = 0
  if (m) core += t.pattern === 'flip-only' || t.pattern === 'transfer' || m.key !== 'ollie' ? m.diff : 0
  if (t.flips) core += EXTRA_FLIP_DIFF * (t.flips - 1)
  if (t.spin) core += D.spin[t.spin.deg]
  if (t.grind) core += GRINDS[t.grind]?.diff ?? 0
  if (t.grind2) core += TRANSITION.diff
  if (t.manual) core += CONFIG.families.manuals.subs[t.manual]?.diff ?? 0
  if (t.lip) core += LIPS[t.lip]?.diff ?? 0
  if (t.exit) core += EXITS[t.exit]?.diff ?? 0
  if (t.revert) core += REVERT.diff
  if (t.transferTo) core += TRANSFER.diff

  const modifiers = stance + obstacle + direction
  const raw = core + modifiers + combo
  const rating = Math.min(10, Math.max(1, raw, gate + D.modifierWeight * (modifiers + combo / 2)))
  return { raw, gate, modifiers, rating: Math.round(rating * 10) / 10 }
}
