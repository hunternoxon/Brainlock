import type { TrickRecord } from '@/features/dataset/types'

export type ObstacleKey =
  | 'Flatground'
  | 'Manual Pad'
  | 'Rail'
  | 'Ledge/Curb'
  | 'Hubba'
  | 'Quarter/Bowl'
  | 'Bank/Hip'
  | 'Gap/Stairs'
  | 'Mini/Vert'

export interface SessionConfig {
  skill: number // 1-10
  obstacles: ObstacleKey[]
  stanceBias?: 'Any' | 'Normal' | 'Switch' | 'Nollie' | 'Fakie'
  includeCombos: boolean
  seed?: number
}

export interface Attempt {
  trick: TrickRecord
  attemptIndex: number // 1..3
  landed: boolean
  points: number
  timestamp: number
}

export interface SessionState {
  id: string
  config: SessionConfig
  letters: number // 0..5
  attemptsLeft: number // for current trick (starts 3)
  currentTrick: TrickRecord | null
  history: Attempt[]
  totalScore: number
  bestStreak: number
  streak: number
  startedAt: number
  endedAt?: number
}
