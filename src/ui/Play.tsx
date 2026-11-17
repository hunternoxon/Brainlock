import { useEffect, useRef, useState } from 'react'
import { LETTERS, soloRemaining, type Challenge, type GameState } from '../engine/game'
import { flowMult } from '../engine/score'
import type { View } from './App'
import { copy, fmt, ordinal } from './copy'
import { Receipt } from './Receipt'
import { Summary } from './Summary'
import { Trip } from './Trip'
import type { Brainlock } from './useBrainlock'

export function Play({ b, go }: { b: Brainlock; go: (v: View) => void }) {
  const s = b.session!
  const c = s.current
  const [menu, setMenu] = useState(false)
  const nextRef = useRef<HTMLButtonElement>(null)
  const landed = s.status === 'result' && c?.outcome === 'landed'

  // Keyboard: L / M / S during a challenge, N or Enter for Next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menu || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (s.status === 'playing' && c) {
        if (k === 'l') b.dispatch({ type: 'land', challengeId: c.id })
        if (k === 'm') b.dispatch({ type: 'miss', challengeId: c.id })
        if (k === 's') b.dispatch({ type: 'skip', challengeId: c.id })
      } else if (s.status === 'result' && (k === 'n' || k === 'enter')) {
        e.preventDefault()
        b.dispatch({ type: 'next' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [b, c, menu, s.status])

  useEffect(() => {
    if (s.status === 'result') nextRef.current?.focus({ preventScroll: true })
  }, [s.status, c?.id])

  if (s.status === 'over') return <Summary b={b} go={go} />

  return (
    <main className="screen play" data-status={s.status} data-landed={landed || undefined}>
      <Trip active={landed} lookKey={c?.id ?? ''} />
      <Hud s={s} onMenu={() => setMenu(true)} />

      <section className="stage" aria-live="polite">
        {s.status === 'blocked' && <Blocked b={b} go={go} />}
        {c && s.status !== 'blocked' && (
          <>
            <Attempts c={c} resolved={s.status === 'result'} />
            <h2 className="trick" key={c.id}>
              <span className="trick__name">{c.name}</span>
              <span className="trick__where">{c.where}</span>
            </h2>
            {c.experimental && <p className="tag">Experimental combo</p>}
            {b.settings.debug && <Debug s={s} c={c} />}
            {s.status === 'result' && <ResultCard s={s} c={c} />}
          </>
        )}
      </section>

      <footer className="thumb">
        {s.status === 'playing' && c && (
          <>
            <button className="pill pill--ghost pill--sm thumb__skip" onClick={() => b.dispatch({ type: 'skip', challengeId: c.id })}>
              Skip{s.tunables.skipPenaltyEnabled && s.tunables.skipPenaltyPoints > 0 ? ` · −${s.tunables.skipPenaltyPoints}` : ''}
            </button>
            <div className="thumb__row">
              <button className="pill pill--xl pill--miss" onClick={() => b.dispatch({ type: 'miss', challengeId: c.id })}>
                Miss
              </button>
              <button className="pill pill--xl pill--primary pill--land" onClick={() => b.dispatch({ type: 'land', challengeId: c.id })}>
                Land
              </button>
            </div>
          </>
        )}
        {s.status === 'result' && (
          <button ref={nextRef} className={`pill pill--xl pill--next ${landed ? 'pill--cutout' : 'pill--primary'}`} onClick={() => b.dispatch({ type: 'next' })}>
            {s.mode === 'solo' && soloRemaining(s) === 0 ? 'See results' : 'Next'}
          </button>
        )}
      </footer>

      {menu && <Menu b={b} go={go} onClose={() => setMenu(false)} />}
    </main>
  )
}

function Hud({ s, onMenu }: { s: GameState; onMenu: () => void }) {
  const flowPct = Math.round((flowMult(s.flow) - 1) * 100)
  return (
    <header className="hud">
      <div className="hud__top">
        <button className="pill pill--icon pill--ghost" aria-label="Menu" onClick={onMenu}>
          <span aria-hidden="true">≡</span>
        </button>
        {s.mode === 'skate' ? (
          <p className="letters" aria-label={`Letters: ${s.letters ? LETTERS.slice(0, s.letters).join('') : 'none'}`}>
            {LETTERS.map((l, i) => (
              <span key={l} className="letter" data-on={i < s.letters || undefined}>
                {l}
              </span>
            ))}
          </p>
        ) : (
          <p className="progress" aria-label={`Challenge ${Math.min(s.resolved + 1, s.soloLength)} of ${s.soloLength}`}>
            <span className="progress__n">{Math.min(s.resolved + (s.status === 'result' ? 0 : 1), s.soloLength)}</span>
            <span className="muted">/{s.soloLength}</span>
          </p>
        )}
        <p className="score" aria-label={`Score ${s.score}`}>
          {fmt(s.score)}
        </p>
      </div>
      <p className="hud__meta">
        <span>Lv {s.skill.effective.toFixed(1)}</span>
        {s.flow > 0 && (
          <span>
            Streak {s.flow}
            {flowPct > 0 ? ` · next +${flowPct}%` : ''}
          </span>
        )}
      </p>
    </header>
  )
}

function Attempts({ c, resolved }: { c: Challenge; resolved: boolean }) {
  return (
    <div className="attempts">
      <div className="dots" aria-hidden="true">
        {[1, 2, 3].map((i) => {
          const r = c.attempts[i - 1]
          return <span key={i} className="dot" data-state={r ?? (i === c.attempt && !resolved ? 'current' : undefined)} />
        })}
      </div>
      <p className="attempts__label">{resolved ? `${c.attempts.length || 0} of 3 used` : `Attempt ${c.attempt} of 3`}</p>
    </div>
  )
}

function ResultCard({ s, c }: { s: GameState; c: Challenge }) {
  const [open, setOpen] = useState(false)
  const r = c.receipt
  return (
    <div className={`result result--${c.outcome}`} role="status">
      {c.outcome === 'landed' && r?.kind === 'landed' && (
        <>
          <p className="result__head">
            Landed on {ordinal(c.attempt)} try · {copy.landed(c.index)}
          </p>
          <p className="result__points">+{fmt(r.total)}</p>
        </>
      )}
      {c.outcome === 'failed' && (
        <>
          <p className="result__head">{c.letter ? `Three misses · ${c.letter} earned` : `Three misses · ${copy.failed(c.index)}`}</p>
          <p className="result__points">+0</p>
        </>
      )}
      {c.outcome === 'skipped' && r?.kind === 'skipped' && (
        <>
          <p className="result__head">Skipped · no letter</p>
          <p className="result__points">{r.skipDelta < 0 ? `−${fmt(-r.skipDelta)}` : '±0'}</p>
        </>
      )}
      <p className="result__total">Total {fmt(s.score)}</p>
      {r && (
        <>
          <button className="link" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide breakdown' : 'Score breakdown'}
          </button>
          {open && <Receipt r={r} />}
        </>
      )}
    </div>
  )
}

function Debug({ s, c }: { s: GameState; c: Challenge }) {
  const t = c.selection
  return (
    <div className="debug">
      <p>
        rated {c.rating} · target {t.target} ({t.mix}) · skill {c.skillAtStart.toFixed(2)} · gate L{t.gateLevel} · pool {t.poolSize} / band {t.bandSize} ±{t.band.toFixed(1)}
      </p>
      <p>
        {t.pattern} · {t.spinRoll}
        {t.notes.length > 0 && ` · ${t.notes.join('; ')}`}
      </p>
      {c.skill && (
        <p>
          skill {c.skill.before.toFixed(2)} → {c.skill.after.toFixed(2)}: {c.skill.reason}
        </p>
      )}
      <p>seed {s.seed}</p>
    </div>
  )
}

function Blocked({ b, go }: { b: Brainlock; go: (v: View) => void }) {
  const s = b.session!
  return (
    <div className="blocked" role="alert">
      <p className="result__head">No fair trick available</p>
      {s.blocked?.messages.map((m) => (
        <p key={m} className="muted">
          {m}
        </p>
      ))}
      <div className="col">
        {(s.blocked?.anyLevel ?? 0) > 0 && (
          <button className="pill" onClick={() => b.dispatch({ type: 'allowStretch' })}>
            Allow harder tricks this session
          </button>
        )}
        <button
          className="pill pill--primary"
          onClick={() => {
            b.dispatch({ type: 'end' })
            go('setup')
          }}
        >
          End session & change setup
        </button>
      </div>
    </div>
  )
}

function Menu({ b, go, onClose }: { b: Brainlock; go: (v: View) => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <button
          className="pill"
          onClick={() => {
            onClose()
            go('home')
          }}
        >
          Home (session stays saved)
        </button>
        <button className="pill" aria-pressed={b.settings.sound} onClick={() => b.setSettings({ sound: !b.settings.sound })}>
          Sound: {b.settings.sound ? 'on' : 'off'}
        </button>
        <button className="pill" aria-pressed={b.settings.debug} onClick={() => b.setSettings({ debug: !b.settings.debug })}>
          Level details: {b.settings.debug ? 'on' : 'off'}
        </button>
        <button
          className={`pill ${confirm ? 'pill--danger' : ''}`}
          onClick={() => {
            if (!confirm) return setConfirm(true)
            onClose()
            b.dispatch({ type: 'end' })
          }}
        >
          {confirm ? 'Tap again to end session' : 'End session'}
        </button>
        <button className="pill pill--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
