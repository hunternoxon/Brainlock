import { useState } from 'react'
import { DEFAULT_TUNABLES, type Tunables } from '../engine/tunables'
import type { Brainlock } from './useBrainlock'

type NumKey = { [K in keyof Tunables]: Tunables[K] extends number ? K : never }[keyof Tunables]
type BoolKey = { [K in keyof Tunables]: Tunables[K] extends boolean ? K : never }[keyof Tunables]

const NUMS: [NumKey, string, number][] = [
  ['skipPenaltyPoints', 'Skip penalty (points)', 5],
  ['repeatCooldown', 'Exact-repeat cooldown (prompts)', 1],
  ['adaptationRate', 'Adaptation rate', 0.01],
  ['adaptationWindow', 'Evidence window', 1],
  ['adaptationWarmup', 'Warm-up challenges', 1],
  ['adaptationStepLimit', 'Max step per challenge', 0.01],
  ['evidenceLand1', 'Evidence: land 1st', 0.05],
  ['evidenceLand2', 'Evidence: land 2nd', 0.05],
  ['evidenceLand3', 'Evidence: land 3rd', 0.05],
  ['evidenceFail', 'Evidence: 3 misses', 0.05],
  ['evidenceSkip', 'Evidence: skip', 0.05],
  ['evidenceDifficultyWeight', 'Evidence × (rating − skill) weight', 0.05],
  ['difficultyBand', 'Selection band ±', 0.1],
  ['maxStretch', 'Max rating above skill', 0.05],
  ['mixEasy', 'Mix: easy share', 0.05],
  ['mixStretch', 'Mix: stretch share', 0.05],
  ['easyOffset', 'Easy offset', 0.1],
  ['stretchOffset', 'Stretch offset', 0.1],
]
const BOOLS: [BoolKey, string][] = [
  ['skipPenaltyEnabled', 'Skip penalty enabled'],
  ['scoreFloorZero', 'Score floor at 0'],
  ['repeatPenaltyEnabled', 'Repeat penalty (legacy −10%)'],
  ['adaptiveDifficultyEnabled', 'Adaptive difficulty'],
  ['experimentalEnabled', 'Experimental combos lane'],
]

/** Local-only developer controls (only bundled in `vite dev`). */
export function DevPanel({ b, onClose }: { b: Brainlock; onClose: () => void }) {
  const t = b.tunables
  const [seed, setSeed] = useState('')
  const set = (p: Partial<Tunables>) => b.setTunables({ ...t, ...p })
  const s = b.session

  const exportTrace = () => {
    const data = { exportedAt: new Date().toISOString(), tunables: t, settings: b.settings, session: s, history: b.store.loadHistory().slice(0, 10) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `brainlock-trace-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="screen dev">
      <header className="setup__head">
        <h2>Dev panel</h2>
        <button className="pill pill--primary" onClick={onClose}>
          Close
        </button>
      </header>
      <p className="hint">Local only. All values are provisional playtest defaults. Changes apply to the current session immediately and are logged.</p>

      <section className="field">
        <p className="label">Flags</p>
        {BOOLS.map(([k, label]) => (
          <label key={k} className="dev__row">
            <input type="checkbox" checked={t[k]} onChange={(e) => set({ [k]: e.target.checked })} />
            <span>{label}</span>
            {t[k] !== DEFAULT_TUNABLES[k] && <span className="tag">changed</span>}
          </label>
        ))}
        <label className="dev__row">
          <span>Flow resets on</span>
          <select value={t.flowResetOn} onChange={(e) => set({ flowResetOn: e.target.value as Tunables['flowResetOn'] })}>
            <option value="any-miss">any missed attempt</option>
            <option value="failed-challenge">failed challenge only</option>
          </select>
        </label>
        <p className="hint">Runtime AI: off (locked) · Stack Builder: off (locked)</p>
      </section>

      <section className="field">
        <p className="label">Numbers</p>
        {NUMS.map(([k, label, step]) => (
          <label key={k} className="dev__row">
            <span>{label}</span>
            <input type="number" step={step} value={t[k]} onChange={(e) => e.target.value !== '' && set({ [k]: Number(e.target.value) })} />
            {t[k] !== DEFAULT_TUNABLES[k] && <span className="tag">was {DEFAULT_TUNABLES[k]}</span>}
          </label>
        ))}
        <button className="pill" onClick={b.resetTunables}>
          Reset to defaults
        </button>
      </section>

      <section className="field">
        <p className="label">Replay</p>
        <label className="dev__row">
          <span>Seed for next session</span>
          <input inputMode="numeric" value={seed} placeholder="random" onChange={(e) => setSeed(e.target.value)} />
        </label>
        <button className="pill" onClick={() => b.setNextSeed(seed ? Number(seed) >>> 0 : null)}>
          Use seed for next start
        </button>
        {s && <p className="hint">Current session seed: {s.seed} · events: {s.events.length}</p>}
        <button className="pill" onClick={exportTrace}>
          Export session trace (JSON)
        </button>
      </section>

      {s && (
        <section className="field">
          <p className="label">Skill log</p>
          <ol className="dev__log">
            {[...s.history, ...(s.current && s.status === 'result' ? [s.current] : [])]
              .filter((c) => c.skill)
              .map((c) => (
                <li key={c.id}>
                  <b>{c.display}</b> [{c.rating}] — {c.skill!.before.toFixed(2)}→{c.skill!.after.toFixed(2)}: {c.skill!.reason}
                </li>
              ))}
          </ol>
        </section>
      )}
    </main>
  )
}
