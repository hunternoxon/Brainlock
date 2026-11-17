# Source audit: what actually exists (and what doesn't)

**Audited artifacts:** two DOCX specs, `index.zip`, `brainlock-pwa-v4-5-2.zip`, `goskateboard_tricks_extracted.csv`, `.jsonl`, and `trickgen_from_dataset.py`. All are preserved unchanged under `source-archive/`.

## High-confidence findings from the sources

### 2025-08-13 deep spec
- Six-page document, "Brainlock Skateboard Game – Deep Feature Spec & Trick System Model", timestamp `Spec 2025-08-13 01:50`.
- Describes 3 attempts, SKATE letter at 3 misses, 5-letter end, 12 obstacles, 1–10 levels, category/stance selection, directional difficulty, detailed scoring formula, and a selector algorithm.
- Contains **a summary of 90 past design answers**, not the verbatim 90 Q/A responses.
- Source includes historical UI and roadmap ideas; these are **not automatically first-release requirements**.

### "Game Overview & Rules" DOCX
- One page. Distinguishes SKATE (five fails) from Solo (set number of challenges); gives simple skill-based challenge narrative, Land/Miss/Skip, high score, avoidance of back-to-back exact repeats.

### `index.zip` (four-file mini demo)
- Contents: `index.html`, `styles.css`, `app.js`, `data/brainlock_dataset.json`.
- Tiny embedded dataset with 10 sample tricks; not the full generation model. Its source uses the gentler attempt multipliers `1.00 / 0.94 / 0.92`, **superseded by user decision to use `1.00 / 0.85 / 0.75`**.
- Keep for contrast and possible UI inspiration, not core logic authority.

### `brainlock-pwa-v4-5-2.zip` (11 files)
- Includes model config, procedural trick generator/scorer (`trick_model.js`), UI/game orchestration (`app.js`), NL parser/scorer (`nl_engine.js`, `nl-tables.json`), HTML, PWA manifest/SW, placeholder-like icons.
- `model-config.json` has all 12 obstacle categories and 4 primary families; attempt, combo, directional, stance, flow and repeat weights.
- Contains intended SKATE/Solo controls and score-breakdown UI. **It is not production-ready or necessarily playable as uploaded.**

#### Confirmed issues visible in the v4.5.2 source

1. **Syntax error:** `trick_model.js` contains `Object.keys(this.cfg?.obstacles||{"flat":{});`, missing a closing `}` before `)`. Test JS module syntax before running. Keep original intact in legacy directory; fix in new working source.
2. **Initialization race:** `new BrainlockModel()` starts asynchronous config loading, then `reset()` immediately initializes selections from fallback `flat`; `ensureSetsInitialized()` won't add the newly loaded obstacle options because the Set is non-empty. UI render also happens before ready. Load config before initializing options and mounting UI.
3. **Broken flip->grind generation:** flip subtype allowed_obstacles exclude ledge/rail/flatbar/hubba/handrail while `flip→grind` is only patterned on those. Treat entry flip separately from platform obstacle legality.
4. **Disabled-spin defect:** `pickSpin()` does not test `famOn('spins')`, so disabling the family does not fully disable spin generation.
5. **Unchecked fallback:** `selectTrick()` falls back to an arbitrary first selected component without re-validating obstacle/pattern legality. Replace with typed empty-candidate result + actionable UI recovery.
6. **No generation-time repeat filter:** there is a `repeatMap` for scoring but selection never actually avoids exact repeated prompts.
7. **End button handler:** `endBtnModule` is selected and toggled but `bind()` never registers its click handler.
8. **Solo length mismatch:** v4.5.2 offers a continuous slider 5–30. User requires exactly 10/25/50 choices.
9. **Skip:** legacy `skip()` resets flow and immediately calls `next()`, with no skip score penalty or result screen. User wants penalty and explicit Next.
10. **Adaptive difficulty absent:** `state.level` is manually selected; outcomes don't gradually update it up/down.
11. **Session persistence incomplete:** options/high scores saved, but active challenge, streak, letters and attempt history are not fully restored after reload.
12. **Potential scoring model confusion:** source supports both spec and NL scoring but these models differ. For v1 choose spec scoring as sole authoritative runtime scorer; preserve isolated NL parser for future flag.

These are **static source inspection observations** and prior limited generator checks, not a completed end-to-end browser test. Do not represent the legacy app as verified playable.

### 35,741-name dataset and Python generator
- CSV fields: `trick_name`, `type_variables`, `stance_variables`, `level_variables`; JSONL has matching entries. 35,741 distinct names, five tier values; heavily weighted to `Sponsd`/`Pro` and `Grind|Combo` tags.
- **Not 35,741 verified physically legal fingerboard tricks.** Do not load wholesale to production or assume their level labels map accurately onto 1–10.
- Python `trickgen_from_dataset.py` constructs filtered session lists, using five tier caps, obstacle-tag mapping, mild pacing biases, seeded RNG and per-session name de-duplication. It **does not** implement Land/Miss, SKATE letters, or rich component-based scoring.
- In the script, default flags allow freestyle, airs and stalls; these defaults contradict 2026 v1 scope and must not be inherited.

## Sources conflict: obey explicit user decisions

- 2025 mini demo attempt weights 1/.94/.92 vs spec+v4.5.2 1/.85/.75 -> choose **1/.85/.75**.
- Historical spec says repeat penalty by signature, but 2026 answer demands **generator-side fairness**, since user has no trick selection; don't enable unfair passive penalties.
- 2025 PWA model initialized only flat; user requested all 12 obstacles and saved preferences.
- 2025 UI has full NL Stack Builder; user says low priority / flag only now.
- Chat was fun, but **a chat UI is explicitly not the goal**; user wants a standalone site with good tap controls.
- Do not confuse the full-size skateboard terminology in old spec title with final fingerboard-only product choice.
