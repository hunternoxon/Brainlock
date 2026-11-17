import { CONFIG, DIFFICULTY } from './rules'
import type { Trick } from './types'

export interface RatingParts {
  raw: number
  gate: number
  modifiers: number
  rating: number
}

const diffOf = (fam: string, name?: string) => (name ? (CONFIG.families[fam]?.subs?.[name]?.diff ?? 0) : 0)

/**
 * 1–10 skill rating for a trick (PROVISIONAL mapping, independent of points).
 * raw = sum of component difficulties; gated components can't rate below their gate.
 */
export function rateTrick(t: Trick, gate: number): RatingParts {
  const D = DIFFICULTY
  const stance = D.stance[t.stance]
  const obstacle = D.obstacle[t.obstacle]
  let direction = 0
  if (t.grind && t.direction) {
    const m = CONFIG.scoring.grind_dir_mult[t.grind]
    if (m) direction = (m[t.direction] - 1) * D.directionWeight
  }
  let combo = 0
  if (t.flip && t.grind) combo += D.combo.flipGrind
  if (t.flip && t.manual) combo += D.combo.flipManual
  if (t.spin && t.flip) combo += t.spin.deg === 360 ? D.combo.spinFlip360 : D.combo.spinFlip180
  if (t.spin && t.grind) combo += D.combo.spinGrind
  if (t.spin && t.manual) combo += D.combo.spinManual

  const core = diffOf('flips', t.flip) + diffOf('grinds', t.grind) + diffOf('manuals', t.manual) + (t.spin ? D.spin[t.spin.deg] : 0)
  const modifiers = stance + obstacle + direction
  const raw = core + modifiers + combo
  const rating = Math.min(10, Math.max(1, raw, gate + D.modifierWeight * (modifiers + combo / 2)))
  return { raw, gate, modifiers, rating: Math.round(rating * 10) / 10 }
}
