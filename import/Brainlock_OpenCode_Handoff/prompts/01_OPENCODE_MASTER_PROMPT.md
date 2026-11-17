# Paste everything below into OpenCode from the unpacked Brainlock project root

You are the lead engineering agent for **Brainlock**, a personal fingerboarding challenge game. This folder is a full handoff package of seven recovered original assets, expanded legacy source trees, a detailed historical rules spec, and 33 confirmed product decisions. Your objective is a *working local playable game*, not a speculative concept, an architecture essay, or a new brand campaign.

**Read before doing anything:** `AGENTS.md`, `README.md`, and every file in `docs/`, especially the decisions, game contract, engine, scoring, audit and acceptance plan. Inspect real code in `legacy/v4.5.2/` and `legacy/minimal-index/`; inspect original specs and dataset only where useful. Do not silently assume that legacy source is correct or runnable. Do not remove, overwrite, "clean up", or check in changes to any file in `source-archive/` or `legacy/`.

### North star

The original game was most enjoyable when it matched the player's actual fingerboard skill, challenged them fairly, and made them want to continue. Rebuild that experience on a standalone, mobile-first site with Land/Miss controls, without requiring an LLM or a chat UI. The old code is valuable because of its skateboarding knowledge; preserve that intelligence while replacing defective orchestration and presentation as needed.

### Required rules (do not quietly change)

- Fingerboard only, not real-size skateboard mode. Core families flips, grinds/slides, manuals, spins. No freestyle for v1.
- Two equal-priority modes: SKATE and Solo. SKATE: three attempts per challenge; three misses = one letter; five letters S-K-A-T-E ends run. Solo: choose exactly 10, 25, or 50 **resolved** challenges.
- User begins at manual level 1–10; hidden effective target adjusts **very gradually upward and downward** based on performance. Only legal combinations that fit enabled obstacles/families/stances and sensibly near level.
- All 12 obstacle choices; save defaults. Hybrid approach: procedural generation and source-validated logic first; raw 35,741 dataset remains reference-only until curated and tested.
- Fair variety, no accidental exact repeats; preserve nuanced directional/stance/obstacle rules from Aug 13 deep spec. No impossible fallbacks; explain empty candidate pools.
- Actions: Land / Miss / Skip. Land awards component-based points at attempts 1:1.00, 2:.85, 3:.75. Three misses ends challenge; Skip has dev-configurable provisional score penalty. +3% flow bonus per consecutive land capped at +15%. Exact repeat penalty semantics to tune fairly; prioritize not generating unwanted repeats.
- **After resolved Land, third Miss or Skip, show results and wait for Next.** No automatic next. First viewport should show concise points only, expandable full score receipt.
- Persist scores, settings, detailed history, and in-progress session including interrupted attempt; resume reliably on reload.
- Sound optional, modest alien/Brainlock personality, one-thumb mobile interface, not an AI chat window.
- Natural-language Stack Builder: keep parser/source as an isolated disabled feature-flag path. Runtime AI: **OFF** by default, no API calls, zero token cost per played challenge. No auth/payments/leaderboards.

### Your implementation phases (work, don't only plan)

**Phase A: Establish running baseline.** Examine and fix the obvious fatal parse error (`legacy/v4.5.2/trick_model.js` line `Object.keys(this.cfg?.obstacles||{"flat":{});`) in *new working source*. Make config loading deterministic before default selections and UI mount. Provide commands to run locally; set up minimal useful test suite and reproducible RNG. Record source differences in `output/WORK_LOG.md`.

**Phase B: Core engine & game state.** Port/repair the strong parts of the procedural generator, components/config, score formula and turn mechanics into clean testable modules (e.g. `src/engine/*`). Separate pure legality validator, selector, scorer, adaptivity model, reducer/state machine, persistence adapter and UI. Solve flip-to-grind allowed-obstacle mismatch by modeling entry flip context; enforce disabled-family toggles including spins. Remove invalid fallback and unsafe immediate repeats. Implement stable session event log and score receipts. Validate all 12 obstacles.

**Phase C: Adaptive skill.** Start with manual 1–10 anchor, use recent attempt outcomes (not score alone) for slowly changing target in both directions; choose bounded challenge difficulty band and sane mix. Make coefficients tunable in a local-only dev panel. Avoid rapid step changes or unfair spikes. Log effective target and reason per challenge in debug mode.

**Phase D: Minimal real UI.** Create a clean, responsive mobile interface, one prompt at a time, with true functional SKATE and Solo 10/25/50. Land/Miss/Skip/Next states must match docs. Include obvious settings, obstacle selections, high scores/history, expand score breakdown and resume previous session. Prioritize playability over visuals. Do not default to a complicated chat interface.

**Phase E: Browser QA.** Run source/syntax checks, logic unit tests, seeded generator tests, two full-mode integration tests, and actual browser smoke at phone width if tooling available. If browser automation is unavailable, state that honestly and include precise manual steps. When tests fail, fix the failures before expanding features. Report exact tests executed and pass/fail results.

### Minimum first-playable acceptance

1. Load locally without console errors or API keys.
2. Start one session in each mode, receive nonempty appropriate and physically plausible fingerboard prompts matched to filters/level.
3. Three attempt logic correct, score receipts and SKATE letters correct, results screen visible until Next, Solo lengths exactly 10/25/50.
4. Skip penalty tunable in hidden developer controls and never silently treated as a landing.
5. Automatic skill target can move a little up and down, with debug explanation. No disabled spins, manual on handrail, or impossible fallback.
6. Survive browser reload mid-session and resume; save scores/history.
7. Local-only dev setup and exact run instructions in `README.md`/`output/WORK_LOG.md`.

### Development behavior / cost discipline

Prefer a small dependency surface and retain strong existing algorithms; choose TypeScript or JavaScript based on best local testability, not fashion. You may rewrite the UI or orchestration, but avoid an unnecessary greenfield engine. Keep source archives immutable. Confirm existing asset provenance before using it. Avoid spending tokens on speculative future architecture and avoid expensive generated art or paid AI dependencies. If feasible, complete phases A–D and run tests in one cohesive pass. If blocked, deliver the greatest **working and tested** vertical slice plus a concise blocker report, never claim a game is complete if it isn't.

At the end, give a concise handoff: project folder structure, files changed, source features reused, known remaining gaps, exact commands `install/run/test`, and which acceptance cases pass. Record every provisional assumption (notably skip penalty magnitude and adaptation coefficients). Then pause implementation for a **real gameplay playtest**. Do not start Stack Builder, accounts, online multiplayer, payments, or social functionality.
