# Trick Intelligence v2: implementation report

Date: 2026-11-17 · Checkpoint before this pass: `git tag v1-first-playable` (commit a670fe5); revert with `git checkout v1-first-playable`.
Decisions and rules: `docs/TRICK_INTELLIGENCE_V2_DECISIONS.md`. Baseline inventory: `output/TRICK_INVENTORY_V1.md`. Seeded data: `output/distribution-report.txt`.

## 1. Gap matrix

**Before (v1)**, from `TRICK_INVENTORY_V1.md`:
- Settings exposed 8 flips, 13 grinds, 2 manuals and 2 spins.
- **No** ollie, shuvits, bigspins, cabs, impossible, late/pressure flips, doubles, exits, reverts, transfers, grind-to-grind, or any quarterpipe coping.
- Quarterpipe produced only 4 tricks, all flip airs.
- Flip-ins only on ledge/hubba/rails. Body-spin naming was mechanical ("Switch FS 180 hardflip").
- The engine and chips matched 1:1 (there was no hidden vocabulary).

**After (v2)**: core + uncommon tricks per obstacle and pattern. Rare tiers are opt-in, but at most "Very low" frequency by default.

| obstacle | air (incl. ollie/shuvit/spin) | grind | flip/shuvit-in grind | manual | flip-in manual | coping | rare tiers |
|---|---|---|---|---|---|---|---|
| flat | 132 | 0 | 0 | 0 | 0 | 0 | 196 |
| manual pad | 44 | 0 | 0 | 48 | 64 | 0 | 232 |
| box | 0 | 144 | 400 | 48 | 0 | 0 | 1080 |
| curb | 0 | 128 | 320 | 48 | 0 | 0 | 1056 |
| bank | 112 | 0 | 0 | 24 | 0 | 0 | 152 |
| ledge | 0 | 296 | 960 | 0 | 0 | 0 | 2200 |
| hubba | 0 | 264 | 880 | 0 | 0 | 0 | 1936 |
| flatbar | 0 | 224 | 640 | 0 | 0 | 0 | 1224 |
| rail | 0 | 224 | 640 | 0 | 0 | 0 | 1224 |
| handrail | 0 | 72 | 720 | 0 | 0 | 0 | 384 |
| gap | 132 | 0 | 0 | 0 | 0 | 0 | 112 |
| **quarterpipe** | 16 | **28** | 0 | 0 | 0 | **38** | 28 |

The total catalog is 16,470 legal tricks: 4,674 core, 1,976 uncommon, 1,084 rare, 6,528 very rare (mostly entry+exit sequences) and 2,208 experimental. Every one passes `validateTrick`, and every name is checked for `undefined`, "?" and implied-ollie prefixes.

## 2. What shipped

| Priority | Status |
|---|---|
| Canonical model; derived naming (FS Flip, Half/Full Cab, Bigspin, Bigflip, Biggerspin, Gazelle, Tre ≡ 360 Flip); strict alias parser; double-count protection | ✅ |
| Fundamentals: Ollie, FS/BS pop & 360 shuvits, named body-spin flips, cabs, bigspins/bigflips | ✅ |
| **Quarterpipe coping**: 12 stalls/lip tricks + 7 coping grinds, level-gated from L1 | ✅ |
| Advanced: impossible, pressure, late flips/shuvits, 360 hardflip/inward, 540 shuvits, biggerspin, gazelle, salad/willy/hurricane, flip/shuvit-ins (incl. box/curb), flip/heelflip/shuvit/180 outs, pop-overs, grind-to-grind, manual sequences, reverts, transfers | ✅ |
| Flags: Rare & experimental (Off/Very low/Low/Normal), Double flips, Triple flips, Transfers | ✅ |
| Adaptation: hot-streak acceleration, bounded temporary boost (L6 → max 8), recovery picks, Too easy/Too hard with cooldown, per-family offsets (flagged off) | ✅ |
| Learning only from completed sessions, recomputed from history; Forget-for-learning with a required reason; optional delete; undo | ✅ |
| Selection: single weighted pick preserving the legacy pattern → obstacle → trick structure, soft family balance, stance variety, novelty, same-skill cooldown across obstacles | ✅ |
| Repeat penalty: only for player-chosen tricks (none exist), so game-assigned repeats are never penalised | ✅ |
| Setup hierarchy (headers + switches + counts vs. check-marked chips, Advanced & rare disclosure, All/None, no-obstacles guidance); desktop layouts for Home/Setup/Scores | ✅ |
| Flip-ins into quarterpipe stalls, round/square rail nuance, kicker assist, primo/darkslide/no-comply, gazelle flip | ⏸ deferred (documented) |

Unchanged: SKATE / Solo 10/25/50, 3 attempts, letters, skip penalty, Land/Miss/Skip → result → Next (no auto-advance), resume, high scores, history, the scoring formula, the expandable receipt, and the landing tunnel.

## 3. Files changed (vs v1-first-playable)

- **New engine:** `src/engine/vocab.ts` (component tables), `canonical.ts` (identity + naming + alias parsing), `learning.ts` (long-term recompute).
- **Reworked engine:** `types.ts`, `rules.ts`, `validate.ts`, `catalog.ts`, `difficulty.ts`, `score.ts`, `select.ts`, `adapt.ts`, `game.ts` (session schema 2: boost, recovery, feedback, novelty), `persist.ts` (profile resets, forget/unforget), `tunables.ts`, `format.ts` (now re-exports).
- **UI:** `SetupSheet.tsx` (rewritten), `Scores.tsx` (forget flow), `Play.tsx` (feedback, diagnostics, rare tag), `Home.tsx` (learned level, desktop columns), `DevPanel.tsx` (all new knobs, long-term view), `useBrainlock.ts` (history-derived skill), `App.tsx` (`data-view`), `styles.css`.
- **Tests:** new `naming.test.ts`, `vocab.test.ts`, `learning.test.ts`; updated `legality`, `scoring`, `adapt`, `distribution`, `helpers`; `scripts/smoke.mjs` extended.
- **Docs:** `docs/TRICK_INTELLIGENCE_V2_DECISIONS.md`, this report, `output/TRICK_INVENTORY_V1.md`.
- **Untouched:** `import/` (verified by `npm run verify:import`), `src/engine/data/legacy-model-config.json` (byte-identical, test-enforced).

## 4. Tests run (this pass, all executed)

| Command | Result |
|---|---|
| `npm test` | **168/168 pass** (10 files: naming 57, legality 31, vocab 20, game 19, adapt 11, scoring 9, learning 9, persist 5, distribution 4, isolation 3) |
| `npx tsc --noEmit` | pass (strict, incl. tests) |
| `npm run build` | pass; JS 316 kB / **97 kB gzip** (v1: 89 kB) |
| `npm run smoke` | **41/41 pass**, Chrome headless, 390×844 touch + 1440×900, **0 console errors** |
| Dev-mode check (`npm run dev`, one-off script) | dev panel sections render; debug line shows boost / long-term / rarity roll; 0 console errors |
| `npm run verify:import` | pass |

The smoke covers all v1 flows, plus:
- Forget requires a reason, and the forgotten session stays in history marked "Not used for learning".
- No-obstacles guidance appears.
- Handrail-only at L1 is explained.
- A quarterpipe-only session produces 4/4 coping tricks (Tail Stall, BS Axle Stall, Rock to Fakie, FS Axle Stall).
- "Too easy" is acknowledged.
- Desktop: Home in 2 columns; Setup with a side column plus a 2-column family grid in a 1120 px container; category headers are H3s with 5 role=switch toggles, larger than chip text.
- All play buttons are at least 44 px.

Property / seeded assertions include:
- Every catalog entry is valid and cleanly named.
- No "Ollie …" prefixes on grinds/manuals; no verbose "FS 180 Kickflip"; Cab names only for fakie + FS.
- Tre ≡ 360 Flip ≡ three flip, with the same key and score.
- Decomposed flip values equal legacy values exactly; a Bigflip scores components only; receipts reconcile for a sampled 1/7 of the catalog; no component appears twice in a receipt.
- Ollie appears at L1, never as plain flat Ollie at L10.
- Pop shuvits appear at low levels; Fakie and Switch Heelflip are distinct skills.
- Doubles off → none; triples off → none; triples on stay under 3%; transfers off → none, and on → only the 4 compatible pairs.
- Rare = Off → no rare tricks; Very low keeps rare + very-rare under 8%; no high-level rare flips at L3.
- Quarterpipe-only at L1/3/5/8 is diverse and not mostly airs.
- A family disabled → none of it generated; spins off → 0 of 2000.
- The same skill on a different obstacle repeats within 8 prompts in under 5% of picks.
- A level-6 hot streak reaches 7+ but never more than skill + 2.0 (no 9 from a 6).
- Recovery triggers after 2 fails with a cooldown.
- Feedback is bounded and cooldown-gated.
- Abandoned and ended sessions don't train; forgetting removes all influence (recompute equals the "only the other session" result); unforget restores it; delete only when chosen.

## 5. Representative generated names (seeded, default settings)

- **L2:** Ollie on flat · Heelflip to Manual on the manual pad · Fakie Kickflip on the bank · BS Axle Stall on the quarterpipe coping · BS Heelflip on the bank · Nose Manual on the box · Kickflip to Manual on the manual pad · BS Pop Shuvit on flat
- **L5:** BS Smith Grind on the flatbar · Nollie Varial Heelflip on flat · Fakie Varial Kickflip to Nose Manual on the manual pad · BS Smith Stall on the quarterpipe coping · BS Bigspin on flat · Nollie FS 5-0 Shuvit Out on the hubba · Nollie FS Flip on the manual pad · Fakie BS 180 Inward Heelflip on the bank
- **L8:** Switch BS Noseblunt Stall on the quarterpipe coping · Fakie Kickflip BS Feeble Grind on the flatbar · Switch FS Smith Grind Heelflip Out on the flatbar · Switch BS Bigflip on flat · Fakie Laser Flip on the bank · Nollie Heelflip BS Lipslide on the handrail · Tre Flip to Manual on the manual pad
- **L10:** Switch Heelflip BS Bluntslide on the handrail · Nollie Inward Heelflip FS Smith Grind on the hubba · Nollie Tre Flip BS Tailslide on the curb · Nollie Laser Flip over the gap · Switch Tre Flip to Nose Manual on the manual pad · Switch BS Bigflip over the gap · Fakie Tre Flip FS Boardslide on the handrail

## 6. Quarterpipe-only samples (200 picks each)

| Level | Distinct | Flip-air share | Examples |
|---|---|---|---|
| 1 | 4 | 0% | Tail Stall · Rock to Fakie · FS/BS Axle Stall |
| 3 | 23 | 33.5% | FS 50-50 (coping) · BS 5-0 Stall · Nosepick · Rock and Roll · Kickflip Fakie |
| 5 | 40 | 21% | FS Feeble Grind · BS Feeble Stall · BS Smith Stall · FS Disaster · Switch BS 50-50 |
| 7 | 38 | 3.5% | BS Noseblunt Stall · Switch FS Feeble Grind · Switch BS Blunt to Fakie · Switch FS Disaster |

## 7. Rarity estimates (share of 3,000 seeded picks, all obstacles)

| Setting | Rare | Very rare | Experimental | Doubles | Triples | Exits | Reverts |
|---|---|---|---|---|---|---|---|
| Very low (default), L5 | 3.0% | 0% | 0% | 0% | 0% | 6.3% | 3.0% |
| Very low, L8 | 3.2% | 0.2% | 0% | 0.4% | 0% | 6.6% | 0% |
| Very low, L10 | 3.0% | 0.6% | 0% | 0% | 0% | 10.7% | 0% |
| Off, L8 | 0% | 0% | 0% | 0% | 0% | ~6% (uncommon tier) | 0% |
| Low, L8 | ~7.5% | ~1% | 0% | ~1% | 0% | | |
| Normal, L8 | ~15% | ~1.3% | ~1.7% | ~1.6% | 0% | | |
| Normal + triples + transfers, L10 | 15% | 2.8% | 0.7% | 0.5% | 0.9% | | |

Transfers sit around level 5–6 in rating, so they appear when the player is near that level and transfers are on (verified in `vocab.test.ts`). They are 0% at L10 by design.

## 8. Runtime cost

**Zero network calls, zero AI.** This is test-enforced, with no fetch/XHR/WebSocket/API keys in app code. The catalog is built once per page load: about 85 ms in Node, likely 100–300 ms on a phone (not measured on device). Each pick takes about 0.6 ms. The bundle is +8 kB gzip vs v1. No new dependencies.

## 9. Screens (output/smoke/)

- `12-setup-mobile.png`: Setup on a phone. Obstacles with All/None and counts, ✓ chips, Variations panel.
- `14-setup-desktop.png`: two-column Setup. Sticky side column (obstacles, stances, variations) plus a family grid; each family is a bordered section with a heading, an "N of M on · X at your level" line, a description and a switch, with smaller check-marked trick chips and an Advanced & rare disclosure.
- `13-home-desktop.png`: Home in two columns (mode/level | setup/start).
- `15-play-desktop.png`: Play kept as a focused 600 px column.
- `03-landed-tunnel.png`: the landing tunnel is unchanged, with the new subtle "Felt too easy / too hard" line.
- `16-debug-hotstreak.png`: Level details showing session skill, temp boost, long-term level and rarity roll.

## 10. Known defects and limits (observed, not guessed)

- **The quarterpipe vocabulary tops out around level 7.5.** At L8+, quarterpipe-only sessions get fewer distinct tricks (≥5 in tests vs ≥6 lower down), because flip-ins to stalls are deferred.
- **The "Spins" family share is about 1%** in the balance stats. It only counts ollie-based spins (FS 180, Half Cab, BS 360). Body rotations on flips (FS Flip, Bigflip…) count as Flips. Spin frequency overall still follows the spec profile (8/28/50% of picks where spin candidates exist).
- **L10 is about 80% grinds/slides with default obstacles.** The highest-rated vocabulary is flip-in grinds on rails and ledges; flips top out around 8.7–9. This is not a variety bug (picks are diverse), but it is skewed. Playtest whether L10 needs more flip-only challenges.
- **v1 in-progress sessions** (schema 1) are not resumable after the upgrade. They are backed up under a `:corrupt:` key and the app starts clean. v1 history still counts for learning: completed v1 sessions replay with their stored ratings.
- **Long-term learning now only counts completed sessions.** Any v1 adaptation from ended-early sessions is dropped. That's by design, but your shown level may differ from v1.
- **Not done:** real-device testing, iOS Safari, measured on-phone catalog build time.

## 11. Open questions for the playtest

1. Do the conventional names read right to you? In particular "BS Pop Shuvit to FS 5-0" for shuvit-ins, "Kickflip Fakie" on the quarterpipe, and `Fakie BS 180` (deliberately not "BS Half Cab").
2. Is Very low the right default rarity? It means roughly 1 rare trick per 30.
3. Is the temporary boost (+0.25 per first-try land after 3 in a row, max +0.75) noticeable but fair?
4. Should Disaster Revert be rare (as now) or ordinary? It's a classic lip trick.
5. Should flip-outs (uncommon, about 6–10% at L5–10) be more or less common?
