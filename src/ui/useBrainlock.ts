import { useCallback, useMemo, useRef, useState } from 'react'
import { anchorSkill } from '../engine/adapt'
import { diagnosePool } from '../engine/catalog'
import { reduce, startSession, type Action, type GameState } from '../engine/game'
import { createStore, memoryStorage, type Settings } from '../engine/persist'
import { DEFAULT_TUNABLES, type Tunables } from '../engine/tunables'
import { sfx } from './sound'

type DistAction = Action extends infer A ? (A extends { at: number } ? Omit<A, 'at'> : never) : never

function safeStorage() {
  try {
    const k = '__brainlock_probe'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return localStorage
  } catch {
    return memoryStorage()
  }
}

function randomSeed(): number {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0]
}

export interface FinishInfo {
  isNewBest: boolean
  previousBest: number | null
}

export function useBrainlock() {
  const store = useMemo(() => createStore(safeStorage()), [])
  const [settings, setSettingsState] = useState(() => store.loadSettings())
  const [profile, setProfile] = useState(() => store.loadProfile())
  const [tunables, setTunablesState] = useState(() => store.loadTunables())
  const sessionRef = useRef<GameState | null>(null)
  const [session, setSessionState] = useState<GameState | null>(() => {
    const s = store.loadSession()
    sessionRef.current = s
    return s
  })
  const [finish, setFinish] = useState<FinishInfo | null>(null)
  const [issues] = useState(() => [...store.issues])
  const nextSeed = useRef<number | null>(null)

  const commit = useCallback(
    (next: GameState, prev: GameState | null) => {
      sessionRef.current = next
      if (next.status === 'over') {
        store.clearSession()
        setFinish(store.finalize(next))
      } else {
        store.saveSession(next)
      }
      if (prev && next.resolved !== prev.resolved) {
        const p = { skill: next.skill }
        store.saveProfile(p)
        setProfile(p)
      }
      setSessionState(next)
    },
    [store],
  )

  const dispatch = useCallback(
    (a: DistAction) => {
      const prev = sessionRef.current
      if (!prev) return
      const next = reduce(prev, { ...a, at: Date.now() } as Action)
      if (next === prev) return
      if (settings.sound) {
        if (next.status === 'over' && next.endReason !== 'ended') sfx.over()
        else if (a.type === 'land') sfx.land()
        else if (a.type === 'miss') (next.current?.outcome === 'failed' ? sfx.fail : sfx.miss)()
      }
      commit(next, prev)
    },
    [commit, settings.sound],
  )

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsState((s) => {
        const n = { ...s, ...patch }
        store.saveSettings(n)
        return n
      })
    },
    [store],
  )

  const setTunables = useCallback(
    (t: Tunables) => {
      store.saveTunables(t)
      setTunablesState(t)
      const s = sessionRef.current
      if (s && s.status !== 'over') commit(reduce(s, { type: 'tune', tunables: t, at: Date.now() }), s)
    },
    [commit, store],
  )

  const start = useCallback(() => {
    const prev = sessionRef.current
    if (prev && prev.status !== 'over') store.finalize(reduce(prev, { type: 'abandon', at: Date.now() }))
    setFinish(null)
    const seed = nextSeed.current ?? randomSeed()
    nextSeed.current = null
    const s = startSession({
      mode: settings.mode,
      soloLength: settings.soloLength,
      filters: settings.filters,
      startLevel: settings.level,
      skill: profile.skill ?? undefined,
      tunables,
      seed,
      at: Date.now(),
    })
    sessionRef.current = s
    store.saveSession(s)
    setSessionState(s)
  }, [profile.skill, settings, store, tunables])

  /** Leave the summary / blocked screen and go home. Unfinished sessions stay resumable. */
  const leave = useCallback(() => {
    const s = sessionRef.current
    if (s?.status === 'over') {
      sessionRef.current = null
      setSessionState(null)
      setFinish(null)
    }
  }, [])

  const discard = useCallback(() => {
    const s = sessionRef.current
    if (s && s.status !== 'over') store.finalize(reduce(s, { type: 'abandon', at: Date.now() }))
    store.clearSession()
    sessionRef.current = null
    setSessionState(null)
    setFinish(null)
  }, [store])

  const resetSkill = useCallback(() => {
    const p = { skill: anchorSkill(settings.level) }
    store.saveProfile(p)
    setProfile(p)
  }, [settings.level, store])

  const pool = useMemo(() => {
    const skill = profile.skill && profile.skill.anchor === settings.level ? profile.skill.effective : settings.level
    return { skill, ...diagnosePool(settings.filters, Math.min(10, Math.max(1, Math.round(skill))), skill + tunables.maxStretch, tunables.experimentalEnabled) }
  }, [profile.skill, settings.filters, settings.level, tunables.maxStretch, tunables.experimentalEnabled])

  return {
    store,
    settings,
    setSettings,
    profile,
    resetSkill,
    tunables,
    setTunables,
    resetTunables: () => {
      store.clearTunables()
      setTunables({ ...DEFAULT_TUNABLES })
    },
    session,
    finish,
    dispatch,
    start,
    leave,
    discard,
    pool,
    issues,
    setNextSeed: (n: number | null) => (nextSeed.current = n),
  }
}

export type Brainlock = ReturnType<typeof useBrainlock>
