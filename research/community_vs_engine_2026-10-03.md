# Engine vs community consensus (boss, level 45, baseline stats), 2026-10-03

Method: the `community_builds/consensus.json` boss stigmas are forced through the same full pipeline as our optimizer
(only the stigma choice differs), and both are scored by our own engine. To rerun, replace
`build_optimizer._optimize_stigmas` with a function returning the community set and call `optimize_full_build`.

| Class | Ours DPS | Community set DPS | Result | Stigma overlap |
|---|---|---|---|---|
| Assassin | 3093 | 3065 | tie | 3/4 |
| Chanter | 9965 | 9759 | ours higher | 2/4 |
| Cleric | 4148 | 4148 | tie (identical set) | 4/4 |
| Gladiator | 5111 | 5466 | community +7% | 3/4 (Focused Block vs Assault Strike) |
| Ranger | 4368 | 4463 | community +2% (search noise) | 2/4 |
| Sorcerer | 11319 | 11353 | tie | 2/4 |
| Spiritmaster | 4249 | 4205 | ours higher | 2/4 |
| Templar | 6656 | 6652 | tie | 3/4 |

## What this shows
- Within our own model we match or beat the guides on 6 of 8 classes and are within 2% on Ranger.
- The Gladiator gap is real in the model, but the rotation search is too noisy to resolve it (see below).

## Search noise (the actual limiter)
`search.optimize` is a seeded first-improvement local search with a small budget (200 simulations) against a
neighbourhood of several hundred edits. For one fixed Gladiator stigma set:
- seeds 0..5 at budget 200: 2628 to 2923 DPS (11% spread); Ranger 3031 to 3144 (4%)
- budgets 30..600: 2620 to 3497 (33% range); it often stalls on a 2620 plateau
- more budget helps on average but slowly in the full pipeline: +1 to 2% DPS for +15 to 100% time

Tried and reverted (no benefit worth shipping):
- re-ranking near-tied stigma sets with the full rotation search: no pick changed, the noise exceeds the differences
- an iterated-local-search kick phase: only helps when seeds stall early; at budget 200 the budget is already spent

## Options if the engine should reliably beat the guides
1. A faster simulator (about 14 ms per simulation now): the same time buys 2 to 4x the search.
2. Smarter neighbourhood ordering (try high value-per-cast insertions first) instead of uniform shuffles.
3. Seed every search with the class's community rotation so a result is never below the guide's rotation.
4. Move the heavy compute off the visitor's browser.

Absolute DPS still needs in-game calibration (damage dummy at two skill ranks). None of this proves accuracy.
