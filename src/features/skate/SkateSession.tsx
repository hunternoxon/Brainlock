import React, { useEffect, useMemo, useState } from 'react'
import { useDataset } from '@/features/dataset/useDataset'
import type { TrickRecord } from '@/features/dataset/types'
import type { ObstacleKey, SessionConfig, SessionState } from './types'
import { newSession, poolFromDataset, pickNextTrick, applyAttempt, isGameOver } from './logic'

type ObstaclesConfig = Record<ObstacleKey, string[]>

const KEY = 'brainlock.skate.session.v1'

function Letters({ n }: { n: number }){
  const all = ['S','K','A','T','E']
  return (
    <div className="flex gap-2 text-2xl font-black tracking-wide">
      {all.map((L, i) => (
        <span key={L} className={i < n ? 'text-red-400' : 'text-zinc-400'}>{L}</span>
      ))}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }){
  return <span className="inline-flex items-center rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{children}</span>;
}

function Section({ title, children }: { title: string, children: React.ReactNode }){
  return (
    <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </section>
  )
}

export default function SkateSession(){
  const { data, meta } = useDataset()
  const [obstacleMap, setObstacleMap] = useState<ObstaclesConfig | null>(null)

  // config ui state
  const [skill, setSkill] = useState(5)
  const [stanceBias, setStanceBias] = useState<'Any' | 'Normal' | 'Switch' | 'Nollie' | 'Fakie'>('Any')
  const [includeCombos, setIncludeCombos] = useState(true)
  const [obstacles, setObstacles] = useState<ObstacleKey[]>(['Flatground','Rail','Ledge/Curb','Manual Pad'])

  const [state, setState] = useState<SessionState | null>(null)
  const [pool, setPool] = useState<TrickRecord[]>([])

  useEffect(() => {
    fetch('/data/obstacles.json').then(r => r.json()).then(setObstacleMap)
  }, [])

  // build pool when dataset or cfg changes
  useEffect(() => {
    if (!data || !obstacleMap) return
    const cfg: SessionConfig = { skill, obstacles, stanceBias, includeCombos }
    const p = poolFromDataset(data, cfg, obstacleMap)
    setPool(p)
  }, [data, obstacleMap, skill, obstacles, stanceBias, includeCombos])

  function startSession() {
    const cfg: SessionConfig = { skill, obstacles, stanceBias, includeCombos }
    const s = newSession(crypto.randomUUID(), cfg)
    setState(s)
    // pick first trick
    const t = pickNextTrick(pool)
    setState(st => st ? { ...st, currentTrick: t ?? null } : st)
  }

  function nextTrick(){
    const t = pickNextTrick(pool)
    setState(st => st ? { ...st, currentTrick: t ?? null } : st)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function doAttempt(landed: boolean){
    setState(st => {
      if (!st) return st
      const updated = applyAttempt(st, landed)
      if (isGameOver(updated)) {
        return { ...updated, endedAt: Date.now(), currentTrick: null }
      }
      // on land or after letters change, pull next trick
      return { ...updated, currentTrick: pickNextTrick(pool) }
    })
  }

  function resetSession(){
    setState(null)
  }

  const gameOver = state ? isGameOver(state) : false

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-extrabold">SKATE Session</div>
          <div className="text-zinc-400 text-sm">Dataset-powered generator • 3 tries per trick • S-K-A-T-E letters</div>
        </div>
        <Letters n={state?.letters ?? 0} />
      </div>

      {!state && (
        <div className="grid md:grid-cols-2 gap-4">
          <Section title="Skill Level">
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={10} step={1} value={skill} onChange={e => setSkill(parseInt(e.target.value))} className="w-full" />
              <div className="w-10 text-right">{skill}</div>
            </div>
            <div className="text-zinc-400 text-xs mt-1">Higher skill = higher base difficulty window.</div>
          </Section>

          <Section title="Stance Bias">
            <select value={stanceBias} onChange={e => setStanceBias(e.target.value as any)} className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2">
              <option>Any</option>
              <option>Normal</option>
              <option>Switch</option>
              <option>Nollie</option>
              <option>Fakie</option>
            </select>
            <label className="inline-flex items-center gap-2 mt-3">
              <input type="checkbox" checked={includeCombos} onChange={e => setIncludeCombos(e.target.checked)} />
              <span>Include combo tricks</span>
            </label>
          </Section>

          <Section title="Obstacles">
            {!obstacleMap ? <div className="text-zinc-400">Loading obstacle presets…</div> : (
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(obstacleMap) as ObstacleKey[]).map(key => {
                  const on = obstacles.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => setObstacles(on ? obstacles.filter(k => k !== key) : [...obstacles, key])}
                      className={`text-left rounded-xl px-3 py-2 border ${on ? 'border-zinc-100 bg-zinc-100 text-black' : 'border-zinc-700 bg-zinc-900/50 text-zinc-200'}`}
                    >
                      {key}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="text-zinc-500 text-xs mt-2">Mapping is approximate (e.g., “Grind” → rail/ledge/hubba). You can edit <code>/public/data/obstacles.json</code>.</div>
          </Section>

          <Section title="Pool Size">
            <div className="text-3xl font-black">{pool.length}</div>
            <div className="text-zinc-400 text-xs">Tricks matching your current filters</div>
          </Section>
        </div>
      )}

      {!state ? (
        <div className="flex items-center gap-3">
          <button onClick={startSession} className="bg-zinc-100 text-black rounded-2xl px-4 py-2 font-semibold hover:bg-white">Start Session</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-extrabold">{state.currentTrick ? state.currentTrick.name : (gameOver ? 'Session Over' : 'Pulling next trick…')}</div>
                <div className="text-zinc-400 text-sm mt-1">
                  {state.currentTrick ? (
                    <>Stance: {state.currentTrick.stance} • Level: {state.currentTrick.level} • Score: {state.currentTrick.difficulty}</>
                  ) : (
                    <>—</>
                  )}
                </div>
                {state.currentTrick && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {state.currentTrick.categories.map(c => <Chip key={c}>{c}</Chip>)}
                    {state.currentTrick.combo ? <Chip>Combo</Chip> : null}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-400">Attempts left</div>
                <div className="text-3xl font-black">{state.attemptsLeft}</div>
              </div>
            </div>

            {!gameOver && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => doAttempt(true)} className="bg-green-300 text-black rounded-xl px-4 py-2 font-semibold hover:bg-green-200">Landed</button>
                <button onClick={() => doAttempt(false)} className="bg-red-300 text-black rounded-xl px-4 py-2 font-semibold hover:bg-red-200">Missed</button>
                <button onClick={nextTrick} className="border border-zinc-700 rounded-xl px-3 py-2">Next trick ↻</button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
              <div className="text-sm text-zinc-400">Total Score</div>
              <div className="text-3xl font-black">{state.totalScore}</div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
              <div className="text-sm text-zinc-400">Streak</div>
              <div className="text-3xl font-black">{state.streak}</div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
              <div className="text-sm text-zinc-400">Best Streak</div>
              <div className="text-3xl font-black">{state.bestStreak}</div>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <div className="text-lg font-semibold mb-2">History</div>
            <div className="space-y-2 max-h-80 overflow-auto pr-2">
              {state.history.slice().reverse().map((h, idx) => (
                <div key={idx} className="flex items-center justify-between border border-zinc-800 rounded-xl px-3 py-2">
                  <div>
                    <div className="font-semibold">{h.trick.name}</div>
                    <div className="text-xs text-zinc-400">Attempt {h.attemptIndex} • {h.landed ? 'Landed' : 'Missed'} • +{h.points}</div>
                  </div>
                  <div className={`text-sm font-bold ${h.landed ? 'text-green-300' : 'text-red-300'}`}>{h.landed ? '✓' : '✗'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={resetSession} className="border border-zinc-700 rounded-xl px-3 py-2">Reset</button>
          </div>
        </div>
      )}
    </div>
  )
}
