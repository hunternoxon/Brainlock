# Canonical decisions — 2026-11-16

These are the user's own answers to 33 questions. **This document supersedes old implementations when they conflict.** Answer letters refer to the questionnaire; text below resolves their meaning.

## Experience (1–5)
1. The fun is **matching their skill level and being an actual challenge to keep going**. This matters more than conversational chat gimmicks.
2. **Fingerboarding**, not full-size skateboarding, for this product.
3. **Standalone site**. Conversational interface is *not* necessary if the UI is good.
4. **Tap Land / Miss**, not text-input dependent.
5. Personality is **A+B**: mostly clean game engine with some casual, minimal host feedback; not a wall of jokes.

## Gameplay (6–10)
6. **Both SKATE and Solo** have equal priority.
7. **Three attempts per trick**.
8. After three misses: **one SKATE letter**; five letters ends SKATE.
9. **Skip incurs a score penalty**, to be calibrated through a developer/admin feature flag.
10. User did not recall what "feedback" meant; resolved at Q31.

## Selection (11–15)
11. **Hybrid** engine: generate from structured rules, while preserving ability to draw on the dataset.
12. The 35,741-name dataset is **reference material**, not a trusted unvalidated source of runtime challenges.
13. **Both manual starting level (1–10) and automatic adaptation**.
14. Difficulty should rise **very gradually** over successful play.
15. Balance **variety and difficulty precision**.

## Fingerboarding intelligence (16–20)
16. Configure available obstacles and **save defaults** (both choose and persist).
17. Include full **12 original obstacle types**: flat, manual pad, box, curb, bank, ledge, hubba, flatbar, rail, handrail, gap, quarterpipe.
18. Prioritize **flips, grinds/slides, manuals, spins**. **No freestyle** in initial release. Airs/stalls can wait.
19. Mostly realistic legal patterns with room for **intentional experimental** combinations; not random impossible results.
20. **Preserve original nuanced rules** summarized from the 90-question design exercise (directional, stance, obstacle, level gating).

## Scoring (21–25)
21. **Rich, component-based scoring** internally, easy to understand at a glance.
22. Attempt multipliers: **1st=1.00, 2nd=0.85, 3rd=0.75**.
23. Preserve **flow/streak bonus** (+3% per consecutive land, capped +15% per historical spec).
24. **Fairness-aware repeat prevention + penalty**, because players cannot pick the prompt and should not be punished for the generator's choices.
25. On land, show **total points**; allow expansion to full score breakdown.

## Roadmap and implementation (26–30)
26. Natural-language Stack Builder is compelling **later**, only early plumbing/flag now. Do not distract or incur significant runtime cost.
27. **Deterministic, no-AI runtime** first. AI may be considered later *only* if the benefit and ongoing cost are justified and explicitly approved.
28. Persist **high scores, user settings, complete play history, and interrupted/resumable sessions**.
29. **Retain useful prior code/logic** while giving OpenCode freedom to replace presentation and orchestration; no unnecessary greenfield rewrite.
30. Success means **both** a fun full session like the original chat game **and** plausible, well-scaled tricks inside a reliable standalone app.

## Final locked decisions (31–33)
31. **Post-trick result screen; wait for explicit Next.** Don't auto-advance.
32. Difficulty adapts **slowly in BOTH directions**, based on performance.
33. Solo session lengths are **10, 25, or 50 tricks**; not endless in v1.

## Non-negotiable North Star

The system should know what the player can reasonably do, generate a slightly challenging trick, track attempts reliably, and give enough feedback to make the player want to keep playing. A fancy UI must not compromise that loop.
