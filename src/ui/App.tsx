import { useEffect, useState } from 'react'
import { DevPanel } from './DevPanel'
import { Home } from './Home'
import { Play } from './Play'
import { Scores } from './Scores'
import { SetupSheet } from './SetupSheet'
import { useBrainlock } from './useBrainlock'

export type View = 'home' | 'play' | 'setup' | 'scores' | 'dev'

export const DEV_PANEL = import.meta.env.DEV

export function App() {
  const b = useBrainlock()
  // Never auto-enter a restored session: Home offers Resume / Start over first
  const [view, setView] = useState<View>('home')

  useEffect(() => {
    if (view === 'play' && !b.session) setView('home')
  }, [b.session, view])

  useEffect(() => {
    if (!DEV_PANEL) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`') setView((v) => (v === 'dev' ? (b.session && b.session.status !== 'over' ? 'play' : 'home') : 'dev'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [b.session])

  return (
    <div className="app">
      {view === 'home' && <Home b={b} go={setView} />}
      {view === 'play' && b.session && <Play b={b} go={setView} />}
      {view === 'setup' && <SetupSheet b={b} onClose={() => setView('home')} />}
      {view === 'scores' && <Scores b={b} onClose={() => setView('home')} />}
      {view === 'dev' && DEV_PANEL && <DevPanel b={b} onClose={() => setView(b.session && b.session.status !== 'over' ? 'play' : 'home')} />}
    </div>
  )
}
