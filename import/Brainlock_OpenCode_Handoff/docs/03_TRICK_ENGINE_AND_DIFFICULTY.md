# Trick intelligence and adaptive difficulty

## Canonical model for first playable version

Use the **procedural, structured JS model** in `legacy/v4.5.2/trick_model.js` + `model-config.json` as the starting foundation, repaired/tested. The written Aug 13 deep spec provides the rule intent. The 35,741 CSV/JSONL names and `trickgen_from_dataset.py` are alternate/reference material, **not automatically valid or importable into the runtime**.

Historical event object from deep spec:

```json
{"obstacle":"ledge","stance":"switch","spin":null,"flip":"kickflip","grind":"crooked","direction":"FS","manual":null,"pattern":"flip→grind"}
```

Recommended enrichments: `id`, `generationSeed`, `difficultyRaw`, `difficultyLevel`, `source`, `legalityStatus`, `tags`, `signature`, `createdAt`. Preserve stable event components; format the display string at presentation layer.

## Selection algorithm

1. Load and validate canonical config; initialize user enabled obstacles/stances/families/subtypes **after config is available**.
2. Build valid obstacle + legal-pattern + available-component candidates that respect selected filters and level gating.
3. Exclude mechanically impossible results *before* random selection. Each emitted trick should be checkable with `validateTrick`.
4. Compute rating of each valid candidate, including stance, directions, spins, combo and obstacle context. Use true candidate difficulty for adaptive targeting; **scoring points need not equal skill rating**.
5. Bias picks to the effective player target, with small predictable stretch and recovery. Vary trick family/obstacle/direction/stance, avoid forced exact repeats. When no valid pool, give understandable repair options; never silently return invalid fallback.
6. At resolution, update performance history / effective target, log why the target changed, and continue only when the user presses Next.
7. Use a deterministic injected RNG seed for tests and replayable bug reports; not `Math.random()` hidden in every function.

## Original 12 obstacles and categories

`flat`, `manual pad`, `box`, `curb`, `bank`, `ledge`, `hubba`, `flatbar`, `rail`, `handrail`, `gap`, `quarterpipe`.

Main initial families: flips, grinds/slides, manuals, spins. No freestyle, large air/stall taxonomy, or public trick editor for v1.

## Legality that must be preserved

- Manuals: manual pad/box/curb/bank where valid; **not handrails**. Flip -> manual only on manual pad, not plain flat.
- On rail/handrail, properly filtered flip -> grind combos should be generated when enabled and gated. Darkslide only level >=8; no primo slide on a handrail. Advanced blunt/noseblunt options must be level-gated.
- 180/360 rotations can occur on any surface as allowed by trick pattern; no 540+ in fingerboard mode.
- Level gates documented: pressure flips >=5, no-comply >=6, late flips >=7, primo >=7, darkslides >=8; rare hospital/triple/impossible-late >=9, if those classes are introduced at all. **Do not implement excluded families simply to satisfy the gates**.
- Preserve FS/BS nuance: smith FS x1.10 / BS x1.20; feeble FS x1.15 / BS x1.05; crooked FS x1.12 / BS x1.06; overcrook FS x1.18 / BS x1.25; historical directional multipliers apply to grind portion only. These are original *difficulty/scoring weights*, not standalone legality.
- An experimental trick may be allowed only through an explicit **opt-in experimental lane**, never because generator failed validation; normal default favors skate realism.

## Key recovered defect to fix

v4.5.2 configuration sets `flip.allowed_obstacles` mainly to flat/bank/gap/manual pad/quarterpipe, while flip->grind patterns are defined on ledge/rail/handrail/hubba/flatbar. This intersection is empty, making requested combinations unproducible. Repair pattern-specific legality; a flip as a stand-alone obstacle challenge and a flip as **entry to a grind** are different contexts.

Other source defects include `pickSpin()` ignoring whether spins family is enabled, fallback tricks bypassing legality checks, and default obstacles being initialized before config is loaded. See audit.

## Difficulty adaptation proposal (provisional, not user-set numbers)

Start with a target `effectiveSkill` anchored to user 1–10 selection. After each resolved challenge, update an evidence trend using first/second/third try land vs failed vs skipped (skip carries little/no skill evidence). Apply bounded change per challenge, e.g. <=0.25 display-level units with smoothing, and cap the generated trick band near `effectiveSkill`. Use 6–10 recent outcomes as a warm-up window to prevent one-lucky-land jumps. Rise and fall must both happen. Make all coefficients debug-tunable and save them only for developer testing until playtested.

Never use mere points scored as the only adaptation signal; it can reward difficulty/combos rather than demonstrate mastery.

## Variation fairness

Avoid exact recent prompt repeats for a reasonable cooldown. A modified obstacle/stance/spin is an intentional remix when the rating/meaning changes, but don't force many near-identical tasks. Penalty should not blindly punish repeat prompts assigned by the engine; prefer generator-side de-duplication, and log clearly when a deliberate remix is offered. Test repeat edge cases for narrow filter sets and provide a fair fallback (e.g. ask to widen filters, or explicitly allow a variation).
