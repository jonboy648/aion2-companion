# Global progression and connected build rules

Read-only audit of Jon's Steam Global client export under `AION2_EXPORT_DIR`.
Client version is unverified. Table envelope `Version: 13` is serialization
metadata, not a client version. A comment mentioning 5.3.2.0 in client_export.py
does not establish this export's version. Global tables do not prove Korea caps.
Private tables remain outside the repository; only derived facts ship.

## Level totals

Source: `Exp.Properties.Data`, fields `Level`, `BonusSkillPoint`,
`BonusStigmaPoint`, `StigmaSkillContextSlotMax`, `DaevanionPointMap` entry
`EDaevanionPointType::DaevanionCrystal`. These are cumulative totals, not
per-level grants: take ONE row, never sum preceding rows. They are a leveling
baseline, not the wallet of an imported character. Quest/dungeon rewards and
already spent points must be tracked separately. BattleCrystal is another pool.

| Level | Skill | Stigma | Stigma slots | DaevanionCrystal |
| --- | --- | --- | --- | --- |
| 1 | 0 | 0 | 0 | 0 |
| 2 | 0 | 0 | 0 | 0 |
| 3 | 0 | 0 | 0 | 0 |
| 4 | 1 | 0 | 0 | 0 |
| 5 | 3 | 0 | 0 | 0 |
| 6 | 5 | 0 | 0 | 0 |
| 7 | 7 | 0 | 0 | 0 |
| 8 | 10 | 0 | 0 | 0 |
| 9 | 13 | 0 | 0 | 0 |
| 10 | 16 | 0 | 0 | 0 |
| 11 | 20 | 0 | 0 | 0 |
| 12 | 24 | 0 | 0 | 4 |
| 13 | 28 | 0 | 0 | 8 |
| 14 | 32 | 0 | 0 | 12 |
| 15 | 36 | 0 | 0 | 16 |
| 16 | 41 | 0 | 0 | 20 |
| 17 | 46 | 0 | 0 | 24 |
| 18 | 51 | 0 | 0 | 28 |
| 19 | 56 | 0 | 0 | 32 |
| 20 | 61 | 0 | 0 | 36 |
| 21 | 66 | 0 | 0 | 40 |
| 22 | 71 | 0 | 1 | 44 |
| 23 | 76 | 1 | 1 | 48 |
| 24 | 81 | 2 | 1 | 52 |
| 25 | 86 | 3 | 1 | 56 |
| 26 | 91 | 4 | 1 | 60 |
| 27 | 96 | 5 | 2 | 64 |
| 28 | 101 | 6 | 2 | 68 |
| 29 | 106 | 7 | 2 | 72 |
| 30 | 111 | 8 | 2 | 76 |
| 31 | 117 | 9 | 2 | 80 |
| 32 | 123 | 10 | 3 | 84 |
| 33 | 129 | 11 | 3 | 88 |
| 34 | 135 | 12 | 3 | 92 |
| 35 | 141 | 13 | 3 | 96 |
| 36 | 147 | 14 | 3 | 100 |
| 37 | 153 | 15 | 4 | 104 |
| 38 | 159 | 16 | 4 | 108 |
| 39 | 165 | 17 | 4 | 112 |
| 40 | 171 | 19 | 4 | 116 |
| 41 | 177 | 21 | 4 | 120 |
| 42 | 183 | 23 | 4 | 124 |
| 43 | 189 | 25 | 4 | 128 |
| 44 | 196 | 27 | 4 | 132 |
| 45 | 203 | 29 | 4 | 136 |

## Acquisition and paid ranks

Source: `SkillAcquireData`, join `SkillId.Value` to our class skill identifiers.
Use `ClassType`, `AcquireType`, `SkillLevel`, `NeedCharacterLevel`,
`NeedAscensionGrade`, `bAutoLearn`, `NeedPrevSkillDataList`, `CostSkillPoint`,
`CostStigmaPoint`, `CostStigmaSuperiorPoint`, `CostItemDataList`.

- All 2,043 Mastery acquisition rows match existing incremental costs:
  ranks 1-10 cost 0/1/1/1/2/2/2/4/4/4, total 21.
- All 2,340 Stigma acquisition rows match existing incremental costs:
  five ranks each at 1/2/4/8, total 75 through rank 20.
- Mastery rank 1 is free; automatic acquisition still requires character level.
- Stigma rank 1 costs ONE point, is not automatic, and requires
  `AscensionGrade_3`. `GlobalSetting` additionally names faction quests
  AQ1602010 / AQ2602010. A slot at level 22 does not grant a free stigma.
- Example Flame Arrow (15010000): paid rank 8 requires character level 23;
  paid rank 10 requires level 29. Enforce every acquired rank's level gate.
- Global paid acquisition stops at Mastery 10 / Stigma 20. Skill representation
  maxima 40/25 are not proof of payable ranks or Korea effective-rank caps.
- This snapshot has no nonempty predecessor or item-cost lists; preserve
  their semantics for future exports rather than assuming they never exist.
- Bonuses from Daevanion/Arcana/gear are NOT paid acquisition ranks. Imported
  ranks cannot reconstruct a spent wallet until bonus sources are separated.

Current engine hazards: `effective_rank` defaults missing skills to 1;
`allocate_points` then omits the rank-1 stigma cost. Its paid cap alone does not
enforce character-level acquisition caps. Claude owns these engine corrections.

## Specialty options versus slots

`SpecializedSkillParts.ParentSkillId/ParentSkillLv` specifies OPTION availability.
`SpecializedSkillSlot.UnlockSkillLv` specifies selectable SLOT availability.
Mastery options example: 8/8/8/12/16. Mastery slots: 8/12/20.
Stigma Parts have automatic tiers at 5/10/15/20 using `InitEquipSlotType`;
their slot entries have threshold 0, `bShowSlot=false`, `bUserEditSlot=false`.
Do not apply Mastery's selectable-slot limit to automatic Stigma tiers.

## Other connections that must not be silently flattened

- Charge/chain/proc damage children are not separate purchases. Hellfire's
  charge children have rank-40 representations but no acquisition rows.
  A generic link is not enough to prove the paid-rank owner.
- Quickslots: join `QuickSlotData`, `PCContextSkillSlot`, `PCLevelQuickSlot`,
  `Skill.ContextSkillSlotRegisterType`. Sorcerer's slot 1 is not editable;
  contextual replacements exist for slot 8. Arbitrary keyboard placement
  and the current four-stack simulation remain suggestions, not fully verified
  physical UI constraints. Label uncertain mechanics honestly.
- `SkillCond` has effect-type and abnormal-group conditions scoped to Self or
  Target. `SkillLink` contains probabilities and Boolean expressions. They are
  not interchangeable with one mandatory requires-status or chain-next edge.
  Also examine ChainSkillPrevSkillId, activation/window/deactivation fields,
  SkillTransform, and effect producers before translating an edge.
- Daevanion has faction quest unlocks HQ1102060/HQ2102065 plus board/node
  gates. Boards 61-64 use DaevanionCrystal; board 66 uses BattleCrystal.
- QuestReward and RewardDungeon contain additional skill/Daevanion point-item
  rewards. Do not grant them from level alone or presume repeatability.

## Acceptance checks

Fresh plans need explicit zero budgets; acquired ranks must meet level/cost
gates; every stigma acquisition must be paid and unlocked; optional rewards
must be explicit; only the selected plan transfers to Keybinds, with already
spent budgets cleared. Imported characters are not rewritten by level previews.
Derived-source version stays null until verified. Missing joins should block
an asserted legal plan, not disappear into a default.

## Derived frontend data

`web/scripts/build_progression.mjs` reads the exported Table directory supplied
in `AION2_EXPORT_DIR`. It emits only derived acquisition facts into
`web/src/features/progression/data.json`: schema 2 pools repeated rank profiles,
and `decodeProgression.ts` restores the expanded contract without inferred ranks.
The readable payload is about 17 KB instead of 789 KB. Tests compare the entire
decoded result with the unpooled representation, including gaps and prerequisites.

Board currency joins use exact class, localized title and unlock level, not node
IDs. The runtime board key `azphel` uses Battle Crystals; it cannot consume the
ordinary leveling crystal budget. Unknown currencies fail closed.

No raw export, keys, or game code is shipped. No exact private-export child-owner
mapping was produced: the 23 charge links lacked joinable child IDs. Existing
confirmed class-data chains may be used as modeled rotation relationships, but
they do not prove a shared paid-rank acquisition. Fixed/contextual quickslot
restrictions remain unverified and are labeled as such on Keybinds.

Automatic Parts mapping was cross-checked against all eight shipped class data
files: 104 mapped stigma skills and 416 tiers have exact `Slot_N` -> option
`N-1` -> `rank_required === ParentSkillLv` matches, without mismatches. Four
Korea-only stigmas and Templar's `blade-storm` have neither automatic profiles
nor matching Parts/options; no mapping is inferred for them. Fresh-plan
validation requires every eligible automatic tier, not a subset of unlocked
tiers, and rejects a normal skill placed in the equipped stigma list.

## Frontend verification (engine integration pending)

On `codex/level-aware-planner`, based on `origin/main` 90b1709:

- 380 web tests across 56 files pass, including generator/decoder round trips,
  stale results, optional icons, retry, quest gates and exact-plan handoff.
- 106 focused Python keybind and Qt-free tests pass, including cooldown chains,
  unavailable pins, one-scenario macros and bounded macro search.
- `npm run build` passes its strict TypeScript check and produces 23 prerenders.
  Main JS is 645.80 KB (200.78 KB gzip); CSS is 112.33 KB (21.28 KB gzip).
  These are totals, not a measured clean-baseline delta. No new dependencies.
- Real-browser level-1 Sorcerer guide -> selected Leveling plan -> Keybinds
  renders that rotation and one F11 Leveling loop, without optimizing another
  playstyle during handoff. At an effective 390px viewport there is no document
  overflow or broken image; quickslots scroll inside their own region.

Higher-level end-to-end acceptance is not complete. Claude owns the matching
engine correction and cache fingerprint. The old engine's invalid higher-level
allocations are rejected; they are not shown as legal plans. Integrate the
engine-only patch, regenerate the web engine bundle, and verify levels 22/30/45
with quests and earned rewards before release. Home and imported characters
are not rewritten by this feature.

## Guide layout and responsiveness pass

Claude reviewed the direction before implementation. The existing ManualBuild
and Codex class-guide flow now uses an explicit Calculate button for one selected
playstyle, not a four-playstyle comparison after every input change. Local
budgets, current core skills and the next unlock update without Python requests.
The guide reads skills -> quickslots/macro -> full analysis, with combat stats,
quest unlocks and earned rewards in a supporting settings column. The existing
AdvancedStats layout, Hotbar, MacroPanel and full PlaystyleDetail are reused.

Read-only guide data is loaded directly from the shipped class and icon JSON;
icon names are resolved using the same official CDN template as webapi.icon_urls.
This path is opt-in: imported-character consumers retain their engine API path.
There is no new dependency, worker termination or frontend result cache.

Previous plans remain visible but are marked Out of date after input/data changes.
Their controls and exact-plan handoff are disabled until recalculation. Requests
have generation guards and repeated submits cannot enqueue another search while
the current request is pending. Non-DPS variants disable the original DPS macro;
recalculating identical inputs resets both the variant and macro state together.

Fresh verification: 456 tests in 59 web files pass; npm run build passes and
generates 23 prerenders. Main JS is 654.55 KB (203.19 KB gzip), CSS 117.32 KB
(22.07 KB gzip). Compared with the preceding planner checkpoint these add
8.75/2.41 KB JS and 4.99/0.79 KB CSS (raw/gzip), not an origin/main baseline.
Existing large-chunk and mixed static/dynamic fixture-import warnings remain.

Real-browser Sorcerer level 1 calculates only Leveling, then renders that exact
plan's key stacks and one F11 macro inline. Changing the level leaves the result
marked Out of date with handoff disabled and Calculate available, without starting
another search. At an effective 390px viewport the document is 378px wide;
quickslots have a 347px scroll region around their 626px content. The chart's
hidden tooltip is contained so desktop positions cannot widen the mobile page.
Fresh Templar guide has no console warnings/errors, and its skill CDN images load.
The browser's mobile screenshot capture showed compositor artifacts; mobile
layout containment was checked through DOM bounds, not inferred from that image.

Preview: http://127.0.0.1:5197/codex/templar and /build. No push. The matching
progression, real-stats and cache-fingerprint integration remains pending; the
levels 22/30/45 engine acceptance above is still required before release.
