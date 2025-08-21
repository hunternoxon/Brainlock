import type { TrickRecord } from '@/features/dataset/types'
import type { SessionConfig, SessionState, ObstacleKey, Attempt } from './types'
import { mulberry32, pickRandom } from '@/features/dataset/seededRandom'

export interface ObstacleMap { [k: string]: string[] }

export function mapObstaclesToCategories(obstacles: ObstacleKey[], map: ObstacleMap): string[] {
  const selected = new Set<string>()
  obstacles.forEach(o => {
    (map[o] || []).forEach(cat => selected.add(cat))
  })
  // turn 'Grind,Combo' etc into simple tags set ['Grind','Combo'] presence checks later
  return Array.from(selected)
}

export function poolFromDataset(data: TrickRecord[], cfg: SessionConfig, map: ObstacleMap): TrickRecord[] {
  const cats = mapObstaclesToCategories(cfg.obstacles, map)
  // approximate difficulty window based on skill (1 -> easy, 10 -> hard)
  const min = Math.max(0.25, 0.25 + (cfg.skill - 1) * 0.5) // grows by ~0.5 per level
  const max = Math.min(6.75, 2.5 + cfg.skill * 0.45) // tops ~6.0-6.75
  return data.filter(r => {
    if (!cfg.includeCombos && r.combo === 1) return false
    if (r.difficulty < min || r.difficulty > max) return false
    if (cfg.stanceBias && cfg.stanceBias !== 'Any' && r.stance !== cfg.stanceBias) return false
    // obstacle filter: keep if at least one category tag is represented by selected obstacle categories
    if (cats.length) {
      const has = r.categories.some(c => cats.includes(c) || c.split(',').some(part => cats.includes(part)))
      if (!has) return false
    }
    return true
  })
}

export function newSession(id: string, cfg: SessionConfig): SessionState {
  return {
    id,
    config: cfg,
    letters: 0,
    attemptsLeft: 3,
    currentTrick: null,
    history: [],
    totalScore: 0,
    bestStreak: 0,
    streak: 0,
    startedAt: Date.now()
  }
}

export function pickNextTrick(pool: TrickRecord[], seed?: number): TrickRecord | null {
  if (!pool.length) return null
  const rnd = typeof seed === 'number' ? mulberry32(seed) : Math.random
  return pickRandom(pool, typeof rnd === 'function' ? (rnd as any) : Math.random)
}

export function landBonus(attemptIndex: number): number {
  if (attemptIndex === 1) return 1.00
  if (attemptIndex === 2) return 0.94
  return 0.92
}

export function scoreFor(trick: TrickRecord, attemptIndex: number): number {
  const base = trick.difficulty * 100 // scale to 100s
  return Math.round(base * landBonus(attemptIndex))
}

export function applyAttempt(state: SessionState, landed: boolean): SessionState {
  if (!state.currentTrick) return state
  const attemptIndex = 4 - state.attemptsLeft
  const points = landed ? scoreFor(state.currentTrick, attemptIndex) : 0
  const rec: Attempt = {
    trick: state.currentTrick,
    attemptIndex,
    landed,
    points,
    timestamp: Date.now()
  }
  const history = [...state.history, rec]
  let letters = state.letters
  let attemptsLeft = state.attemptsLeft
  let totalScore = state.totalScore
  let streak = state.streak
  let bestStreak = state.bestStreak

  if (landed) {
    totalScore += points
    streak += 1
    bestStreak = Math.max(bestStreak, streak)
    // new trick next time
    attemptsLeft = 3
  } else {
    attemptsLeft -= 1
    if (attemptsLeft <= 0) {
      // assign a letter
      letters = Math.min(5, letters + 1)
      streak = 0
      attemptsLeft = 3
    }
  }

  return {
    ...state,
    history,
    letters,
    attemptsLeft,
    totalScore,
    streak,
    bestStreak
  }
}

export function isGameOver(state: SessionState): boolean {
  return state.letters >= 5
}
