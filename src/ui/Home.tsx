import { LETTERS, SOLO_LENGTHS } from '../engine/game'
import { boardKey } from '../engine/persist'
import { FAMILIES, OBSTACLES, STANCES } from '../engine/types'
import { DEV_PANEL, type View } from './App'
import { fmt } from './copy'
import type { Brainlock } from './useBrainlock'

export function Home({ b, go }: { b: Brainlock; go: (v: View) => void }) {
  const { settings: st, session: s, pool } = b
  const resumable = s && s.status !== 'over' ? s : null
  const adapted = b.profile.skill && b.profile.skill.anchor === st.level ? b.profile.skill : null
  const f = st.filters
  const best = b.store
    .loadScores()
    .filter((e) => e.board === boardKey(st.mode, st.soloLength))
    .sort((a, c) => c.value - a.value)[0]
  const canStart = pool.atLevel > 0

  const startNew = () => {
    b.start()
    go('play')
  }

  return (
    <main className="screen home">
      <header className="home__head">
        <h1 className="wordmark">Brainlock</h1>
        <p className="muted">Fingerboard challenges that match your level.</p>
      </header>

      {b.issues.length > 0 && (
        <p className="notice" role="status">
          Some saved data was unreadable and has been reset (a backup was kept in storage).
        </p>
      )}

      {resumable && (
        <section className="card resume" aria-label="Session in progress">
          <p className="meta">In progress · {resumable.mode === 'skate' ? 'SKATE' : `Solo ${resumable.soloLength}`}</p>
          <p className="resume__trick">{resumable.current ? resumable.current.display : 'Waiting on your filters'}</p>
          <p className="muted">
            {fmt(resumable.score)} pts
            {resumable.mode === 'skate' && resumable.letters > 0 && ` · ${LETTERS.slice(0, resumable.letters).join('')}`}
            {resumable.mode === 'solo' && ` · ${resumable.resolved}/${resumable.soloLength}`}
            {resumable.status === 'playing' && resumable.current && ` · attempt ${resumable.current.attempt} of 3`}
            {resumable.status === 'result' && ' · result showing'}
          </p>
          <div className="row">
            <button className="pill pill--primary" onClick={() => go('play')}>
              Resume
            </button>
            <button className="pill" onClick={() => b.discard()}>
              Start over
            </button>
          </div>
        </section>
      )}

      <section className="field" aria-label="Mode">
        <p className="label">Mode</p>
        <div className="seg" role="radiogroup">
          {(['skate', 'solo'] as const).map((m) => (
            <button key={m} role="radio" aria-checked={st.mode === m} className="seg__btn" onClick={() => b.setSettings({ mode: m })}>
              {m === 'skate' ? 'SKATE' : 'Solo'}
            </button>
          ))}
        </div>
        <p className="hint">{st.mode === 'skate' ? 'Three misses earns a letter. Spell S-K-A-T-E and you’re out.' : 'A fixed run of challenges. Score as much as you can.'}</p>
        {st.mode === 'solo' && (
          <div className="seg seg--sub" role="radiogroup" aria-label="Solo length">
            {SOLO_LENGTHS.map((n) => (
              <button key={n} role="radio" aria-checked={st.soloLength === n} className="seg__btn" onClick={() => b.setSettings({ soloLength: n })}>
                {n}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="field" aria-label="Level">
        <p className="label">Your level</p>
        <div className="stepper">
          <button className="pill pill--icon" aria-label="Lower level" disabled={st.level <= 1} onClick={() => b.setSettings({ level: st.level - 1 })}>
            −
          </button>
          <output className="stepper__val" aria-live="polite">
            {st.level}
          </output>
          <button className="pill pill--icon" aria-label="Raise level" disabled={st.level >= 10} onClick={() => b.setSettings({ level: st.level + 1 })}>
            +
          </button>
        </div>
        <p className="hint">
          {adapted && Math.abs(adapted.effective - st.level) >= 0.05 ? (
            <>
              Adapted to {adapted.effective.toFixed(1)} from your play.{' '}
              <button className="link" onClick={b.resetSkill}>
                Reset to {st.level}
              </button>
            </>
          ) : (
            '1 = just starting, 10 = pro. It adjusts slowly as you play.'
          )}
        </p>
      </section>

      <section className="field" aria-label="Setup">
        <p className="label">Setup</p>
        <button className="setup-summary" onClick={() => go('setup')}>
          <span>
            {f.obstacles.length === OBSTACLES.length ? 'All 12 obstacles' : `${f.obstacles.length} obstacles`} · {f.families.length}/{FAMILIES.length} trick types ·{' '}
            {f.stances.length === STANCES.length ? 'all stances' : f.stances.join(', ')}
          </span>
          <span className="setup-summary__edit">Edit</span>
        </button>
        {canStart ? (
          <p className="hint">{fmt(pool.atLevel)} possible tricks at your level.</p>
        ) : (
          <div className="notice notice--warn" role="alert">
            {pool.messages.map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        )}
      </section>

      <div className="home__cta">
        <button className="pill pill--primary pill--xl" disabled={!canStart} onClick={startNew}>
          {resumable ? 'Start new session' : 'Start session'}
        </button>
        {best && (
          <p className="hint center">
            Best {st.mode === 'skate' ? 'SKATE' : `Solo ${st.soloLength}`}: {fmt(best.value)}
          </p>
        )}
      </div>

      <footer className="home__foot">
        <button className="link" onClick={() => go('scores')}>
          Scores & history
        </button>
        <button className="link" aria-pressed={st.sound} onClick={() => b.setSettings({ sound: !st.sound })}>
          Sound {st.sound ? 'on' : 'off'}
        </button>
        {DEV_PANEL && (
          <button className="link" onClick={() => go('dev')}>
            Dev
          </button>
        )}
      </footer>
    </main>
  )
}
