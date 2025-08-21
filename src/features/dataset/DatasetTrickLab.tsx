import React from 'react';
import { useDataset } from './useDataset';
import type { Filters } from './types';

function Chip({ children }: { children: React.ReactNode }){
  return <span className="inline-flex items-center rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 mr-1">{children}</span>;
}

export default function DatasetTrickLab(){
  const { data, meta, filters, setFilters, pool, picked, randomize } = useDataset();

  if (!meta || !filters) {
    return (
      <div className="p-6 text-zinc-300">
        <div className="animate-pulse">Loading dataset…</div>
      </div>
    );
  }

  const update = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  const toggleList = (key: 'stancesOn'|'catsOn', value: string) => {
    const cur = new Set(filters[key] as string[]);
    cur.has(value) ? cur.delete(value) : cur.add(value);
    update({ [key]: Array.from(cur) } as any);
  };

  return (
    <div className="mx-auto max-w-7xl grid md:grid-cols-[320px,1fr] gap-6 p-4 md:p-8">
      <aside className="space-y-4">
        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Search</h2>
          <input
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search by trick name…"
            className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2 text-zinc-100"
          />
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Stance</h2>
          <div className="flex flex-wrap gap-2">
            {meta.stances.map(s => (
              <label key={s} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.stancesOn.includes(s)}
                  onChange={() => toggleList('stancesOn', s)}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 max-h-[360px] overflow-auto">
          <h2 className="font-semibold mb-3">Categories</h2>
          <div className="grid grid-cols-2 gap-2">
            {meta.categories.map(c => (
              <label key={c} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.catsOn.includes(c)}
                  onChange={() => toggleList('catsOn', c)}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <h2 className="font-semibold mb-2">Difficulty</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm w-20">Min</span>
              <input type="range" min={meta.scoreRange.min} max={meta.scoreRange.max} step={0.25}
                value={filters.minScore}
                onChange={(e) => update({ minScore: parseFloat(e.target.value) })}
                className="w-full" />
              <span className="text-sm w-10">{filters.minScore}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm w-20">Max</span>
              <input type="range" min={meta.scoreRange.min} max={meta.scoreRange.max} step={0.25}
                value={filters.maxScore}
                onChange={(e) => update({ maxScore: parseFloat(e.target.value) })}
                className="w-full" />
              <span className="text-sm w-10">{filters.maxScore}</span>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={filters.includeCombos}
              onChange={(e) => update({ includeCombos: e.target.checked })}
            />
            <span>Include combo tricks</span>
          </label>
        </section>

        <button
          onClick={() => randomize()}
          className="w-full bg-zinc-100 text-black rounded-2xl px-4 py-2 font-semibold hover:bg-white transition"
        >
          🎲 Random Trick
        </button>

        <div className="text-zinc-400 text-sm">{pool.length} tricks match</div>
      </aside>

      <main className="space-y-4">
        {picked && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <div className="text-2xl font-extrabold">{picked.name}</div>
            <div className="text-zinc-400 text-sm mt-1">
              Stance: {picked.stance} • Level: {picked.level} • Score: {picked.difficulty}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {picked.categories.map(c => <Chip key={c}>{c}</Chip>)}
              {picked.combo ? <Chip>Combo</Chip> : null}
            </div>
          </div>
        )}

        <h3 className="text-lg font-semibold">Results</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {pool.slice(0, 200).map(r => (
            <div key={r.name + r.stance} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3">
              <div className="font-bold">{r.name}</div>
              <div className="text-zinc-400 text-xs mt-0.5">Stance: {r.stance} • Level: {r.level} • Score: {r.difficulty}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.categories.map(c => <Chip key={c}>{c}</Chip>)}
                {r.combo ? <Chip>Combo</Chip> : null}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
