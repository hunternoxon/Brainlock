# Instructions for OpenCode agents working on Brainlock

READ `README.md`, `docs/01_DECISION_RECORD.md`, `docs/02_GAMEPLAY_CONTRACT.md`, `docs/03_TRICK_ENGINE_AND_DIFFICULTY.md`, `docs/04_SCORING_AND_FLAGS.md`, `docs/05_SOURCE_AUDIT.md`, and `docs/06_ACCEPTANCE_AND_PLAYTEST.md` BEFORE editing.

- Do not casually discard the original logic. Preserve `source-archive/` and `legacy/` unchanged as historical reference. New code may live in `src/`, `public/`, `tests/`, and build configs.
- Start by identifying live code vs intended spec; isolate model/generator, session reducer/state machine, scorer and UI.
- Shipping bar: full playable SKATE and Solo 10/25/50, 3 attempts, full feedback/Next transition, believable obstacle-filtered and level-matched tricks, adaptive difficulty up/down slowly, saved/resumable session, transparent full score breakdown, no runtime AI needed.
- Keep a concise `output/WORK_LOG.md` with findings, code changes, testing results, any assumptions made, unresolved issues, and exact local run commands. Do not claim tests passed unless run.
- Prefer a small, testable stack over large framework migration. Determine actual need before adding dependencies. Offline-first; no paid API requests by default.
- Do not silently produce invalid fallback tricks; show explicit empty-filter guidance and recovery.
- Avoid sweeping visual redesign or unrelated features. Mobile one-thumb play is the primary workflow; UI should expose Land, Miss, Skip (with penalty) and Next at appropriate states.
- No paid AI model calls inside the app unless user separately approves a specific cost and budget.
- Source specs sometimes disagree. `docs/08_ASSUMPTIONS_AND_OPEN_ITEMS.md` describes unresolved details, so implement explicitly provisional configurable values and log them.
- Do not allow the generator to emit disabled trick families, impossible obstacle/trick combinations, or accidental exact immediate repeats.
- Keep all original files available for future comparison and regression testing.
