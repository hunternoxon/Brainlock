# Staged implementation plan — make it playable, then tune

## Stage 0 — Source triage & baseline (before UI redesign)

- Audit archives; record exactly which code is running, which is historical, and what cannot be reused.
- Fix v4.5.2 parse failure in working copies and assert load/config initialization order; don't mutate archived original.
- Establish repeatable local dev server and unit test runner. Ensure deterministic RNG injection and reproducible seeds.
- Add static/config validation and initial golden scoring tests. Write `output/WORK_LOG.md`.

**Gate:** engine imports; config loads deterministically; basic source tests pass.

## Stage 1 — Pure functional game engine

- Repair/refactor generator, validator, scorer and state machine. Preserve config weights and source logic where possible.
- Implement both modes, 3 attempts, letters, landing receipts, result/Next transitions, fixed 10/25/50 Solo, skip penalty flag, scores, manual ending.
- Explicit empty-pool diagnostics; no invalid fallback tricks. Generator filters and trick IDs stable.
- Add local persistence + resume, session histories, high scores. Separate session state from presentation. Debug trace.

**Gate:** full SKATE and Solo session can complete with seeded tests even without attractive UI.

## Stage 2 — Skill matching (core fun)

- Implement slow bidirectional adaptation grounded in attempts/fails and recent outcomes. Inject and tune constants in dev panel.
- Weighted difficulty target, variety fairness and repeat avoidance. Test legal generate distributions by skill/obstacle/family.
- Optional manual re-anchor and bounded recovery when a filter pool is too narrow.

**Gate:** player can use level 1–10 and see plausible, traceable gentle adaptation in both directions. No impossible tricks or silent fallback.

## Stage 3 — Clean mobile UI

- One-thumb mobile-first site; player sees challenge, attempt, score, letters/counter and essential tap controls.
- After Land/final Miss/Skip show result and points; **Next** only advances after resolved outcome.
- Compact options, saved obstacle setup, high-score view, resume prompt, expand score breakdown. Casual voice, but minimal copy.
- Preserve brainlock identity (alien vibe) lightly, no time spent on branding redesign.

**Gate:** actual fingerboard session fun and usable on phone, including a game over and resume.

## Stage 4 — Confidence, offline, polish

- Run high-volume deterministic generation and score tests, full mobile browser QA, local persistence migration/recovery, offline behavior.
- Keep service worker disabled in development or cache correctly; PWA installability only after stable core.
- Developer panel for generation distributions, scoring multipliers, skip amount, repeat controls, adaptive parameters.

**Gate:** user plays several sessions and rates pacing/trick quality favorably.

## Explicit defer list

- AI-driven runtime conversations, server-side costs, accounts/auth, public leaderboards, community spots, bounties, 1v1, print/merch, social integrations, freestyle, giant air/stall taxonomy, and fully interactive natural-language Stack Builder UI.
- Keep Stack Builder parsing behind disabled flag and avoid costs. Historical NL code may be kept isolated pending tests; don't mix two scoring engines at launch.

## Cost discipline

Use Opus for architecture and engine work, smaller model later for UI polish. Ask agent to work through named stages and report changes/tests. Stop after Stage 0 + basic Stage 1 if major hidden defects surface, and explain tradeoffs before generating large unrelated UI changes. Do not ask for architecture essays when code/tests are possible.
