# Acceptance / playtest plan

All must be verified in the **new implemented code** before calling v1 playable. Tests here are requirements/fixtures, **not yet passing tests**.

## 1. Quick session smoke (real browser, phone viewport)

- Open standalone site locally; no paid API key required.
- Set fingerboard level 4, allow flat+ledge+flatbar, select core categories; settings persist.
- Start SKATE; see actual named legal trick and attempt 1/3. Land first -> points shown + total; cannot double award; must tap **Next** to advance.
- Miss attempt 1 -> attempt 2; miss attempt 2 -> attempt 3; miss attempt 3 -> 1 SKATE letter and result state; **Next** generates new trick.
- Continue five failed challenges -> session_over, correct letters/high score/history. No extra trick after final letter.
- Skip -> visible result, tunable penalty, no auto-next, no surprise letter.
- Start Solo 10 -> exactly 10 resolved challenges; count skip and three misses; show completion summary. Repeat lengths 25 and 50; don't silently end at 30.
- Interrupt mid-attempt, reload, resume with identical current trick, selected filters, attempt number, score, letters, streak and history.
- Ending a session manually works and produces a distinct result status.
- Expand landed score and reconcile total with component formula.
- Confirm no `window.alert` workflow blocking every common action and controls remain thumb reachable at small mobile widths.

## 2. Hard rules / property tests

- No manual on handrail. No flip->manual on plain flat. Flip->manual allowed when selected on manual pad.
- Flip->grind **is possible** on valid ledge/rail/flatbar/hubba/handrail at appropriate levels with both families enabled.
- Switch off spins -> 0 generated spins over large seeded sample. Switch off flips/grinds/manuals -> none from disabled families.
- All emitted generated tricks pass the same `validateTrick` function; no empty/nonsense `on rail` fallback.
- Full 12 obstacles can initialize from defaults after config load. Narrow to only a valid obstacle and verify filters remain applied.
- Darkslide only >=8 when introduced, no-complies >=6 if included, late flips >=7, no 540+ spins, no primo slide on handrail.
- Direction scoring: BS smith more than FS smith, FS feeble more than BS feeble, FS crook more than BS crook per historical weights; compare holding other parts equal.
- 1000+ seeded tricks at varied levels must stay legal, selected, non-empty. Log distributions, allowed families, impossible fallbacks, repeat rates.
- No exact repeated prompt back-to-back unless filter pool exhausted and there is an explicit recovery/consent flow.
- All manual level choices 1–10 work. Typical successful sequences move effective level up gradually; misses move it down gradually; single lucky land cannot jump multiple levels. Max range [1,10].
- Reproducible deterministic run with injected seed, including logged effective level and scores.

## 3. Scoring checks

- Kickflip on flat regular, no flow/repeats: 1st = 130; 2nd = 111; 3rd = 98 (current config).
- Each challenge awards at most once; third failure awards no points and one letter in SKATE.
- Flow bonus grows in +3% steps, capped at +15%; miss/skip reset behavior documented and tested.
- Skip penalty default is provisional; developer panel changes it without changing algorithm source; score never becomes negative if floor configured.
- Repeat handling is fair under system-assigned prompts; debug trace explains any penalty applied.
- Save/restore does not change historical receipts or double-add score.

## 4. Browser and packaging

- Run JavaScript syntax checks, unit tests, core integration tests and mobile browser smoke.
- Run offline test if PWA enabled; verify up-to-date files after code changes and no service-worker stale bundle.
- Confirm all 12 obstacle types, all 4 families available where legal; no freestyle family in initial UI.
- Clear instructions in root README: install, run, test, build; list versions. Do not claim completed milestones without screenshots/test outputs.

## 5. Manual playtest questions after milestone

1. Do tricks genuinely feel matched to my level?
2. Does difficulty ramp feel *very gradual* in both directions?
3. Do I want to press Next after the result?
4. Did I see any physically strange prompt or unfair repeat?
5. Did score and skip feel appropriately rewarding/punishing?

Log answers separately and change only one tuning variable per test round when possible.
