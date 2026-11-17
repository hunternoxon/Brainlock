# Trick Intelligence v2: decisions and precedence

Date: 2026-11-17. Applies on top of the v1 build (`git tag v1-first-playable`).

## Precedence

1. **The v2 expansion prompt (2026-11-17)** overrides anything below it where they conflict.
2. The 33 decisions in `import/…/docs/01_DECISION_RECORD.md`.
3. Aug 13 2025 deep spec (legality, gates, scoring formula, directional weights).
4. Legacy v4.5.2 `model-config.json`: kept **byte-identical** as `src/engine/data/legacy-model-config.json`. Its weights stay the baseline. Everything new is a separate, documented layer (`rules.ts`, `vocab.ts`).

Values marked *provisional* are playtest defaults, tunable in the dev panel. They are not user decisions.

## A. Canonical model (src/engine/types.ts, canonical.ts)

The four layers are kept separate:

| Layer | Where | Source of truth |
|---|---|---|
| Mechanics | `Trick` (stance, board move key, flip count, body spin, grind+direction, grind2, manual, lip+dir, exit(+dir), revert, transfer target) | Yes |
| Legality / difficulty / score | `validate.ts`, `difficulty.ts`, `score.ts` | Read components only |
| Display name / aliases | `canonical.ts` (`trickName`, `parseAirName`) | Derived; never parsed for scoring, legality or dedup |
| Identity | `trickSignature` (skill, obstacle excluded) and `trickKey` (challenge, obstacle included) | Derived from components |

- **Board move**: one key per unique mechanics (flip kind × shuvit rotation/direction × late). Tre Flip = kickflip + BS 360 shuvit; Laser = heelflip + FS 360; Hardflip = kickflip + FS 180; Inward = heelflip + BS 180; Varial = kickflip + BS 180 / heelflip + FS 180. Aliases (360 Flip, three flip, varial flip, shove-it…) map to the same key, so they share identity and score.
- **Body rotation** (`spin`) is separate from **board rotation** (shuvit in the board move). The v1 FS/BS spin capability is kept, with no new FS/BS toggles.
- **Ollie**: a valid standalone prompt (`flip: 'ollie'`, level 1). It is implied everywhere else and can never be an entry, so "Ollie FS 50-50" is structurally impossible.

## Naming conventions (derived)

- No "Regular" prefix. Fakie / Nollie / Switch are shown. FS/BS shorthand throughout. Title Case.
- Ollie + body 180/360 → `FS 180`, `BS 360`. Fakie + FS 180 → **Half Cab**; fakie + FS 360 → **Full Cab**.
- Kickflip/heelflip + body 180 → **FS Flip / BS Flip / FS Heelflip / BS Heelflip**; fakie + FS → **Half Cab Flip / Half Cab Heelflip**; + 360 → `FS 360 Kickflip` (rare) / **Full Cab Flip**.
- 360 shuvit + same-direction 180 body → **FS/BS Bigspin**. With the tre-flip motion → **BS Bigflip**. With the 360-hardflip motion → FS Bigflip. Heelflip variants → `Bigspin Heelflip`. 540 shuvit + 180 → **Biggerspin**; + 360 → **Gazelle**.
- **Conservative cases**: fakie **BS** 180 stays `Fakie BS 180`, not "BS half cab". Nollie/switch rotations are never called cabs. Uncertain assemblies keep the explicit form, e.g. `BS 180 Varial Kickflip`.
- Flip-ins: `Kickflip BS Smith Grind`. Shuvit-ins: `BS Pop Shuvit to FS 5-0`. Exits: `… Heelflip Out`, `… Shuvit Out`, `… FS 180 Out`, `… Pop Over`. Transitions: `FS 50-50 to 5-0`.
- Quarterpipe flips read `Kickflip Fakie` (lip flip back in fakie). Coping tricks read `… on the quarterpipe coping`.

## B. Vocabulary added (src/engine/vocab.ts)

| Area | Added | Gate / rarity (provisional) |
|---|---|---|
| Fundamentals | Ollie; FS/BS Pop Shuvit; FS/BS 360 Shuvit; FS/BS Flip & Heelflip; Half/Full Cab (+ flips); FS/BS Bigspin; Bigflip | Ollie/BS pop shuvit L1; FS pop L2; BS 360 L3; FS 360 L4; bigspin L5–6; bigflip L7 |
| Advanced flips | Impossible (L8, uncommon); Pressure Flip (L5, rare); Late Kickflip/Heelflip/BS/FS Shuvit (L7, rare); 360 Hardflip / 360 Inward Heelflip (L9, rare); 540 Shuvits (L9, rare); Biggerspin (L9, rare); Gazelle (L10, very rare) | the 540+ ban is for **body** spins only |
| Multi-flips | Doubles (kick/heel/varials/hardflip/inward/tre), **Double Flips** toggle, default on | L7+, rare |
| | Triples (kickflip/heelflip only), **Triple Flips** toggle, default **off** | L9+, very rare |
| Grinds | Salad, Willy (L6, uncommon); Hurricane (L8, rare; its 180 setup is inherent, so no extra entry); Slash Grind (quarterpipe, L3) | |
| Entries | Flip-ins (kick/heel L5, varials L7, hard/inward L8, tre L9); shuvit-ins (BS L5, FS L6, BS 360 L8). Flip-ins now allowed on box/curb as well | |
| Exits | Kickflip/Heelflip Out (L6, uncommon), Shuvit Out (L5, uncommon), FS/BS 180 Out (L7, rare), Pop Over (boardslide/lipslide on flatbar/rail/handrail, L6, rare). Entry + exit on one grind/manual: L8, very rare, simple flip-ins only | |
| Grind-to-grind | 50-50→5-0, 5-0→50-50, nosegrind↔crooked, 50-50→nosegrind | L8, rare |
| Manuals | Flip/shuvit-ins (manual pad only, per spec), exits on pad/box/curb, long sequences (e.g. Kickflip to Nose Manual Heelflip Out) | sequences L8, very rare |
| Reverts | After simple flips/shuvits on flat/bank, at the end of pad/box manuals, Disaster Revert | L5, rare |
| Transfers | manual pad ↔ box, bank ↔ quarterpipe. **Transfers** toggle, default **off** | L5, rare |
| **Quarterpipe coping** | Stalls: Tail, Axle (FS/BS), Nose, 5-0, Smith, Feeble, Noseblunt; lip tricks: Rock to Fakie, Rock and Roll, Nosepick, Disaster (+Revert), Blunt to Fakie; coping grinds: 50-50, 5-0, Smith, Feeble, Lipslide, Tailslide, Slash | L1–7. New family **Stalls & lip tricks**; coping grinds stay in Grinds & slides |
| Excluded | Hospital flip, casper flip (hard ban); no freestyle; primo/darkslide/no-comply still not generated (gates kept) | |

## Rare / experimental control

One user setting: **Off / Very low (default) / Low / Normal**.

- Core and uncommon tricks are always available; uncommon ones get ×0.5 weight.
- Each pick first rolls for a rarity tier: rare 3% / very rare 0.6% at Very low, ×2.5 at Low, ×5 at Normal. A tier is only used if it has a trick within the fair difficulty band.
- **Off** removes rare / very-rare / experimental tricks entirely.
- The old experimental lane (spin-in grinds, spins on flip-ins) only exists at **Normal**.

## C. Adaptation

- The manual start level 1–10 is kept. Long-term evidence is unchanged from v1 (outcome × attempt × relative difficulty, never points).
- **Hot streak**: 4+ first-try lands in a row → long-term step ×1.5, still capped at ±0.15 per challenge.
- **Temporary challenge boost** (in-session only): after 3 first-try lands in a row, +0.25 per further first-try land, max **+0.75**. It halves on a later-attempt land or skip and resets on a failed challenge. The cap is skill + 1.25 stretch + boost, so **a level-6 player maxes at 8, never 9**.
- **Recovery**: 2 failed challenges in the last 3 → one pick targeted 1 level easier (cooldown 3). It scores normally, with no pity bonus.
- **Too easy / Too hard** on the result screen: ±0.05 skill and ±0.25 boost. Max one per challenge and one effective tap per 3 challenges. Later taps are recorded but have no effect. Never affects legality.
- **Per-family learning** (flips/grinds/manuals/spins/stalls offsets, ±0.75) is recorded, but only used for selection when `familySkillEnabled` (default **off**).
- **Long-term profile** = a replay of every **completed** (S-K-A-T-E or Solo finished), non-forgotten session at the same start level, after the last "Reset to N". It is recomputed from history every time, so there's no cached residue. Ended-early and abandoned sessions still adapt during their own run but never teach the long-term level.
- **Forget this session for skill learning** (Scores → History): reason required (Accidental taps / Injury or off day / Device issue / Not representative / Other + note). History and score are **kept** unless the player also ticks "Also delete this session and its score". It can be undone ("Use it again").

## D. Selection and repeats

- Soft family balance over the last 10 picks (×0.4–1.4), no quotas. Stance variety (the same non-regular stance twice in a row ×0.6). FS/BS stays roughly even, from symmetric candidates.
- Novelty: skills not yet seen this session ×1.25. The same skill on any obstacle within 8 prompts ×0.25, so a different obstacle is not a loophole. The same main component within 5 picks ×0.5, the same exit within 5 ×0.5.
- Exact-challenge cooldown of 12 prompts, relaxed only if the pool is exhausted (and logged).
- **Repeat penalty**: since the game assigns every prompt, the legacy −10% penalty now only applies to player-chosen tricks (none exist in v1). It is effectively off and the receipt says "No repeat penalty (game-assigned trick)".
- The quarterpipe is treated as a coping obstacle first: plain flip airs there are weighted ×0.35.

## E. Scoring (unchanged formula)

`round(100 × BaseSum × Combo × Attempt × Flow × Repeat)`, attempts 1.00/0.85/0.75, flow +3%/land up to +15%. Base components come only from canonical parts, each counted once. Board moves decompose to flip rotation + shuvit rotation + a direction interaction; this reproduces every legacy named-flip value exactly (test-enforced). New components (*provisional*): ollie 0; shuvit 180/360/540 = .15/.35/.60; extra flip rotation +.35 each; late +.40; impossible .90; pressure .55; exits .10–.35; revert .10; transition = 50% of the second grind; transfer .20; lips .25–.70. Combo multipliers are the legacy ones only. Shuvit-ins use the flip-into-grind multiplier.

## F. UI

- Setup categories are section headers: an H3, an "N of M on · X at your level" status line, a description, and an accessible **switch** (role=switch). Turning a family off keeps its child selections.
- Trick toggles are smaller chips with a ✓ when on, outlined when off, and dashed/dimmed when their family is off. Size isn't the only cue.
- Advanced/rare options sit in a collapsible "Advanced & rare" group per family.
- Obstacles have All / None. "No obstacles selected" shows guidance and disables Start; nothing is force-selected.
- Desktop (≥900px): Home in two columns; Setup with a sticky side column plus a multi-column family grid; Scores in two columns. Play stays a focused 600px column. Mobile is unchanged apart from the new hierarchy.

## Flags and defaults

| Flag / setting | Default | Where |
|---|---|---|
| Rare & experimental frequency | Very low | Setup → Variations |
| Double flips | On | Setup → Variations |
| Triple flips | **Off** | Setup → Variations |
| Transfers | **Off** | Setup → Variations |
| `familySkillEnabled` (learning by family) | Off | Dev panel |
| Forget session | Available on completed sessions | Scores → History |
| `repeatPenaltyEnabled` | Off (player-chosen only) | Dev panel |
| Debug logs | "Level details" in ≡ menu (any build); full dev panel + skill log only in `npm run dev` | |
| `nlStackBuilderEnabled`, `runtimeAiEnabled` | false, hard-locked | |

## Deferred (not implemented, by choice)

Flip-ins into quarterpipe stalls and lip tricks (the quarterpipe vocabulary tops out around level 7.5); round vs square rail nuance; kicker assist; primo/darkslide/no-comply; gazelle flips; per-family learning on by default; dataset-derived names.

## v2.1 additions (2026-11-17, second request)

- **Solo → "Marathon"** in all UI copy. The internal mode id stays `solo` so saved scores, boards and history keep working.
- **Local multiplayer (2–4, pass-and-play)** for both modes (`src/engine/match.ts`):
  - Each player gets a normal session with the same rules, scoring and receipts; the match only orchestrates turns.
  - SKATE: S-K-A-T-E knocks a player out, and the last one standing wins. Marathon: everyone plays N in turn, and the highest score wins.
  - **Same trick for everyone** (default on): one trick per round at the average level of the players still in. Off: each player gets tricks for their own level.
  - Matches are saved under Scores → Multiplayer. They never feed long-term learning or solo high scores.
  - **Online multiplayer is not included**: it would need a server, and was out of scope in the original brief.
- **Hardflip / Inward Heelflip + 180 body spin → rare tier.** Varial + 180 stays uncommon.
- **Difficulty staggering:** `rating = max(raw, gate + lift, gateOther + lift + 0.35 × core)`. When a stance, obstacle or pattern gate sets the floor, the trick's own difficulty still spreads ratings above it: switch Kickflip 5.9 < Varial 6.3 < Hardflip 6.7 < Tre 7.4; nollie 4.8 → 6.4. Quarterpipe lip tricks get individual difficulties (Tail Stall 1.5 … BS Noseblunt Stall 6.5), and BS lip tricks rate +0.2.
- **Naming:** a nollie ollie displays as "Nollie"; multiplayer copy uses "Your turn" / "Pass back to you" for the default "You" player.
- **Visuals (revised):**
  - Minimal Interpol-style wordmark: heavy uppercase BRAINLOCK over a red rule. Semicircle-in-square favicon.
  - Home sits on a solid dark card. Behind it (page level, never on the card) is a fine grid of semicircle-in-square tiles, white hairlines on near-black. At rest they flicker and occasionally twitch to new orientations like static (~15 fps). On any selection change, a plasma-ball 'touch' sends tendrils and brightening rings toward the tap, then releases over about 1 s. Reduced motion shows a still frame.
  - The KISS/Partiful logo and the crackle background were replaced at the user's request.
  - Also: TV-static "Finger ⇄ Skate" subtitle; red melting tunnel on the third-miss result; mobile title/description pairs at 1.05 rem / 0.95 rem.

## v2.2 (2026-11-17)

- **Manual pad = manuals only.** Hard legality rule: every manual pad trick includes a manual (manual, nose manual, flip/shuvit-into-manual, 180 to manual, manual exits/reverts). Plain airs onto the pad and the manual pad ↔ box transfers are removed; transfers are bank ↔ quarterpipe only. This is test-enforced across the catalog and in seeded play.
- **Home background:** about 20% more bike-frame crackle. Sharp branching crack lines plus faint hairline sub-cracks run through the semicircle grid, and tiles shift slightly at each crack like shattered paint. A greyscale photographic finish adds soft uneven exposure, a mild vignette, lifted blacks, animated film grain and slight lens softness.

## v2.3 (2026-11-17)

- **Logo:** flared glyphic capitals after the vintage Humber badge (Marcellus, bundled via @fontsource for offline use). It's slightly heavier, with low-frequency edge roughening and per-letter baseline/angle jitter so it feels hand-cut. The red rule is dropped.
- **Home background:** rebuilt in the Land/Miss visual language. It's a slow greyscale tunnel (same geometry family as the Land screen) whose walls are lined with semicircle-in-square tiles, finished with fog, a pale core, vignette and film grain. A selection change triggers a Land-style rush forward, then a small Miss-style drip/melt that recovers. The thick crack lines are removed. Reduced motion shows a still frame.

## v2.4 (2026-11-17)

- **Logo:** closer to the Humber badge lettering: pure white, much heavier (stroke-thickened), ~12% wider, more open spacing. A blur-then-threshold filter gives softened, cast-badge corners, with a gentle low-frequency hand-cut wobble.
- **Home background (still greyscale):** more trippy. The spiralling tunnel twist follows depth, the kaleidoscope (7–9 slices) breathes, the walls ripple radially, a second counter-rotating tile skin creates moving moiré, a greyscale echo/afterimage is layered in, and there's a slow breathing zoom. A selection change still gives the Land-style rush and the Miss-style drip.
