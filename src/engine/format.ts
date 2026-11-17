import type { Obstacle, Trick } from './types'

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

export function obstaclePhrase(o: Obstacle): string {
  return OBSTACLE_PHRASE[o]
}

/** Trick name without the obstacle, e.g. "Switch kickflip BS smith". */
export function trickName(t: Trick): string {
  const p: string[] = []
  if (t.stance !== 'regular') p.push(t.stance)
  if (t.spin) p.push(`${t.spin.dir} ${t.spin.deg}`)
  if (t.flip) p.push(t.flip)
  if (t.grind) p.push(`${t.direction} ${t.grind}`)
  if (t.manual) p.push(t.flip || t.spin ? `to ${t.manual}` : t.manual)
  const s = p.join(' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function displayText(t: Trick): string {
  return `${trickName(t)} ${obstaclePhrase(t.obstacle)}`
}

/** Exact prompt identity. Different obstacle/stance/spin = different prompt. */
export function trickKey(t: Trick): string {
  return [t.stance, t.spin ? `${t.spin.dir}${t.spin.deg}` : '', t.flip ?? '', t.grind ?? '', t.direction ?? '', t.manual ?? '', t.obstacle].join('|')
}

/** Historical spec signature: stance|spin|flip|grind|manual|direction, obstacle excluded. */
export function trickSignature(t: Trick): string {
  return [t.stance, t.spin ? `${t.spin.dir}${t.spin.deg}` : '', t.flip ?? '', t.grind ?? '', t.manual ?? '', t.direction ?? ''].join('|')
}
