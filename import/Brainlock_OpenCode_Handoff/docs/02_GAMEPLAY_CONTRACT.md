# Gameplay contract and session lifecycle

## Modes

- **SKATE:** generate one valid fingerboard trick at a time. Three misses across the *same challenge* award one letter. Session ends after S-K-A-T-E (five failed challenges). Successful land awards points and advances only after Next.
- **Solo:** same attempts/generation/scoring but exactly **10, 25, or 50 resolved challenges** (landed, failed after three misses, or skipped). Session ends after N completed challenges. Solo does not use SKATE as its end condition; tracked misses can still appear in session summary.
- Both modes start at selectable level 1–10, available obstacles, stances, trick categories and sub-options. Config persists across sessions.

## State machine (no surprise transitions)

`idle -> showing_trick -> (miss on attempt 1 or 2 -> showing_trick) -> result_landed/result_failed/result_skipped -> (Next) -> showing_trick or session_over`.

If the 3rd miss earns the fifth SKATE letter, enter `session_over` and show that final result; do not require Next to finish. Do not allow duplicate tap events to award points/letters twice. UI must reflect one authoritative game state.

For every challenge, persist: unique ID, actual generated components, obstacle, starting/effective level, intended difficulty, exact display string, attempt number 1–3, attempt outcomes, scoring components, result, repeat/retry metadata, timestamp.

### Inputs

- **Land:** resolves current challenge, applies score based on correct attempt multiplier. Show result, amount earned, total, and **Next** button. Optionally expand full breakdown.
- **Miss:** if attempts 1 or 2, advance attempt counter and update miss feedback. If attempt 3, resolve failed challenge and in SKATE add one letter; show result and Next unless game over.
- **Skip:** intentionally ends challenge, applies a **configurable signed score penalty** (to calibrate); clear streak, record reason `skipped`, and show result / Next. Skip does not automatically award a SKATE letter without a separate design decision.
- **Next:** only works in a result state, never as a means of scoring or missing. Create next valid challenge, or end Solo after N completed.
- **End session:** accessible deliberately (confirmation recommended) and must actually work. Save ended/interrupted state and history. Do not confuse manually ended sessions with a SKATE loss or Solo completion.

## Adaptive skill (separate from visible starting skill)

- Player picks a 1–10 starting level.
- Engine maintains a persisted **effective challenge target** that changes gradually with the outcomes (in either direction). Avoid sudden jumps after a single land or miss; consider recent trend, attempt count, skip rate and current difficulty vs expected difficulty.
- Do not immediately upshift after an easy prompt; a third-attempt land should generally be weaker evidence of mastery than first-attempt land.
- Permit easy/medium/stretch mix within a bounded difficulty band, not wild swings. Show a simple level indicator with optional debug detail; manual change resets or explicitly re-anchors the adaptive target.
- Adaptation must not modify previously awarded score and must never force invalid tricks just to hit a target.
- See `docs/08_ASSUMPTIONS_AND_OPEN_ITEMS.md`: exact adaptation coefficients are provisional and should be tunable in developer tooling.

## Session persistence

- Persist settings, high scores, history, and full in-progress session snapshot to local storage (or IndexedDB if justified). Schema-version the storage; use atomic/validated restoration and a recovery option for corrupt data.
- On reload, offer **Resume session / Start over**. Preserve current trick, attempt, misses, scores, letters, streak, level adaptation, session length, RNG/repeat state where possible.
- Distinguish a completed score from an abandoned/interrupted run in the high-score list. Store high scores sorted, with per-run metadata and optional nickname later.
- Offline-first; deterministic core doesn't require internet. Service-worker caching should be disabled in local iteration or versioned correctly to prevent stale build confusion.

## Presentation invariants

- Mobile first; thumb-friendly controls >=44px. Clear trick, attempt 1/3 etc, score, SKATE letters (when applicable), remaining Solo count, active effective skill.
- During a challenge: Land / Miss / Skip. On resolution: hide those buttons and show **Next**; display a short human-readable result. On game over: show summary and New Session.
- On successful land: default display is **points earned + total**, expandable breakdown with base parts, stance, direction, obstacle, combo, attempt, flow, repeat/skip modifiers.
- Keep full options available but out of gameplay view. Settings behind a compact menu. No conversational typing or real-time AI required.
