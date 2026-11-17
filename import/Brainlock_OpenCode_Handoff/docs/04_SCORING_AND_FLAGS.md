# Scoring contract and developer controls

## Reference formula (deep spec Aug 13 and v4.5.2 model)

`points = round( SCALE * BaseSum * ComboMult * AttemptMult * FlowMult * RepeatMult )` where SCALE = 100.

`BaseSum = 1.0 + stance + spin + flip + (grind_base * FS/BS directional multiplier) + manual + obstacle_add`.

- Attempts (2026 decision): **1st x1.00, 2nd x0.85, 3rd x0.75**.
- Flow: **+3% per consecutive landed challenge**, maximum **+15%**. The Aug spec says miss/skip resets flow. Define exactly whether each failed *attempt* resets it and write tests; currently this remains a provisional interpretation (recommend any missed attempt breaks a perfect-landing streak).
- Repeat: historical spec says -10% per repeat after 3rd execution of same signature (different obstacle still counts as same signature; different stance/opposite spin not). **Superseded in intent by fairness-first 2026 repeat decision**. Prevent unwanted repeats upstream; test repeat-penalty trigger separately before enabling it.
- Obstacle and individual trick values live in `legacy/v4.5.2/model-config.json`; **preserve exact weights as baseline** where spec agrees, and log changes.
- Combo multiplier source values: flip->grind x1.25, spin+flip x1.30, spin->grind x1.15, manual+(flip|spin) x1.10, gap+spin+flip x1.10. Multiple applicable bonuses historically multiply; keep traceable.
- Show **total earned** in normal gameplay. Expanded breakdown contains each component and exact multiplier, preserving the scoring formula.
- Use JS rounding behavior in tests (positive values; `Math.round`). Do not conflate a displayed level 1–10 with a simple `level*100` score.

## Reference checks from v4.5.2 config

With no streak, no repeat penalty, regular stance, flat obstacle, no spin/combo:

| Challenge | Attempt | Expected result | Explanation |
|---|---:|---:|---|
| Kickflip on flat | 1 | 130 | `(1 + 0.30)*100` |
| Kickflip on flat | 2 | 111 | `round(130*0.85)` using JS rounding |
| Kickflip on flat | 3 | 98 | `round(130*0.75)` |

These cases are based on source weights, not a verdict that 130 is the ideal playtest value. Use golden fixture tests as guardrails until developer tuning deliberately changes values.

## Skip policy (intentionally not fully calibrated)

The user explicitly chose **a score penalty and a developer/admin feature flag**. They have **not** chosen a penalty magnitude or whether skip should count as a SKATE letter.

For the first playable build, use an editable conservative provisional default, e.g. **-50 points**, floor score at 0, no SKATE letter, break streak, log action; **label this a playtest default, not a final rule**. Feature flag `skipPenaltyEnabled` and number `skipPenaltyPoints`; allow admin-only tuning. Do not hide this assumption.

## Debug / admin feature flags

- `devPanelEnabled`: hidden local-only debug page, no user login/auth needed for local prototype. Production guard required before shipping. Can inspect current seed/trick/legality/skill target/pacing decisions.
- `skipPenaltyEnabled`, `skipPenaltyPoints`: tune without rewriting scoring code.
- `repeatPenaltyEnabled`, `repeatCooldown`, `fairnessMode`: default safe, inspect exact repeats and generator responsibility.
- `adaptiveDifficultyEnabled`, `adaptationWindow`, `adaptationStepLimit`, `difficultyBand`: tune and record observed outcomes. User wants both manual start and gradual up/down.
- `nlStackBuilderEnabled`: **false**; early parser interface can be isolated without shipping UI.
- `runtimeAiEnabled`: **false**, and no API key/config by default. Never send requests or incur cost without explicit future approval.

## Debug data / transparency

Store per-challenge immutable score receipts (`baseParts`, `comboM`, `attemptM`, `flowM`, `repeatM`, `skipDelta`, `total`, `formulaVersion`). Admin panel should allow replaying seed / forcing outcomes for deterministic QA, exporting sanitized JSON session traces, and resetting local test scores.
