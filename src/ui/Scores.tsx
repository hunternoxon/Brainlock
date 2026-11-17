import { useState } from 'react'
import { fmt } from './copy'
import type { Brainlock } from './useBrainlock'

const BOARDS = [
  ['skate', 'SKATE'],
  ['solo-10', 'Solo 10'],
  ['solo-25', 'Solo 25'],
  ['solo-50', 'Solo 50'],
] as const

const REASON: Record<string, string> = { skate: 'S-K-A-T-E', 'solo-complete': 'Completed', ended: 'Ended early', abandoned: 'Abandoned' }
const date = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function Scores({ b, onClose }: { b: Brainlock; onClose: () => void }) {
  const [tick, setTick] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const scores = b.store.loadScores()
  const history = b.store.loadHistory()
  void tick

  return (
    <main className="screen scores">
      <header className="setup__head">
        <h2>Scores</h2>
        <button className="pill pill--primary" onClick={onClose}>
          Done
        </button>
      </header>

      {BOARDS.map(([key, label]) => {
        const top = scores.filter((s) => s.board === key).slice(0, 5)
        return (
          <section className="field" key={key}>
            <p className="label">{label}</p>
            {top.length === 0 ? (
              <p className="hint">No completed runs yet.</p>
            ) : (
              <ol className="board">
                {top.map((s, i) => (
                  <li key={s.sessionId}>
                    <span className="board__rank">{i + 1}</span>
                    <span className="board__val">{fmt(s.value)}</span>
                    <span className="muted small">
                      L{s.startLevel} · {s.landed}/{s.challenges} landed · {date(s.at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      })}

      <section className="field">
        <p className="label">History</p>
        {history.length === 0 && <p className="hint">Nothing yet.</p>}
        <ol className="history">
          {history.slice(0, 50).map((h) => (
            <li key={h.id}>
              <span>
                {h.mode === 'skate' ? 'SKATE' : `Solo ${h.soloLength}`} · {REASON[h.endReason] ?? h.endReason}
              </span>
              <span className="board__val">{fmt(h.score)}</span>
              <span className="muted small">
                {h.stats.landed} landed · {h.stats.failed} failed · {h.stats.skipped} skipped · Lv {h.skillStart.toFixed(1)}→{h.skillEnd.toFixed(1)} · {date(h.endedAt)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="setup__foot">
        <button
          className={`link ${confirm ? 'danger' : ''}`}
          onClick={() => {
            if (!confirm) return setConfirm(true)
            b.store.clearScoresAndHistory()
            setConfirm(false)
            setTick((t) => t + 1)
          }}
        >
          {confirm ? 'Tap again to erase scores and history' : 'Clear scores and history'}
        </button>
      </footer>
    </main>
  )
}
