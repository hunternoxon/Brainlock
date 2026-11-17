/**
 * Brainlock wordmark. KISS-inspired: tall angular caps, a lightning-bolt "I",
 * a chrome horizon line. Partiful-inspired: a chunky die-cut sticker outline,
 * offset shadow, slight tilt and a sparkle mark.
 */
const W = 56
const GAP = 7
type Glyph = { d: string; w: number; fill?: boolean }
const GLYPHS: Record<string, Glyph> = {
  B: { d: 'M8 8 H38 L48 18 V38 L40 50 L50 60 V82 L40 92 H8 Z M8 50 H40', w: W },
  R: { d: 'M8 92 V8 H38 L48 18 V40 L38 50 H8 M28 50 L50 92', w: W },
  A: { d: 'M5 92 L21 8 H35 L51 92 M13 64 H43', w: W },
  I: { d: 'M17 0 H45 L33 38 H48 L10 100 L21 54 H6 Z', w: 50, fill: true },
  N: { d: 'M8 94 V8 L48 92 V6', w: W },
  L: { d: 'M8 4 V92 H50', w: 54 },
  O: { d: 'M8 22 L22 8 H34 L48 22 V78 L34 92 H22 L8 78 Z', w: W },
  C: { d: 'M50 16 L42 8 H22 L8 22 V78 L22 92 H42 L50 84', w: 54 },
  K: { d: 'M8 4 V96 M48 6 L20 50 H32 L52 94', w: W },
}
const WORD = 'BRAINLOCK'
let x = 0
const PLACED = WORD.split('').map((ch) => {
  const g = GLYPHS[ch]
  const p = { ...g, x }
  x += g.w + GAP
  return p
})
const WIDTH = x - GAP

function Letters({ stroke, width, fillBolt, join = 'miter' }: { stroke: string; width: number; fillBolt?: string; join?: 'miter' | 'round' }) {
  return (
    <>
      {PLACED.map((g, i) => (
        <path
          key={i}
          d={g.d}
          transform={`translate(${g.x} 0)`}
          fill={g.fill ? (fillBolt ?? stroke) : 'none'}
          stroke={stroke}
          strokeWidth={g.fill ? width - 13 : width}
          strokeLinejoin={join}
          strokeLinecap={join === 'round' ? 'round' : 'square'}
          strokeMiterlimit={4}
        />
      ))}
    </>
  )
}

export function Logo({ title = 'Brainlock' }: { title?: string }) {
  const pad = 22
  return (
    <svg className="logo" viewBox={`${-pad} ${-pad} ${WIDTH + pad * 2} ${100 + pad * 2}`} role="img" aria-label={title}>
      <defs>
        <linearGradient id="bl-chrome" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--chrome-1)' }} />
          <stop offset="0.48" style={{ stopColor: 'var(--chrome-2)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--chrome-3)' }} />
          <stop offset="0.56" style={{ stopColor: 'var(--chrome-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--chrome-4)' }} />
        </linearGradient>
      </defs>
      <g className="logo__tilt">
        {/* Sticker: offset shadow, then the die-cut backing */}
        <g transform="translate(5 6)" opacity="0.9">
          <Letters stroke="var(--ink-strong)" width={36} join="round" />
        </g>
        <Letters stroke="var(--paper)" width={36} join="round" />
        <Letters stroke="var(--ink-strong)" width={18} />
        <Letters stroke="url(#bl-chrome)" width={13} fillBolt="var(--laser)" />
        <path className="logo__spark" d="M0 -14 L3.5 -3.5 L14 0 L3.5 3.5 L0 14 L-3.5 3.5 L-14 0 L-3.5 -3.5 Z" transform={`translate(${WIDTH + 4} -6)`} fill="var(--laser)" stroke="var(--ink-strong)" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

/** Square mark: bolt on a rounded sticker blob (used for the favicon). */
export const MARK_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 4 C78 4 96 22 96 50 C96 78 78 96 50 96 C22 96 4 78 4 50 C4 22 22 4 50 4Z' fill='%23111'/><path d='M54 14 H76 L64 44 H78 L36 88 L46 54 H30 Z' fill='%23ff2414' stroke='white' stroke-width='5' stroke-linejoin='round'/></svg>`
