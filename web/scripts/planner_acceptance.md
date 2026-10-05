# Planner Cross-Runtime Acceptance

Run from `web` with existing dependencies and system Python:

```sh
node scripts/run_planner_acceptance.mjs --workers 4
```

Run a subset or validate previously recorded Python results against the current
TypeScript validators:

```sh
node scripts/run_planner_acceptance.mjs --case sorcerer-22 --workers 2
node scripts/run_planner_acceptance.mjs --check-only
npm test -- scripts/planner_acceptance.test.mjs src/features/progression/progression.test.ts src/features/progression/decodeProgression.test.ts
```

`--python` selects a Python executable. `--case` matches case ID substrings.
Each optimization run replaces the generated request/output/report artifacts.
`--check-only` does not run Python and checks only the recorded case set.

The Vite library build bundles the actual `initialForm`, `buildFromForm`,
`prepareLevelBuild`, `validateLevelPlan`, and `validateLevelPriority` helpers.
Node reads the shipped `public/engine/classes` data and generates optimizer
requests. CPython registers that same data and calls `aion2c.webapi.optimize`
with the exact serialized arguments, including a zero BattleCrystal budget.
There are no optimizer mocks in the acceptance run.

The 33 cases cover all eight classes at levels 22, 30, and 45 with both quest
gates unlocked, plus Sorcerer at those levels with locked gates, explicit earned
rewards, and locked gates with earned rewards. Earned rewards are +5 skill,
+3 stigma, and +4 Daevanion points; locked gates retain zero spendable stigma
and Daevanion budgets.

The checker applies `validateLevelPlan` to the main build and every variant,
including their paid ranks, acquisition gates, point spending, specialties,
and Daevanion connectivity. It applies `validateLevelPriority` to every returned
priority. The current variant wire format has no priority, so variant checks
cover their builds and DPS without inventing a rotation. The main build's
priority is not reused for variants that swap stigmas.

Additional checks cover request identity, class/level/region, returned budgets
and quest flags, bonus ranks, finite nonnegative DPS, variant keys, regional
skill availability, and agreement between shipped board currencies, Python
board currencies, and the derived frontend map.

`FullBuild.daevanion_path` is the full future opening order, not a purchase list.
Guidance checks cover known node IDs and currency only; they do not apply the
request's current level, quest gate, or spendable budget. A locked request with
empty `build.daevanion_nodes` can therefore carry a nonempty guidance path.
This follows `app/tests/test_build_optimizer.py::test_daevanion_int_selects_prefix`,
which verifies that actual purchases are only a budget-limited prefix of the
full path. Purchase checks on the main build and every variant's
`build.daevanion_nodes` still enforce level gates, quest flags, spending,
and connectivity through the actual frontend validator.

Both purchases and guidance reject BattleCrystal nodes in this zero-battle-budget
matrix. The engine's `plan_daevanion(..., battle=False)` excludes BattleCrystal
boards; `webapi.optimize` passes `bool(battle_points)`, which is false for these
requests. All 33 recorded outputs contain zero BattleCrystal guidance nodes.
Unknown guidance nodes remain an error, independently of whether anything is
purchased.

All generated artifacts stay in ignored `web/.planner-acceptance`:

- `validator.mjs`: compiled actual frontend helpers.
- `requests.json`: exact optimizer requests and passed validation budgets.
- `outputs.jsonl`: Python receipts and trimmed FullBuild results, without casts.
- `report.json`: every validator failure and the build/case counts.

The command exits nonzero for any rejected output or missing/duplicate response.
It does not change engine data, validators, or UI to resolve contract failures.
