import type { Receipt as R } from '../engine/score'

const x = (n: number) => `×${n.toFixed(2)}`
const plus = (n: number) => (n === 0 ? '0' : `+${Math.round(n * 1000) / 1000}`)

export function Receipt({ r }: { r: R }) {
  if (r.kind === 'failed') return <p className="receipt muted">No points for three misses.{r.letter ? ` Letter ${r.letter} added.` : ''}</p>
  if (r.kind === 'skipped')
    return (
      <div className="receipt">
        <Row k="Skip penalty (provisional)" v={String(r.requestedPenalty)} />
        {r.skipDelta !== r.requestedPenalty && <Row k="Applied (score can’t go below 0)" v={String(r.skipDelta)} />}
        <p className="muted small">Streak reset. No SKATE letter.</p>
      </div>
    )
  return (
    <div className="receipt">
      {r.baseParts.map((p) => (
        <Row key={p.label} k={p.label} v={p.label === 'Base' ? '1' : plus(p.value)} />
      ))}
      <Row k="Base sum" v={r.baseSum.toFixed(3)} strong />
      {r.combos.map((c) => (
        <Row key={c.label} k={`Combo: ${c.label}`} v={x(c.mult)} />
      ))}
      <Row k={`Attempt ${r.attempt}`} v={x(r.attemptM)} />
      <Row k={`Flow (${r.flowCount} in a row)`} v={x(r.flowM)} />
      <Row k={r.repeatNote} v={x(r.repeatM)} />
      <Row k={`× ${r.scale}, rounded`} v={String(r.total)} strong />
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <p className={`receipt__row${strong ? ' receipt__row--strong' : ''}`}>
      <span>{k}</span>
      <span>{v}</span>
    </p>
  )
}
