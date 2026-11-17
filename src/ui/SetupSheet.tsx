import { CONFIG } from '../engine/rules'
import { defaultFilters } from '../engine/catalog'
import { FAMILIES, OBSTACLES, STANCES, type Family, type Filters } from '../engine/types'
import { fmt } from './copy'
import type { Brainlock } from './useBrainlock'

const FAMILY_LABEL: Record<Family, string> = { flips: 'Flips', grinds: 'Grinds / slides', manuals: 'Manuals', spins: 'Spins' }
const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

export function SetupSheet({ b, onClose }: { b: Brainlock; onClose: () => void }) {
  const f = b.settings.filters
  const set = (p: Partial<Filters>) => b.setSettings({ filters: { ...f, ...p } })
  const all = defaultFilters()

  return (
    <main className="screen setup">
      <header className="setup__head">
        <h2>Setup</h2>
        <button className="pill pill--primary" onClick={onClose}>
          Done
        </button>
      </header>
      <p className="hint">Saved automatically as your defaults. Applies to the next session.</p>

      <section className="field">
        <div className="field__row">
          <p className="label">Obstacles you have</p>
          <button className="link" onClick={() => set({ obstacles: f.obstacles.length === OBSTACLES.length ? ['flat'] : [...OBSTACLES] })}>
            {f.obstacles.length === OBSTACLES.length ? 'Just flat' : 'All'}
          </button>
        </div>
        <div className="chips">
          {OBSTACLES.map((o) => (
            <button key={o} className="chip" aria-pressed={f.obstacles.includes(o)} onClick={() => set({ obstacles: toggle(f.obstacles, o) })}>
              {o}
            </button>
          ))}
        </div>
      </section>

      <section className="field">
        <p className="label">Stances</p>
        <div className="chips">
          {STANCES.map((s) => (
            <button key={s} className="chip" aria-pressed={f.stances.includes(s)} onClick={() => set({ stances: toggle(f.stances, s) })}>
              {s}
            </button>
          ))}
        </div>
      </section>

      {FAMILIES.map((fam) => {
        const on = f.families.includes(fam)
        return (
          <section className="field family" key={fam}>
            <button className="chip chip--family" aria-pressed={on} onClick={() => set({ families: toggle(f.families, fam) })}>
              {FAMILY_LABEL[fam]}
            </button>
            <div className="chips chips--sub" data-off={!on || undefined}>
              {all.subs[fam].map((name) => (
                <button
                  key={name}
                  className="chip chip--sm"
                  disabled={!on}
                  aria-pressed={f.subs[fam].includes(name)}
                  onClick={() => set({ subs: { ...f.subs, [fam]: toggle(f.subs[fam], name) } })}
                >
                  {fam === 'spins' ? `${name}°` : name}
                  {CONFIG.families[fam].subs[name].minLevel > 1 && <span className="chip__lvl">L{CONFIG.families[fam].subs[name].minLevel}+</span>}
                </button>
              ))}
            </div>
          </section>
        )
      })}

      <footer className="setup__foot">
        {b.pool.atLevel > 0 ? (
          <p className="hint">{fmt(b.pool.atLevel)} possible tricks at your level.</p>
        ) : (
          <div className="notice notice--warn" role="alert">
            {b.pool.messages.map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        )}
        <button className="link" onClick={() => b.setSettings({ filters: defaultFilters() })}>
          Reset to everything on
        </button>
      </footer>
    </main>
  )
}
