import type { CSSProperties } from 'react'
import './CutWords.css'

function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

type Props = { text: string; seed?: number; /** Word that flips to black (otherwise one is picked) */ highlight?: string }

/**
 * Words that get sliced apart on hover: a blade cuts between each word, then
 * the pieces lift, drift, and follow the cursor. Activated by a
 * `.cut-host` ancestor (hover, focus, or data-active="true").
 */
export function CutWords({ text, seed = 1, highlight }: Props) {
  const rand = seeded(seed * 7919)
  const words = text.split(' ')
  const picked = Math.floor(rand() * words.length)
  const wanted = highlight ? words.findIndex((w) => w.replace(/[^\w]/g, '') === highlight) : -1
  const invert = wanted >= 0 ? wanted : picked

  return (
    <span className="cutwords">
      {words.map((word, i) => {
        const style = {
          '--i': i,
          '--dx': `${(rand() * 0.14 - 0.07).toFixed(3)}em`,
          '--dy': `${(rand() * 0.18 - 0.09).toFixed(3)}em`,
          '--r': `${(rand() * 5 - 2.5).toFixed(2)}deg`,
          '--depth': (0.4 + rand() * 1.2).toFixed(2),
        } as CSSProperties
        return (
          <span key={i}>
            <span className="cw" style={style} data-invert={i === invert || undefined}>
              <span className="cw__in">{word}</span>
            </span>
            {i < words.length - 1 ? ' ' : null}
          </span>
        )
      })}
    </span>
  )
}
