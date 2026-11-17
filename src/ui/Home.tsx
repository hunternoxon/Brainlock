import { LETTERS, SOLO_LENGTHS } from '../engine/game'
import { MAX_PLAYERS } from '../engine/match'
import { boardKey } from '../engine/persist'
import { FAMILIES, OBSTACLES, STANCES } from '../engine/types'
import { DEV_PANEL, type Go } from './App'
import { fmt } from './copy'
import { Logo } from './Logo'
import { modeLabel, turnLabel } from './Match'
import { Switch } from './SetupSheet'
import { StaticWord } from './StaticWord'
import type { Brainlock } from './useBrainlock'

export function Home({ b, go }: { b: Brainlock; go: Go }) {
  const { settings: st, session: s, pool, match } = b
  const mu = st.multi
  const multi = mu.count > 1
  const resumable = s && s.status !== 'over' ? s : null
  const resumableMatch = match && match.status !== 'over' ? match : null
  const lt = b.longTerm
  const adapted = lt.used.length ? lt.skill : null
  const f = st.filters
  const best = b.store
    .loadScores()
    .filter((e) => e.board === boardKey(st.mode, st.soloLength))
    .sort((a, c) => c.value - a.value)[0]
  const canStart = pool.atLevel > 0
  const setMulti = (p: Partial<typeof mu>) => b.setSettings({ multi: { ...mu, ...p } })

  return (
    <main className="screen home">
      <header className="home__head">
        <h1 className="wordmark">
          <Logo />
        </h1>
        <p className="tagline">
          <StaticWord words={['Finger', 'Skate']} />
          board challenges that match your level.
        </p>
      </header>

      {b.issues.length > 0 && (
        <p className="notice" role="status">
          Some saved data was unreadable and has been reset (a backup was kept in storage).
        </p>
      )}

      {resumable && (
        <section className="card resume" aria-label="Session in progress">
          <p className="meta">In progress · {modeLabel(resumable.mode, resumable.mode === 'solo' ? resumable.soloLength : undefined)}</p>
          <p className="resume__trick">{resumable.current ? resumable.current.display : 'Waiting on your filters'}</p>
          <p className="muted">
            {fmt(resumable.score)} pts
            {resumable.mode === 'skate' && resumable.letters > 0 && ` · ${LETTERS.slice(0, resumable.letters).join('')}`}
            {resumable.mode === 'solo' && ` · ${resumable.resolved}/${resumable.soloLength}`}
            {resumable.status === 'playing' && resumable.current && ` · attempt ${resumable.current.attempt} of 3`}
            {resumable.status === 'result' && ' · result showing'}
          </p>
          <div className="row">
            <button className="pill pill--primary" onClick={() => go('play', 'single')}>
              Resume
            </button>
            <button className="pill" onClick={() => b.discard()}>
              Start over
            </button>
          </div>
        </section>
      )}

      {resumableMatch && (
        <section className="card resume" aria-label="Match in progress">
          <p className="meta">
            Match in progress · {modeLabel(resumableMatch.mode, resumableMatch.mode === 'solo' ? resumableMatch.soloLength : undefined)} · round {resumableMatch.round}
          </p>
          <p className="resume__trick">{turnLabel(resumableMatch.players[resumableMatch.turn].name)}</p>
          <p className="muted">{resumableMatch.players.map((p) => `${p.name} ${fmt(p.session.score)}`).join(' · ')}</p>
          <div className="row">
            <button className="pill pill--primary" onClick={() => go('play', 'match')}>
              Resume match
            </button>
            <button className="pill" onClick={() => b.discardMatch()}>
              End it
            </button>
          </div>
        </section>
      )}

      <div className="home__cols">
        <div className="home__col">
          <section className="field" aria-labelledby="mode-t">
            <h2 className="field__title" id="mode-t">
              Mode
            </h2>
            <div className="seg" role="radiogroup" aria-labelledby="mode-t">
              {(['skate', 'solo'] as const).map((m) => (
                <button key={m} role="radio" aria-checked={st.mode === m} className="seg__btn" onClick={() => b.setSettings({ mode: m })}>
                  {modeLabel(m)}
                </button>
              ))}
            </div>
            <p className="field__desc">{st.mode === 'skate' ? 'Three misses earns a letter. Spell S-K-A-T-E and you’re out.' : 'A fixed run of challenges. Score as much as you can.'}</p>
            {st.mode === 'solo' && (
              <div className="seg seg--sub" role="radiogroup" aria-label="Marathon length">
                {SOLO_LENGTHS.map((n) => (
                  <button key={n} role="radio" aria-checked={st.soloLength === n} className="seg__btn" onClick={() => b.setSettings({ soloLength: n })}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="field" aria-labelledby="players-t">
            <h2 className="field__title" id="players-t">
              Players
            </h2>
            <div className="seg" role="radiogroup" aria-labelledby="players-t">
              {Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).map((n) => (
                <button key={n} role="radio" aria-checked={mu.count === n} className="seg__btn" onClick={() => setMulti({ count: n })}>
                  {n === 1 ? 'Just me' : n}
                </button>
              ))}
            </div>
            <p className="field__desc">
              {multi
                ? st.mode === 'skate'
                  ? 'Pass the phone. Take turns; S-K-A-T-E knocks you out. Last one standing wins.'
                  : `Pass the phone. Everyone plays ${st.soloLength}; highest score wins.`
                : 'Play on your own. Your level adapts as you complete sessions.'}
            </p>
            {multi && (
              <div className="players">
                {Array.from({ length: mu.count }, (_, i) => (
                  <div className="player-row" key={i}>
                    <input
                      aria-label={`Player ${i + 1} name`}
                      value={mu.names[i]}
                      maxLength={16}
                      onChange={(e) => setMulti({ names: mu.names.map((n, j) => (j === i ? e.target.value : n)) })}
                    />
                    <Stepper
                      label={`Player ${i + 1} level`}
                      value={i === 0 ? st.level : mu.levels[i]}
                      onChange={(v) => (i === 0 ? b.setSettings({ level: v }) : setMulti({ levels: mu.levels.map((l, j) => (j === i ? v : l)) }))}
                      small
                    />
                  </div>
                ))}
                <Switch
                  label="Same trick for everyone"
                  hint={mu.shared ? 'Each round, everyone gets one trick at the group’s average level.' : 'Each player gets tricks matched to their own level.'}
                  on={mu.shared}
                  onChange={(v) => setMulti({ shared: v })}
                />
              </div>
            )}
          </section>

          {!multi && (
            <section className="field" aria-labelledby="level-t">
              <h2 className="field__title" id="level-t">
                Your level
              </h2>
              <Stepper label="Level" value={st.level} onChange={(v) => b.setSettings({ level: v })} />
              <p className="field__desc">
                {adapted && Math.abs(adapted.effective - st.level) >= 0.05 ? (
                  <>
                    Adapted to {adapted.effective.toFixed(1)} from {lt.used.length} completed session{lt.used.length === 1 ? '' : 's'}.{' '}
                    <button className="link" onClick={b.resetSkill}>
                      Reset to {st.level}
                    </button>
                  </>
                ) : (
                  '1 = just starting, 10 = pro. It adjusts slowly as you complete sessions.'
                )}
              </p>
            </section>
          )}
        </div>

        <div className="home__col">
          <section className="field" aria-labelledby="setup-t">
            <h2 className="field__title" id="setup-t">
              Setup
            </h2>
            <button className="setup-summary" onClick={() => go('setup')}>
              <span>
                {f.obstacles.length === OBSTACLES.length ? 'All 12 obstacles' : f.obstacles.length === 0 ? 'No obstacles' : f.obstacles.length <= 3 ? f.obstacles.join(', ') : `${f.obstacles.length} obstacles`} ·{' '}
                {f.families.length}/{FAMILIES.length} trick types · {f.stances.length === STANCES.length ? 'all stances' : f.stances.join(', ')}
                {f.rarity !== 'very-low' && ` · rare: ${f.rarity}`}
              </span>
              <span className="setup-summary__edit">Edit</span>
            </button>
            {canStart ? (
              <p className="field__desc">{fmt(pool.atLevel)} possible tricks at your level.</p>
            ) : (
              <div className="notice notice--warn" role="alert">
                {pool.messages.map((m) => (
                  <p key={m}>{m}</p>
                ))}
              </div>
            )}
          </section>

          <div className="home__cta">
            <button className="pill pill--primary pill--xl" disabled={!canStart} onClick={() => go('play', b.start())}>
              {multi ? `Start ${mu.count}-player match` : resumable ? 'Start new session' : 'Start session'}
            </button>
            {best && !multi && (
              <p className="field__desc center">
                Best {modeLabel(st.mode, st.mode === 'solo' ? st.soloLength : undefined)}: {fmt(best.value)}
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="home__foot">
        <button className="link" onClick={() => go('scores')}>
          Scores &amp; history
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

function Stepper({ label, value, onChange, small }: { label: string; value: number; onChange: (v: number) => void; small?: boolean }) {
  return (
    <div className={`stepper${small ? ' stepper--small' : ''}`} role="group" aria-label={label}>
      <button className="pill pill--icon" aria-label={small ? `Lower ${label.toLowerCase()}` : 'Lower level'} disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output className="stepper__val" aria-live="polite">
        {small && <span className="stepper__pre">Lv </span>}
        {value}
      </output>
      <button className="pill pill--icon" aria-label={small ? `Raise ${label.toLowerCase()}` : 'Raise level'} disabled={value >= 10} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}
