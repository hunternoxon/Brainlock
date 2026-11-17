import { useState } from 'react'
import { sessionStats } from '../engine/game'
import { sanitizeInitials } from '../engine/persist'
import type { Go } from './App'
import { copy, fmt } from './copy'
import { Receipt } from './Receipt'
import type { Brainlock } from './useBrainlock'

export function Summary({ b, go }: { b: Brainlock; go: Go }) {
  const s = b.session!
  const st = sessionStats(s)
  const f = b.finish
  const [open, setOpen] = useState<string | null>(null)
  const last = s.history.at(-1)
  const eligible = s.endReason === 'skate' || s.endReason === 'solo-complete'

  return (
    <main className="screen summary">
      <header>
        <p className="meta">{s.mode === 'skate' ? 'SKATE' : `Marathon ${s.soloLength}`}</p>
        <h2 className="summary__title">{copy.over(s.endReason)}</h2>
        {s.endReason === 'skate' && last && (
          <p className="muted">
            Last one: {last.display} · {last.letter} earned
          </p>
        )}
      </header>

      <section className="summary__score">
        <p className="result__points">{fmt(s.score)}</p>
        {eligible && f && (
          <p className="muted">
            {f.isNewBest ? (f.previousBest === null ? 'First score on this board.' : `New best! Previous ${fmt(f.previousBest)}.`) : f.previousBest !== null ? `Best ${fmt(f.previousBest)} (${s.score - f.previousBest >= 0 ? '+' : ''}${fmt(s.score - f.previousBest)})` : ''}
          </p>
        )}
        {!eligible && <p className="muted">Ended early, so it’s saved to history but not high scores.</p>}
      </section>

      {eligible && <InitialsPrompt b={b} />}

      <dl className="stats">
        <div>
          <dt>Landed</dt>
          <dd>{st.landed}</dd>
        </div>
        <div>
          <dt>First try</dt>
          <dd>{st.firstTry}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{st.failed}</dd>
        </div>
        <div>
          <dt>Skipped</dt>
          <dd>{st.skipped}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd>{s.bestFlow}</dd>
        </div>
        <div>
          <dt>Level</dt>
          <dd>
            {s.skillStart.toFixed(1)} → {s.skill.effective.toFixed(1)}
          </dd>
        </div>
      </dl>

      <ol className="recap">
        {s.history.map((c) => (
          <li key={c.id}>
            <button className="recap__row" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
              <span className="recap__name">{c.display}</span>
              <span className={`recap__pts recap__pts--${c.outcome}`}>
                {c.outcome === 'landed' ? `+${c.delta}` : c.outcome === 'failed' ? (c.letter ?? '✕') : c.outcome === 'skipped' ? (c.delta ? String(c.delta) : 'skip') : '—'}
              </span>
            </button>
            {open === c.id && c.receipt && <Receipt r={c.receipt} />}
          </li>
        ))}
      </ol>

      <footer className="thumb">
        <button
          className="pill pill--primary pill--xl"
          onClick={() => go('play', b.start())}
        >
          New session
        </button>
        <button
          className="pill pill--ghost"
          onClick={() => {
            b.leave()
            go('home')
          }}
        >
          Home
        </button>
      </footer>
    </main>
  )
}

/** Arcade-style: the score only goes on the board once initials are entered. */
function InitialsPrompt({ b }: { b: Brainlock }) {
  const s = b.session!
  void b.historyRev
  const posted = b.store.loadScores().find((e) => e.sessionId === s.id)
  const [ini, setIni] = useState(() => b.settings.initials)
  const board = s.mode === 'skate' ? 'SKATE' : `Marathon ${s.soloLength}`

  if (posted)
    return (
      <p className="initials__done" role="status">
        On the {board} board as <strong>{posted.initials}</strong>
      </p>
    )
  return (
    <form
      className="initials"
      onSubmit={(e) => {
        e.preventDefault()
        b.postScore(s.id, ini)
      }}
    >
      <label className="label" htmlFor="initials">
        Add your initials to the {board} board
      </label>
      <div className="initials__row">
        <input
          id="initials"
          className="initials__input"
          value={ini}
          maxLength={3}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="AAA"
          onChange={(e) => setIni(sanitizeInitials(e.target.value))}
        />
        <button className="pill pill--primary" type="submit" disabled={!ini}>
          Add score
        </button>
      </div>
      <p className="hint small">Skip it and the score stays in history only.</p>
    </form>
  )
}
