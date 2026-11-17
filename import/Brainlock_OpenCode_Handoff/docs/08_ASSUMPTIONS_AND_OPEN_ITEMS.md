# Unresolved details — NOT blockers for the first local build

User answered all 33 questions. No further broad interview necessary. These precise parameters remain for **playtest tuning**, not for deciding whether we can start.

1. **Skip penalty magnitude:** selected "score penalty" and admin flag but no exact points. Tentative -50 with score floor 0, editable in dev panel. No SKATE letter assumed, since not explicitly selected. Mark provisional in debug UI.
2. **What constitutes a 'flow' reset:** Aug deep spec says flow resets on miss/skip. Does one missed attempt before eventual land break it? First build should choose and document consistently; recommend miss attempt resets continuous perfect-attempt streak, then validate by playtesting.
3. **Adaptive difficulty numerical tuning:** user specified 1–10 manual start + gradual bidirectional movement, not specific coefficients. Use very small bounded shifts and rolling evidence windows, log and tune. Avoid rigid 1-for-1 relationship of old five dataset tier labels to desired ten levels.
4. **Difficulty scoring relationship:** points calculation described, but a 1–10 displayed `difficultyLevel` needs an explicit derived mapping. Record mapping in code/test; avoid assuming score = level*100.
5. **Experimental combinations:** "mostly realistic, occasional experimental" means there must be validation and an opt-in experimental lane; choose **off** initially, and log candidates separately.
6. **Repeat fairness:** user said prevent repeats *and* allow penalties with exceptions; choose de-duplication-first by default, penalty behind debug flag until fair semantics established.
7. **Preserved old NL scoring:** 2026 answer prioritizes base gameplay and cost. Preserve parser code as heritage, but disable UI/scoring branch until tested; no runtime AI API calls.
8. **App stack:** no explicit choice of framework. Pick minimal, well-testable JS/TS (no unnecessary framework if legacy vanilla JS is sufficient), make migration easy. OpenCode should explain stack only briefly and proceed.
9. **All 12 obstacles vs candidate pool:** user chose all obstacles as options, **not** all obstacle families being valid at all levels. Handle empty legal pools with clear UX.
10. **Score high-score treatment for manually abandoned sessions:** preserve history, but only completed sessions eligible for competitive high-score comparison unless explicitly configured later.

These are defaults/implementation assumptions, not newly asserted user decisions. Code must make the adjustable items visible in dev tooling.
