import type { TrickRecord, Filters, DatasetMeta, Stance, Level } from './types';
import { pickRandom, mulberry32 } from './seededRandom';

let _DATA: TrickRecord[] | null = null;
let _META: DatasetMeta | null = null;

export async function loadDataset(): Promise<{ data: TrickRecord[]; meta: DatasetMeta; }> {
  if (_DATA && _META) return { data: _DATA, meta: _META };
  const res = await fetch('/data/brainlock_dataset.json', { cache: 'force-cache' });
  const data: TrickRecord[] = await res.json();

  const stances = Array.from(new Set(data.map(d => d.stance))).sort() as Stance[];
  const cats = Array.from(new Set(data.flatMap(d => d.categories))).sort();
  const levels = Array.from(new Set(data.map(d => d.level))) as Level[];
  const difficulties = data.map(d => d.difficulty).filter((n): n is number => typeof n === 'number');
  const scoreRange = { min: Math.min(...difficulties), max: Math.max(...difficulties) };

  _DATA = data;
  _META = { stances, categories: cats, scoreRange, levels };
  return { data, meta: _META };
}

export function defaultFilters(meta: DatasetMeta): Filters {
  return {
    q: '',
    includeCombos: true,
    minScore: Math.floor(meta.scoreRange.min * 4) / 4,
    maxScore: Math.ceil(meta.scoreRange.max * 4) / 4,
    stancesOn: meta.stances,
    catsOn: meta.categories
  };
}

export function applyFilters(data: TrickRecord[], f: Filters): TrickRecord[] {
  const q = f.q.trim().toLowerCase();
  return data.filter(r => {
    if (q && !r.name.toLowerCase().includes(q)) return false;
    if (!f.includeCombos && r.combo === 1) return false;
    if (r.difficulty < f.minScore || r.difficulty > f.maxScore) return false;
    if (f.stancesOn.length && !f.stancesOn.includes(r.stance)) return false;
    if (f.catsOn.length && !r.categories.some(c => f.catsOn.includes(c))) return false;
    return true;
  });
}

export function drawRandom(pool: TrickRecord[], seed?: number): TrickRecord | null {
  if (!pool.length) return null;
  const rnd = typeof seed === 'number' ? mulberry32(seed) : Math.random;
  return pickRandom(pool, typeof rnd === 'function' ? (rnd as any) : Math.random);
}
