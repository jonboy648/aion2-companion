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

## Fresh acceptance result: 2026-10-05

Executed from `D:/Aion2-level-planner/web` after the regenerated-bundle merge:

```sh
node scripts/run_planner_acceptance.mjs --workers 3
```

- Merge checkpoint: `f11ad70ebed2dc92a62ea6bde94daf8386fd396b`, whose
  parents are `00abe88` and engine correction `84a8aec`.
- Shipped engine fingerprint: `81efe112b9e8`, matching both the fresh request
  document and the current manifest. Bundle built at `2026-10-05T19:02:08-05:00`.
- Started: `2026-10-05T19:02:16.8684460-05:00`.
- Finished: `2026-10-05T19:02:42.3696416-05:00`.
- Stopwatch elapsed for the complete command: **25.494 seconds**, with three
  workers. Summed per-case optimizer time: **69.550 seconds**; cases overlap.
- Result: **33 successes, 0 failures, 107 main/variant builds validated**;
  process exit code **0**.
- All eight classes passed at levels 22, 30, and 45. All nine additional
  Sorcerer locked/earned/locked-earned cases passed at those same levels.
- The report has zero case issues and zero aggregate issues. The output has
  33 unique responses and zero CPython errors.

The run freshly generated `validator.mjs`, `requests.json`, `outputs.jsonl`,
and `report.json` in ignored `web/.planner-acceptance`. The command ran through
completion; no engine, validator, or UI edits were made for this run. The full
web suite was not run while other agents were editing UI tests.

Per-case times below are the runner's `elapsedSeconds`, in seconds, including
registration and optimization after importing `webapi`; they are not each
case's end-to-end command latency.

| Case | Result | Builds checked | Seconds |
| --- | --- | ---: | ---: |
| assassin-22-unlocked | PASS | 2 | 0.635 |
| assassin-30-unlocked | PASS | 4 | 2.043 |
| assassin-45-unlocked | PASS | 4 | 3.730 |
| chanter-22-unlocked | PASS | 2 | 0.774 |
| chanter-30-unlocked | PASS | 4 | 2.831 |
| chanter-45-unlocked | PASS | 3 | 4.220 |
| cleric-22-unlocked | PASS | 2 | 0.618 |
| cleric-30-unlocked | PASS | 4 | 1.353 |
| cleric-45-unlocked | PASS | 2 | 1.485 |
| gladiator-22-unlocked | PASS | 2 | 0.589 |
| gladiator-30-unlocked | PASS | 6 | 3.069 |
| gladiator-45-unlocked | PASS | 2 | 3.323 |
| ranger-22-unlocked | PASS | 2 | 1.151 |
| ranger-30-unlocked | PASS | 5 | 2.858 |
| ranger-45-unlocked | PASS | 5 | 5.399 |
| sorcerer-22-unlocked | PASS | 2 | 0.909 |
| sorcerer-30-unlocked | PASS | 5 | 2.480 |
| sorcerer-45-unlocked | PASS | 4 | 4.316 |
| spiritmaster-22-unlocked | PASS | 2 | 1.124 |
| spiritmaster-30-unlocked | PASS | 4 | 1.846 |
| spiritmaster-45-unlocked | PASS | 3 | 2.357 |
| templar-22-unlocked | PASS | 2 | 0.849 |
| templar-30-unlocked | PASS | 5 | 2.106 |
| templar-45-unlocked | PASS | 5 | 4.938 |
| sorcerer-22-locked | PASS | 2 | 0.879 |
| sorcerer-22-earned | PASS | 5 | 2.039 |
| sorcerer-22-locked-earned | PASS | 2 | 1.000 |
| sorcerer-30-locked | PASS | 2 | 0.867 |
| sorcerer-30-earned | PASS | 5 | 2.323 |
| sorcerer-30-locked-earned | PASS | 2 | 0.853 |
| sorcerer-45-locked | PASS | 2 | 1.282 |
| sorcerer-45-earned | PASS | 4 | 3.964 |
| sorcerer-45-locked-earned | PASS | 2 | 1.340 |

## Read-only QuickUse evidence

Direct table evidence exists in the private export already referenced by
[the progression generator](build_progression.mjs):
`D:/Aion2-tools/export-test/out/AION2/Content/Data/Table`.
The following existing files were parsed read-only: `QuickSlotData.json`
(20 rows), `PCContextSkillSlot.json` (110), `PCLevelQuickSlot.json` (54),
`InputAction.json` (200), `InputKeyMapping.json` (166), and `Skill.json` (16,279).
Only derived findings are recorded here; no raw export was copied into the repo.
The export's client version remains unverified; envelope `Version: 13` is not
proof of a client version.

### Verified snapshot slot/action/default-key joins

`QuickSlotData.SlotId.Value` joins to its `InputAction`;
`InputAction.InputAction` has the same enum name, and `InputKeyMapping.Name`
matches that name without the `EAionInputAction::` prefix.

| Slot ID | Canonical action suffix | `InputKeyMapping.Keys` main-key entries |
| --- | --- | --- |
| 1 | QuickSlot_Skill_1 | LeftMouseButton; w |
| 2 | QuickSlot_Skill_2 | RightMouseButton; q |
| 3-6 | QuickSlot_Skill_3-6 | One, Two, Three, Four, respectively |
| 7 | QuickSlot_Skill_7 | t |
| 8 | QuickSlot_Skill_8 | grave-accent/backtick key |
| 21-24 | QuickSlot_Stigma_1-4 | Five, Six, Seven, Eight, respectively |
| 11-18 | QuickSlot_Item_1-8 | F1-F8, respectively |

All listed keyboard entries have `SubKey` and `SubKey2` equal to `None`.
Skill slots 1 and 2 each have two stored key entries; their profile/selection
meaning was not verified. These are exported defaults, not the player's current
remappings or measured HUD coordinates. No literal `QuickUse` string was found
in any row of these six tables, so a `QuickUse_N` alias or macro command must
not be inferred from the canonical `QuickSlot_*` names.

### Verified snapshot restriction fields

- For each of the eight shipped classes, `PCContextSkillSlot` marks slot 1
  `bEditable: false`; its default skill also has
  `Skill.ContextSkillSlotRegisterType: FixSlot`. The class-specific context
  rows mark slots 2-8 and 21-24 editable. Separately, `QuickSlotData` marks
  skill/stigma slots noneditable and item slots editable. The precedence of
  those different editability fields is not established by this read-only pass.
- Sorcerer slot 1 defaults to Flame Arrow (`15210000`, `FixSlot`). Slot 7
  defaults to Frost Burst (`15220000`) and its context list contains Frost
  (`15150000`). Slot 8 defaults to Flame Scattershot (`15010000`) and its
  context list contains Blaze (`15050000`) and Wish of Concentration
  (`15310000`). The latter default/replacement skills have register type `All`;
  the context lists do not establish activation conditions or arbitrary stacking.
- Every one of the 54 `PCLevelQuickSlot` rows is an item assignment, not a
  normal-skill/stigma placement or unlock rule. Sorcerer's six rows are level-1,
  ascension-grade-1 item defaults for slots 11/12/13/15/16/17.
- `QuickSlotData.AvailableType` is an unlabeled Boolean array in this export.
  Its index meanings, screen positions, stack capacity and complete runtime
  registration/edit rules were not verified. Passing planner acceptance does
  not certify physical hotbar legality.

[Prior progression research](../../research/progression_connections_2026-10-05.md)
already identified these joins and tentative Sorcerer observations, but left
fixed/contextual rules unverified. This pass confirms the fields above directly
in the snapshot. [The key label model](../../app/aion2c/models.py) and
[layout assignment](../../app/aion2c/keybinds/layout.py) still use number/punctuation
keys plus A-Z, preserve available pins, or choose the next free label for stacks
of up to four. They check availability/equipped stigmas but do not join these
client slot tables or enforce their physical placement restrictions.
[The Keybinds page](../src/pages/Keybinds.tsx) therefore continues to label its
layout as suggested and the fixed/contextual restrictions as not fully verified.
