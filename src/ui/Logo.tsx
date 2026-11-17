/**
 * Wordmark after the old Humber badge: flared glyphic capitals, slightly
 * imperfect (roughened edges, hand-set baseline/angle jitter), no rule.
 */
const JITTER: [number, number][] = [
  [0, -0.6],
  [0.02, 0.8],
  [-0.015, -0.4],
  [0.01, 1.1],
  [-0.02, -0.9],
  [0.015, 0.5],
  [-0.01, -1.2],
  [0.02, 0.7],
  [0, -0.5],
]

export function Logo() {
  return (
    <span className="logo" aria-label="Brainlock" role="img">
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id="logo-rough" x="-5%" y="-10%" width="110%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <span className="logo__word" aria-hidden="true">
        {'BRAINLOCK'.split('').map((ch, i) => (
          <span key={i} style={{ transform: `translateY(${JITTER[i][0]}em) rotate(${JITTER[i][1]}deg)` }}>
            {ch}
          </span>
        ))}
      </span>
    </span>
  )
}
