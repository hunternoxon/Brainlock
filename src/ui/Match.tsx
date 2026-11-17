import { LETTERS } from '../engine/game'
import { standings, type MatchState } from '../engine/match'
import type { Go } from './App'
import { fmt } from './copy'
import type { Brainlock } from './useBrainlock'

/** "Your turn" for the default first player, otherwise "Sam’s turn" */
export const turnLabel = (name: string) => (name === 'You' ? 'Your turn' : `${name}’s turn`)

export const modeLabel = (mode: string, n?: number) => (mode === 'skate' ? 'SKATE' : `Marathon${n ? ` ${n}` : ''}`)

/** Label for the Next button: who the phone gets passed to, or results. */
export function nextPlayerLabel(m: MatchState): string {
  const cur = m.players[m.turn]
  const curOut = cur.session.status === 'over' || (m.mode === 'solo' && cur.session.resolved >= m.soloLength)
  const others = m.players.filter((p, i) => i !== m.turn && p.session.status !== 'over')
  if (m.mode === 'skate' && others.length + (curOut ? 0 : 1) <= 1) return 'See results'
  if (others.length === 0) return curOut ? 'See results' : 'Next'
  for (let k = 1; k <= m.players.length; k++) {
    const p = m.players[(m.turn + k) % m.players.length]
    if (p.session.status !== 'over' && p !== cur) return p.name === 'You' ? 'Pass back to you' : `Pass to ${p.name}`
  }
  return 'Next'
}

export function MatchBar({ m }: { m: MatchState }) {
  return (
    <ol className="matchbar" aria-label="Players">
      {m.players.map((p, i) => {
        const out = p.session.endReason === 'skate'
        return (
          <li key={p.id} className="matchbar__p" data-active={i === m.turn || undefined} data-out={out || undefined}>
            <span className="matchbar__name">{p.name}</span>
            <span className="matchbar__stat">
              {m.mode === 'skate' ? (p.session.letters ? LETTERS.slice(0, p.session.letters).join('') : '–') : `${Math.min(p.session.resolved, m.soloLength)}/${m.soloLength}`} · {fmt(p.session.score)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function MatchSummary({ b, go, m }: { b: Brainlock; go: Go; m: MatchState }) {
  const ranked = standings(m)
  const winners = m.players.filter((p) => m.winners.includes(p.id))
  const title =
    m.endReason === 'ended' && winners.length === 0
      ? 'Match ended.'
      : winners.length > 1
        ? `Tie: ${winners.map((w) => w.name).join(' & ')}`
        : `${winners[0]?.name ?? 'Nobody'} ${winners[0]?.name === 'You' ? 'win' : 'wins'}${m.endReason === 'ended' ? ' (ended early)' : ''}`
  return (
    <main className="screen summary">
      <header>
        <p className="meta">
          {modeLabel(m.mode, m.mode === 'solo' ? m.soloLength : undefined)} · {m.players.length} players · {m.shared ? 'same tricks' : 'own-level tricks'}
        </p>
        <h2 className="summary__title">{title}</h2>
      </header>
      <ol className="standings">
        {ranked.map((p, i) => (
          <li key={p.id} data-winner={m.winners.includes(p.id) || undefined}>
            <span className="standings__rank">{i + 1}</span>
            <span className="standings__name">{p.name}</span>
            <span className="standings__stat">
              {m.mode === 'skate' && (p.session.endReason === 'skate' ? 'out · ' : p.session.letters ? `${LETTERS.slice(0, p.session.letters).join('')} · ` : 'clean · ')}
              {fmt(p.session.score)}
            </span>
          </li>
        ))}
      </ol>
      <p className="hint">Multiplayer matches are saved under Scores and don’t change anyone’s long-term level.</p>
      <footer className="thumb">
        <button className="pill pill--primary pill--xl" onClick={() => go('play', b.start())}>
          Rematch
        </button>
        <button
          className="pill pill--ghost"
          onClick={() => {
            b.leaveMatch()
            go('home')
          }}
        >
          Home
        </button>
      </footer>
    </main>
  )
}
