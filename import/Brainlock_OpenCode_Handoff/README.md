# BRAINLOCK / OPENCode HANDOFF

**Status:** Ready to begin an implementation-and-playtest cycle, **not** a verified finished game.  
**Prepared:** 2026-11-16.  
**Platform:** fingerboarding, mobile-first standalone site / installable PWA, offline-first.  
**Primary value:** challenges that credibly match the player's ability and gradually push it, so a session remains fun.

## Start here in VS Code / OpenCode

1. Unzip the package to a permanent local project directory, e.g. `~/Projects/brainlock`.
2. Open the **unpacked folder** in VS Code: `code ~/Projects/brainlock`.
3. Open a terminal in that folder and launch `opencode` (assuming already configured).
4. Open `prompts/01_OPENCODE_MASTER_PROMPT.md`. Paste the prompt **into OpenCode**, referring it to local files in this repository. Do not just paste the docs into ChatGPT.
5. Keep the first milestone focused: a complete, playable **SKATE** and **Solo (10/25/50)** session, with reliable trick legality and sensible difficulty. Work locally first; commit to your own repo when it runs.

Optional source audit (requires Python 3):

```bash
python3 tools/audit_sources.py
```

The legacy app **is not known to run as shipped**. Its `trick_model.js` has a syntax error. Do not use `file://` or assume it is production-ready. The earliest OpenCode step is to establish a tested working baseline, not deploy this archive unchanged.

## Repository map

- `AGENTS.md`: standing directions for the coding agent.
- `prompts/01_OPENCODE_MASTER_PROMPT.md`: first full OpenCode instruction. Read/submit this first.
- `prompts/02_ITERATION_PROMPT.md`: follow-up after the first local session.
- `docs/01_DECISION_RECORD.md`: all 33 decisions, current source of truth.
- `docs/02_GAMEPLAY_CONTRACT.md`: states, modes, attempt lifecycle, persistence and UI.
- `docs/03_TRICK_ENGINE_AND_DIFFICULTY.md`: legal generation, adaptive pacing, data-source hierarchy.
- `docs/04_SCORING_AND_FLAGS.md`: scoring formula, knobs, contested details.
- `docs/05_SOURCE_AUDIT.md`: differences across the recovered implementations and concrete issues.
- `docs/06_ACCEPTANCE_AND_PLAYTEST.md`: test checklist including source-derived cases.
- `docs/07_IMPLEMENTATION_PLAN.md`: milestones, boundaries and stop conditions.
- `docs/08_ASSUMPTIONS_AND_OPEN_ITEMS.md`: specifically *not* fully decided; low-cost defaults.
- `docs/09_DATASET_PROFILE.md`: inspected data sizes and distribution.
- `docs/10_UX_DIRECTION.md`: preserve the chat game's pacing without recreating a chat UI.
- `tests/acceptance_cases.json`: machine-readable starter QA cases, **not a passing automated suite**.
- `source-archive/`: exact seven user uploads unchanged. Archive first, do not mutate.
- `legacy/`: unpacked copies of the two old ZIP implementations. Preserve until new tests prove equivalent behavior.
- `tools/audit_sources.py`: archive/data consistency script; does not test playability.

## What is authoritative?

1. The user's **33 answers** recorded in `docs/01_DECISION_RECORD.md`, including final choices 31-33.
2. `source-archive/brainlock_trick_system_deep_spec.docx` (Aug 13, 2025) for detailed historical trick/scoring rules; some choices superseded by 2026 answers.
3. `source-archive/Brainlock_Overview_Rules.docx` for high-level original game and session idea.
4. v4.5.2 JavaScript/model config as **reference implementation**, not guaranteed correct.
5. Dataset/CSV/JSONL/Python generator as **optional reference and future curation input**, not an authoritative runtime feed.

If sources conflict, **do not silently merge them**; follow this precedence and log the decision.

## Scope and cost guardrails

First version: deterministic local runtime, no paid AI requests, no login, no external database, no payments, no public leaderboards. Stack Builder only behind a disabled feature flag, with reusable parsing structures if inexpensive. Avoid service-worker caching headaches during development. Optimize for **playing** a session, not building a platform.

## Files are originals

Original uploads are copied without edits. The expanded legacy folders are convenience copies. The package is a **handoff**; this ZIP does not claim to contain a repaired, completed game.
