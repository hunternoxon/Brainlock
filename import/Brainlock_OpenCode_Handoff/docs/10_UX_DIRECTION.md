# Minimal UX direction — make the game feel as fun as chat did

The favorite historical version was played directly inside ChatGPT. The user switched to a UI mainly because of **rate limits**, but now explicitly says a standalone site is desirable and **chatting is not the important component if the UI is right**. Do not re-create an LLM conversation window.

## One screen / one challenge

- Prominent, legible trick phrase and obstacle context.
- Clearly visible attempt number (1 of 3), target/starting difficulty, session score, streak, and SKATE letters or Solo progress.
- Primary actions in reach: **LAND**, **MISS**, **SKIP** (skip less prominent, but accessible).
- After resolving: transient but **persistent until Next is tapped** result area with `+points` or failure/skip state; full breakdown optional; one obvious **NEXT** action.
- After game over: total score, high score difference, compact session recap, new session.
- Optional subtle character/alien personality in microcopy, not constant jokes, not large auto-generated artwork.

## Experience principles

- Clear vs clever; authentic fingerboard terminology; low reading burden.
- No nested settings trays during moment-to-moment play. Save available obstacle presets and let user modify before starting.
- Accessibility: >=44x44 hit targets; contrast; keyboard/focus; no important information conveyed by color alone.
- Avoid forced animations, modal interruptions, aggressive sounds, or surprises between attempts.
- UI should render from a pure session state machine; don't award points in click handlers unrelated to that state.
- Use helpful response copy like `Landed on attempt 2 · +111` or `Three misses · S earned`, but **never auto-advance** after resolving a trick.

## What not to build in the first pass

A chat UI, social feed, profiles, giant dashboard, generated mascots, elaborate animation, monetization, AI prompts per action, or a second scoring engine. The product is a game.
