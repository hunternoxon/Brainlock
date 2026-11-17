import { useCallback, useMemo, useRef, useState } from 'react'
import { diagnosePool } from '../engine/catalog'
import { reduce, startSession, type Action, type GameState } from '../engine/game'
import { computeLongTermSkill } from '../engine/learning'
import { matchAct as matchActPure, matchEnd as matchEndPure, matchNext as matchNextPure, startMatch, type MatchState, type TurnAction } from '../engine/match'
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
  /** Bumped whenever history changes so the long-term skill recomputes */
  const [historyRev, setHistoryRev] = useState(0)
  const [issues] = useState(() => [...store.issues])
  const nextSeed = useRef<number | null>(null)
  const matchRef = useRef<MatchState | null>(null)
  const [match, setMatchState] = useState<MatchState | null>(() => {
    const m = store.loadMatch()
    matchRef.current = m
    return m
  })

  const commit = useCallback(
    (next: GameState, prev: GameState | null) => {
      sessionRef.current = next
      if (next.status === 'over') {
        store.clearSession()
        setFinish(store.finalize(next))
        setHistoryRev((r) => r + 1)
      } else {
        store.saveSession(next)
      }
      void prev
      setSessionState(next)
    },
    [store],
  )

  const playSound = useCallback(
    (type: string, after: GameState | undefined, over: boolean) => {
      if (!settings.sound) return
      if (over) sfx.over()
      else if (type === 'land') sfx.land()
      else if (type === 'miss') (after?.current?.outcome === 'failed' ? sfx.fail : sfx.miss)()
    },
    [settings.sound],
  )

  const dispatch = useCallback(
    (a: DistAction) => {
      const prev = sessionRef.current
      if (!prev) return
      const next = reduce(prev, { ...a, at: Date.now() } as Action)
      if (next === prev) return
      playSound(a.type, next, next.status === 'over' && next.endReason !== 'ended')
      commit(next, prev)
    },
    [commit, playSound],
  )

  const commitMatch = useCallback(
    (m: MatchState) => {
      matchRef.current = m
      if (m.status === 'over') {
        store.clearMatch()
        store.finalizeMatch(m)
      } else store.saveMatch(m)
      setMatchState(m)
    },
    [store],
  )

  type TurnInput = TurnAction extends infer A ? (A extends { at: number } ? Omit<A, 'at'> : never) : never
  const matchAct = useCallback(
    (a: TurnInput) => {
      const m = matchRef.current
      if (!m) return
      const next = matchActPure(m, { ...a, at: Date.now() } as TurnAction)
      if (next === m) return
      const s = next.players[next.turn].session
      playSound(a.type, s, s.status === 'over')
      commitMatch(next)
    },
    [commitMatch, playSound],
  )
  const matchNext = useCallback(() => {
    const m = matchRef.current
    if (!m) return
    const next = matchNextPure(m, Date.now())
    if (next === m) return
    if (next.status === 'over' && settings.sound) sfx.over()
    commitMatch(next)
  }, [commitMatch, settings.sound])
  const matchEnd = useCallback(() => {
    const m = matchRef.current
    if (m) commitMatch(matchEndPure(m, Date.now()))
  }, [commitMatch])
  const leaveMatch = useCallback(() => {
    if (matchRef.current?.status === 'over') {
      matchRef.current = null
      setMatchState(null)
    }
  }, [])
  const discardMatch = useCallback(() => {
    const m = matchRef.current
    if (m && m.status !== 'over') store.finalizeMatch(matchEndPure(m, Date.now()))
    store.clearMatch()
    matchRef.current = null
    setMatchState(null)
  }, [store])

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

  const longTerm = useMemo(() => {
    void historyRev
    return computeLongTermSkill(store.loadHistory(), settings.level, profile.resets[String(settings.level)] ?? 0, tunables)
  }, [historyRev, profile.resets, settings.level, store, tunables])

  const start = useCallback(() => {
    const mu = settings.multi
    if (mu.count > 1) {
      const prevM = matchRef.current
      if (prevM && prevM.status !== 'over') store.finalizeMatch(matchEndPure(prevM, Date.now()))
      const seed = nextSeed.current ?? randomSeed()
      nextSeed.current = null
      commitMatch(
        startMatch({
          mode: settings.mode,
          soloLength: settings.soloLength,
          filters: settings.filters,
          tunables,
          shared: mu.shared,
          seed,
          at: Date.now(),
          players: Array.from({ length: mu.count }, (_, i) => ({ name: mu.names[i], level: i === 0 ? settings.level : mu.levels[i] })),
        }),
      )
      return 'match' as const
    }
    const prev = sessionRef.current
    if (prev && prev.status !== 'over') store.finalize(reduce(prev, { type: 'abandon', at: Date.now() }))
    setHistoryRev((r) => r + 1)
    setFinish(null)
    const seed = nextSeed.current ?? randomSeed()
    nextSeed.current = null
    const s = startSession({
      mode: settings.mode,
      soloLength: settings.soloLength,
      filters: settings.filters,
      startLevel: settings.level,
      skill: longTerm.skill,
      tunables,
      seed,
      at: Date.now(),
    })
    sessionRef.current = s
    store.saveSession(s)
    setSessionState(s)
    return 'single' as const
  }, [commitMatch, longTerm.skill, settings, store, tunables])

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
    setHistoryRev((r) => r + 1)
  }, [store])

  const resetSkill = useCallback(() => {
    const p = { resets: { ...profile.resets, [String(settings.level)]: Date.now() } }
    store.saveProfile(p)
    setProfile(p)
  }, [profile.resets, settings.level, store])

  const forget = useCallback(
    (id: string, reason: string, note: string | undefined, alsoDelete: boolean) => {
      store.forgetSession(id, reason, note, alsoDelete)
      setHistoryRev((r) => r + 1)
    },
    [store],
  )
  /** Put the finished session on its board under these initials (remembered for next time) */
  const postScore = useCallback(
    (id: string, initials: string) => {
      const e = store.postScore(id, initials)
      if (e) {
        setSettings({ initials: e.initials! })
        setHistoryRev((r) => r + 1)
      }
      return e
    },
    [store, setSettings],
  )
  const removeScore = useCallback(
    (id: string) => {
      store.removeScore(id)
      setHistoryRev((r) => r + 1)
    },
    [store],
  )
  const unforget = useCallback(
    (id: string) => {
      store.unforgetSession(id)
      setHistoryRev((r) => r + 1)
    },
    [store],
  )

  const pool = useMemo(() => {
    const skill = longTerm.skill.effective
    return { skill, ...diagnosePool(settings.filters, Math.min(10, Math.max(1, Math.round(skill))), skill + tunables.maxStretch) }
  }, [longTerm.skill.effective, settings.filters, tunables.maxStretch])

  return {
    store,
    settings,
    setSettings,
    profile,
    longTerm,
    historyRev,
    resetSkill,
    forget,
    unforget,
    postScore,
    removeScore,
    tunables,
    setTunables,
    resetTunables: () => {
      store.clearTunables()
      setTunables({ ...DEFAULT_TUNABLES })
    },
    session,
    finish,
    match,
    matchAct,
    matchNext,
    matchEnd,
    leaveMatch,
    discardMatch,
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
