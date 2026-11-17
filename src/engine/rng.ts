/**
 * mulberry32. State is a single uint32 so it can be persisted in the session
 * snapshot and replayed exactly after a reload.
 */
export function nextRandom(state: number): [value: number, state: number] {
  const s = (state + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s >>> 0]
}

/** Mutable wrapper for use inside one pure step; read `.state` back out after. */
export class Rng {
  constructor(public state: number) {}
  next(): number {
    const [v, s] = nextRandom(this.state)
    this.state = s
    return v
  }
  /** Weighted pick; returns undefined only for empty / all-zero input. */
  pick<T>(items: readonly T[], weight: (x: T) => number): T | undefined {
    let total = 0
    const ws = items.map((x) => {
      const w = Math.max(0, weight(x))
      total += w
      return w
    })
    if (total <= 0) return undefined
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) if ((r -= ws[i]) <= 0) return items[i]
    return items[items.length - 1]
  }
}

export function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
