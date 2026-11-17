import { sanitizeFilters } from './catalog'
import { SESSION_SCHEMA, SOLO_LENGTHS, sessionStats, type GameState, type Mode, type SoloLength } from './game'
import { MATCH_SCHEMA, MAX_PLAYERS, standings, type MatchState } from './match'
import { sanitizeTunables, type Tunables } from './tunables'
import type { Filters } from './types'

export interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

const P = 'brainlock:v1:'
export const KEYS = {
  settings: P + 'settings',
  profile: P + 'profile',
  session: P + 'session',
  history: P + 'history',
  scores: P + 'scores',
  tunables: P + 'tunables',
  match: P + 'match',
  matches: P + 'matches',
}
const HISTORY_CAP = 200
const SCORES_CAP = 100

export interface MultiSettings {
  /** 1 = single player; 2–4 = local pass-and-play */
  count: number
  names: string[]
  /** Levels for players 2–4 (player 1 uses Settings.level) */
  levels: number[]
  /** Same trick for everyone each round */
  shared: boolean
}

export interface Settings {
  mode: Mode
  soloLength: SoloLength
  level: number
  filters: Filters
  sound: boolean
  debug: boolean
  multi: MultiSettings
}

export interface MatchRecord {
  id: string
  mode: Mode
  soloLength: SoloLength
  endReason: string
  shared: boolean
  winners: string[]
  players: { id: string; name: string; level: number; score: number; letters: number; landed: number; out: boolean }[]
  startedAt: number
  endedAt: number
}

export function defaultMulti(): MultiSettings {
  return { count: 1, names: ['You', 'Player 2', 'Player 3', 'Player 4'], levels: [3, 3, 3, 3], shared: true }
}

/** Long-term profile metadata. The skill itself is recomputed from history (learning.ts). */
export interface Profile {
  /** Per starting level: ignore sessions before this time ("Reset to N") */
  resets: Record<string, number>
}

export interface ScoreEntry {
  sessionId: string
  board: string
  value: number
  mode: Mode
  soloLength?: SoloLength
  endReason: string
  startLevel: number
  endSkill: number
  landed: number
  challenges: number
  at: number
}

export interface HistoryEntry {
  id: string
  mode: Mode
  soloLength: SoloLength
  endReason: string
  score: number
  startLevel: number
  skillStart: number
  skillEnd: number
  startedAt: number
  endedAt: number
  stats: ReturnType<typeof sessionStats>
  /** Full session snapshot: every challenge, receipt and event */
  session: GameState
  /** Excluded from skill learning by the player */
  forgotten?: { reason: string; note?: string; at: number }
}

export function defaultSettings(): Settings {
  return { mode: 'skate', soloLength: 10, level: 3, filters: sanitizeFilters(undefined), sound: false, debug: false, multi: defaultMulti() }
}

export const boardKey = (mode: Mode, soloLength?: SoloLength) => (mode === 'skate' ? 'skate' : `solo-${soloLength}`)

export interface LoadIssue {
  key: string
  error: string
  backupKey: string
}

export function createStore(storage: StorageLike, now: () => number = Date.now) {
  const issues: LoadIssue[] = []

  function read<T>(key: string, validate: (x: unknown) => T): T | null {
    let raw: string | null = null
    try {
      raw = storage.getItem(key)
      if (raw === null) return null
      const env = JSON.parse(raw)
      if (!env || typeof env !== 'object' || env.v !== 1) throw new Error('bad envelope')
      return validate(env.data)
    } catch (e) {
      // Keep the bad data for recovery, then clear it so the app still boots
      const backupKey = `${key}:corrupt:${now()}`
      try {
        if (raw !== null) storage.setItem(backupKey, raw)
        storage.removeItem(key)
      } catch {
        /* storage full: nothing more we can do */
      }
      issues.push({ key, error: String((e as Error)?.message ?? e), backupKey })
      return null
    }
  }
  function write(key: string, data: unknown) {
    storage.setItem(key, JSON.stringify({ v: 1, savedAt: now(), data }))
  }

  const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object'

  return {
    issues,
    loadSettings(): Settings {
      const d = defaultSettings()
      const s = read(KEYS.settings, (x) => {
        if (!isObj(x)) throw new Error('settings not an object')
        return x as Partial<Settings>
      })
      if (!s) return d
      return {
        mode: s.mode === 'solo' ? 'solo' : 'skate',
        soloLength: (SOLO_LENGTHS as readonly number[]).includes(s.soloLength as number) ? (s.soloLength as SoloLength) : 10,
        level: typeof s.level === 'number' && s.level >= 1 && s.level <= 10 ? Math.round(s.level) : d.level,
        filters: sanitizeFilters(s.filters),
        sound: !!s.sound,
        debug: !!s.debug,
        multi: sanitizeMulti(s.multi),
      }
    },
    saveSettings(s: Settings) {
      write(KEYS.settings, s)
    },
    loadProfile(): Profile {
      return (
        read(KEYS.profile, (x) => {
          if (!isObj(x)) throw new Error('profile not an object')
          // v1 profiles cached a skill; v2 recomputes it from history, so only resets are kept
          const resets = isObj(x.resets) ? (x.resets as Record<string, number>) : {}
          return { resets }
        }) ?? { resets: {} }
      )
    },
    saveProfile(p: Profile) {
      write(KEYS.profile, p)
    },
    loadTunables(): Tunables {
      return sanitizeTunables(read(KEYS.tunables, (x) => x as Partial<Tunables>) ?? undefined)
    },
    saveTunables(t: Tunables) {
      write(KEYS.tunables, t)
    },
    clearTunables() {
      storage.removeItem(KEYS.tunables)
    },
    loadSession(): GameState | null {
      return read(KEYS.session, (x) => {
        if (!isObj(x)) throw new Error('session not an object')
        const s = x as unknown as GameState
        if (s.schema !== SESSION_SCHEMA) throw new Error(`session schema ${s.schema} != ${SESSION_SCHEMA}`)
        if (!['playing', 'result', 'blocked', 'over', 'waiting'].includes(s.status)) throw new Error('bad status')
        if (s.status === 'playing' && (!s.current || !s.current.trick)) throw new Error('playing without challenge')
        if (typeof s.score !== 'number' || typeof s.rng !== 'number' || !Array.isArray(s.history) || !Array.isArray(s.events)) throw new Error('missing fields')
        if (s.current && (s.current.attempt < 1 || s.current.attempt > 3)) throw new Error('bad attempt')
        return { ...s, filters: sanitizeFilters(s.filters), tunables: sanitizeTunables(s.tunables) }
      })
    },
    saveSession(s: GameState) {
      write(KEYS.session, s)
    },
    clearSession() {
      storage.removeItem(KEYS.session)
    },
    loadHistory(): HistoryEntry[] {
      return read(KEYS.history, (x) => {
        if (!Array.isArray(x)) throw new Error('history not an array')
        return x as HistoryEntry[]
      }) ?? []
    },
    loadScores(): ScoreEntry[] {
      return read(KEYS.scores, (x) => {
        if (!Array.isArray(x)) throw new Error('scores not an array')
        return x as ScoreEntry[]
      }) ?? []
    },
    /**
     * Record a finished session once (idempotent by session id). Only SKATE
     * losses and completed Solo runs go on the high-score boards.
     */
    finalize(s: GameState): { isNewBest: boolean; previousBest: number | null } {
      const history = this.loadHistory()
      const scores = this.loadScores()
      const board = boardKey(s.mode, s.soloLength)
      const prev = scores.filter((e) => e.board === board && e.sessionId !== s.id).sort((a, b) => b.value - a.value)[0]
      const previousBest = prev ? prev.value : null
      const eligible = s.endReason === 'skate' || s.endReason === 'solo-complete'
      const isNewBest = eligible && (previousBest === null || s.score > previousBest)
      // Already recorded (e.g. re-render or reload on the summary): never double-add
      if (history.some((h) => h.id === s.id)) return { isNewBest, previousBest }
      const stats = sessionStats(s)
      history.unshift({
        id: s.id,
        mode: s.mode,
        soloLength: s.soloLength,
        endReason: s.endReason ?? 'ended',
        score: s.score,
        startLevel: s.startLevel,
        skillStart: s.skillStart,
        skillEnd: s.skill.effective,
        startedAt: s.startedAt,
        endedAt: s.endedAt ?? now(),
        stats,
        session: s,
      })
      write(KEYS.history, history.slice(0, HISTORY_CAP))
      if (!eligible) return { isNewBest: false, previousBest }
      scores.push({
        sessionId: s.id,
        board,
        value: s.score,
        mode: s.mode,
        soloLength: s.mode === 'solo' ? s.soloLength : undefined,
        endReason: s.endReason!,
        startLevel: s.startLevel,
        endSkill: s.skill.effective,
        landed: stats.landed,
        challenges: s.history.length,
        at: s.endedAt ?? now(),
      })
      scores.sort((a, b) => b.value - a.value)
      write(KEYS.scores, scores.slice(0, SCORES_CAP))
      return { isNewBest, previousBest }
    },
    /**
     * Exclude a session from skill learning (reason required). History and score
     * stay unless the player explicitly asks to delete them too.
     */
    forgetSession(id: string, reason: string, note: string | undefined, alsoDelete: boolean): boolean {
      if (!reason) throw new Error('A reason is required')
      const history = this.loadHistory()
      const h = history.find((x) => x.id === id)
      if (!h) return false
      if (alsoDelete) {
        write(KEYS.history, history.filter((x) => x.id !== id))
        write(KEYS.scores, this.loadScores().filter((e) => e.sessionId !== id))
      } else {
        h.forgotten = { reason, note: note?.trim() || undefined, at: now() }
        write(KEYS.history, history)
      }
      return true
    },
    unforgetSession(id: string) {
      const history = this.loadHistory()
      const h = history.find((x) => x.id === id)
      if (h) {
        delete h.forgotten
        write(KEYS.history, history)
      }
    },
    loadMatch(): MatchState | null {
      return read(KEYS.match, (x) => {
        const m = x as MatchState
        if (!isObj(x) || m.schema !== MATCH_SCHEMA || !Array.isArray(m.players) || m.players.length < 2) throw new Error('bad match')
        if (m.players.some((p) => !p.session || p.session.schema !== SESSION_SCHEMA)) throw new Error('bad match player')
        return m
      })
    },
    saveMatch(m: MatchState) {
      write(KEYS.match, m)
    },
    clearMatch() {
      storage.removeItem(KEYS.match)
    },
    loadMatches(): MatchRecord[] {
      return read(KEYS.matches, (x) => {
        if (!Array.isArray(x)) throw new Error('matches not an array')
        return x as MatchRecord[]
      }) ?? []
    },
    /** Record a finished match once. Multiplayer never feeds long-term learning or solo high scores. */
    finalizeMatch(m: MatchState) {
      const list = this.loadMatches()
      if (list.some((r) => r.id === m.id)) return
      list.unshift({
        id: m.id,
        mode: m.mode,
        soloLength: m.soloLength,
        endReason: m.endReason ?? 'ended',
        shared: m.shared,
        winners: m.winners,
        players: standings(m).map((p) => ({
          id: p.id,
          name: p.name,
          level: p.level,
          score: p.session.score,
          letters: p.session.letters,
          landed: sessionStats(p.session).landed,
          out: p.session.endReason === 'skate',
        })),
        startedAt: m.startedAt,
        endedAt: m.endedAt ?? now(),
      })
      write(KEYS.matches, list.slice(0, 50))
    },
    clearScoresAndHistory() {
      storage.removeItem(KEYS.scores)
      storage.removeItem(KEYS.history)
      storage.removeItem(KEYS.matches)
    },
  }
}

export type Store = ReturnType<typeof createStore>

export function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

export function sanitizeMulti(m: Partial<MultiSettings> | undefined): MultiSettings {
  const d = defaultMulti()
  if (!m || typeof m !== 'object') return d
  const count = typeof m.count === 'number' && m.count >= 1 && m.count <= MAX_PLAYERS ? Math.round(m.count) : 1
  const names = d.names.map((n, i) => (Array.isArray(m.names) && typeof m.names[i] === 'string' ? m.names[i].slice(0, 16) : n))
  const levels = d.levels.map((l, i) => {
    const v = Array.isArray(m.levels) ? m.levels[i] : undefined
    return typeof v === 'number' && v >= 1 && v <= 10 ? Math.round(v) : l
  })
  return { count, names, levels, shared: typeof m.shared === 'boolean' ? m.shared : true }
}
