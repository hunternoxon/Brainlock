import { useEffect, useState } from 'react'
import { DevPanel } from './DevPanel'
import { Field } from './Field'
import { Home, type HomeStep } from './Home'
import { Play, type PlayCtl } from './Play'
import { Scores } from './Scores'
import { SetupSheet } from './SetupSheet'
import { useBrainlock } from './useBrainlock'

export type View = 'home' | 'play' | 'setup' | 'scores' | 'dev'
export type Go = (v: View, which?: 'single' | 'match') => void

export const DEV_PANEL = import.meta.env.DEV

export function App() {
  const b = useBrainlock()
  // Never auto-enter a restored session: Home offers Resume / Start over first
  const [view, setView] = useState<View>('home')
  // Home is a Typeform-style flow; remembered while visiting Setup/Scores
  const [homeStep, setHomeStep] = useState<HomeStep>('mode')

  const [playing, setPlaying] = useState<'single' | 'match'>('single')
  const go = (v: View, which?: 'single' | 'match') => {
    if (which) setPlaying(which)
    setView(v)
  }

  useEffect(() => {
    if (view === 'play' && (playing === 'single' ? !b.session : !b.match)) setView('home')
  }, [b.session, b.match, playing, view])

  const ctl: PlayCtl | null =
    playing === 'match' && b.match
      ? { s: b.match.players[b.match.turn].session, act: b.matchAct, next: b.matchNext, end: b.matchEnd, match: b.match }
      : playing === 'single' && b.session
        ? { s: b.session, act: (a) => b.dispatch(a), next: () => b.dispatch({ type: 'next' }), end: () => b.dispatch({ type: 'end' }) }
        : null

  useEffect(() => {
    if (!DEV_PANEL) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`') setView((v) => (v === 'dev' ? 'home' : 'dev'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [b.session])

  return (
    <>
    {view === 'home' && <Field pulse={`${homeStep}:${JSON.stringify(b.settings)}`} />}
    <div className="app" data-view={view === 'play' ? 'play' : view} data-step={view === 'home' ? homeStep : undefined}>
      {view === 'home' && <Home b={b} go={go} step={homeStep} setStep={setHomeStep} />}
      {view === 'play' && ctl && <Play b={b} go={go} ctl={ctl} />}
      {view === 'setup' && <SetupSheet b={b} onClose={() => setView('home')} />}
      {view === 'scores' && <Scores b={b} onClose={() => setView('home')} />}
      {view === 'dev' && DEV_PANEL && <DevPanel b={b} onClose={() => setView('home')} />}
    </div>
    </>
  )
}
