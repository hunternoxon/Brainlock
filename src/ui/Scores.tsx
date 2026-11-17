import { useState } from 'react'
import { FORGET_REASONS, isLearnable } from '../engine/learning'
import type { HistoryEntry } from '../engine/persist'
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
  void tick
  void b.historyRev
  const scores = b.store.loadScores()
  const history = b.store.loadHistory()

  return (
    <main className="screen scores">
      <header className="setup__head">
        <h2>Scores</h2>
        <button className="pill pill--primary" onClick={onClose}>
          Done
        </button>
      </header>

      <div className="scores__grid">
        <div className="scores__boards">
          {BOARDS.map(([key, label]) => {
            const top = scores.filter((s) => s.board === key).slice(0, 5)
            return (
              <section className="panel" key={key}>
                <div className="panel__head">
                  <h3>{label}</h3>
                </div>
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
        </div>

        <section className="panel scores__history">
          <div className="panel__head">
            <h3>History</h3>
          </div>
          <p className="hint small">Only completed sessions teach your long-term level. Ended-early and abandoned runs are kept here but not learned from.</p>
          {history.length === 0 && <p className="hint">Nothing yet.</p>}
          <ol className="history">
            {history.slice(0, 50).map((h) => (
              <HistoryRow key={h.id} h={h} b={b} />
            ))}
          </ol>
        </section>
      </div>

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

function HistoryRow({ h, b }: { h: HistoryEntry; b: Brainlock }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [alsoDelete, setAlsoDelete] = useState(false)
  const l = isLearnable(h)
  const learnable = h.endReason === 'skate' || h.endReason === 'solo-complete'

  return (
    <li>
      <span>
        {h.mode === 'skate' ? 'SKATE' : `Solo ${h.soloLength}`} · {REASON[h.endReason] ?? h.endReason}
      </span>
      <span className="board__val">{fmt(h.score)}</span>
      <span className="muted small">
        {h.stats.landed} landed · {h.stats.failed} failed · {h.stats.skipped} skipped · Lv {h.skillStart.toFixed(1)}→{h.skillEnd.toFixed(1)} · {date(h.endedAt)}
      </span>
      <span className="history__learn small">
        {h.forgotten ? (
          <>
            Not used for learning ({h.forgotten.reason}
            {h.forgotten.note ? `: ${h.forgotten.note}` : ''}).{' '}
            <button className="link small" onClick={() => b.unforget(h.id)}>
              Use it again
            </button>
          </>
        ) : l.ok ? (
          <>
            Used for learning.{' '}
            {!open && (
              <button className="link small" onClick={() => setOpen(true)}>
                Forget this session for skill learning
              </button>
            )}
          </>
        ) : (
          <span className="muted">Not used for learning ({l.why}).</span>
        )}
      </span>
      {open && learnable && !h.forgotten && (
        <div className="forget" role="group" aria-label="Forget session">
          <label className="label" htmlFor={`r-${h.id}`}>
            Why? (required)
          </label>
          <select id={`r-${h.id}`} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason…</option>
            {FORGET_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <input aria-label="Optional note" placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
          <label className="check">
            <input type="checkbox" checked={alsoDelete} onChange={(e) => setAlsoDelete(e.target.checked)} />
            Also delete this session and its score
          </label>
          <div className="row">
            <button className="pill pill--sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className={`pill pill--sm ${alsoDelete ? 'pill--danger' : 'pill--primary'}`}
              disabled={!reason || (reason === 'Other' && !note.trim())}
              onClick={() => {
                b.forget(h.id, reason, note, alsoDelete)
                setOpen(false)
              }}
            >
              {alsoDelete ? 'Forget and delete' : 'Forget for learning'}
            </button>
          </div>
          <p className="hint small">Your level is recalculated from the remaining completed sessions.{!alsoDelete && ' The score and history stay.'}</p>
        </div>
      )}
    </li>
  )
}
