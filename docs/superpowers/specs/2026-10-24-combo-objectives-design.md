# Damage and stagger recommendations from existing game data

Jon authorized implementation on Oct 24 after the source report and the explanation
that gameplay is not required to proceed. Reuse the current engine and pages; show
verified results before pushing. This does not authorize deploying this branch.

## Outcome

For an imported or entered character and an existing content playstyle, select
Damage or Stagger. Search the complete legal build and rotation using that goal,
preserving current equipment, opened nodes, entered ranks and separate spare-point
budgets. Present HP damage and stagger gauge separately. The existing damage view
remains the default. This increment does not implement full paid-rank/node refunds
or promote the separate workspace prototype.

Stagger is a modeled contribution over the playstyle's stated duration, not a
prediction of breaks or actual break time. Do not invent boss thresholds, recovery,
immunity, native macro retry behavior or optimal delays. Missing gauge data and
unmodeled conditional mechanics must remain visible in warnings.

## Contracts (implementation choices)

- `Scenario.objective`: `"damage" | "stagger"`, default `"damage"`. Content key,
  duration, targets and boss flag are unchanged; a replaced scenario carries the
  goal through all existing nested planners without adding global mutable state.
- `SimResult.total_stagger`, `stagger_per_s`: additive numbers defaulting to zero.
  `CastEvent.stagger` and `SkillTally.stagger`: additive zero-default contributions.
  All existing damage/DPS fields retain HP damage semantics.
- `ChargeLevel.stagger_gauge`: optional per-release gauge, never multiplied by HP
  hit count. `ChargeLevel.fast_charge_s`: optional confirmed alternate threshold.
  `SkillRule.fast_charge_spec`: optional `(owner_key, zero_based_option)` identifying
  the matching speed specialty. Unknown charge gauge never uses a range maximum.
- A shared scorer selects `result.dps` for Damage or `result.stagger_per_s` for
  Stagger. Every stigma/rank/specialty/node/rotation selection must use it. Keep
  search limits, legal gates and currency checks. Gauge-only skills are eligible.
- `optimize_full_build(..., objective="damage")` and
  `compare_playstyles(..., objective="damage")` add trailing keyword arguments.
  Web API compare/optimize add a trailing objective argument after battle_points;
  existing positional arguments and progress callback handling remain compatible.
- Full-build JSON adds `objective`, `objective_score`, `objective_unit`,
  `current_objective_score`. Existing `current_dps` and variant DPS remain HP DPS.
  Legacy gain fields whose historical names contain DPS must not silently become
  mislabeled stagger percentages; add objective-specific fields or omit those
  damage-only panels in Stagger mode. Do not report native macro DPS.
- The worker/client passes the objective on both serial and parallel paths and
  includes it in normal argument-based cache identity. No new cache implementation.
- The current Character page gets an explicit goal control and Calculate action.
  Keep the previous result visibly out of date while recalculating; ignore late
  responses via the existing effect/request lifetime, never kill the worker.
  Reuse the existing native setup handoff for the chosen build/rotation, retaining
  charge/manual and runtime-uncertainty warnings. No Home/nav/map redesign.

## Source and timing corrections

Use the existing allowlisted client derivation to preserve release-specific gauge
and exact alternate charge thresholds. Hellfire source witnesses: gauge
20/25/30/35; normal seconds .3/.5/1/1.5; rank-8 speed option seconds
.21/.35/.7/1.05. Select the alternate only for its actual unlocked specialty.
Never apply aggregate gauge once per HP hit or use the top tier for every charge.

Damage/status/proc/gauge effects landing at or after the scenario end do not count.
A charge begun within the window may be recorded as an unfinished zero-effect cast;
other previously established instant-cast timing semantics remain unchanged.

Conditional links already modeled remain in search. The immunity-trigger route,
per-projectile Firestorm timing and native scheduler are not certified by this
increment unless their exact public-behavior regression and source join are added;
otherwise surface the specific limitation instead of claiming complete mechanics.

## Test boundaries and acceptance

Use the existing public boundaries approved in the preceding conversation:
`simulate`, `optimize`, `optimize_full_build`, webapi, worker calls and rendered
page interactions. One failing test then minimal implementation per slice.

- Synthetic damage winner differs from gauge winner with the same fight/build.
- Real source witnesses retain four Hellfire tiers; fast option is level-gated.
- Unfinished charges add no HP/gauge/status/proc after the fight end.
- Gauge selection affects complete stigma/rank/specialty/node decisions while
  retaining legal budgets, input immutability and actual damage fields.
- Damage remains the default; invalid objectives fail clearly, and Stagger reports
  unknown amounts as missing rather than confirmed zero capability.
- Objective survives serial/parallel worker calls and result caching.
- UI shows units, matching current baseline, stale/loading behavior, and accessible
  desktop/390px controls; it never labels gauge as DPS or promises macro timing.

Derived files only; ADR 0001, source/browser parity and engine fingerprint remain
enforced. Historical export patch stays unknown. No dependencies, raw exports or
gameplay captures are added. Known Chanter timing issue #43 is separate, not fixed
by changing test timeouts. Complete relevant tests/build and review before reporting.
