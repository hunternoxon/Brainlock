import { useEffect, useRef, useState } from 'react'
import { LETTERS, soloRemaining, type Challenge, type GameState } from '../engine/game'
import type { MatchState, TurnAction } from '../engine/match'
import { flowMult } from '../engine/score'
import type { Go } from './App'
import { copy, fmt, ordinal } from './copy'
import { Receipt } from './Receipt'
import { MatchBar, MatchSummary, nextPlayerLabel, turnLabel } from './Match'
import { Summary } from './Summary'
import { Trip } from './Trip'
import type { Brainlock } from './useBrainlock'

type TurnInput = TurnAction extends infer A ? (A extends { at: number } ? Omit<A, 'at'> : never) : never

/** What the play screen needs, whether it's a solo session or one player's turn in a match. */
export interface PlayCtl {
  s: GameState
  act: (a: TurnInput) => void
  next: () => void
  end: () => void
  match?: MatchState
}

export function Play({ b, go, ctl }: { b: Brainlock; go: Go; ctl: PlayCtl }) {
  const s = ctl.s
  const c = s.current
  const [menu, setMenu] = useState(false)
  const nextRef = useRef<HTMLButtonElement>(null)
  // In a match, a player knocked out (or done with Marathon) still sees their result before Next
  const status = ctl.match && s.status === 'over' && ctl.match.status === 'playing' ? 'result' : s.status
  const landed = status === 'result' && c?.outcome === 'landed'
  const failed = status === 'result' && c?.outcome === 'failed'

  // Keyboard: L / M / S during a challenge, N or Enter for Next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menu || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (status === 'playing' && c) {
        if (k === 'l') ctl.act({ type: 'land', challengeId: c.id })
        if (k === 'm') ctl.act({ type: 'miss', challengeId: c.id })
        if (k === 's') ctl.act({ type: 'skip', challengeId: c.id })
      } else if (status === 'result' && (k === 'n' || k === 'enter')) {
        e.preventDefault()
        ctl.next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctl, c, menu, status])

  useEffect(() => {
    if (status === 'result') nextRef.current?.focus({ preventScroll: true })
  }, [status, c?.id])

  if (status === 'over') return ctl.match ? <MatchSummary b={b} go={go} m={ctl.match} /> : <Summary b={b} go={go} />

  const player = ctl.match?.players[ctl.match.turn]
  const nextLabel = ctl.match
    ? nextPlayerLabel(ctl.match)
    : s.mode === 'solo' && soloRemaining(s) === 0
      ? 'See results'
      : 'Next'

  return (
    <main className="screen play" data-status={status} data-landed={landed || undefined} data-failed={failed || undefined}>
      <Trip active={landed || failed} variant={failed ? 'fail' : 'land'} lookKey={c?.id ?? ''} />
      {ctl.match && <MatchBar m={ctl.match} />}
      <Hud s={s} onMenu={() => setMenu(true)} />

      <section className="stage" aria-live="polite">
        {player && (
          <p className="turn" key={`${player.id}-${c?.id}`}>
            {turnLabel(player.name)}
          </p>
        )}
        {status === 'blocked' && <Blocked ctl={ctl} go={go} />}
        {c && status !== 'blocked' && (
          <>
            <Attempts c={c} resolved={status === 'result'} />
            <h2 className="trick" key={c.id}>
              <span className="trick__name">{c.name}</span>
              <span className="trick__where">{c.where}</span>
            </h2>
            {c.experimental ? <p className="tag">Experimental combo</p> : (c.rarity === 'rare' || c.rarity === 'very-rare') && <p className="tag">Rare one</p>}
            {b.settings.debug && <Debug b={b} s={s} c={c} />}
            {status === 'result' && <ResultCard ctl={ctl} s={s} c={c} />}
          </>
        )}
      </section>

      <footer className="thumb">
        {status === 'playing' && c && (
          <>
            <button className="pill pill--ghost pill--sm thumb__skip" onClick={() => ctl.act({ type: 'skip', challengeId: c.id })}>
              Skip{s.tunables.skipPenaltyEnabled && s.tunables.skipPenaltyPoints > 0 ? ` · −${s.tunables.skipPenaltyPoints}` : ''}
            </button>
            <div className="thumb__row">
              <button className="pill pill--xl pill--miss" onClick={() => ctl.act({ type: 'miss', challengeId: c.id })}>
                Miss
              </button>
              <button className="pill pill--xl pill--primary pill--land" onClick={() => ctl.act({ type: 'land', challengeId: c.id })}>
                Land
              </button>
            </div>
          </>
        )}
        {status === 'result' && (
          <button ref={nextRef} className={`pill pill--xl pill--next ${landed || failed ? 'pill--cutout' : 'pill--primary'}`} onClick={ctl.next}>
            {nextLabel}
          </button>
        )}
      </footer>

      {menu && <Menu b={b} ctl={ctl} go={go} onClose={() => setMenu(false)} />}
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

function ResultCard({ ctl, s, c }: { ctl: PlayCtl; s: GameState; c: Challenge }) {
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
          <p className="result__head">
            {c.letter ? `Three misses · ${c.letter} earned` : `Three misses · ${copy.failed(c.index)}`}
            {ctl.match && s.endReason === 'skate' && ' · out of the game'}
          </p>
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
      <div className="feedback" aria-label="How did that feel?">
        {c.feedback ? (
          <p className="hint small" role="status">
            {c.feedback.note}
          </p>
        ) : (
          <>
            <span className="hint small">Felt</span>
            <button className="link small" onClick={() => ctl.act({ type: 'feedback', challengeId: c.id, value: 'too-easy' })}>
              too easy
            </button>
            <button className="link small" onClick={() => ctl.act({ type: 'feedback', challengeId: c.id, value: 'too-hard' })}>
              too hard
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Debug({ b, s, c }: { b: Brainlock; s: GameState; c: Challenge }) {
  const t = c.selection
  return (
    <div className="debug">
      <p>
        rated {c.rating} ({c.rarity}, {c.family}) · target {t.target} ({t.mix}) · max {t.maxRating}
      </p>
      <p>
        session skill {c.skillAtStart.toFixed(2)} · temp boost {t.boost >= 0 ? '+' : ''}
        {t.boost} · long-term {b.longTerm.skill.effective.toFixed(2)} ({b.longTerm.used.length} sessions) · gate L{t.gateLevel}
      </p>
      <p>
        pool {t.poolSize} / band {t.bandSize} ±{t.band.toFixed(1)} · rarity roll {t.rarityRoll}
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

function Blocked({ ctl, go }: { ctl: PlayCtl; go: Go }) {
  const s = ctl.s
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
          <button className="pill" onClick={() => ctl.act({ type: 'allowStretch' })}>
            Allow harder tricks this session
          </button>
        )}
        <button
          className="pill pill--primary"
          onClick={() => {
            ctl.end()
            go('setup')
          }}
        >
          End session & change setup
        </button>
      </div>
    </div>
  )
}

function Menu({ b, ctl, go, onClose }: { b: Brainlock; ctl: PlayCtl; go: Go; onClose: () => void }) {
  const what = ctl.match ? 'match' : 'session'
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
          Home ({what} stays saved)
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
            ctl.end()
          }}
        >
          {confirm ? `Tap again to end ${what}` : `End ${what}`}
        </button>
        <button className="pill pill--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
