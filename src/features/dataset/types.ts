export type Stance = 'Normal' | 'Switch' | 'Nollie' | 'Fakie';
export type Level = 'Noob' | 'Beginner' | 'Amateur' | 'Sponsd' | 'Pro';

export interface TrickRecord {
  name: string;
  stance: Stance;
  categories: string[];
  level: Level;
  difficulty: number;
  combo: 0 | 1;
}

export interface Filters {
  q: string;
  includeCombos: boolean;
  minScore: number;
  maxScore: number;
  stancesOn: Stance[];
  catsOn: string[];
}

export interface DatasetMeta {
  stances: Stance[];
  categories: string[];
  scoreRange: { min: number; max: number };
  levels: Level[];
}
