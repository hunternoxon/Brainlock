import { useEffect, useRef, useState } from 'react'
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

export type HomeStep = 'mode' | 'length' | 'players' | 'names' | 'level' | 'ready'

const MODE_DESC = {
  skate: 'Three misses earns a letter. Spell S-K-A-T-E and you’re out.',
  solo: 'A fixed run of 10, 25 or 50 challenges. Score as much as you can.',
} as const
const KEYS = 'ABCDEFGH'

/**
 * Home as a Typeform-style flow: one question at a time on a glass card,
 * choices auto-advance, letter keys pick, Enter continues, arrows go back/forward.
 */
export function Home({ b, go, step, setStep }: { b: Brainlock; go: Go; step: HomeStep; setStep: (s: HomeStep) => void }) {
  const { settings: st, session: s, pool, match } = b
  const mu = st.multi
  const multi = mu.count > 1
  const steps: HomeStep[] = ['mode', ...(st.mode === 'solo' ? (['length'] as const) : []), 'players', multi ? 'names' : 'level', 'ready']
  const idx = Math.max(0, steps.indexOf(step))
  const current = steps[idx]
  const [dir, setDir] = useState<1 | -1>(1)
  const [picked, setPicked] = useState<string | null>(null)
  const timer = useRef(0)

  const goTo = (i: number) => {
    const n = Math.max(0, Math.min(steps.length - 1, i))
    if (n === idx) return
    setDir(n > idx ? 1 : -1)
    setPicked(null)
    setStep(steps[n])
  }
  const next = () => goTo(idx + 1)
  const back = () => goTo(idx - 1)

  /** Typeform beat: flash the choice, then move on. */
  const choose = (id: string, apply: () => void, nextSteps?: HomeStep[]) => {
    apply()
    setPicked(id)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const list = nextSteps ?? steps
      const i = list.indexOf(current)
      setDir(1)
      setPicked(null)
      setStep(list[Math.min(list.length - 1, i + 1)])
    }, 320)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const stepsFor = (mode: 'skate' | 'solo', count = mu.count): HomeStep[] => ['mode', ...(mode === 'solo' ? (['length'] as const) : []), 'players', count > 1 ? 'names' : 'level', 'ready']

  // Options for the current question (for letter-key shortcuts)
  type Opt = { id: string; label: string; desc?: string; on: boolean; pick: () => void }
  const opts: Opt[] =
    current === 'mode'
      ? (['skate', 'solo'] as const).map((m) => ({ id: m, label: modeLabel(m), desc: MODE_DESC[m], on: st.mode === m, pick: () => choose(m, () => b.setSettings({ mode: m }), stepsFor(m)) }))
      : current === 'length'
        ? SOLO_LENGTHS.map((n) => ({ id: String(n), label: `${n} challenges`, on: st.soloLength === n, pick: () => choose(String(n), () => b.setSettings({ soloLength: n })) }))
        : current === 'players'
          ? Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).map((n) => ({
              id: String(n),
              label: n === 1 ? 'Just me' : `${n} players`,
              desc: n === 1 ? undefined : 'Pass the phone',
              on: mu.count === n,
              pick: () => choose(String(n), () => b.setSettings({ multi: { ...mu, count: n } }), stepsFor(st.mode, n)),
            }))
          : []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toUpperCase()
      const i = KEYS.indexOf(k)
      if (i >= 0 && opts[i]) {
        e.preventDefault()
        opts[i].pick()
      } else if (e.key === 'Enter' && current !== 'ready' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowUp' || e.key === 'Escape') back()
      else if (e.key === 'ArrowDown') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
    <main className="screen home" data-step={current}>
      <div className="survey glass">
        {current === 'mode' && (
          <header className="home__head">
            <h1 className="wordmark">
              <Logo />
            </h1>
            <p className="tagline">
              <StaticWord words={['Finger', 'Skate']} />
              board challenges that match your level.
            </p>
          </header>
        )}

        {current === 'mode' && (resumable || resumableMatch) && (
          <div className="resume-strip">
            {resumable && (
              <p>
                <span className="muted">
                  {modeLabel(resumable.mode, resumable.mode === 'solo' ? resumable.soloLength : undefined)} in progress · {fmt(resumable.score)} pts
                  {resumable.mode === 'skate' && resumable.letters > 0 && ` · ${LETTERS.slice(0, resumable.letters).join('')}`}
                </span>
                <span className="resume-strip__actions">
                  <button className="link" onClick={() => go('play', 'single')}>
                    Resume
                  </button>
                  <button className="link muted" onClick={() => b.discard()}>
                    Start over
                  </button>
                </span>
              </p>
            )}
            {resumableMatch && (
              <p>
                <span className="muted">
                  Match · round {resumableMatch.round} · {turnLabel(resumableMatch.players[resumableMatch.turn].name)}
                </span>
                <span className="resume-strip__actions">
                  <button className="link" onClick={() => go('play', 'match')}>
                    Resume match
                  </button>
                  <button className="link muted" onClick={() => b.discardMatch()}>
                    End it
                  </button>
                </span>
              </p>
            )}
          </div>
        )}

        {b.issues.length > 0 && current === 'mode' && (
          <p className="notice" role="status">
            Some saved data was unreadable and has been reset (a backup was kept in storage).
          </p>
        )}

        <section className="q" key={current} data-dir={dir} aria-labelledby={`q-${current}`}>
          {current !== 'mode' && (
            <p className="q__num">
              {idx + 1} <span aria-hidden="true">→</span>
            </p>
          )}

          {current === 'mode' && (
            <h2 className="q__title" id="q-mode">
              Choose a mode
            </h2>
          )}
          {current === 'length' && (
            <h2 className="q__title" id="q-length">
              How long is the marathon?
            </h2>
          )}
          {current === 'players' && (
            <h2 className="q__title" id="q-players">
              Who’s playing?
            </h2>
          )}
          {current === 'level' && (
            <>
              <h2 className="q__title" id="q-level">
                What’s your level?
              </h2>
              <p className="q__desc">
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
            </>
          )}
          {current === 'names' && (
            <>
              <h2 className="q__title" id="q-names">
                Names and levels
              </h2>
              <p className="q__desc">{st.mode === 'skate' ? 'Take turns; S-K-A-T-E knocks you out. Last one standing wins.' : `Everyone plays ${st.soloLength}; highest score wins.`}</p>
            </>
          )}
          {current === 'ready' && (
            <>
              <h2 className="q__title" id="q-ready">
                Ready?
              </h2>
              <p className="q__desc">
                {modeLabel(st.mode, st.mode === 'solo' ? st.soloLength : undefined)} · {multi ? `${mu.count} players` : `level ${st.level}`}
              </p>
            </>
          )}

          {opts.length > 0 && (
            <div className="choices" role="radiogroup" aria-labelledby={`q-${current}`}>
              {opts.map((o, i) => (
                <button key={o.id} role="radio" aria-checked={o.on} className="choice" data-flash={picked === o.id || undefined} onClick={o.pick}>
                  <span className="choice__key" aria-hidden="true">
                    {KEYS[i]}
                  </span>
                  <span className="choice__text">
                    <span className="choice__label">{o.label}</span>
                    {o.desc && <span className="choice__desc">{o.desc}</span>}
                  </span>
                  {o.on && (
                    <span className="choice__check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {current === 'level' && (
            <div className="q__body">
              <Stepper label="Level" value={st.level} onChange={(v) => b.setSettings({ level: v })} />
              <button className="pill pill--primary q__ok" onClick={next}>
                OK <span aria-hidden="true">✓</span>
              </button>
            </div>
          )}

          {current === 'names' && (
            <div className="q__body players">
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
              <button className="pill pill--primary q__ok" onClick={next}>
                OK <span aria-hidden="true">✓</span>
              </button>
            </div>
          )}

          {current === 'ready' && (
            <div className="q__body">
              <button className="setup-summary" onClick={() => go('setup')}>
                <span>
                  {f.obstacles.length === OBSTACLES.length ? 'All 12 obstacles' : f.obstacles.length === 0 ? 'No obstacles' : f.obstacles.length <= 3 ? f.obstacles.join(', ') : `${f.obstacles.length} obstacles`} ·{' '}
                  {f.families.length}/{FAMILIES.length} trick types · {f.stances.length === STANCES.length ? 'all stances' : f.stances.join(', ')}
                  {f.rarity !== 'very-low' && ` · rare: ${f.rarity}`}
                </span>
                <span className="setup-summary__edit">Edit</span>
              </button>
              {canStart ? (
                <p className="q__desc">{fmt(pool.atLevel)} possible tricks at your level.</p>
              ) : (
                <div className="notice notice--warn" role="alert">
                  {pool.messages.map((m) => (
                    <p key={m}>{m}</p>
                  ))}
                </div>
              )}
              <button className="pill pill--primary pill--xl" disabled={!canStart} onClick={() => go('play', b.start())}>
                {multi ? `Start ${mu.count}-player match` : resumable ? 'Start new session' : 'Start session'}
              </button>
              {best && !multi && (
                <p className="q__desc center">
                  Best {modeLabel(st.mode, st.mode === 'solo' ? st.soloLength : undefined)}: {fmt(best.value)}
                </p>
              )}
              <div className="home__foot">
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
              </div>
            </div>
          )}
        </section>

        {current !== 'mode' && (
          <nav className="survey__nav" aria-label="Steps">
            <div className="survey__progress" aria-hidden="true">
              <span style={{ width: `${(idx / (steps.length - 1)) * 100}%` }} />
            </div>
            <div className="survey__arrows">
              <button className="pill pill--icon" aria-label="Previous question" onClick={back}>
                ↑
              </button>
              <button className="pill pill--icon" aria-label="Next question" disabled={idx === steps.length - 1} onClick={next}>
                ↓
              </button>
            </div>
          </nav>
        )}
      </div>
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
