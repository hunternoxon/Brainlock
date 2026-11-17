# Brainlock implementation log

Handoff template: `import/Brainlock_OpenCode_Handoff/output/WORK_LOG.md` (left untouched; this file continues it).

## 2026-11-16/17 · Pass 1: phases A–E

**Environment:** macOS (darwin), Node 26.13.1, npm 11.20.0, Google Chrome (system) for browser smoke.
**Stack:** TypeScript (strict) + Vite 8 + React 19 + Vitest 4; `playwright-core` (dev only) drives the installed Chrome. Runtime deps: `react`, `react-dom`, `@fontsource-variable/inter`. No service worker (intentionally off during iteration), no network calls, no AI.
**Why this stack:** the engine is pure TS with no DOM, so it's unit-testable in Node. React's `reducer → render` matches the "UI renders from one authoritative state machine" contract, and the design kit is React too.

### Commands

```
npm install
npm run dev              # play at http://localhost:5280 (dev panel included)
npm test                 # 73 Vitest tests
npm run typecheck
npm run build && npm run smoke    # 31-check browser smoke at 390×844
npm run sim              # → output/distribution-report.txt
npm run legacy:baseline  # → output/legacy-baseline.json
npm run verify:import    # import/ unchanged vs output/import-baseline.sha256
```

### Phase A: baseline (evidence: `output/legacy-baseline.json`)

`npm run legacy:baseline` loads the original `trick_model.js` read-only, confirms the parse failure, repairs it **in memory only** (`{"flat":{});` → `{"flat":{}});`), and measures the legacy generator with a seeded `Math.random`:

| Legacy defect (audit #) | Measured |
|---|---|
| 1 Parse error | `SyntaxError: Unexpected token ')'`. Parses after the 1-char fix |
| 2 Init race | Obstacles stay `["flat"]` after config loads (never expands to 12) |
| 3 flip→grind unreachable | **0 / 2000** at L10, all options on |
| 4 Spins ignore family toggle | **1002 / 2000** tricks had spins with spins *disabled* |
| 5 Unvalidated fallback | handrail-only @ L1: **200/200** fallbacks, all "kickflip on handrail"; 199 immediate repeats |
| Scoring | legacy scorer gives 130 / 111 / 98, which matches the golden fixtures, so it was ported as-is |

Config loading is now deterministic: the config is a static import (byte-identical copy, test-enforced), so selections are never initialized before it's available. Archive integrity: `tools/audit_sources.py` PASS; SHA-256 of all 23 files in `legacy/` + `source-archive/` recorded in `output/import-baseline.sha256`; `npm run verify:import` passes after all work.

### Phase B: engine (`src/engine/`)

| Module | Source reused | Changes |
|---|---|---|
| `data/legacy-model-config.json` | v4.5.2 config, **unchanged** | none (test asserts byte equality) |
| `rules.ts` | legacy weights → obstacle/stance intro levels; spec §8–9 gates/bans | Repairs + extensions, listed below |
| `validate.ts` | legacy `allowed*OnObstacle`, pattern lists | Single pure validator used by catalog, selector (belt and braces) and tests |
| `catalog.ts` | legacy pattern/sub tables | Enumerates every legal trick up front (7,952 total; 3,088 normal lane) so selection never "tries then falls back"; explains empty pools in player terms |
| `select.ts` | legacy pattern weights, `weight_by_level` tables, spin frequency profile A | Picks by difficulty band + variety + exact-repeat cooldown; seeded RNG |
| `score.ts` | legacy `scoreTrick` formula and weights, exactly | Adds immutable receipts (`baseParts`, combos, `attemptM`, `flowM`, `repeatM`, `skipDelta`, `formulaVersion`) |
| `game.ts` | legacy turn ideas | New pure reducer: playing → result → Next; SKATE letters; Solo 10/25/50; skip; manual end; blocked; event log |
| `persist.ts` | legacy localStorage keys idea | Versioned envelopes, validation, corrupt-data backup + recovery, idempotent finalize |

**Rules layer (repairs/extensions, all in `rules.ts`):**
- **flip→grind repaired** by modeling the *entry flip* separately from flip-on-obstacle legality: kickflip/heelflip from L5, varials L7, hardflip/inward L8, tre L9 (laser never). Allowed on ledge, hubba, flatbar, rail, handrail.
- **Spins:** family and sub toggles enforced everywhere. Normal lane: spin+flip (180 with flips of diff ≤3; 360 only with kickflip/heelflip, flat/gap only); 180 into manual; standalone spins (`spin-only`, extension) on flat/gap/bank so the Spins family works without Flips. Spin-in grinds and spins on flip-in grinds are **experimental-lane only** (they read oddly, e.g. "BS 180 FS noseslide").
- **Level gates are hard:** component `minLevel`; obstacle/stance intro levels from legacy zero weights (ledge L3, handrail L6, nollie L4, switch L5…); pattern gates (flip→grind L5, flip→manual L2). Spec named gates/bans (darkslide 8, primo 7, no primo slide on handrail, …) are in the validator for when those classes get added. They are *not* generated in v1, per the docs.
- No manual on handrail; flip→manual on manual pad only; no 540+.
- No fallback path exists. An empty pool returns a typed diagnosis ("These obstacles and tricks start around level 6…", "Try enabling Grinds/Slides"). The UI blocks Start; mid-session it offers an explicit "Allow harder tricks this session" (lifts level gates only, never legality) or ending.

### Phase C: adaptive skill (`adapt.ts`)

Effective target starts at the chosen level 1–10. After each resolved challenge: evidence from outcome + attempt (land 1st +1.0, 2nd +0.5, 3rd +0.15, three misses −0.9, skip −0.2), scaled ×(1 ± 0.5 × (rating − skill)) and clamped to [0.25, 1.5]. So landing a stretch counts more than landing an easy trick, and failing an easy trick counts more than failing a stretch. Δ = 0.08 × mean(last 8) × warm-up (n/4), capped at ±0.15 per challenge, bounded [1,10]. **Points are never used.** Each challenge logs `before → after: reason`. Changing the level re-anchors; "Reset to N" on Home.

Selection: rounded skill sets the hard gate; candidate rating ≤ skill + 1.25; per-challenge mix easy 20% (−0.8) / core 55% / stretch 25% (+0.6), band ±0.6 (widened only if empty, logged).

Seeded simulated-player results (`output/distribution-report.txt`): start 3/true 6 → 4.9 after 25, 6.4 after 50; start 8/true 4 → 6.3 after 25, 5.4 after 50; max single step < 0.1. Equilibrium ≈ 60% of challenges cleared within 3 tries (≈26% first try).

### Phase D: UI (`src/ui/`)

Home (mode, Solo 10/25/50, level stepper with adapted level shown, setup summary, live "N possible tricks at your level" or empty-pool explanation, Resume / Start over card) · Play (letters or n/N, score, level, streak; trick name huge with obstacle beneath; attempt dots; Miss / **Land** in thumb zone, Skip smaller, showing its penalty; on resolve Land/Miss/Skip are replaced by **Next**) · result card (points + total first; "Score breakdown" expands the full receipt) · Summary (score vs best, stats, level start→end, tap-to-expand recap) · Setup (12 obstacles, stances, families + sub-options with level badges, auto-saved defaults) · Scores (per-board top 5: SKATE, Solo 10/25/50; history incl. ended/abandoned) · Dev panel (dev builds only).

Visual direction from `import/design-kit` (your own kit): tokens.css copied, Inter, pills, calm white with automatic dark mode. A **landed** result opens the ported tunnel shader (different look per challenge) with white/black cut-out type. The texture is generated procedurally, so the Emerica poster and photos are **not** shipped (reference only). Reduced motion gives a static aurora. Sound is optional, off by default, synthesized (no files). The host copy is minimal ("Landed on 2nd try · Clean.", "Three misses · S earned").

### Phase E: tests run (all executed, this pass)

| Command | Result |
|---|---|
| `npm test` | **73/73 pass** (7 files: scoring 9, legality 24, game 19, adapt 11, persist 5, isolation 3, distribution 2) |
| `npm run typecheck` | pass |
| `npm run build` | pass (JS 283 kB / 89 kB gzip) |
| `npm run smoke` | **31/31 pass**, preview build, Chrome headless 390×844 touch, 0 console errors. Screenshots in `output/smoke/` |
| Dev-mode check (one-off script) | dev panel skip penalty 80 → button shows "Skip · −80"; debug overlay shows rating/target/reason; 0 console errors |
| `npm run verify:import` | pass, import/ unchanged |

Smoke covers: settings persist; SKATE trick non-empty; land → points, Next-only, no double award; breakdown expands; miss → attempt 2 → 3; **reload mid-attempt → Resume restores same trick, attempt 3, score**; 3rd miss → "S earned"; skip → penalty, no letter, waits for Next; 5th letter ends immediately, no extra trick; Solo 10 ends after exactly 10; manual end → "Session ended.", not a high score; scores/history; handrail-only at L1 explains and blocks Start; all play buttons ≥ 44 px.

Not tested: a real phone (only emulated viewport), iOS Safari, offline/PWA install (no service worker yet), Solo 25/50 *in the browser* (covered by reducer tests).

### Acceptance (docs/06 + master prompt "minimum first playable")

| # | Case | Status |
|---|---|---|
| 1 | Loads locally, no console errors, no keys | ✅ smoke |
| 2 | Each mode gives non-empty, legal, level-matched prompts | ✅ smoke + 1,200-pick property test + distribution report |
| 3 | 3-attempt logic, receipts, SKATE letters, result until Next, Solo exactly 10/25/50 | ✅ reducer tests (all three lengths) + smoke (10) |
| 4 | Skip penalty tunable in dev controls, never a land | ✅ tests + dev check |
| 5 | Skill moves a little up and down with debug explanation; no disabled spins, manual on handrail or fallback | ✅ |
| 6 | Survives reload mid-session; scores/history saved | ✅ smoke + persistence tests (incl. corrupt data) |
| 7 | Local dev setup + run instructions | ✅ README + this log |

## Provisional values (tunable in the Dev panel; none are user decisions)

| Item | Default | Note |
|---|---|---|
| Skip penalty | **−50**, enabled, score floored at 0, no SKATE letter, breaks streak | Decision 9 chose penalty + flag; magnitude undecided |
| Flow reset | **any missed attempt** resets the streak (alt: failed challenge only) | docs/08 #2 recommendation |
| Repeat handling | penalty **off**; exact-prompt cooldown 12; legacy −10% semantics available behind flag | fairness-first (decision 24) |
| Adaptation | rate 0.08, window 8, warm-up 4, step cap ±0.15; evidence +1 / +0.5 / +0.15 / −0.9 / skip −0.2; difficulty weight 0.5 | see Phase C |
| Selection | band ±0.6, max stretch +1.25, mix 20/55/25, offsets −0.8/+0.6 | |
| Difficulty rating | component diffs from config; stance 0/0.5/1/1.5; obstacle 0–2 (handrail 2); combos +0.5–1; rating = max(raw, gate + 0.4 × modifiers) | docs/08 #4 mapping, separate from points |
| Grind-entry flip levels | kick/heel 5, varials 7, hard/inward 8, tre 9 | new (repair) |
| Spin compatibility | see Rules layer | new |
| Experimental lane | **off** | docs/08 #5 |
| Default start level | 3 | |
| High scores | completed SKATE/Solo only; ended/abandoned → history only | docs/08 #10 |

## Known gaps / open issues

- **Not yet played by a human.** All tuning above is untested against real fingerboard sessions.
- Difficulty ratings are a first mapping; a few prompts may still feel off (e.g. how common spin-to-manual is at L4–6, quarterpipe phrasing "Kickflip on the quarterpipe").
- Downward adaptation is slower than upward (start 8/true 4 is still at 5.4 after 50). Watch for this in playtest.
- At L8–10, manuals effectively disappear (only grinds/flips rate that high). This follows from the source weights; flag it if you want manuals at high levels.
- Not added: service worker/PWA install, high-score nicknames, admin delete per score (only "clear all"), round-vs-square rail nuance, kicker assist ×0.95.
- Filters are snapshotted per session; changing setup mid-session needs End → Setup.
- Dataset (35,741 names) not used at runtime (by design).
- The project is not committed to git yet.

## Next: hands-on playtest

Use `prompts/02_ITERATION_PROMPT.md`. Play a SKATE run and a Solo 25 at your real level with **Level details** on (≡ menu) so each pick's reasoning is visible. Note answers to docs/06 §5 questions; change one dev-panel variable per round.
