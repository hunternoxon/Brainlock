# Brainlock

A personal fingerboarding challenge game. One trick at a time, matched to your level; tap **Land**, **Miss** or **Skip**; three attempts per challenge. Two modes: **SKATE** (three misses = a letter, S-K-A-T-E ends it) and **Marathon** (exactly 10, 25 or 50 challenges), each playable alone or as a 2–4 player pass-and-play match. Runs entirely in the browser: offline, no accounts, no AI calls, no API keys.

Status: **Trick Intelligence v2, awaiting real playtest.** See `output/TRICK_INTELLIGENCE_V2_REPORT.md` (latest pass), `docs/TRICK_INTELLIGENCE_V2_DECISIONS.md` (rules and flags) and `output/WORK_LOG.md` (history). The previous build is tagged `v1-first-playable`.

## Play it

Live build (auto-deployed from `main` by GitHub Actions): see the repository's **About → website** link, or `https://<your-github-username>.github.io/brainlock/`.

## Run it

Requires Node 20+ (developed on Node 26.13, npm 11.20).

```bash
npm install
npm run dev          # http://localhost:5280 (also on your LAN IP for phone testing)
```

On your phone (same Wi-Fi): open the `Network:` URL that `npm run dev` prints.

Production build (no dev panel):

```bash
npm run build && npm run preview   # http://localhost:5281
```

## Test it

```bash
npm test                 # 181 unit/integration/property tests (Vitest)
npm run typecheck        # TypeScript strict
npm run build            # typecheck + production bundle
npm run smoke            # 46-check browser smoke at 390×844 and 1440×900 in your installed Google Chrome (needs a build first)
npm run sim              # seeded distribution + adaptation report → output/distribution-report.txt
npm run legacy:baseline  # measures the original v4.5.2 generator's defects → output/legacy-baseline.json
npm run verify:import    # confirms import/ (source archive + legacy) is byte-for-byte unchanged
```

## Developer controls

In `npm run dev` only: tap **Dev** on the home screen (or press the backtick key). Tune skip penalty, flow reset rule, repeat penalty, adaptation coefficients, selection band and the experimental lane; replay a seed; export a session trace. The menu's **Level details** toggle shows why each trick was picked and how the level moved.

Keyboard (desktop): `L` land, `M` miss, `S` skip, `N`/`Enter` next.

## Layout

```
src/engine/        pure game logic, no DOM: unit-tested
  data/legacy-model-config.json   exact copy of the v4.5.2 config (weights preserved)
  rules.ts         repairs + extensions layered on the config (documented)
  vocab.ts         v2 component tables: board moves, grinds, stalls, exits, reverts, transfers
  canonical.ts     canonical identity + skater-convention naming + strict alias parsing
  learning.ts      long-term level recomputed from completed, non-forgotten sessions
  match.ts         local pass-and-play multiplayer (turns, shared tricks, elimination)
  validate.ts      the single legality check every trick must pass
  catalog.ts       enumerates every legal trick; filters; empty-pool diagnosis
  difficulty.ts    1–10 rating per trick (separate from points)
  select.ts        level-matched, variety-aware picker (seeded RNG)
  score.ts         spec scoring formula + receipts
  adapt.ts         slow two-way skill adaptation
  game.ts          session state machine (reducer)
  persist.ts       versioned localStorage with corruption recovery
src/ui/            React screens (Home, Play, Summary, Setup, Scores, Dev panel)
src/features/stack-builder/   legacy NL parser, isolated and disabled
tests/             Vitest suites
scripts/           smoke test, legacy baseline
import/            original handoff package + design kit (read-only reference)
output/            WORK_LOG.md, reports, smoke screenshots
```
