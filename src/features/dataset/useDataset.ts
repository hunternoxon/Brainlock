import { useEffect, useMemo, useState } from 'react';
import type { Filters, DatasetMeta, TrickRecord } from './types';
import { loadDataset, defaultFilters, applyFilters, drawRandom } from './dataset';

const KEY = 'brainlock.dataset.filters.v1';

export function useDataset() {
  const [data, setData] = useState<TrickRecord[] | null>(null);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [picked, setPicked] = useState<TrickRecord | null>(null);

  useEffect(() => {
    (async () => {
      const { data, meta } = await loadDataset();
      setData(data);
      setMeta(meta);
      const raw = localStorage.getItem(KEY);
      const initial = raw ? JSON.parse(raw) as Filters : defaultFilters(meta);
      setFilters(initial);
    })();
  }, []);

  const pool = useMemo(() => {
    if (!data || !filters) return [];
    return applyFilters(data, filters);
  }, [data, filters]);

  useEffect(() => {
    if (filters) localStorage.setItem(KEY, JSON.stringify(filters));
  }, [filters]);

  function randomize(seed?: number) {
    setPicked(drawRandom(pool, seed));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return { data, meta, filters, setFilters, pool, picked, setPicked, randomize };
}
