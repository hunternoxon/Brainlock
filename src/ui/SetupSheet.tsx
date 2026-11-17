import { defaultFilters } from '../engine/catalog'
import { FAMILIES, OBSTACLES, RARITY_LEVELS, STANCES, type Family, type Filters, type RarityLevel } from '../engine/types'
import { FAMILY_LABEL, familySubs, subGate, subLabel } from '../engine/vocab'
import { fmt } from './copy'
import type { Brainlock } from './useBrainlock'

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])
const RARITY_LABEL: Record<RarityLevel, string> = { off: 'Off', 'very-low': 'Very low', low: 'Low', normal: 'Normal' }
const FAMILY_HINT: Record<Family, string> = {
  flips: 'Ollies, shuvits, flips, and their entries and exits',
  grinds: 'Ledges, rails, boxes, curbs and quarterpipe coping',
  manuals: 'Manual pad, box, curb and bank',
  spins: 'Body 180s and 360s, including half cabs and bigspins',
  stalls: 'Quarterpipe stalls, rocks, disasters and blunts',
}

export function SetupSheet({ b, onClose }: { b: Brainlock; onClose: () => void }) {
  const f = b.settings.filters
  const set = (p: Partial<Filters>) => b.setSettings({ filters: { ...f, ...p } })
  const subs = familySubs()

  return (
    <main className="screen setup">
      <header className="setup__head">
        <div>
          <h2>Setup</h2>
          <p className="field__desc">Saved as your defaults. Applies to the next session.</p>
        </div>
        <button className="pill pill--primary" onClick={onClose}>
          Done
        </button>
      </header>

      <PoolStatus b={b} />

      <div className="setup__grid">
        <div className="setup__side">
          <section className="panel" aria-labelledby="obs-h">
            <div className="panel__head">
              <h3 id="obs-h">Obstacles</h3>
              <span className="count">
                {f.obstacles.length}/{OBSTACLES.length}
              </span>
              <span className="panel__links">
                <button className="link" onClick={() => set({ obstacles: [...OBSTACLES] })}>
                  All
                </button>
                <button className="link" onClick={() => set({ obstacles: [] })}>
                  None
                </button>
              </span>
            </div>
            <div className="chips">
              {OBSTACLES.map((o) => (
                <Chip key={o} on={f.obstacles.includes(o)} onClick={() => set({ obstacles: toggle(f.obstacles, o) })}>
                  {o}
                </Chip>
              ))}
            </div>
          </section>

          <section className="panel" aria-labelledby="st-h">
            <div className="panel__head">
              <h3 id="st-h">Stances</h3>
              <span className="count">
                {f.stances.length}/{STANCES.length}
              </span>
            </div>
            <div className="chips">
              {STANCES.map((s) => (
                <Chip key={s} on={f.stances.includes(s)} onClick={() => set({ stances: toggle(f.stances, s) })}>
                  {s}
                </Chip>
              ))}
            </div>
          </section>

          <section className="panel" aria-labelledby="var-h">
            <div className="panel__head">
              <h3 id="var-h">Variations</h3>
            </div>
            <p className="switch-row__label" id="rare-l">
              Rare &amp; experimental tricks
            </p>
            <div className="seg seg--small" role="radiogroup" aria-labelledby="rare-l">
              {RARITY_LEVELS.map((r) => (
                <button key={r} role="radio" aria-checked={f.rarity === r} className="seg__btn" onClick={() => set({ rarity: r })}>
                  {RARITY_LABEL[r]}
                </button>
              ))}
            </div>
            <p className="field__desc">Late flips, 540s, reverts, grind-to-grind and more. Off keeps everyday tricks only.</p>
            <Switch label="Double flips" hint="Rare, level 7+" on={f.doubles} onChange={(v) => set({ doubles: v })} />
            <Switch label="Triple flips" hint="Extremely rare, level 9+" on={f.triples} onChange={(v) => set({ triples: v })} />
            <Switch label="Transfers" hint="Between compatible obstacles, very rare" on={f.transfers} onChange={(v) => set({ transfers: v })} />
          </section>
        </div>

        <div className="setup__families">
          {FAMILIES.map((fam) => {
            const on = f.families.includes(fam)
            const all = [...subs[fam].core, ...subs[fam].advanced]
            const count = f.subs[fam].length
            const avail = b.pool.byFamily[fam]
            return (
              <section className="family" key={fam} data-off={!on || undefined} aria-labelledby={`fam-${fam}`}>
                <div className="family__head">
                  <div className="family__title">
                    <h3 id={`fam-${fam}`}>{FAMILY_LABEL[fam]}</h3>
                    <p className="family__meta">
                      {on ? `${count} of ${all.length} on` : 'Off'}
                      {on && count > 0 && ` · ${avail ? `${fmt(avail)} at your level` : 'none at your level'}`}
                    </p>
                  </div>
                  <SwitchButton on={on} label={FAMILY_LABEL[fam]} onChange={() => set({ families: toggle(f.families, fam) })} />
                </div>
                <p className="family__hint">{FAMILY_HINT[fam]}</p>
                <div className="family__body">
                  <div className="chips chips--sub">
                    {subs[fam].core.map((k) => (
                      <SubChip key={k} fam={fam} k={k} f={f} on={on} set={set} />
                    ))}
                  </div>
                  {subs[fam].advanced.length > 0 && (
                    <details className="advanced">
                      <summary>
                        Advanced &amp; rare · {subs[fam].advanced.filter((k) => f.subs[fam].includes(k)).length}/{subs[fam].advanced.length}
                      </summary>
                      <div className="chips chips--sub">
                        {subs[fam].advanced.map((k) => (
                          <SubChip key={k} fam={fam} k={k} f={f} on={on} set={set} />
                        ))}
                      </div>
                    </details>
                  )}
                  <div className="family__links">
                    <button className="link small" disabled={!on} onClick={() => set({ subs: { ...f.subs, [fam]: all } })}>
                      Select all
                    </button>
                    <button className="link small" disabled={!on} onClick={() => set({ subs: { ...f.subs, [fam]: [] } })}>
                      Clear
                    </button>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <footer className="setup__foot">
        <button className="link" onClick={() => b.setSettings({ filters: defaultFilters() })}>
          Reset setup to defaults
        </button>
      </footer>
    </main>
  )
}

function PoolStatus({ b }: { b: Brainlock }) {
  return b.pool.atLevel > 0 ? (
    <p className="pool-status" role="status">
      <strong>{fmt(b.pool.atLevel)}</strong> possible tricks at level {b.pool.skill.toFixed(1)}
    </p>
  ) : (
    <div className="notice notice--warn" role="alert">
      {b.pool.messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  )
}

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button className="chip" aria-pressed={on} disabled={disabled} onClick={onClick}>
      <span className="chip__check" aria-hidden="true">
        {on ? '✓' : ''}
      </span>
      {children}
    </button>
  )
}

function SubChip({ fam, k, f, on, set }: { fam: Family; k: string; f: Filters; on: boolean; set: (p: Partial<Filters>) => void }) {
  const gate = subGate(fam, k)
  return (
    <button
      className="chip chip--sm"
      disabled={!on}
      aria-pressed={f.subs[fam].includes(k)}
      onClick={() => set({ subs: { ...f.subs, [fam]: toggle(f.subs[fam], k) } })}
    >
      <span className="chip__check" aria-hidden="true">
        {f.subs[fam].includes(k) ? '✓' : ''}
      </span>
      {subLabel(fam, k)}
      {gate > 1 && <span className="chip__lvl">L{gate}+</span>}
    </button>
  )
}

export function SwitchButton({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span className="switch__knob" />
    </button>
  )
}

export function Switch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="switch-row">
      <div>
        <p className="switch-row__label">{label}</p>
        <p className="hint small">{hint}</p>
      </div>
      <SwitchButton on={on} label={label} onChange={onChange} />
    </div>
  )
}
