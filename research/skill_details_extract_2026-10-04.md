# Skill details extract from the client export (2026-10-04)

Derived numbers only. Source: private export `Content\Data\Table\` (read-only, outside the repo). Machine-readable result: `D:\Aion2-tools\derived\skill_details.json` (outside the repo, class -> our skill key -> fields). Nothing here is a raw row copy. Export build per the folder name: 5.3.2.0 (region not stated).

## 1. Tables and fields used, and how they link

`Skill`, `SkillLv`, `SkillEffect`, `SkillAbnormal` and `SkillAcquireData` decode now (the earlier recon note listed them as not decoded).

| Need | Table.field | Notes |
|---|---|---|
| Skill header | `Skill` (16279 rows), key `ID.Value` = our `skill_id` | Class prefix in the id: 11 Gladiator, 12 Templar, 13 Assassin, 14 Ranger, 15 Sorcerer, 16 Spiritmaster, 17 Cleric, 18 Chanter. |
| Name | L10N `SkillString_<Skill.SkillString_Key>_skill_name` | `Skill.SkillString_Key` = `STR_SKILL_PC_<CLASS>_<id>`. |
| Type | `Skill.SkillType` (Active/Passive), `Skill.bIsStigmaSkill`, `SkillAcquireData.AcquireType` (Stigma/Mastery), `SkillList.SkillListCategory` (Active/Passive/Dp) | Stigma = `bIsStigmaSkill` or acquire type Stigma. |
| Cooldown | `Skill.NeedCoolTime` (ms, float) for rank 1; `SkillLv.NeedCoolTime` for ranks 2..max | `SkillLv` rows are keyed by `Skill.SkillLvGroupId` (`<Class>_Skill<NNN>_LvUp`) + `SkillLv`. 517 skills have a group, the rest are constant. |
| Cast time | `Skill.CastingTime`, `SkillLv.CastingTime` (ms) | 0 on all 5820 player-class skill rows and all 1204 `SkillLv` rows. Charge skills use `SkillCharge` instead (below). |
| MP cost | `Skill.NeedCostMp` (rank 1), `SkillLv.NeedCostMp` | Does not scale with rank on any of the 470 resolved skills. Other costs (`NeedCostHp/Sp/Fp/Dp/Ap`, `SealStoneConsumptionCount`) exist and are not exported. |
| Range | `Skill.NeedSkillUseRange` (client cm, /100 = m) | Ours `range_m` 20.0 = client 2000. `NeedSkillFollowRange` (auto-follow distance) not exported. |
| Unlock level | `SkillAcquireData` (`SkillId`, `SkillLevel` 1) `.NeedCharacterLevel` | Stigmas are all 22 (plus `NeedAscensionGrade`, `CostStigmaPoint` per rank). Per-rank character levels are in the same table (not exported). |
| Max rank | `Skill.SkillLvMax` | 40 mastery, 25 stigma, as in the recon note. |
| Target / AoE | `Skill.SkillEffectTimeDataList[].SkillEffectFilterId` -> `SkillEffectFilter` (`EffectRangeType`, `EffectRangeValues`, `TargetCountMin/Max`); `Skill.TargetProcessType` | Circle/Sphere: `EffectRangeValues[4]` cm = radius (inferred: 400 on a 4-target skill; unconfirmed for other shapes, so the JSON keeps `shape_values_raw`). Primary target block = the slot with the highest `TargetCountMax`. |
| Damage / effect link | `Skill.SkillEffectTimeDataList[].SkillEffectGroupId` -> `SkillEffect.SkillEffectGroupId` (row id = group x10 + n) -> `SkillEffect.SkillEffectLvGroupId` -> `SkillEffectLv` | This is the real link the recon note said was missing. `EffectValueList` layout as in the recon note. For `Abnormal*` effect types, `EffectValueList[2]` = `SkillAbnormal.ID` (`[0]` for `Abnormal_Passive`). |
| Charge | `Skill.ChargeId` -> `SkillCharge.ID` (`ChargeMinTime`, `SkillChargeDataList[{ChargeTime, ChargeSkillId}]`) | The `ChargeSkillId`s are real `Skill` rows (Hellfire 15060001/2/3) with their own damage groups (`..._Charge01_LvUp`). |
| DoT / buff numbers behind an abnormal | `SkillAbnormal` -> `SkillAbnormalEffect.AbnormalId` -> `.AbnormalEffectLvGroupId` -> `SkillAbnormalEffectLv` | Used here only for Apply Poison (section 4). |

JSON fields per skill: `client_id`, `client_name`, `match`, `type`, `list_category`, `max_rank`, `unlock_level`, `cooldown_ms` (+`_by_rank` only if it varies), `cast_time_ms`, `mp_cost`, `range_m`, `target{process,shape,max_targets,radius_m,shape_values_raw,spawns_object}`, `charge{min_ms,tier_ms,tier_skill_ids}`, `links{effect_group_ids,effect_filter_ids,damage_effect_ids,effect_lv_groups,abnormal_ids}`.

Limit of the target block: skills that deal damage through a spawned object (Cold Storm, Fire Wall, the summons; `spawns_object` true) expose only the spawner's Single/Self filter or a side filter. The object's own area lives in the spawned entity's skill, which was not followed. Treat `target.max_targets` as unreliable for those.

## 2. Match to our skill keys (per class)

Match order: (a) our `skill_id` found in `Skill.ID`; (b) our `charge_tier` keys via `SkillCharge.SkillChargeDataList.ChargeSkillId` of the base skill; (c) our skills with no `skill_id`, by exact normalised L10N name, preferring the class prefix, taking the lowest id (the no-specialization variant) when several variants share the name; (d) otherwise not found.

| Class | Our skills | (a) id | (b) charge tier | (c) name | Unmatched |
|---|---|---|---|---|---|
| gladiator | 62 | 58 | 0 | 4 | 0 |
| templar | 46 | 42 | 3 | 1 | 0 |
| assassin | 52 | 50 | 0 | 2 | 0 |
| ranger | 58 | 51 | 3 | 3 | 1 |
| sorcerer | 56 | 51 | 3 | 2 | 0 |
| spiritmaster | 110 | 74 | 0 | 31 | 5 |
| cleric | 44 | 40 | 3 | 1 | 0 |
| chanter | 48 | 45 | 0 | 3 | 0 |
| total | 476 | 411 | 12 | 47 | 6 |

All 8 client `SkillList` HUD lists (35 ids each, 280 total) are fully covered by our keys; none is missing on our side.

Unmatched (6):
- ranger `basic-attack` (Basic Attack) - only generic `ETC` basic attacks [9628, 9631, 9634, 9637, 9640] (one per weapon family), no class link
- spiritmaster `lethargy` (Lethargy) - not found as a `Skill` row
- spiritmaster `pvp-attack-increase` (PvP Attack Increase) - not found as a `Skill` row
- spiritmaster `pvp-critical-hit-resist-increase` (PvP Critical Hit Resist Increase) - not found as a `Skill` row
- spiritmaster `pvp-accuracy-increase` (PvP Accuracy Increase) - not found as a `Skill` row
- spiritmaster `earth-chain` (Earth Chain) - not found as a `Skill` row
- Note: L10N has name strings `STR_SKILL_PC_ELEMENTALIST_100600/100610...` (Lethargy), `..._100510...` (Earth Chain) and `..._109360/109361/109362` (the three PvP buffs; abnormal strings 1093601/1093621/1093611 exist) but no `Skill` row with those ids exists in the decoded table.

Resolved without a `skill_id` (key -> client id; `xN` = N variants share the name, lowest id taken; `[tier]` = via `SkillCharge`):
- gladiator (4): `wave-attack`->11050047, `predation`->11340027 x4, `destruction`->11770007, `rush-strike-max`->11360031 x11
- templar (4): `punishment-level-1`->12090001 [tier], `punishment-level-2`->12090002 [tier], `punishment-max`->12090003 [tier], `shield-rush-max`->12430031 x11
- assassin (2): `clone-attack`->13720005 x5, `poison`->13730007
- ranger (6): `deadshot-lv-1`->14010001 [tier], `deadshot-lv-2`->14010002 [tier], `deadshot-max`->14010003 [tier], `crimson-flames`->14060038 x2, `explosion`->14170001 x15, `root`->14180001 x4
- sorcerer (5): `the-depths`->15300001 x6, `flame-zone`->15060026 x4, `hellfire-level-1`->15060001 [tier], `hellfire-level-2`->15060002 [tier], `hellfire-max`->15060003 [tier]
- spiritmaster (31): `fire-spirit-basic-attack`->100011 x8, `water-spirit-basic-attack`->100021 x9, `wind-spirit-basic-attack`->100031 x9, `earth-spirit-basic-attack`->100041 x8, `ancient-spirit-basic-attack`->100051 x2, `elemental-immunity`->109330 x2, `fire-spirit-flame-explosion`->16001101 x4, `water-spirit-water-bomb`->16001105 x4, `wind-spirit-malicious-whirlwind`->16001109 x4, `earth-spirit-headbutt`->16001113 x4, `ancient-spirit-destruction`->16001117, `fire-spirit-summon-meteor`->16001301 x16, `water-spirit-glacier-harpoon`->16001305 x16, `wind-spirit-storm`->16001313 x16, `earth-spirit-colossal-stalk`->16001309 x16, `ancient-spirit-magnetic-storm`->16001317 x4, `fire-spirit-leaping-slam`->16100001 x8, `water-spirit-discharge-chill`->16110001 x4, `water-spirit-enhanced-discharge-chill`->16110005 x4, `wind-spirit-falling-wind`->16120001 x4, `wind-spirit-enhanced-falling-wind`->16120005 x4, `earth-spirit-tackle`->16130001 x4, `earth-spirit-enhanced-tackle`->16130005 x4, `jointstrike-destructive-attack-lv-1`->16240011 x5, `jointstrike-destructive-attack-lv-2`->16240012 x5, `jointstrike-destructive-attack-max`->16240013 x5, `ancient-spirit-plasma-cannon`->16250001, `elemental-fusion-lv-1`->16300041 x11, `elemental-fusion-lv-2`->16300042 x11, `elemental-fusion-max`->16300043 x11, `dimensional-control-delayed-damage`->16330027
- cleric (4): `bolt-level-1`->17060001 [tier], `bolt-level-2`->17060002 [tier], `bolt-max`->17060003 [tier], `earths-blessing`->17400027 x9
- chanter (3): `rushing-smash-level-1`->18090021 x11, `rushing-smash-level-2`->18090022 x11, `rushing-smash-max`->18090023 x11

## 3. Discrepancies, our gamedata vs client

Compared for the 470 resolved skills, every rank both sides have (ours `ranks[].cooldown_s` x1000, `mp_cost`, and `range_m`). Threshold: difference above 5% of the larger value. Our gamedata has no cast-time field (only `anim_lock_s`), so cast time has nothing to compare; the client value is 0 everywhere.

Result: **cooldown 9 skills differ, MP cost 0, range 4 skills, cast time none (client 0 for all).** Everything else agrees to the unit (461 of 470 cooldowns, 470 of 470 MP costs, 466 of 470 ranges).

| Class | Our key | Client id | Field | Ours | Client | Ranks differing |
|---|---|---|---|---|---|---|
| templar | noble-armor | 12230000 | cooldown | 300 s (rank 1) | 120 s | 25 of 25 |
| ranger | concentrated-fire | 14720000 | cooldown | 1 s (rank 1) | 0 s | 40 of 40 |
| ranger | rooting-eye | 14770000 | cooldown | 1 s (rank 1) | 0 s | 40 of 40 |
| ranger | melee-fire | 14780000 | cooldown | 1 s (rank 1) | 0 s | 40 of 40 |
| ranger | hunters-soul | 14800000 | cooldown | 1 s (rank 1) | 0 s | 40 of 40 |
| cleric | empyrean-lords-grace | 17730000 | cooldown | 1 s (rank 1) | 0 s | 40 of 40 |
| chanter | guardian-blessing | 18420000 | cooldown | 300 s (rank 1) | 120 s | 25 of 25 |
| chanter | raging-spell | 18770000 | cooldown | 1 s (rank 1) | 0 s | 40 of 40 |
| chanter | winds-promise | 18800000 | cooldown | 1 s (rank 1) | 0 s | 40 of 40 |
| gladiator | wrathful-strike-11350000 | 11350000 | range | none | 4 m | 1 of 1 |
| gladiator | predation | 11340027 | range | 50 m | 40 m | 1 of 1 |
| sorcerer | cold-snap | 15080000 | range | none | 20 m | 1 of 1 |
| sorcerer | cold-snap-15730000 | 15730000 | range | 20 m | 0 m | 1 of 1 |

Reading notes:
- Seven of the nine cooldown rows are passives that are 1 s in ours and 0 in the client (Ranger Concentrated Fire, Rooting Eye, Melee Fire, Hunter's Soul; Cleric Empyrean Lord's Grace; Chanter Raging Spell, Wind's Promise).
- Templar Noble Armor and Chanter Guardian Blessing are 300 s in ours and 120 s in the client at every rank.
- Cold Snap: ours has the 20 m range on the passive row `cold-snap-15730000` and none on the proc row `cold-snap` (15080000). The client has it the other way round (15080000 active, 20 m; 15730000 passive, 0).
- Predation (ours 50 m, matched by name, 4 variants) is 40 m on the lowest-id variant 11340027. Wrathful Strike (11350000) is 4 m in the client, none in ours.
- Cooldown scales with rank in the client on 25 skills (Curse: Tree 90 s at rank 1 to 66 s at rank 25, 1 s per rank); MP cost and cast time scale on none. Wherever ours has a per-rank cooldown it equals the client's.

### Secondary differences (not cooldown/cast/MP/range)

| Field | Count | What it is |
|---|---|---|
| max_rank | 54 | All are our derived/child rows with `max_rank` 1 (charge tiers 23, procs 24, chain/system/active 7) while the client row has 25 or 40 (they scale with the parent's rank). Not a data conflict; the ranks beyond 1 are simply absent in ours. |
| rank list length | 59 | Same rows: ours has 1 rank, client 25/40, so ranks 2+ were not compared for cooldown and MP. |
| unlock_level | 105 | Ours has a level, the client has no `SkillAcquireData` row for that id (child, proc, chain, charge-tier skills). No case where both exist and differ; none where only the client has one. |
| aoe_targets | 62 | ours 1 vs client 4 (43), ours 4 vs client 1 (13), other (6). Mostly party heals/buffs (client counts up to 4 recipients) and the spawned-object skills above; low confidence. |
| kind vs client type | 7 | ours `active`, client `stigma`: Doom Advent, Blade Storm, Frenzied Accord, Prepare to Assassinate, Lumiel's Authority. Ours `active`, client `system`: Use Spirit Summon Skill (x2). |

## 4. The 15 previously unmatched skills, resolved

The recon note gave only the counts (Assassin 5, Templar 5, Spiritmaster 5), not the names. These are the 15 I identified. Assassin and Templar are exactly the skills whose flat damage equals no client group (5 each, matching the counts); Spiritmaster is the five summons whose damage group name carries a suffix. If the earlier run listed different 15, the method below still applies to them.

| Class | Our key | Our skill_id | Link to damage rows | Result |
|---|---|---|---|---|
| assassin | quick-slice | 13010000 | `Assassin_Skill001_LvUp`; the name rule finds the group but values differ | client flat x1.07 to x1.10 over ranks 2-40 (rank 1: ours 58, client 61); ratio 70 equal; hits 2 equal |
| assassin | breaking-slice | 13030000 | `Assassin_Skill003_LvUp` | client flat x1.07 to x1.10; ratio 77.5 equal; hits ours 1, client 3 |
| assassin | swift-slice | 13040000 | `Assassin_Skill004_LvUp` | client flat x1.08 to x1.09; ratio 92 equal; hits ours 1, client 4 |
| assassin | insignia-explosion | 13130000 | `Assassin_Skill013_LvUp` (also `_01.._05` at 246.4% to 352% ratio, probably specialization variants, unconfirmed) | client flat x1.10; ratio 220 equal; hits 1 |
| assassin | apply-poison-13730000 | 13730000 | skill 13730000 -> SkillEffect 1373000011 -> abnormal 13730007 (client name Poison) -> SkillAbnormal 137300071 -> SkillAbnormalEffect 1373000712 (`Dot_NormalCalc`) -> `Assassin_Passive003_LvUp_AB2` | flat EXACT (233 rank 1, 314 rank 2, 416 rank 3, 2885 rank 40; 1000 ms tick); client tick ratio 138% ATK vs ours `atk_ratio_pct` 0.0 (missing). Companion groups AB3 and AB3_2 carry the Incoming Heal reduction (14% at lv2 to 90% at lv40 in client units) |
| templar | punishment | 12090000 | `Templar_Skill009_LvUp` (base) and charge skills 12090001/2/3 -> `Templar_Skill009_Charge01/02/03_LvUp` | client flat x1.10; base ratio 430.5 equal; client tier ratios 602.7, 861, 1291.5 vs ours `punishment-level-1/2/max` 0.0 (missing) |
| templar | shield-smite | 12100000 | `Templar_Skill010_LvUp` | client flat x1.20; ratio 175.75 equal |
| templar | annihilate | 12300000 | `Templar_Skill030_LvUp` | client flat x1.10; ratio 321.75 equal |
| templar | warding-strike | 12350000 | `Templar_Skill035_LvUp` (+ `Templar_Skill035_LvUp_Heal`, the heal row) | client flat x1.10; ratio 212.5 equal |
| templar | blade-storm | 12420000 | SkillEffect group 124200001 (1242000011/12 damage, 13 stagger 20, 14 stun 2000 ms abnormal 100000321); no `SkillEffectLvGroupId`, no `SkillLv` rows | EXACT: flat 1174, ratio 205%, constant at all 25 ranks, as ours. Unmatched only because the skill has no level group |
| spiritmaster | summon-fire-spirit | 16100000 | `Elementalist_Skill010_LvUp` is the spawn-parameter group (no damage); damage group `Elementalist_Skill010_LvUp_Fire` | EXACT: flat 118 at lv2, ratio 120, hits 1 |
| spiritmaster | summon-water-spirit | 16110000 | `Elementalist_Skill011_LvUp_Water` | EXACT: flat 204, ratio 145, hits 1 |
| spiritmaster | summon-wind-spirit | 16120000 | `Elementalist_Skill012_LvUp_Wind` (+ `_Wind2`) | EXACT: flat 359, ratio 111, hits 4 |
| spiritmaster | summon-earth-spirit | 16130000 | `Elementalist_Skill013_LvUp_Earth` | EXACT: flat 332, ratio 135, hits 1 |
| spiritmaster | summon-ancient-spirit | 16250000 | `Elementalist_Skill025_LvUp_Ancient` (+ `_Ancient_1`) | EXACT: flat 1230, ratio 189, hits 4 |

Findings from this table:
- 8 of the 15 (Assassin Quick Slice, Breaking Slice, Swift Slice, Insignia Explosion; Templar Punishment, Shield Smite, Annihilate, Warding Strike) are not name-rule failures. The linked client group exists with the same ATK ratio, but its flat damage is a constant 1.07 to 1.20 times ours at every rank. The skills the recon note reported as matching do match exactly, so this looks like a balance change between our 2026-09-18 aion2.app dump and client build 5.3.2.0 rather than a mapping error. Which side matches the live game version is not determined here.
- Spiritmaster summons: the five exact matches use the suffixed groups. The damage belongs to the summoned spirit, so the engine should read it from `..._Fire/_Water/_Wind/_Earth/_Ancient`.
- Hit counts differ from our `hits` 1 for Breaking Slice (client 3) and Swift Slice (client 4). Our value for Wind and Ancient summon (4) equals the client's.

## 5. Caveats

- Cooldown is the base `NeedCoolTime` (ms). The client also has `CoolTimeStat` (cooldown-stat sensitivity) and `NeedCoolTimeMin`, not exported.
- `unlock_level` is the level at rank 1; later ranks gate on higher levels (Winter's Shackles ranks 2-10: 8, 11, 14, 17, 20, 23, 26, 29, 32) and are in `SkillAcquireData`.
- `radius_m` is inferred and only for Circle/Sphere. Spawn-based area skills are not followed.
- Name matching for keyless rows picks the lowest-id variant; the other variants (specializations) have their own cooldown/MP rows and are listed in `variant_ids` in the JSON.
